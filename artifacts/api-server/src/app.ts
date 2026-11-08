import fs from "node:fs";
import path from "node:path";

import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.set("trust proxy", true);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());

// Paystack signs the raw request body, so these paths must be parsed as a
// Buffer before the JSON body parser consumes them. Both the order webhook and
// the wallet deposit webhook share the same signature scheme.
app.use(["/api/payments/webhook", "/api/deposits/webhook"], express.raw({ type: "*/*", limit: "1mb" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

/**
 * Serve the built storefront from the same origin as the API. In development
 * the Vite dev server handles the UI and this falls through.
 */
const staticDir = path.resolve(
  process.env["STATIC_DIR"]?.trim() || path.join(process.cwd(), "..", "bet-code-hub-storefront", "dist", "public"),
);
const indexHtml = path.join(staticDir, "index.html");
const hasStaticBuild = fs.existsSync(indexHtml);

if (hasStaticBuild) {
  app.use(express.static(staticDir, { index: false }));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(indexHtml);
  });
} else {
  logger.warn({ staticDir }, "No storefront build found; serving API only");
}

app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const issues = (error as { issues?: { path: (string | number)[]; message: string }[] })?.issues;

  // The API boots without a database so the storefront and /api/healthz stay
  // available; data routes report a clear 503 instead of a generic 500.
  if ((error as { name?: string })?.name === "DatabaseNotConfiguredError") {
    logger.error({ err: error }, "Data route called without DATABASE_URL");
    res.status(503).json({
      error: "The store database is not configured yet. Set DATABASE_URL to enable packages and orders.",
    });
    return;
  }

  if (Array.isArray(issues)) {
    res.status(400).json({
      error: issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; "),
    });
    return;
  }

  const message = error instanceof Error ? error.message : "Unexpected server error";
  logger.error({ err: error }, "Unhandled request error");
  res.status(500).json({ error: message });
});

export default app;
