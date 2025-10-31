import type { ReactNode } from "react";
import { auth } from "@/server/auth";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  return (
    <AuthSessionProvider session={session}>
      <AppShell>{children}</AppShell>
    </AuthSessionProvider>
  );
}
