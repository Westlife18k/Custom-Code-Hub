import { prepareStore } from "./store";

/**
 * Kept for backwards compatibility: schema creation and seeding now live in
 * the store implementations (Postgres or embedded SQLite) behind
 * `prepareStore()`, which the API calls during startup.
 */
export async function bootstrapDatabase(): Promise<void> {
  await prepareStore();
}
