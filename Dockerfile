# ==========================================
# STAGE 1: Build & Transpile TypeScript
# ==========================================
FROM node:20-slim AS builder

WORKDIR /app

# Force Node.js to prefer IPv4 DNS resolution (prevents EAI_AGAIN on QEMU/VPN networks)
ENV NODE_OPTIONS="--dns-result-order=ipv4first"

# Copy package manifests and install all dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and transpile TypeScript to dist/
COPY . .
RUN npm run build

# ==========================================
# STAGE 2: Lightweight Production Runtime
# ==========================================
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000
ENV NODE_OPTIONS="--dns-result-order=ipv4first"

# Copy package manifests and prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Copy pre-generated node_modules and compiled dist from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Expose server port
EXPOSE 5000

# Run production server
CMD ["node", "dist/server.js"]
