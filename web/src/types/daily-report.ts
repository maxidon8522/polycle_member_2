export type DailyReportSource = "manual" | "slack_ingest" | "web_form";

export interface DailyReport {
  reportId: string;
  date: string; // YYYY-MM-DD
  weekday: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  userSlug: string;
  userName: string;
  email: string;
  slackUserId: string;
  slackTeamId: string;
  channelId: string;
  satisfactionToday: string;
  doneToday: string;
  goodMoreBackground: string;
  moreNext: string;
  todoTomorrow: string;
  wishTomorrow: string;
  personalNews: string;
  tags: string[];
  source: DailyReportSource;
  slackTs?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyReportUpsertInput
  extends Omit<
    DailyReport,
    "reportId" | "createdAt" | "updatedAt" | "source"
  > {
  reportId?: string;
  source?: DailyReportSource;
  slackTs?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WeeklySatisfactionPoint {
  userSlug: string;
  department: string;
  weekStart: string; // YYYY-MM-DD
  averageScore: number;
  sampleSize: number;
  scope: "individual" | "department" | "company";
}
