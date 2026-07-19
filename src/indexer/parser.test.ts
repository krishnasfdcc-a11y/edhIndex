import { describe, it, expect, beforeAll } from 'vitest';
import { LanguageRegistry } from '../language/registry.js';

const registry = new LanguageRegistry();
const adapters = registry.getInfoList().filter(a => a.key !== 'generic');

describe('Language Adapter Registry', () => {
  it('registers all adapters', () => {
    expect(adapters.length).toBeGreaterThan(0);
    expect(adapters.find(a => a.key === 'ts')).toBeTruthy();
    expect(adapters.find(a => a.key === 'py')).toBeTruthy();
    expect(adapters.find(a => a.key === 'go')).toBeTruthy();
    expect(adapters.find(a => a.key === 'rs')).toBeTruthy();
    expect(adapters.find(a => a.key === 'java')).toBeTruthy();
    expect(adapters.find(a => a.key === 'html')).toBeTruthy();
    expect(adapters.find(a => a.key === 'css')).toBeTruthy();
    expect(adapters.find(a => a.key === 'json')).toBeTruthy();
  });

  it('maps file extensions to correct adapters', () => {
    expect(registry.getAdapter('file.ts').key).toBe('ts');
    expect(registry.getAdapter('file.js').key).toBe('js');
    expect(registry.getAdapter('file.py').key).toBe('py');
    expect(registry.getAdapter('file.go').key).toBe('go');
    expect(registry.getAdapter('file.rs').key).toBe('rs');
    expect(registry.getAdapter('file.java').key).toBe('java');
    expect(registry.getAdapter('file.rb').key).toBe('rb');
    expect(registry.getAdapter('file.c').key).toBe('c');
    expect(registry.getAdapter('file.cpp').key).toBe('cpp');
    expect(registry.getAdapter('file.cs').key).toBe('csharp');
    expect(registry.getAdapter('file.php').key).toBe('php');
    expect(registry.getAdapter('file.html').key).toBe('html');
    expect(registry.getAdapter('file.css').key).toBe('css');
    expect(registry.getAdapter('file.json').key).toBe('json');
  });

  it('returns generic for unknown extensions', () => {
    const { adapter, key } = registry.getAdapter('file.xyz');
    expect(key).toBe('generic');
    expect(adapter.languageName()).toBe('Generic');
  });
});

const SAMPLES: Record<string, string> = {
  ts: `import { readFileSync } from 'node:fs';
export interface Config { name: string }
export class App { start() {} }
function helper() {}`,
  js: `const { join } = require('node:path');
class App { constructor() { this.name = 'app'; } }
function helper() {}`,
  py: `import os
def hello(name):
    pass
class App:
    def start(self):
        pass`,
  go: `package main
import "fmt"
func hello() {}
func (a App) Start() {}`,
  rs: `use std::fs;
pub struct User { name: String }
pub trait Runner { fn run(&self); }
pub fn hello() -> String { "hi".into() }
enum Color { Red, Green }`,
  java: `import java.util.List;
public class App {
    public void start() {}
    public interface Handler { void handle(); }
}`,
  rb: `require 'json'
module App
  class User
    def login; end
  end
end`,
  c: `#include <stdio.h>
struct Point { int x; int y; };
void hello() { printf("hi"); }`,
  cpp: `#include <vector>
class App { void start() {} };
struct Point { int x; };
void hello() {}`,
  csharp: `using System;
class App { void Start() {} }
interface IHandler { void Handle(); }`,
  php: `<?php
function hello() {}
class App {
    public function start() {}
}`,
  json: `{ "name": "test", "version": "1.0.0" }`,
  css: `.btn { color: red; }
#header { font-size: 16px; }`,
  html: `<!DOCTYPE html><html><body><p>Hello</p></body></html>`,
};

for (const info of adapters) {
  const sample = SAMPLES[info.key];
  if (!sample) continue;

  describe(`${info.name} (${info.key})`, () => {
    const { adapter } = registry.getAdapter(`file.${info.extensions[0]?.replace('.', '') || 'txt'}`);

    it('parses content', async () => {
      const result = await adapter.parse(sample, `file${info.extensions[0] || ''}`);
      expect(result).toBeTruthy();
      expect(Array.isArray(result.symbols)).toBe(true);
      expect(Array.isArray(result.imports)).toBe(true);
      expect(Array.isArray(result.exports)).toBe(true);
    }, 30000);

    if (info.supportsSymbols) {
      it('extracts symbols', async () => {
        const result = await adapter.parse(sample, `file${info.extensions[0] || ''}`);
        expect(result.symbols.length).toBeGreaterThan(0);
        for (const sym of result.symbols) {
          expect(sym.name).toBeTruthy();
          expect(sym.type).toBeTruthy();
          expect(sym.startLine).toBeGreaterThan(0);
          expect(sym.endLine).toBeGreaterThanOrEqual(sym.startLine);
        }
      }, 30000);
    }
  });
}
