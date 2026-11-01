# syntax=docker/dockerfile:1
# Bet Code Hub: Express API (bundled with esbuild) + Vite storefront served by that API.
# ---------------------------------------------------------------------------
# Stage 1: build the API bundle and the storefront assets
# ---------------------------------------------------------------------------
FROM node:24-alpine AS build

# Patch OS packages and add the small toolchain esbuild/rollup can need on musl.
RUN apk upgrade --no-cache \
 && apk add --no-cache libstdc++ \
 && rm -rf /var/cache/apk/*

WORKDIR /app

RUN npm install -g pnpm@10

ENV CI=1

# Copy the whole workspace so the pnpm lockfile and every workspace package match.
COPY . .

# Drop any node_modules that came from the build context so the install is clean.
RUN rm -rf node_modules artifacts/*/node_modules lib/*/node_modules scripts/node_modules

RUN pnpm install --frozen-lockfile

# Build the API server bundle (artifacts/api-server/dist) and the storefront (dist/public).
RUN pnpm --filter @workspace/api-server run build \
 && pnpm --filter @workspace/bet-code-hub-storefront run build

# ---------------------------------------------------------------------------
# Stage 2: runtime image with only what the server needs at boot
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runtime

# Patch OS packages. The apk index cache is intentionally kept (not deleted):
# image vulnerability scanners read /var/cache/apk to enumerate installed
# Alpine packages, and an empty/missing cache makes that extraction fail.
RUN apk update \
 && apk upgrade --no-cache \
 && apk add --no-cache libstdc++ \
 && rm -f /var/lib/apk/db/lock

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    STATIC_DIR=/app/public \
    SQLITE_PATH=/app/data/bet-code-hub.sqlite

# Runtime dependencies (the API bundle externalizes native/unbundleable modules).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/artifacts/api-server/package.json ./artifacts/api-server/package.json
COPY --from=build /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=build /app/artifacts/bet-code-hub-storefront/dist/public ./public

# Writable location for the embedded SQLite database used when DATABASE_URL is
# absent (the container runs as the unprivileged `node` user).
RUN mkdir -p /app/data && chown -R node:node /app/data

# Run as the unprivileged user that ships with the official Node image.
USER node

EXPOSE 3000

# Storage: set DATABASE_URL to use Postgres. When it is unset the API creates and
# seeds an embedded SQLite database at SQLITE_PATH, so packages and orders work
# with no external database (rows live in the container filesystem).
# PAYSTACK_SECRET_KEY is required for checkout (Paystack initialize/verify + webhook).
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
