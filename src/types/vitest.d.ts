declare module 'vitest' {
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn?: () => void | Promise<void>, timeout?: number): void;
  export function test(name: string, fn?: () => void | Promise<void>, timeout?: number): void;
  export function expect(actual: any): any;
  export function beforeAll(fn: () => void | Promise<void>, timeout?: number): void;
  export function afterAll(fn: () => void | Promise<void>, timeout?: number): void;
  export function beforeEach(fn: () => void | Promise<void>, timeout?: number): void;
  export function afterEach(fn: () => void | Promise<void>, timeout?: number): void;
}

