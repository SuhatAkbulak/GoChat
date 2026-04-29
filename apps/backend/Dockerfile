# Context: Monorepo Root
FROM node:21-alpine AS builder

WORKDIR /app

# Build için gerekli dosyaları kopyala
COPY . .

# Monorepo bağımlılıklarını kur (root package-lock.json kullanılarak)
RUN npm ci

# Prisma Client oluştur (Backend için)
WORKDIR /app/apps/backend
RUN npx prisma generate

# Backend projesini build et
RUN npm run build

# --- Production Image ---
FROM node:21-alpine AS runner

WORKDIR /app

# Sadece çalışmak için gerekli olan dosyaları kopyala
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma

WORKDIR /app/apps/backend

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
