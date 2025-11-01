export const DR_TAGS = {
  satisfaction: ":満足度:",
  done: ":done:",
  good: ":good:",
  moreNext: ":more_next:",
  todoTomorrow: ":明日の_タスク:",
  wishTomorrow: ":タスク_意外:",
  personalNews: ":個人的_ニュース:",
} as const;

export type DrFields = {
  date?: string;
  dateISO?: string;
  userName?: string;
  satisfaction?: string;
  done?: string;
  good?: string;
  moreNext?: string;
  todoTomorrow?: string;
  wishTomorrow?: string;
  personalNews?: string;
  tomorrowTasks?: string;
  nonTask?: string;
};

export function formatDailyReportMessage(f: DrFields): {
  text: string;
  blocks: Array<Record<string, unknown>>;
} {
  const safe = {
    date: f.date ?? f.dateISO ?? "",
    userName: f.userName ?? "",
    satisfaction: f.satisfaction ?? "",
    done: f.done ?? "",
    good: f.good ?? "",
    moreNext: f.moreNext ?? "",
    todoTomorrow: f.todoTomorrow ?? f.tomorrowTasks ?? "",
    wishTomorrow: f.wishTomorrow ?? f.nonTask ?? "",
    personalNews: f.personalNews ?? "",
  };

  const head = [
    `${DR_TAGS.satisfaction}\n${safe.satisfaction}`,
    `${DR_TAGS.done}\n${bulletize(safe.done)}`,
    `${DR_TAGS.good}\n${bulletize(safe.good)}`,
    `${DR_TAGS.moreNext}\n${bulletize(safe.moreNext)}`,
    `${DR_TAGS.todoTomorrow}\n${bulletize(safe.todoTomorrow)}`,
    `${DR_TAGS.wishTomorrow}\n${bulletize(safe.wishTomorrow)}`,
    `${DR_TAGS.personalNews}\n${bulletize(safe.personalNews)}`,
  ].join("\n");

  const text = [`:spiral_calendar_pad: ${safe.date} ${safe.userName} #dr`, head].join(
    "\n",
  );

  return {
    text,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text,
        },
      },
    ],
  };
}

export function bulletize(s: string): string {
  const lines = s
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return "";
  return lines
    .map((line) => (line.startsWith("・") ? line : `・${line}`))
    .join("\n");
}

export function parseDailyReportFromSlack(text: string): Partial<DrFields> {
  const lines = text.split(/\r?\n/);
  const result: Partial<DrFields> = {};
  let currentKey: keyof typeof DR_TAGS | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (!currentKey) return;
    const value = buffer.join("\n").trim();
    switch (currentKey) {
      case "satisfaction":
        result.satisfaction = value;
        break;
      case "done":
        result.done = value;
        break;
      case "good":
        result.good = value;
        break;
      case "moreNext":
        result.moreNext = value;
        break;
      case "todoTomorrow":
        result.todoTomorrow = value;
        break;
      case "wishTomorrow":
        result.wishTomorrow = value;
        break;
      case "personalNews":
        result.personalNews = value;
        break;
      default:
        break;
    }
    buffer = [];
  };

  const tagOf = (line: string) =>
    (Object.entries(DR_TAGS).find(([, tag]) => line.trim() === tag)?.[0] ??
      null) as keyof typeof DR_TAGS | null;

  for (const raw of lines) {
    const key = tagOf(raw);
    if (key) {
      flush();
      currentKey = key;
      continue;
    }
    if (currentKey) {
      buffer.push(raw);
    }
  }

  flush();

  return result;
}
