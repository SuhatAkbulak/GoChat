"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { getAccessToken } from "@/lib/auth";

/**
 * localStorage’daki access token yoksa /login’e yönlendirir.
 * (Middleware cookie kullanmadığı için istemci tarafı koruma.)
 */
export function AuthGate({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = React.useState(false);

  React.useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      const next = pathname && pathname !== "/" ? pathname : "/messages";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    setAllowed(true);
  }, [router, pathname]);

  if (!allowed) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background text-sm text-muted-foreground">
        Oturum doğrulanıyor…
      </div>
    );
  }

  return children;
}
