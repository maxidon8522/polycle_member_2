import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "./options";

export const auth = async (): Promise<Session | null> => {
  return getServerSession(authOptions);
};
