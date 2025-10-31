import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/options";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <AuthSessionProvider session={session}>
      <AppShell>{children}</AppShell>
    </AuthSessionProvider>
  );
}
