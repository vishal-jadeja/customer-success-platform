# Multi-stage: deps -> build -> runner. Node 22 matches this repo's dev
# environment (no .nvmrc pin exists; v22 is what `npm run build` was
# verified against locally).

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# node:22-alpine bundles npm 10.x; this lockfile was written by npm 11 (this
# repo's dev environment). npm 10's `npm ci` validator is stricter about the
# lockfile's optional/peer dependency graph than npm 11's and rejects it
# (spuriously — `npm install` on either version is a no-op, and npm 11's own
# `npm ci` passes clean). Match the npm major that wrote the lockfile.
RUN npm install -g npm@11 && npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# BUILD_STANDALONE gates next.config.ts's `output: "standalone"` (unset on
# Vercel, where the standalone trace step breaks the build — see the config
# file's own comment). BACKEND_URL is consumed by next.config.ts's
# rewrites() DURING `next build` — the destination is frozen into
# .next/routes-manifest.json at build time, not read per-request — so it
# must be a build ARG, never only a runtime env (that would bake in
# "undefined/api/v1/...").
ARG BACKEND_URL
ENV BACKEND_URL=$BACKEND_URL
ENV BUILD_STANDALONE=1
# `next build --webpack`, not Turbopack — this repo's Next 16.3.x Turbopack
# build omits next-server.js.nft.json (see PROGRESS.md's Vercel notes).
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Runtime copy for consistency with the build-time value; the rewrite
# destination itself is already frozen into the build output above.
ARG BACKEND_URL
ENV BACKEND_URL=$BACKEND_URL

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Standalone output: a minimal server.js + only the node_modules it traced,
# NOT the full node_modules from the deps stage.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
