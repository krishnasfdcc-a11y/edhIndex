import { describe, it, expect, beforeAll } from 'vitest';
import { initParser, loadLanguage, parseContentAsync, extractSymbols, extractImports, extractExports } from './parser.js';

const LANGUAGES = [
  { key: 'ts', name: 'TypeScript' },
  { key: 'js', name: 'JavaScript' },
  { key: 'py', name: 'Python' },
  { key: 'go', name: 'Go' },
  { key: 'rs', name: 'Rust' },
  { key: 'java', name: 'Java' },
  { key: 'rb', name: 'Ruby' },
  { key: 'c', name: 'C' },
  { key: 'cpp', name: 'C++' },
  { key: 'csharp', name: 'C#' },
  { key: 'php', name: 'PHP' },
  { key: 'scala', name: 'Scala' },
  { key: 'hs', name: 'Haskell' },
  { key: 'solidity', name: 'Solidity' },
];

const FILE_ONLY_LANGUAGES = [
  { key: 'css', name: 'CSS' },
  { key: 'json', name: 'JSON' },
  { key: 'html', name: 'HTML' },
];

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
  scala: `object App {
  def hello(): Unit = {}
  class User
  trait Logger
}`,
  hs: `module Main where
hello :: String -> String
hello x = x
class Show a where`,
  solidity: `pragma solidity ^0.8.0;
contract App {
    function hello() external {}
    event Transfer(address indexed from);
}`,
  css: `.btn { color: red; }
#header { font-size: 16px; }`,
  json: `{ "name": "test", "version": "1.0.0" }`,
  html: `<!DOCTYPE html><html><body><p>Hello</p></body></html>`,
};

beforeAll(async () => {
  await initParser();
}, 30000);

for (const { key, name } of LANGUAGES) {
  describe(`${name} (${key})`, () => {
    let tree: any;
    let rootNode: any;

    it('loads WASM grammar', async () => {
      const lang = await loadLanguage(key);
      expect(lang).toBeTruthy();
    }, 15000);

    it('parses content', async () => {
      const result = await parseContentAsync(SAMPLES[key], key);
      tree = result.tree;
      rootNode = result.rootNode;
      expect(rootNode).toBeTruthy();
      expect(rootNode.type).toBeTruthy();
    }, 10000);

    it('extracts symbols', () => {
      const symbols = extractSymbols(tree, key);
      expect(symbols.length).toBeGreaterThan(0);
      for (const sym of symbols) {
        expect(sym.name).toBeTruthy();
        expect(sym.kind).toBeTruthy();
        expect(sym.startLine).toBeGreaterThan(0);
        expect(sym.endLine).toBeGreaterThanOrEqual(sym.startLine);
      }
    });

    it('extracts imports', () => {
      const imports = extractImports(tree, key);
      expect(Array.isArray(imports)).toBe(true);
    });

    it('extracts exports', () => {
      const exports = extractExports(tree, key);
      expect(Array.isArray(exports)).toBe(true);
    });
  });
}

for (const { key, name } of FILE_ONLY_LANGUAGES) {
  describe(`${name} (${key}) — file-level only`, () => {
    let tree: any;

    it('loads WASM grammar', async () => {
      const lang = await loadLanguage(key);
      expect(lang).toBeTruthy();
    }, 15000);

    it('parses content', async () => {
      const result = await parseContentAsync(SAMPLES[key], key);
      tree = result.tree;
      expect(result.rootNode).toBeTruthy();
    }, 10000);

    it('extracts symbols (may be empty)', () => {
      const symbols = extractSymbols(tree, key);
      expect(Array.isArray(symbols)).toBe(true);
    });
  });
}
