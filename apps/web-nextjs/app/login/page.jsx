import { Suspense } from "react";

import { LoginForm } from "@/components/login-form";

export const metadata = {
  title: "Giriş · GoChat",
  description: "GoChat kontrol paneline giriş",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center bg-background text-sm text-muted-foreground">
          Yükleniyor…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
