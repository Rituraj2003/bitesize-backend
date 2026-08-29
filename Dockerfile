# ==========================================
# STAGE 1: Build & Transpile TypeScript
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests and install dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and build
COPY . .
RUN npm run build

# ==========================================
# STAGE 2: Lightweight Production Runtime
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Copy package manifests and production dependencies only
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --only=production
RUN npx prisma generate

# Copy compiled JavaScript from builder stage
COPY --from=builder /app/dist ./dist

# Expose server port
EXPOSE 5000

# Run production server
CMD ["node", "dist/server.js"]
