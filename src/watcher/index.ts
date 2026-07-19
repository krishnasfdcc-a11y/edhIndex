import { join, relative } from 'node:path';
import { logger } from '../logging.js';
import { emitProgress } from '../progress.js';

type ChangeHandler = (filePath: string) => Promise<void>;

export class FileWatcher {
  private watcher: any = null;
  private rootPath: string;
  private onFileChange: ChangeHandler;
  private timeoutId: any = null;
  private pending = new Set<string>();
  private debounceMs: number;

  constructor(rootPath: string, onChange: ChangeHandler, debounceMs = 300) {
    this.rootPath = rootPath;
    this.onFileChange = onChange;
    this.debounceMs = debounceMs;
  }

  async start(): Promise<void> {
    const chokidar = await import('chokidar');
    const { createIgnoreRules } = await import('../indexer/ignore.js');
    const ignore = createIgnoreRules(this.rootPath);

    this.watcher = chokidar.watch(this.rootPath, {
      ignored: (path: string) => {
        const rel = relative(this.rootPath, path).replace(/\\/g, '/');
        return ignore.isIgnored(rel);
      },
      persistent: true,
      ignoreInitial: true,
      depth: 99,
    });

    this.watcher.on('change', (path: string) => this.queueChange(path));
    this.watcher.on('add', (path: string) => this.queueChange(path));
    this.watcher.on('unlink', (path: string) => this.queueChange(path));

    logger.info('File watcher started');
  }

  private queueChange(filePath: string) {
    const rel = relative(this.rootPath, filePath).replace(/\\/g, '/');
    this.pending.add(rel);

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(async () => {
      const batch = Array.from(this.pending);
      this.pending.clear();
      this.timeoutId = null;

      for (const file of batch) {
        try {
          logger.debug(`File changed: ${file}`);
          await this.onFileChange(file);
        } catch (e) {
          logger.debug(`Failed to handle file change ${file}:`, e);
        }
      }
    }, this.debounceMs);
  }

  async stop(): Promise<void> {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }
}
