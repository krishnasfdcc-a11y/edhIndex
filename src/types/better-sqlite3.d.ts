declare module 'better-sqlite3' {
  namespace Database {
    interface Database {
      prepare(sql: string): Statement;
      exec(sql: string): Database;
      pragma(pragma: string, options?: { simple?: boolean }): any;
      function(name: string, cb: (...args: any[]) => any): Database;
      aggregate(name: string, options: any): Database;
      loadExtension(path: string, entryPoint?: string): Database;
      close(): Database;
      defaultSafeIntegers(toggleState?: boolean): Database;
      unsafeMode(unsafe?: boolean): Database;
      transaction(fn: (...args: any[]) => any): (...args: any[]) => any;
      savepoint(fn: (...args: any[]) => any): (...args: any[]) => any;
      checkpoint(databaseName?: string): Database;
      readonly(toggleState?: boolean): Database;
      open: boolean;
      inTransaction: boolean;
      name: string;
      memory: boolean;
      readonly: boolean;
    }

    interface Statement {
      database: Database;
      source: string;
      reader: boolean;
      readonly: boolean;
      busy: boolean;
      run(...params: any[]): RunResult;
      get(...params: any[]): any;
      all(...params: any[]): any[];
      iterate(...params: any[]): IterableIterator<any>;
      pluck(toggleState?: boolean): Statement;
      expand(toggleState?: boolean): Statement;
      raw(toggleState?: boolean): Statement;
      columns(toggleState?: boolean): Statement;
      bind(...params: any[]): Statement;
      safeIntegers(toggleState?: boolean): Statement;
    }

    interface RunResult {
      changes: number;
      lastInsertRowid: number | bigint;
    }
  }

  interface DatabaseConstructor {
    new(filename?: string | Buffer, options?: any): Database.Database;
    (filename?: string | Buffer, options?: any): Database.Database;
  }

  const Database: DatabaseConstructor;
  export = Database;
}
