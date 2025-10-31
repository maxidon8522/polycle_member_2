"use client";

import { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

interface Props {
  session: Session | null;
  children: ReactNode;
}

export const AuthSessionProvider = ({ session, children }: Props) => {
  return <SessionProvider session={session}>{children}</SessionProvider>;
};
