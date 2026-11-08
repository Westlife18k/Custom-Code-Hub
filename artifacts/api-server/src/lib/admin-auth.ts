import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Owner sign-in for the admin panel.
 *
 * The password lives only in the `ADMIN_PASSWORD` environment variable: it is
 * never sent to the browser, never stored in the repository and never returned
 * by an endpoint. A successful login exchanges it for a short-lived,
 * HMAC-signed token that the panel keeps in sessionStorage.
 */
const PASSWORD_ENV = "ADMIN_PASSWORD";
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const TOKEN_SCOPE = "admin";

export function isAdminConfigured(): boolean {
  return Boolean(process.env[PASSWORD_ENV]?.trim());
}

function adminPassword(): string {
  return process.env[PASSWORD_ENV]?.trim() ?? "";
}

/** Derived signing key, so the raw password is not used as the HMAC key. */
function signingKey(): Buffer {
  return createHash("sha256").update(`bch-admin-session:${adminPassword()}`).digest();
}

/** Constant-time comparison of SHA-256 digests (equal lengths by construction). */
export function passwordMatches(candidate: string): boolean {
  const expected = adminPassword();
  if (!expected) return false;

  const given = createHash("sha256").update(candidate).digest();
  const want = createHash("sha256").update(expected).digest();
  return timingSafeEqual(given, want);
}

export type AdminSession = { token: string; expiresAt: number };

export function issueAdminToken(): AdminSession {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${TOKEN_SCOPE}.${expiresAt}`;
  const signature = createHmac("sha256", signingKey()).update(payload).digest("base64url");
  return { token: `${payload}.${signature}`, expiresAt };
}

export function verifyAdminToken(token: string | null | undefined): boolean {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [scope, rawExpiry, signature] = parts;
  if (scope !== TOKEN_SCOPE) return false;

  const expiresAt = Number(rawExpiry);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

  const expected = createHmac("sha256", signingKey())
    .update(`${TOKEN_SCOPE}.${rawExpiry}`)
    .digest("base64url");

  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length) return false;
  return timingSafeEqual(given, want);
}
