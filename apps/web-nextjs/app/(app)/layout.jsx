import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";

export default function PrivateLayout({ children }) {
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}
