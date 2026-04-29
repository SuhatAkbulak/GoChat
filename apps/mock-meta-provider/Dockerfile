# Context: Monorepo Root
FROM node:21-alpine AS builder

WORKDIR /app

COPY . .

RUN npm ci

WORKDIR /app/apps/mock-meta-provider
RUN npm run build

# --- Production Image ---
FROM node:21-alpine AS runner

WORKDIR /app

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/mock-meta-provider/package.json ./apps/mock-meta-provider/package.json
COPY --from=builder /app/apps/mock-meta-provider/dist ./apps/mock-meta-provider/dist

WORKDIR /app/apps/mock-meta-provider

EXPOSE 4000

CMD ["npm", "run", "start:prod"]
