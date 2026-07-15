# Production web image (Railway / Docker)
FROM node:20-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY packages/db/package.json ./packages/db/
COPY packages/domain/package.json ./packages/domain/
COPY packages/queue/package.json ./packages/queue/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run db:generate
RUN npm run build --workspace @mlm/web

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/apps/web ./apps/web
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/web/.next ./apps/web/.next
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "@mlm/web"]
