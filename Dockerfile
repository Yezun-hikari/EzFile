# Base image for the final runner (target platform)
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl supervisor
WORKDIR /app

# Base image for building (native host platform)
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder-base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Install all dependencies
FROM builder-base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# Install only production dependencies
FROM builder-base AS prod-deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Builder
FROM builder-base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG DATABASE_URL="file:/tmp/dev.db"
ENV DATABASE_URL=${DATABASE_URL}
RUN npx prisma generate
RUN npx prisma db push
ARG URL_BASE_PATH
ENV URL_BASE_PATH=$URL_BASE_PATH
RUN npm run build
RUN npm run worker:build

# Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV DATABASE_URL="file:/app/storage/dev.db"

# Copy nextjs standalone build
COPY public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# Copy production dependencies
COPY --from=prod-deps /app/node_modules ./node_modules
# Ensure generated prisma client is copied
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Copy compiled worker script
COPY --from=builder /app/dist/worker.js ./dist/worker.js

# Supervisor config
COPY supervisord.conf /etc/supervisord.conf

# Setup storage directory
RUN mkdir -p /app/storage
ENV BASE_PATH=/app/storage
ENV PORT=3000

# Copy and setup start script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 3000

CMD ["/app/start.sh"]
