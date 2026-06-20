# Base image
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ARG URL_BASE_PATH
ENV URL_BASE_PATH=$URL_BASE_PATH
RUN npm run build

# Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Install supervisord
RUN apk add --no-cache supervisor

# Copy nextjs build
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/package.json ./package.json

# Copy worker script
COPY --from=builder /app/src/worker.ts ./src/worker.ts
# Need ts-node for worker
COPY --from=builder /app/node_modules ./node_modules

# Supervisor config
COPY supervisord.conf /etc/supervisord.conf

# Setup storage directory
RUN mkdir -p /app/storage
ENV BASE_PATH=/app/storage
ENV PORT=3000

EXPOSE 3000

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
