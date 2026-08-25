# TianshangChat server image
# Multi-stage: install → build (turbo) → production deploy via pnpm --filter.
# Base is Debian (glibc) so better-sqlite3 prebuilt binaries download cleanly.

FROM node:22-bookworm-slim AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN npm install -g pnpm@11.23.0

# ------------------------------------------------------------------
# deps: full workspace install (frozen lockfile)
# ------------------------------------------------------------------
FROM base AS deps
WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY apps/desktop/package.json apps/desktop/
COPY packages/shared/package.json packages/shared/
COPY packages/crypto/package.json packages/crypto/
RUN pnpm install --frozen-lockfile --ignore-scripts \
 && pnpm rebuild better-sqlite3 bcrypt esbuild

# ------------------------------------------------------------------
# build: shared + server TS compilation
# ------------------------------------------------------------------
FROM deps AS build
COPY tsconfig.base.json turbo.json ./
COPY packages/shared packages/shared
COPY packages/crypto packages/crypto
COPY apps/server apps/server
RUN pnpm --filter @tianshangchat/crypto build 
 && pnpm --filter @tianshangchat/shared build \
 && pnpm --filter @tianshangchat/server db:generate --if-present || true \
 && pnpm --filter @tianshangchat/server build

# ------------------------------------------------------------------
# runtime: pruned production deploy
# ------------------------------------------------------------------
FROM base AS runtime
WORKDIR /repo
COPY --from=deps /repo .
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/packages/crypto/dist packages/crypto/dist
COPY --from=build /repo/apps/server/drizzle apps/server/drizzle
COPY --from=build /repo/apps/server/dist apps/server/dist
RUN pnpm --filter @tianshangchat/server... --prod deploy /out

WORKDIR /out
ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/src/index.js"]
