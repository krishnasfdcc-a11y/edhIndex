export enum LogLevel {
  Silent = 0,
  Info = 1,
  Verbose = 2,
  Debug = 3,
}

const levelNames: Record<LogLevel, string> = {
  [LogLevel.Silent]: 'SILENT',
  [LogLevel.Info]: 'INFO',
  [LogLevel.Verbose]: 'VERBOSE',
  [LogLevel.Debug]: 'DEBUG',
};

let currentLevel = LogLevel.Info;

export function setLogLevel(level: LogLevel) {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

function log(level: LogLevel, ...args: unknown[]) {
  if (level <= currentLevel) {
    const prefix = levelNames[level];
    const timestamp = new Date().toISOString();
    if (level === LogLevel.Debug) {
      console.error(`[${timestamp}] [${prefix}]`, ...args);
    } else if (level === LogLevel.Info) {
      console.error(...args);
    } else {
      console.error(`[${prefix}]`, ...args);
    }
  }
}

export const logger = {
  info: (...args: unknown[]) => log(LogLevel.Info, ...args),
  verbose: (...args: unknown[]) => log(LogLevel.Verbose, ...args),
  debug: (...args: unknown[]) => log(LogLevel.Debug, ...args),
  error: (...args: unknown[]) => console.error(...args),
};
