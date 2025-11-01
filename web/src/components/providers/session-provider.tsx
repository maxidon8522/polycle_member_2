"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

type Props = {
  session?: Session | null;
  children: ReactNode;
};

const ensureExpires = (session: Session | null | undefined): Session | null => {
  if (!session) {
    return null;
  }

  if (session.expires) {
    return session;
  }

  return {
    ...session,
    expires: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };
};

export const AuthSessionProvider = ({ session, children }: Props) => {
  const safeSession = ensureExpires(session);
  return <SessionProvider session={safeSession ?? undefined}>{children}</SessionProvider>;
};
