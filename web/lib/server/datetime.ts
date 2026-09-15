import { DEFAULT_TIMEZONE } from "../constants";

export type TokyoParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function tokyoParts(moment: Date): TokyoParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: DEFAULT_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(moment)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

export function toDbTimestamp(moment: Date): string {
  const parts = tokyoParts(moment);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}+09:00`;
}

export function formatDateTimeLocalValue(moment: Date): string {
  const parts = tokyoParts(moment);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function formatDateTimeSpace(moment: Date): string {
  const parts = tokyoParts(moment);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function parseDateTimeLocal(text: string): Date {
  const raw = text.trim().replace(" ", "T");
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    throw new Error("日時の形式が正しくありません");
  }
  const second = match[6] ?? "00";
  return new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${second}+09:00`);
}

export function parseDbTimestamp(value: string): Date {
  const normalized = value.trim().replace(" ", "T");
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(normalized)) {
    return new Date(normalized);
  }
  const withSeconds = normalized.length === 16 ? `${normalized}:00` : normalized;
  return new Date(`${withSeconds}+09:00`);
}

export function tokyoTodayNoon(): Date {
  const parts = tokyoParts(new Date());
  return new Date(`${parts.year}-${pad(parts.month)}-${pad(parts.day)}T12:00:00+09:00`);
}
