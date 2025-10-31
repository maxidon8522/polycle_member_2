import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";
import { startOfWeek, formatISO, parseISO, addDays } from "date-fns";
import { DEFAULT_TIMEZONE, START_OF_WEEK } from "@/config/constants";
import type { DailyReport } from "@/types";

export const toTimezone = (date: Date | string, tz = DEFAULT_TIMEZONE) => {
  const instance = typeof date === "string" ? parseISO(date) : date;
  // v3: utcToZonedTime → toZonedTime
  return toZonedTime(instance, tz);
};

export const fromTimezone = (date: Date | string, tz = DEFAULT_TIMEZONE) => {
  const instance = typeof date === "string" ? parseISO(date) : date;
  // v3: zonedTimeToUtc → fromZonedTime
  return fromZonedTime(instance, tz);
};

export const getWeekStart = (
  date: Date | string,
  tz = DEFAULT_TIMEZONE,
): string => {
  const zoned = toTimezone(date, tz);
  const weekStart = startOfWeek(zoned, { weekStartsOn: START_OF_WEEK });
  return formatISO(weekStart, { representation: "date" });
};

export const getWeekdayCode = (
  date: Date | string,
  tz = DEFAULT_TIMEZONE,
): DailyReport["weekday"] => {
  const instance = typeof date === "string" ? parseISO(date) : date;
  const label = formatInTimeZone(instance, tz, "EEE");
  switch (label) {
    case "Mon":
      return "Mon";
    case "Tue":
      return "Tue";
    case "Wed":
      return "Wed";
    case "Thu":
      return "Thu";
    case "Fri":
      return "Fri";
    case "Sat":
      return "Sat";
    case "Sun":
    default:
      return "Sun";
  }
};

export const getReportLocalDate = (
  now = new Date(),
  tz = DEFAULT_TIMEZONE,
): string => {
  const zoned = toTimezone(now, tz);
  const hour = Number.parseInt(formatInTimeZone(zoned, tz, "H"), 10);
  const target = hour < 5 ? addDays(zoned, -1) : zoned;
  return formatInTimeZone(target, tz, "yyyy-MM-dd");
};

export const getReportWeekdayCode = (
  dateISO: string,
  tz = DEFAULT_TIMEZONE,
): DailyReport["weekday"] => {
  return getWeekdayCode(dateISO, tz);
};

export const reportDateBy29hRule = (
  now = new Date(),
  tz = DEFAULT_TIMEZONE,
): {
  dateISO: string;
  isPreviousDay: boolean;
} => {
  const zoned = toTimezone(now, tz);
  const hour = Number.parseInt(formatInTimeZone(zoned, tz, "H"), 10);
  const isPreviousDay = hour < 5;
  const target = isPreviousDay ? addDays(zoned, -1) : zoned;
  const dateISO = formatInTimeZone(target, tz, "yyyy-MM-dd");
  return { dateISO, isPreviousDay };
};
