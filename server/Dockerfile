# Excalidraw sync server — Bun runtime
FROM oven/bun:1.3-alpine

WORKDIR /app

# Install deps first (cached unless lockfile changes)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# App source
COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production
EXPOSE 3002

# Apply schema, then boot. Migrate is idempotent-safe to re-run on deploy.
CMD ["sh", "-c", "bun src/migrate.ts && bun src/index.ts"]
