# syntax=docker/dockerfile:1.7
#
# Orbit & Atmosphere — single image: built SPA + Fastify + in-process Telegram bot.
# Target runtime: Oracle Cloud Ampere A1 (ARM64). Native deps (better-sqlite3) MUST
# compile on the build platform; this Dockerfile does that explicitly.

ARG NODE_VERSION=20.15.0

# ---------- base ----------
FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# ---------- deps (with build toolchain for native modules) ----------
FROM base AS deps
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      python3 build-essential ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json   packages/shared/package.json
COPY packages/backend/package.json  packages/backend/package.json
COPY packages/frontend/package.json packages/frontend/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile=false

# ---------- build ----------
FROM deps AS build
COPY . .
RUN pnpm --filter @horizon/shared build \
 && pnpm --filter @horizon/frontend build \
 && pnpm --filter @horizon/backend build
# Strip dev deps after build to shrink the runtime image.
RUN pnpm install --prod --frozen-lockfile=false \
 && pnpm store prune

# ---------- runtime ----------
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=8080 \
    DB_PATH=/app/data/horizon.sqlite
WORKDIR /app
# Bring node_modules + built artifacts.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist   ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/backend/dist  ./packages/backend/dist
COPY --from=build /app/packages/backend/package.json ./packages/backend/package.json
COPY --from=build /app/packages/backend/node_modules ./packages/backend/node_modules
# SPA bundle is served as static by Fastify from this path.
COPY --from=build /app/packages/frontend/dist ./packages/backend/public

RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
# --import loads the OpenTelemetry bootstrap (Oculory) before Fastify is imported
# so HTTP/Fastify auto-instrumentation attaches. Tracing is best-effort/guarded.
CMD ["node", "--import", "./packages/backend/dist/instrumentation/tracing.js", "packages/backend/dist/server.js"]
