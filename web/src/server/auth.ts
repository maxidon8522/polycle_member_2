import NextAuth from "next-auth";
import Slack from "next-auth/providers/slack";
import { env } from "@/config/env";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      slackUserId?: string | null;
      slackTeamId?: string | null;
    };
  }
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  secret: env.server.NEXTAUTH_SECRET,
  providers: [
    Slack({
      clientId: env.server.SLACK_CLIENT_ID,
      clientSecret: env.server.SLACK_CLIENT_SECRET,
      authorization: { params: { scope: "openid profile email" } },
      profile(profile) {
        const anyProfile = profile as Record<string, unknown>;

        return {
          id: (profile as { sub?: string }).sub ?? "",
          name: (profile as { name?: string }).name ?? null,
          email: (profile as { email?: string }).email ?? null,
          image: (profile as { picture?: string }).picture ?? null,
          slackUserId:
            (anyProfile["https://slack.com/user_id"] as string | undefined) ??
            null,
          slackTeamId:
            (anyProfile["https://slack.com/team_id"] as string | undefined) ??
            null,
        };
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token?.sub) {
        session.user.id = token.sub;
      }
      if (token?.slackUserId) {
        session.user.slackUserId = token.slackUserId as string;
      }
      if (token?.slackTeamId) {
        session.user.slackTeamId = token.slackTeamId as string;
      }

      return session;
    },
    async jwt({ token, profile }) {
      if (profile) {
        const anyProfile = profile as Record<string, unknown>;
        token.slackUserId = anyProfile["https://slack.com/user_id"] as string | undefined;
        token.slackTeamId = anyProfile["https://slack.com/team_id"] as string | undefined;
      }

      return token;
    },
  },
});

