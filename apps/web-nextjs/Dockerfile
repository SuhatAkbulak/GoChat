# Context: Monorepo Root
FROM node:21-alpine AS builder

WORKDIR /app

COPY . .

RUN npm ci

WORKDIR /app/apps/web-nextjs
RUN npm run build

# --- Production Image ---
FROM node:21-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5180

# Standalone build çıktılarını kopyala. Monorepo yapısı korunduğu için
# server.js dosyası `apps/web-nextjs/server.js` olarak ayağa kalkar.
# COPY --from=builder /app/apps/web-nextjs/public ./apps/web-nextjs/public
COPY --from=builder /app/apps/web-nextjs/.next/standalone ./
COPY --from=builder /app/apps/web-nextjs/.next/static ./apps/web-nextjs/.next/static

EXPOSE 5180

CMD ["node", "apps/web-nextjs/server.js"]
