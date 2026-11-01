import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

type Database = ReturnType<typeof drizzle<typeof schema>>;

let cachedPool: pg.Pool | null = null;
let cachedDb: Database | null = null;

/**
 * Thrown when a data route is used without a provisioned database. Importing
 * this module never throws, so the API can still boot (and serve /api/healthz
 * plus the static storefront) before DATABASE_URL is configured.
 */
export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
    this.name = "DatabaseNotConfiguredError";
  }
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env["DATABASE_URL"]?.trim());
}

export function getPool(): pg.Pool {
  if (!isDatabaseConfigured()) throw new DatabaseNotConfiguredError();
  if (!cachedPool) {
    cachedPool = new Pool({ connectionString: process.env["DATABASE_URL"] });
  }
  return cachedPool;
}

export function getDb(): Database {
  if (!cachedDb) {
    cachedDb = drizzle(getPool(), { schema });
  }
  return cachedDb;
}

/**
 * Lazily resolved proxies so existing `db.select(...)` / `db.execute(...)`
 * call sites keep working while the connection itself is only created on the
 * first real query.
 */
function lazyProxy<T extends object>(resolve: () => T): T {
  return new Proxy({} as T, {
    get(_target, property, receiver) {
      const value = Reflect.get(resolve(), property, receiver);
      return typeof value === "function" ? value.bind(resolve()) : value;
    },
    has(_target, property) {
      return Reflect.has(resolve(), property);
    },
  });
}

export const pool: pg.Pool = lazyProxy(getPool);
export const db: Database = lazyProxy(getDb);

export * from "./schema";
