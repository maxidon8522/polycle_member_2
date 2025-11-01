import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: DefaultSession["user"] & {
      id?: string;
      slackUserId?: string | null;
      slackTeamId?: string | null;
    };
  }

  interface User {
    slackUserId?: string | null;
    slackTeamId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    slackUserId?: string | null;
    slackTeamId?: string | null;
  }
}
