# syntax=docker/dockerfile:1
#
# Adspark IT Inventory - one image that runs the API and serves the built
# pages (server/src/index.js serves client/dist). See README
# "Running it with Docker".
#
# Build needs internet: npm downloads SheetJS from cdn.sheetjs.com.
# Pin NODE_IMAGE to a digest (node:22-alpine@sha256:...) for fully
# reproducible production builds.
ARG NODE_IMAGE=node:22-alpine

# ---- all dependencies, for building the pages -----------------------------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci --no-audit --no-fund

# ---- build client/dist ------------------------------------------------------
FROM deps AS build
COPY client client
RUN npm run build --workspace client

# ---- the server's production dependencies only ------------------------------
FROM ${NODE_IMAGE} AS server-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci --omit=dev --workspace server --no-audit --no-fund

# ---- runtime ----------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001
WORKDIR /app

# Files stay owned by root and read-only to the app user; the app writes
# nothing to disk.
COPY --from=server-deps /app/node_modules ./node_modules
COPY package.json ./
COPY server/package.json server/
COPY server/src server/src
COPY server/scripts server/scripts
COPY supabase/migrations supabase/migrations
COPY --from=build /app/client/dist client/dist

# HOST=0.0.0.0 makes the server refuse to start without ALLOWED_IPS - the
# office allowlist is required, never optional, in a container.
USER node
EXPOSE 3001

# /api/health is the one path the allowlist always answers.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3001) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

CMD ["node", "server/src/index.js"]
