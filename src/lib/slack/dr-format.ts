export type DrFields = {
  satisfaction: number | string;
  done: string;
  good: string;
  moreNext: string;
  tomorrowTasks: string;
  nonTask: string;
  personalNews: string;
  dateISO?: string;
};

export function formatDailyReportMessage(fields: DrFields) {
  const lines = [
    `:満足度:`,
    String(fields.satisfaction).trim(),
    `:done:`,
    fields.done.trim(),
    `:good:`,
    fields.good.trim(),
    `:more_next:`,
    fields.moreNext.trim(),
    `:明日の_タスク:`,
    fields.tomorrowTasks.trim(),
    `:タスク_意外:`,
    fields.nonTask.trim(),
    `:個人的_ニュース:`,
    fields.personalNews.trim(),
  ];

  const text = lines.join("\n");

  const blocks = [
    {
      type: "section" as const,
      text: { type: "mrkdwn" as const, text },
    },
  ];

  return { text, blocks };
}

// Slack ingest → Sheets 保存の時に使う予定
export function parseDailyReportFromSlack(_text: string): Partial<DrFields> {
  return {};
}
