// Minimal types for Node's built-in SQLite module (node:sqlite).
// The installed @types/node (v20) predates it, so only what lib/db.ts uses is declared here.
declare module "node:sqlite" {
  type SQLValue = null | number | bigint | string | Uint8Array;

  interface StatementSync {
    run(...params: SQLValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    get(...params: SQLValue[]): Record<string, SQLValue> | undefined;
    all(...params: SQLValue[]): Record<string, SQLValue>[];
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
