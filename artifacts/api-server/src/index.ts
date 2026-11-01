import app from "./app";
import { prepareStore } from "./lib/store";
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
 * The API always starts: prepareStore() creates the schema and seeds the
 * starter catalogue, retrying a configured Postgres a few times. When no
 * DATABASE_URL is present the embedded SQLite backend is used instead, so
 * packages and orders work on a bare deployment.
 */
const store = await prepareStore();
logger.info({ backend: store.kind }, "Data backend ready");

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
