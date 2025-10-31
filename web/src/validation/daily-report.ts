import { z } from "zod";

export const dailyReportUpsertSchema = z.object({
  reportId: z.string().optional(),
  date: z.string().min(1),
  weekday: z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
  userSlug: z.string().min(1),
  userName: z.string().min(1),
  email: z.string().email(),
  slackUserId: z.string().min(1),
  slackTeamId: z.string().min(1),
  channelId: z.string().min(1),
  satisfactionToday: z.string().optional().default(""),
  doneToday: z.string().min(1, "今日やったこと（Done）を入力してください"),
  goodMoreBackground: z.string().optional().default(""),
  moreNext: z.string().optional().default(""),
  todoTomorrow: z.string().optional().default(""),
  wishTomorrow: z.string().optional().default(""),
  personalNews: z.string().optional().default(""),
  tags: z.array(z.string()).default([]),
  source: z.enum(["manual", "slack_ingest"]).optional(),
  slackTs: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type DailyReportUpsertSchema = z.infer<typeof dailyReportUpsertSchema>;
