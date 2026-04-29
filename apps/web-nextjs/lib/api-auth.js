import { API_BASE_URL } from "@/lib/config";

/**
 * @returns {Promise<{ accessToken: string, refreshToken: string, tokenType: string, expiresIn: number, user: object }>}
 */
export async function loginRequest(email, password) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  let body;
  try {
    body = await res.json();
  } catch {
    body = {};
  }

  if (!res.ok) {
    const msg =
      body?.message ||
      (Array.isArray(body?.message) ? body.message.join(", ") : null) ||
      body?.error ||
      `Giriş başarısız (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : "Giriş başarısız");
  }

  return body;
}
