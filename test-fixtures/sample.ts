import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';

export interface UserConfig {
  name: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  settings?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  status: number;
  data: T;
  message: string;
  timestamp: number;
}

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
}

export abstract class BaseService {
  protected baseUrl: string;
  protected timeout: number;

  constructor(baseUrl: string, timeout = 5000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  abstract handle(data: unknown): Promise<ApiResponse<unknown>>;

  protected log(method: string, path: string): void {
    console.log(`[${method}] ${path}`);
  }
}

export class UserService extends BaseService {
  private users: Map<string, UserConfig> = new Map();
  private emitter: EventEmitter = new EventEmitter();

  constructor() {
    super('https://api.example.com/users');
  }

  async handle(data: unknown): Promise<ApiResponse<unknown>> {
    return this.getUser(data as string);
  }

  async getUser(id: string): Promise<ApiResponse<UserConfig>> {
    const user = this.users.get(id);
    if (!user) {
      return { status: 404, data: null as unknown as UserConfig, message: 'Not found', timestamp: Date.now() };
    }
    this.emitter.emit('user:fetched', user);
    return { status: 200, data: user, message: 'OK', timestamp: Date.now() };
  }

  async createUser(config: UserConfig): Promise<ApiResponse<UserConfig>> {
    const id = randomBytes(16).toString('hex');
    this.users.set(id, config);
    this.emitter.emit('user:created', config);
    return { status: 201, data: config, message: 'Created', timestamp: Date.now() };
  }

  async deleteUser(id: string): Promise<ApiResponse<null>> {
    const deleted = this.users.delete(id);
    if (!deleted) {
      return { status: 404, data: null, message: 'Not found', timestamp: Date.now() };
    }
    this.emitter.emit('user:deleted', id);
    return { status: 200, data: null, message: 'Deleted', timestamp: Date.now() };
  }

  on(event: string, handler: (...args: unknown[]) => void): void {
    this.emitter.on(event, handler);
  }
}

function calculateHash(input: string): string {
  return createHash('sha256').update(input, 'utf-8').digest('hex');
}

function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function paginate<T>(items: T[], page: number, perPage: number): { items: T[]; total: number; pages: number } {
  const start = (page - 1) * perPage;
  const end = start + perPage;
  return { items: items.slice(start, end), total: items.length, pages: Math.ceil(items.length / perPage) };
}

function retry<T>(fn: () => Promise<T>, retries: number, delay: number): Promise<T> {
  return fn().catch((err) => {
    if (retries <= 0) throw err;
    return new Promise((resolve) => setTimeout(resolve, delay)).then(() => retry(fn, retries - 1, delay));
  });
}

const DEFAULT_CONFIG: UserConfig = {
  name: 'Guest',
  email: 'guest@example.com',
  role: 'viewer',
};

export { calculateHash, validateEmail, paginate, retry, DEFAULT_CONFIG };
