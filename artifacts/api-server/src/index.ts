import app from "./app";
import { bootstrapDatabase } from "./lib/bootstrap-db";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

/**
 * The API can start without a reachable database so /api/healthz still reports
 * liveness, but every data route will then fail until Postgres is available.
 */
async function prepareDatabase(): Promise<void> {
  if (!process.env["DATABASE_URL"]) {
    logger.error("DATABASE_URL is not set; package and order routes will fail");
    return;
  }

  const attempts = 5;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await bootstrapDatabase();
      return;
    } catch (error) {
      logger.error({ err: error, attempt, attempts }, "Database bootstrap failed");
      if (attempt === attempts) return;
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }
}

await prepareDatabase();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
