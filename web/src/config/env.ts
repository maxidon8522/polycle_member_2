import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET is required"),
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z
    .string()
    .min(1, "GOOGLE_CLIENT_SECRET is required"),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z
    .string()
    .optional(),
  GOOGLE_SERVICE_ACCOUNT_KEY: z.string().optional(),
  SHEETS_DR_SPREADSHEET_ID: z
    .string()
    .min(1, "SHEETS_DR_SPREADSHEET_ID is required"),
  SHEETS_TASKS_SPREADSHEET_ID: z
    .string()
    .min(1, "SHEETS_TASKS_SPREADSHEET_ID is required"),
  SLACK_CLIENT_ID: z.string().min(1, "SLACK_CLIENT_ID is required"),
  SLACK_CLIENT_SECRET: z.string().min(1, "SLACK_CLIENT_SECRET is required"),
  SLACK_SIGNING_SECRET: z
    .string()
    .min(1, "SLACK_SIGNING_SECRET is required for Events API validation"),
  SLACK_DAILY_REPORT_CHANNEL_ID: z
    .string()
    .min(1, "SLACK_DAILY_REPORT_CHANNEL_ID is required"),
  SLACK_APP_LEVEL_TOKEN: z
    .string()
    .min(1, "SLACK_APP_LEVEL_TOKEN is required for the Events API"),
  SLACK_BOT_TOKEN: z.string().min(1, "SLACK_BOT_TOKEN is required"),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default("Polycle Member 2"),
  NEXT_PUBLIC_DEFAULT_TIMEZONE: z.string().default("Asia/Taipei"),
});

const parseEnv = () => {
  if (process.env.SKIP_ENV_VALIDATION === "1") {
    return {
      server: {
        NODE_ENV: process.env.NODE_ENV ?? "development",
        NEXTAUTH_URL: process.env.NEXTAUTH_URL,
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "dev-secret",
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
        GOOGLE_SERVICE_ACCOUNT_EMAIL:
          process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "",
        GOOGLE_SERVICE_ACCOUNT_KEY:
          process.env.GOOGLE_SERVICE_ACCOUNT_KEY ?? "",
        SHEETS_DR_SPREADSHEET_ID:
          process.env.SHEETS_DR_SPREADSHEET_ID ?? "",
        SHEETS_TASKS_SPREADSHEET_ID:
          process.env.SHEETS_TASKS_SPREADSHEET_ID ?? "",
        SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID ?? "",
        SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET ?? "",
        SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET ?? "",
        SLACK_DAILY_REPORT_CHANNEL_ID:
          process.env.SLACK_DAILY_REPORT_CHANNEL_ID ?? "",
        SLACK_APP_LEVEL_TOKEN: process.env.SLACK_APP_LEVEL_TOKEN ?? "",
        SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN ?? "",
      },
      client: {
        NEXT_PUBLIC_APP_NAME:
          process.env.NEXT_PUBLIC_APP_NAME ?? "Polycle Member 2",
        NEXT_PUBLIC_DEFAULT_TIMEZONE:
          process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? "Asia/Taipei",
      },
    };
  }

  const parsedServerEnv = envSchema.safeParse(process.env);
  if (!parsedServerEnv.success) {
    const issues = parsedServerEnv.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid server environment variables:\n${issues}`);
  }

  const parsedClientEnv = clientEnvSchema.safeParse(process.env);
  if (!parsedClientEnv.success) {
    const issues = parsedClientEnv.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid client environment variables:\n${issues}`);
  }

  return {
    server: parsedServerEnv.data,
    client: parsedClientEnv.data,
  };
};

export const env = parseEnv();
