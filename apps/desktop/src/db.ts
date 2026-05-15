import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { SQLInputValue } from "node:sqlite";

export interface DbTransaction {
  execute(sql: string, params?: ReadonlyArray<unknown>): Promise<void>;
  query<T>(sql: string, params?: ReadonlyArray<unknown>): Promise<T[]>;
}

export interface TransactionRunner {
  runInTransaction<T>(work: (tx: DbTransaction) => Promise<T>): Promise<T>;
}

export class SqliteTransactionRunner implements TransactionRunner {
  private readonly db: DatabaseSync;

  constructor(databaseFile: string) {
    mkdirSync(dirname(databaseFile), { recursive: true });
    this.db = new DatabaseSync(databaseFile);
    this.db.exec("PRAGMA foreign_keys = ON;");
  }

  applySchemaFile(schemaFile: string): void {
    const sql = readFileSync(schemaFile, "utf8");
    this.db.exec(sql);
  }

  async runInTransaction<T>(work: (tx: DbTransaction) => Promise<T>): Promise<T> {
    this.db.exec("BEGIN IMMEDIATE;");

    const tx: DbTransaction = {
      execute: async (sql: string, params: ReadonlyArray<unknown> = []): Promise<void> => {
        this.db.prepare(sql).run(...toSqliteParams(params));
      },
      query: async <T>(sql: string, params: ReadonlyArray<unknown> = []): Promise<T[]> => {
        return this.db.prepare(sql).all(...toSqliteParams(params)) as T[];
      }
    };

    try {
      const result = await work(tx);
      this.db.exec("COMMIT;");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK;");
      throw error;
    }
  }

  execute(sql: string, params: ReadonlyArray<unknown> = []): void {
    this.db.prepare(sql).run(...toSqliteParams(params));
  }

  query<T>(sql: string, params: ReadonlyArray<unknown> = []): T[] {
    return this.db.prepare(sql).all(...toSqliteParams(params)) as T[];
  }

  close(): void {
    this.db.close();
  }
}

function toSqliteParams(params: ReadonlyArray<unknown>): SQLInputValue[] {
  return params as SQLInputValue[];
}

export function resolveProjectPath(...segments: string[]): string {
  return resolve(process.cwd(), ...segments);
}
