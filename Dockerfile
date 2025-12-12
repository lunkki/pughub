FROM node:20-bookworm-slim AS base
WORKDIR /app

# System deps for Prisma (OpenSSL)
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Install deps first (better caching)
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copy source
COPY . .

# Generate Prisma client (safe with placeholder DB URL)
ENV DATABASE_URL=postgres://user:pass@localhost:5432/db
RUN npx prisma generate

# Build
RUN npm run build

# Runtime image
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# System deps for Prisma (OpenSSL)
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Install only production deps
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts --omit=dev

# Copy schema before generating Prisma client
COPY --from=base /app/prisma ./prisma

# Generate Prisma client in runtime image
ENV DATABASE_URL=postgres://user:pass@localhost:5432/db
RUN npx prisma generate

# Copy built app and assets
COPY --from=base /app/.next ./.next
COPY --from=base /app/public ./public
COPY --from=base /app/next.config.js ./next.config.js
COPY --from=base /app/package.json ./package.json

ENV PORT=3000
EXPOSE 3000

CMD ["npm", "run", "start"]
