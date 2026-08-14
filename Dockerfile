# Production web image (Railway / Docker / Hostinger-compatible standalone)
FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY packages/db/package.json ./packages/db/
COPY packages/domain/package.json ./packages/domain/
COPY packages/queue/package.json ./packages/queue/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/prisma/schema.prisma ./packages/db/prisma/schema.prisma
RUN npm ci --include=optional

FROM deps AS build
COPY . .
ARG NEXT_PUBLIC_APP_NAME=Fources
ARG APP_BASE_URL=http://localhost:3000
ENV NODE_ENV=production \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    APP_BASE_URL=$APP_BASE_URL \
    DATABASE_URL=postgresql://postgres:postgres@postgres:5432/mlm_ecommerce?schema=public \
    REDIS_URL=redis://redis:6379 \
    JWT_SECRET=docker-build-placeholder-secret-min-32-chars \
    JWT_REFRESH_SECRET=docker-build-refresh-secret-min-32-chars
RUN npm run db:generate
RUN npm run build --workspace @mlm/web

FROM base AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app
COPY --from=build /app/apps/web/.next/standalone ./
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["node", "server.js"]
