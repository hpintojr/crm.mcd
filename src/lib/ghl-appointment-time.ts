import "server-only";

function isTimeZone(value: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }).format(); return true; } catch { return false; }
}

function offsetAt(instant: number, timeZone: string) {
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant)).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second)) - instant;
}

export function parseGhlAppointmentDate(value: string, field: string, timeZone?: string) {
  const source = value.trim();
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(source)) {
    const date = new Date(source);
    if (!Number.isNaN(date.getTime())) return date;
  }
  const match = source.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/);
  if (!match || !timeZone || !isTimeZone(timeZone)) throw new Error(`Invalid ${field} value or appointment timezone.`);
  const wallTime = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] ?? 0), Number((match[7] ?? "0").padEnd(3, "0")));
  let instant = wallTime;
  for (let index = 0; index < 2; index += 1) instant = wallTime - offsetAt(instant, timeZone);
  return new Date(instant);
}
