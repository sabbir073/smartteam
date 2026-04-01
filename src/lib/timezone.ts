import { supabase } from "./db";

let cachedTimezone: string | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

/**
 * Get system timezone from settings. Cached for 1 minute.
 */
export async function getSystemTimezone(): Promise<string> {
  if (cachedTimezone && Date.now() - cacheTime < CACHE_TTL) {
    return cachedTimezone;
  }

  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "timezone")
    .single();

  const tz = data?.value ? String(data.value).replace(/"/g, "") : "UTC";
  cachedTimezone = tz;
  cacheTime = Date.now();
  return tz;
}

/**
 * Get current date string (YYYY-MM-DD) in the system timezone
 */
export function getNowInTimezone(tz: string): Date {
  // Create a date string in the target timezone, then parse it
  const nowStr = new Date().toLocaleString("en-US", { timeZone: tz });
  return new Date(nowStr);
}

/**
 * Format a Date as YYYY-MM-DD (no timezone shift)
 */
export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Get date range for a period, using system timezone
 */
export function getDateRangeForPeriod(
  period: string,
  tz: string,
  customStart?: string,
  customEnd?: string
) {
  const now = getNowInTimezone(tz);
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = formatDate(now);

  let startDate: string;
  let endDate: string = today;
  let prevStartDate: string;
  let prevEndDate: string;

  switch (period) {
    case "today":
      startDate = today;
      prevStartDate = formatDate(new Date(y, m, now.getDate() - 1));
      prevEndDate = prevStartDate;
      break;
    case "this_month":
      startDate = formatDate(new Date(y, m, 1));
      endDate = today;
      prevStartDate = formatDate(new Date(y, m - 1, 1));
      prevEndDate = formatDate(new Date(y, m, 0));
      break;
    case "last_month":
      startDate = formatDate(new Date(y, m - 1, 1));
      endDate = formatDate(new Date(y, m, 0));
      prevStartDate = formatDate(new Date(y, m - 2, 1));
      prevEndDate = formatDate(new Date(y, m - 1, 0));
      break;
    case "last_6_months":
      startDate = formatDate(new Date(y, m - 5, 1));
      endDate = today;
      prevStartDate = formatDate(new Date(y, m - 11, 1));
      prevEndDate = formatDate(new Date(y, m - 5, 0));
      break;
    case "this_year":
      startDate = `${y}-01-01`;
      endDate = today;
      prevStartDate = `${y - 1}-01-01`;
      prevEndDate = `${y - 1}-12-31`;
      break;
    case "last_year":
      startDate = `${y - 1}-01-01`;
      endDate = `${y - 1}-12-31`;
      prevStartDate = `${y - 2}-01-01`;
      prevEndDate = `${y - 2}-12-31`;
      break;
    case "custom":
      startDate = customStart || today;
      endDate = customEnd || today;
      prevStartDate = startDate;
      prevEndDate = startDate;
      break;
    default:
      startDate = formatDate(new Date(y, m, 1));
      endDate = today;
      prevStartDate = formatDate(new Date(y, m - 1, 1));
      prevEndDate = formatDate(new Date(y, m, 0));
      break;
  }

  return { startDate, endDate, prevStartDate, prevEndDate, today };
}

/**
 * Common timezone list for dropdown
 */
export const TIMEZONE_OPTIONS = [
  { value: "Pacific/Midway", label: "(UTC-11:00) Midway Island" },
  { value: "Pacific/Honolulu", label: "(UTC-10:00) Hawaii" },
  { value: "America/Anchorage", label: "(UTC-09:00) Alaska" },
  { value: "America/Los_Angeles", label: "(UTC-08:00) Pacific Time (US)" },
  { value: "America/Denver", label: "(UTC-07:00) Mountain Time (US)" },
  { value: "America/Chicago", label: "(UTC-06:00) Central Time (US)" },
  { value: "America/New_York", label: "(UTC-05:00) Eastern Time (US)" },
  { value: "America/Sao_Paulo", label: "(UTC-03:00) Sao Paulo" },
  { value: "Atlantic/Azores", label: "(UTC-01:00) Azores" },
  { value: "UTC", label: "(UTC+00:00) UTC" },
  { value: "Europe/London", label: "(UTC+00:00) London" },
  { value: "Europe/Paris", label: "(UTC+01:00) Paris, Berlin" },
  { value: "Europe/Istanbul", label: "(UTC+03:00) Istanbul" },
  { value: "Asia/Dubai", label: "(UTC+04:00) Dubai" },
  { value: "Asia/Karachi", label: "(UTC+05:00) Karachi, Islamabad" },
  { value: "Asia/Kolkata", label: "(UTC+05:30) Mumbai, Delhi" },
  { value: "Asia/Dhaka", label: "(UTC+06:00) Dhaka" },
  { value: "Asia/Bangkok", label: "(UTC+07:00) Bangkok, Jakarta" },
  { value: "Asia/Singapore", label: "(UTC+08:00) Singapore, Kuala Lumpur" },
  { value: "Asia/Shanghai", label: "(UTC+08:00) Beijing, Shanghai" },
  { value: "Asia/Tokyo", label: "(UTC+09:00) Tokyo" },
  { value: "Australia/Sydney", label: "(UTC+10:00) Sydney" },
  { value: "Pacific/Auckland", label: "(UTC+12:00) Auckland" },
];
