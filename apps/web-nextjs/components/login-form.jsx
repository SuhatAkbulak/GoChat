"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Command } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginRequest } from "@/lib/api-auth";
import { getAccessToken, setAuthTokens } from "@/lib/auth";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/messages";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (getAccessToken()) {
      router.replace(nextPath.startsWith("/") ? nextPath : "/messages");
    }
  }, [router, nextPath]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await loginRequest(email.trim(), password);
      setAuthTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      router.replace(nextPath.startsWith("/") ? nextPath : "/messages");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Command className="size-6" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              GoChat
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Hesabınıza giriş yapın
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-border bg-card/50 p-6 shadow-sm"
        >
          {error ? (
            <p
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email">E-posta</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="h-10"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Şifre</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-10"
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            className="h-10 w-full"
            size="lg"
            disabled={loading}
          >
            {loading ? "Giriş yapılıyor…" : "Giriş yap"}
          </Button>
        </form>


      </div>
    </div>
  );
}
