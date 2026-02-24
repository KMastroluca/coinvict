import fs from 'node:fs';

export interface Env {
  INTENTDB: D1Database;
  BLOCKCHAINDB: D1Database;
  KEYSTOREDB: D1Database;
  MASTERLEDGERDB: D1Database;
}

/**
 * Core Database Wrapper for Cloudflare D1
 */
export class Database {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }
  
  async loadsqlfile(filepath:string):Promise<void> {
      try {
          fs.readFileSync(filepath, 'r', 'utf-8', (result) => {
              await this.db.exec(result);
              console.log("Loaded ", filepath);
          });
      }
      catch(error) {
          console.error("Error: ", error)
      }
  }

  async create_table(sql: string): Promise<void> {
    // expects full CREATE TABLE statement
    await this.db.exec(sql);
  }

  async drop_table(table: string): Promise<void> {
    await this.db.exec(`DROP TABLE IF EXISTS ${this.escapeId(table)};`);
  }

  select(table: string): SelectBuilder {
    return new SelectBuilder(this.db, table);
  }

  private escapeId(identifier: string): string {
    return `"${identifier.replace(/"/g, "")}"`;
  }
}

/**
 * SELECT Builder
 */
class SelectBuilder {
  private db: D1Database;
  private table: string;
  private conditions: string[] = [];
  private params: unknown[] = [];

  constructor(db: D1Database, table: string) {
    this.db = db;
    this.table = table;
  }

  where(condition: ConditionBuilder): this {
    const { sql, params } = condition.build();
    this.conditions.push(sql);
    this.params.push(...params);
    return this;
  }

  async all<T = any>(): Promise<T[]> {
    const { sql, params } = this.buildQuery();
    const stmt = this.db.prepare(sql).bind(...params);
    const { results } = await stmt.all<T>();
    return results ?? [];
  }

  async first<T = any>(): Promise<T | null> {
    const { sql, params } = this.buildQuery();
    const stmt = this.db.prepare(sql).bind(...params);
    const { results } = await stmt.first<T>();
    return results ?? null;
  }

  private buildQuery(): { sql: string; params: unknown[] } {
    let sql = `SELECT * FROM "${this.table}"`;

    if (this.conditions.length > 0) {
      sql += ` WHERE ${this.conditions.join(" AND ")}`;
    }

    return { sql, params: this.params };
  }
}

/**
 * Condition Builder Entry
 */
export function value(column: string): ConditionBuilder {
  return new ConditionBuilder(column);
}

/**
 * Condition Builder
 */
class ConditionBuilder {
  private column: string;
  private operator?: string;
  private compareValue?: unknown;

  constructor(column: string) {
    this.column = column;
  }

  eq(val: unknown): this {
    this.operator = "=";
    this.compareValue = val;
    return this;
  }

  neq(val: unknown): this {
    this.operator = "!=";
    this.compareValue = val;
    return this;
  }

  gt(val: unknown): this {
    this.operator = ">";
    this.compareValue = val;
    return this;
  }

  lt(val: unknown): this {
    this.operator = "<";
    this.compareValue = val;
    return this;
  }

  build(): { sql: string; params: unknown[] } {
    if (!this.operator) {
      throw new Error("No operator specified in condition.");
    }

    return {
      sql: `"${this.column}" ${this.operator} ?`,
      params: [this.compareValue],
    };
  }
}