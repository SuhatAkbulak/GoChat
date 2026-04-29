import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // LAN üzerinden (ör. telefondan) erişirken /_next uyarısını azaltır; kendi IP’ni ekle
  allowedDevOrigins: ["192.168.1.30"],
  // REST proxy: app/api-proxy/[...path]/route.js — Nest adresi BACKEND_PROXY_TARGET (.env)
};

export default nextConfig;
