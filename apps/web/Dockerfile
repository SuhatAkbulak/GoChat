# Context: Monorepo Root
FROM node:21-alpine AS builder

WORKDIR /app

COPY . .

RUN npm ci

WORKDIR /app/apps/web
RUN npm run build

# --- Production Image (Node Serve) ---
FROM node:21-alpine AS runner

WORKDIR /app

# Basit bir statik dosya sunucusu kuruyoruz (Nginx istenmediği için)
RUN npm install -g serve

# Sadece build edilen statik dosyaları kopyalıyoruz
COPY --from=builder /app/apps/web/dist ./dist

# Vite varsayılan portu ile aynı olması için 5173 kullanabiliriz
EXPOSE 5173

# SPA yönlendirmesi için -s (single) bayrağı ile çalıştırıyoruz
CMD ["serve", "-s", "dist", "-l", "5173"]
