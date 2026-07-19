const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { join, relative, resolve } = require('node:path');
const { createHash, randomBytes } = require('node:crypto');
const { EventEmitter } = require('node:events');

const API_BASE = 'https://api.example.com';
const DEFAULT_TIMEOUT = 5000;

class BaseService {
  constructor(baseUrl, timeout = DEFAULT_TIMEOUT) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  log(method, path) {
    console.log(`[${method}] ${path}`);
  }
}

class UserService extends BaseService {
  constructor() {
    super(`${API_BASE}/users`);
    this.users = new Map();
    this.emitter = new EventEmitter();
  }

  async getUser(id) {
    const user = this.users.get(id);
    if (!user) {
      return { status: 404, data: null, message: 'Not found', timestamp: Date.now() };
    }
    this.emitter.emit('user:fetched', user);
    return { status: 200, data: user, message: 'OK', timestamp: Date.now() };
  }

  async createUser(config) {
    const id = randomBytes(16).toString('hex');
    this.users.set(id, config);
    this.emitter.emit('user:created', config);
    return { status: 201, data: config, message: 'Created', timestamp: Date.now() };
  }

  async updateUser(id, updates) {
    const existing = this.users.get(id);
    if (!existing) {
      return { status: 404, data: null, message: 'Not found', timestamp: Date.now() };
    }
    const updated = { ...existing, ...updates };
    this.users.set(id, updated);
    this.emitter.emit('user:updated', updated);
    return { status: 200, data: updated, message: 'Updated', timestamp: Date.now() };
  }

  async deleteUser(id) {
    const deleted = this.users.delete(id);
    if (!deleted) {
      return { status: 404, data: null, message: 'Not found', timestamp: Date.now() };
    }
    this.emitter.emit('user:deleted', id);
    return { status: 200, data: null, message: 'Deleted', timestamp: Date.now() };
  }

  listUsers() {
    return Array.from(this.users.values());
  }

  on(event, handler) {
    this.emitter.on(event, handler);
  }
}

function calculateHash(input) {
  return createHash('sha256').update(input, 'utf-8').digest('hex');
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function paginate(items, page, perPage) {
  const start = (page - 1) * perPage;
  const end = start + perPage;
  return {
    items: items.slice(start, end),
    total: items.length,
    pages: Math.ceil(items.length / perPage),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retry(fn, retries, delay) {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await sleep(delay);
    return retry(fn, retries - 1, delay);
  }
}

function formatDate(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

function parseConfig(path) {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw);
}

module.exports = { UserService, BaseService, calculateHash, validateEmail, paginate, retry, formatDate, parseConfig };
