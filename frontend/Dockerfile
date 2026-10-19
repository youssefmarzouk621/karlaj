# BrickArt storefront (Next.js standalone).
# Build context: the repo root — the app depends on the sibling database/ package.
#   docker build -f frontend/Dockerfile -t brickart/frontend .

ARG NODE_VERSION=22-alpine
ARG PRISMA_VERSION=6.19.3

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS base
# openssl: Prisma's query engine; libc6-compat: native modules built for glibc
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

# ---------------------------------------------------------------------------
# Shared Prisma package: deps first (cached until its lockfile changes), then
# generate the client for this platform and compile dist/.
FROM base AS database
COPY database/package.json database/package-lock.json database/
RUN --mount=type=cache,target=/root/.npm \
    cd database && npm ci --ignore-scripts --no-audit --no-fund
COPY database/ database/
RUN cd database && npm run build

# ---------------------------------------------------------------------------
# App dependencies (cached until frontend's lockfile changes). Only the shared
# package's manifest is needed here — the file:../database link is resolved later.
FROM base AS deps
COPY database/package.json database/
COPY frontend/package.json frontend/package-lock.json frontend/
# npm would run the linked package's `prepare` (its build) here — that's done in
# the database stage instead, so drop the hook from this copy of the manifest.
RUN --mount=type=cache,target=/root/.npm \
    cd database && npm pkg delete scripts.prepare && \
    cd ../frontend && npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=database /app/database database
COPY --from=deps /app/frontend/node_modules frontend/node_modules
COPY frontend/ frontend/
# .next/cache persists between builds (BuildKit cache mount) → faster rebuilds
RUN --mount=type=cache,target=/app/frontend/.next/cache \
    cd frontend && npm run build

# ---------------------------------------------------------------------------
FROM base AS runner
ARG PRISMA_VERSION
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Prisma CLI for the entrypoint's migrations (standalone output doesn't ship it)
RUN --mount=type=cache,target=/root/.npm \
    npm install -g prisma@${PRISMA_VERSION} --no-audit --no-fund

# Standalone output mirrors the repo layout (traced from the root):
#   /app/frontend/server.js, /app/node_modules, /app/database/...
COPY --from=builder --chown=node:node /app/frontend/.next/standalone ./
COPY --from=builder --chown=node:node /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder --chown=node:node /app/frontend/public ./frontend/public
# Schema (+ migrations, when there are any) for the entrypoint
COPY --chown=node:node database/prisma ./database/prisma
COPY --chmod=755 frontend/entrypoint.sh /usr/local/bin/entrypoint.sh

# Rendered artwork images are written here at runtime — mounted as a volume.
RUN mkdir -p frontend/public/uploads && chown node:node frontend/public/uploads

USER node
WORKDIR /app/frontend
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["entrypoint.sh"]
CMD ["node", "server.js"]
