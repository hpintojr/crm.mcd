import "server-only";

const monthNames: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const timeZoneAliases: Record<string, string> = {
  pst: "America/Los_Angeles",
  pdt: "America/Los_Angeles",
  "pacific time": "America/Los_Angeles",
  "pacific time (us & canada)": "America/Los_Angeles",
  "america/los angeles": "America/Los_Angeles",
};

function normalizeTimeZone(value: string) {
  const candidate = value.trim();
  return timeZoneAliases[candidate.toLowerCase()] ?? candidate;
}

function isTimeZone(value: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }).format(); return true; } catch { return false; }
}

function offsetAt(instant: number, timeZone: string) {
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant)).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second)) - instant;
}

function hourFromMeridiem(hour: number, meridiem?: string) {
  if (!meridiem) return hour;
  const normalized = meridiem.toUpperCase();
  if (hour < 1 || hour > 12) return Number.NaN;
  if (normalized === "AM") return hour === 12 ? 0 : hour;
  return hour === 12 ? 12 : hour + 12;
}

function wallTimeToDate(parts: { year: number; month: number; day: number; hour: number; minute: number; second?: number; millisecond?: number }, timeZone: string) {
  const normalizedTimeZone = normalizeTimeZone(timeZone);
  if (!isTimeZone(normalizedTimeZone)) throw new Error("Invalid appointment timezone.");
  const wallTime = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second ?? 0, parts.millisecond ?? 0);
  let instant = wallTime;
  for (let index = 0; index < 2; index += 1) instant = wallTime - offsetAt(instant, normalizedTimeZone);
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid appointment date.");
  return date;
}

function parseWallClock(source: string) {
  const iso = source.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[T\s](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?\s*(AM|PM)?$/i);
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]), hour: hourFromMeridiem(Number(iso[4]), iso[8]), minute: Number(iso[5]), second: Number(iso[6] ?? 0), millisecond: Number((iso[7] ?? "0").padEnd(3, "0")) };

  const numeric = source.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,)?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (numeric) return { year: Number(numeric[3]), month: Number(numeric[1]), day: Number(numeric[2]), hour: hourFromMeridiem(Number(numeric[4]), numeric[7]), minute: Number(numeric[5]), second: Number(numeric[6] ?? 0), millisecond: 0 };

  const named = source.match(/^(?:[A-Za-z]+,\s+)?([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})(?:,)?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (named) {
    const month = monthNames[named[1].toLowerCase()];
    return { year: Number(named[3]), month, day: Number(named[2]), hour: hourFromMeridiem(Number(named[4]), named[7]), minute: Number(named[5]), second: Number(named[6] ?? 0), millisecond: 0 };
  }

  return null;
}

export function parseGhlAppointmentDate(value: string, field: string, timeZone?: string) {
  const source = value.trim();
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(source)) {
    const date = new Date(source);
    if (!Number.isNaN(date.getTime())) return date;
  }
  const wallClock = parseWallClock(source);
  if (!wallClock || !timeZone || Number.isNaN(wallClock.hour) || !wallClock.month || wallClock.month < 1 || wallClock.month > 12) throw new Error(`Invalid ${field} value or appointment timezone.`);
  return wallTimeToDate(wallClock, timeZone);
}
