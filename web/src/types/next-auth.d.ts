import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session extends DefaultSession {
    expires: string;
    slackUserId?: string | null;
    slackTeamId?: string | null;
    slackUserAccessToken?: string | null;
    user?: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      slackUserId?: string | null;
      slackTeamId?: string | null;
      slackAccessToken?: string | null;
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
    slackUserAccessToken?: string | null;
  }
}
