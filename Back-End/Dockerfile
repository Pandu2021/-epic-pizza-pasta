# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN npm ci || yarn install || pnpm install
COPY . .
RUN npm run build

# Runtime stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
# Note: Environment variables should be injected at runtime, not copied from .env files
# Use: docker run -e DATABASE_URL=... -e JWT_PRIVATE_KEY=... your-image
EXPOSE 4000
CMD ["node", "dist/main.js"]
