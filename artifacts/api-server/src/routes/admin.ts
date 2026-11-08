import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";

import {
  isAdminConfigured,
  issueAdminToken,
  passwordMatches,
  verifyAdminToken,
} from "../lib/admin-auth";
import { getStore } from "../lib/store";
import type { UpdatePackageInput } from "../lib/store/types";

/**
 * Owner-only catalogue management.
 *
 * Every route below the login is behind `requireAdmin`, so the betting codes
 * and prices can only be read or changed with a valid owner session. Codes are
 * never exposed by the public catalogue endpoints.
 */
const router: IRouter = Router();

const MIN_PESEWAS = 100;
const MAX_PESEWAS = 1_000_000;

/** Owner input errors are the only ones surfaced verbatim to the panel. */
class AdminInputError extends Error {}

type Body = Record<string, unknown>;

// --- Login throttling -------------------------------------------------------
// In-memory and per-instance: enough to make password guessing impractical
// without adding a dependency or shared state.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, { count: number; resetAt: number }>();

function clientKey(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

function tooManyAttempts(req: Request): boolean {
  const entry = attempts.get(clientKey(req));
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    attempts.delete(clientKey(req));
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(req: Request): void {
  const key = clientKey(req);
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  entry.count += 1;
}

function clearFailures(req: Request): void {
  attempts.delete(clientKey(req));
}

// --- Helpers ----------------------------------------------------------------

function bearerToken(req: Request): string | null {
  const header = req.headers["authorization"];
  if (typeof header !== "string") return null;

  const [scheme, token] = header.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!isAdminConfigured()) {
    res.status(503).json({
      error:
        "Owner sign-in is not set up yet. Add an ADMIN_PASSWORD environment variable to this app, then reload.",
    });
    return;
  }

  if (!verifyAdminToken(bearerToken(req))) {
    res.status(401).json({ error: "Please sign in again to manage codes." });
    return;
  }

  next();
}

function text(
  body: Body,
  key: string,
  label: string,
  max: number,
  required: boolean,
): string | null | undefined {
  const raw = body[key];

  if (raw === undefined) {
    if (required) throw new AdminInputError(`${label} is required.`);
    return undefined;
  }

  if (raw === null) return null;

  if (typeof raw !== "string") throw new AdminInputError(`${label} must be text.`);

  const value = raw.trim();

  if (!value) {
    if (required) throw new AdminInputError(`${label} cannot be empty.`);
    return null;
  }

  if (value.length > max) {
    throw new AdminInputError(`${label} must be ${max} characters or fewer.`);
  }

  return value;
}

function requiredText(body: Body, key: string, label: string, max: number): string {
  const value = text(body, key, label, max, true);
  if (!value) throw new AdminInputError(`${label} cannot be empty.`);
  return value;
}

/** Accepts either an exact pesewa value or a GHS amount typed by the owner. */
function amountPesewas(body: Body): number | undefined {
  const hasPesewas = body["pricePesewas"] !== undefined;
  const hasGhs = body["amountGhs"] !== undefined;

  if (!hasPesewas && !hasGhs) return undefined;

  const raw = hasPesewas ? body["pricePesewas"] : body["amountGhs"];
  const numeric =
    typeof raw === "string" ? Number(raw.replace(/[^0-9.]/g, "")) : Number(raw);

  if (!Number.isFinite(numeric)) {
    throw new AdminInputError("Amount must be a number, for example 25 or 25.50.");
  }

  const pesewas = Math.round(hasPesewas ? numeric : numeric * 100);

  if (!Number.isInteger(pesewas) || pesewas < MIN_PESEWAS || pesewas > MAX_PESEWAS) {
    throw new AdminInputError(
      "Amount must be between GH₵1.00 and GH₵10,000.00.",
    );
  }

  return pesewas;
}

function matchCount(body: Body): number | null | undefined {
  const raw = body["matchCount"];

  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;

  const value = Number(raw);

  if (!Number.isInteger(value) || value < 0 || value > 60) {
    throw new AdminInputError("Selections must be a whole number between 0 and 60.");
  }

  return value;
}

function activeFlag(body: Body): boolean | undefined {
  const raw = body["active"];

  if (raw === undefined) return undefined;
  if (typeof raw === "boolean") return raw;
  if (raw === "true" || raw === 1 || raw === "1") return true;
  if (raw === "false" || raw === 0 || raw === "0") return false;

  throw new AdminInputError("Active must be true or false.");
}

function fail(
  res: Response,
  next: NextFunction,
  error: unknown,
): void {
  if (error instanceof AdminInputError) {
    res.status(400).json({ error: error.message });
    return;
  }

  next(error);
}

// --- Routes -----------------------------------------------------------------

router.get("/admin/status", (_req, res) => {
  res.json({ configured: isAdminConfigured() });
});

router.post("/admin/login", (req, res) => {
  if (!isAdminConfigured()) {
    res.status(503).json({
      error:
        "Owner sign-in is not set up yet. Add an ADMIN_PASSWORD environment variable to this app, then reload.",
    });
    return;
  }

  if (tooManyAttempts(req)) {
    res
      .status(429)
      .json({ error: "Too many sign-in attempts. Please wait a few minutes." });
    return;
  }

  const body = (req.body ?? {}) as Body;
  const password = body["password"];

  if (typeof password !== "string" || !passwordMatches(password)) {
    recordFailure(req);
    res.status(401).json({ error: "That password is not correct." });
    return;
  }

  clearFailures(req);
  const session = issueAdminToken();

  res.json({
    token: session.token,
    expiresAt: new Date(session.expiresAt).toISOString(),
  });
});

router.get("/admin/codes", requireAdmin, async (_req, res, next) => {
  try {
    res.json({ codes: await getStore().listAllPackages() });
  } catch (error) {
    fail(res, next, error);
  }
});

router.post("/admin/codes", requireAdmin, async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as Body;

    const title = requiredText(body, "title", "Title", 120);
    const bettingCode = requiredText(body, "bettingCode", "Code", 80);
    const price = amountPesewas(body);

    if (price === undefined) {
      throw new AdminInputError("Amount is required.");
    }

    const created = await getStore().createPackage({
      title,
      bettingCode,
      pricePesewas: price,
      description: text(body, "description", "Description", 400, false) ?? null,
      totalOdds: text(body, "totalOdds", "Total odds", 12, false) ?? null,
      matchCount: matchCount(body) ?? null,
      active: activeFlag(body) ?? true,
    });

    res.status(201).json(created);
  } catch (error) {
    fail(res, next, error);
  }
});

router.patch("/admin/codes/:id", requireAdmin, async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as Body;
    const patch: UpdatePackageInput = {};

    if ("title" in body) patch.title = requiredText(body, "title", "Title", 120);
    if ("bettingCode" in body) {
      patch.bettingCode = requiredText(body, "bettingCode", "Code", 80);
    }
    if ("description" in body) {
      patch.description = text(body, "description", "Description", 400, false) ?? null;
    }
    if ("totalOdds" in body) {
      patch.totalOdds = text(body, "totalOdds", "Total odds", 12, false) ?? null;
    }
    if ("pricePesewas" in body || "amountGhs" in body) {
      patch.pricePesewas = amountPesewas(body);
    }
    if ("matchCount" in body) patch.matchCount = matchCount(body) ?? null;
    if ("active" in body) patch.active = activeFlag(body);

    if (Object.keys(patch).length === 0) {
      throw new AdminInputError("Nothing to update.");
    }

    const updated = await getStore().updatePackage(String(req.params["id"]), patch);

    if (!updated) {
      res.status(404).json({ error: "That code no longer exists." });
      return;
    }

    res.json(updated);
  } catch (error) {
    fail(res, next, error);
  }
});

router.delete("/admin/codes/:id", requireAdmin, async (req, res, next) => {
  try {
    const outcome = await getStore().deletePackage(String(req.params["id"]));

    if (outcome === "not_found") {
      res.status(404).json({ error: "That code no longer exists." });
      return;
    }

    if (outcome === "has_orders") {
      res.status(409).json({
        error:
          "This code has already been sold, so it cannot be deleted. Turn it off instead to hide it from the storefront.",
      });
      return;
    }

    res.json({ deleted: true });
  } catch (error) {
    fail(res, next, error);
  }
});

export default router;
