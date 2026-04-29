const trim = (s) => (typeof s === "string" ? s.replace(/\/$/, "") : "");

const explicitApi = trim(process.env.NEXT_PUBLIC_API_URL);

/**
 * REST çağrıları:
 * - NEXT_PUBLIC_API_URL doluysa doğrudan o adres (örn. http://127.0.0.1:3000).
 * - Boşsa tarayıcıda `/api-proxy` → Next `rewrites` ile Nest'e (port karışmasını önler).
 * - SSR'da doğrudan Nest adresi (rewrite istemci isteklerinde çalışır).
 */
function resolveApiBase() {
  if (explicitApi) return explicitApi;
  if (typeof window === "undefined") {
    return (
      trim(process.env.BACKEND_PROXY_TARGET) ||
      trim(process.env.INTERNAL_API_URL) ||
      "http://127.0.0.1:3000"
    );
  }
  return "/api-proxy";
}

/** NestJS REST API tabanı */
export const API_BASE_URL = resolveApiBase();

/** Socket.IO doğrudan Nest origin (WebSocket için tam URL) */
export const SOCKET_URL =
  trim(process.env.NEXT_PUBLIC_SOCKET_URL) ||
  trim(process.env.BACKEND_PROXY_TARGET) ||
  "http://127.0.0.1:3000";

/** Mock Meta Provider */
export const MOCK_META_URL =
  trim(process.env.NEXT_PUBLIC_MOCK_META_URL) || "http://localhost:4000";
