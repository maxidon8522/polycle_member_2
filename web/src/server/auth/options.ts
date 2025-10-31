import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import SlackProvider from "next-auth/providers/slack";
import { env } from "@/config/env";

const SLACK_USER_SCOPE = "chat:write,channels:read,users:read";
const SLACK_OIDC_SCOPE = "openid profile email";

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    if (value === null || value === undefined) return null;
    const coerced = String(value);
    return coerced.trim() ? coerced.trim() : null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const pickFirstTruthy = (...values: unknown[]): string | null => {
  for (const value of values) {
    const normalized = normalizeString(value);
    if (normalized) {
      return normalized;
    }
  }
  return null;
};

export const authOptions: NextAuthOptions = {
  secret: env.server.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  providers: [
    GoogleProvider({
      clientId: env.server.GOOGLE_CLIENT_ID,
      clientSecret: env.server.GOOGLE_CLIENT_SECRET,
    }),
    SlackProvider({
      clientId: env.server.SLACK_CLIENT_ID,
      clientSecret: env.server.SLACK_CLIENT_SECRET,
      authorization: {
        params: {
          scope: SLACK_OIDC_SCOPE,
          user_scope: SLACK_USER_SCOPE,
        },
      },
      profile(profile) {
        const record = profile as Record<string, unknown>;
        const id =
          pickFirstTruthy(
            record.id,
            record.user_id,
            record["https://slack.com/user_id"],
          ) ?? "";
        const name =
          pickFirstTruthy(record.real_name, record.name, id) ?? id;
        const email = pickFirstTruthy(record.email);

        return {
          id,
          name,
          email,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.provider === "slack") {
        const slackProfile = (profile ?? {}) as Record<string, unknown>;

        const slackUserId =
          pickFirstTruthy(
            slackProfile.id,
            slackProfile.user_id,
            slackProfile["https://slack.com/user_id"],
            (account as Record<string, unknown>)?.authed_user &&
              (
                (account as Record<string, unknown>)?.authed_user as
                  | Record<string, unknown>
                  | undefined
              )?.id,
          ) ?? token.slackUserId;
        if (slackUserId) {
          token.slackUserId = slackUserId;
        }

        const teamId =
          pickFirstTruthy(
            slackProfile.team_id,
            (slackProfile.team as Record<string, unknown> | undefined)?.id,
            slackProfile["https://slack.com/team_id"],
            (account as Record<string, unknown>)?.team_id,
            (account as Record<string, unknown>)?.teamId,
            (
              (account as Record<string, unknown>)?.team as
                | Record<string, unknown>
                | undefined
            )?.id,
            (
              (account as Record<string, unknown>)?.authed_user as
                | Record<string, unknown>
                | undefined
            )?.team_id,
          ) ?? token.slackTeamId;
        if (teamId) {
          token.slackTeamId = teamId;
        }

        const authedUser =
          ((account as Record<string, unknown>)?.authed_user as
            | Record<string, unknown>
            | undefined) ??
          (slackProfile.authed_user as Record<string, unknown> | undefined);
        const candidateAccessTokens = [
          authedUser?.access_token,
          account.access_token,
          token.slackUserAccessToken,
          (token as Record<string, unknown>)["slack_access_token"],
        ];
        const userAccessToken =
          candidateAccessTokens
            .map((candidate) => normalizeString(candidate))
            .find(
              (candidate): candidate is string =>
                Boolean(candidate?.startsWith("xoxp-")),
            ) ?? null;
        if (userAccessToken) {
          token.slackUserAccessToken = userAccessToken;
        }
      }

      const legacySlackUserId = normalizeString(
        (token as Record<string, unknown>)["slack_user_id"],
      );
      if (!token.slackUserId && legacySlackUserId) {
        token.slackUserId = legacySlackUserId;
      }

      const legacySlackTeamId = normalizeString(
        (token as Record<string, unknown>)["slack_team_id"],
      );
      if (!token.slackTeamId && legacySlackTeamId) {
        token.slackTeamId = legacySlackTeamId;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.slackUserId = token.slackUserId ?? null;
        session.user.slackAccessToken = token.slackUserAccessToken ?? null;
      }

      (session as Record<string, unknown>).slackUserId =
        token.slackUserId ?? "";
      (session as Record<string, unknown>).slackTeamId =
        token.slackTeamId ?? "";
      (session as Record<string, unknown>).slackUserAccessToken =
        token.slackUserAccessToken ?? "";

      return session;
    },
  },
};
