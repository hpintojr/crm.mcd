"use client";

import { useEffect, useState } from "react";

type Props = { startAt: string; endAt?: string | null };

type Value = { text: string; zone: string };

function format(startAt: string, endAt?: string | null): Value {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const start = new Date(startAt);
  const end = endAt ? new Date(endAt) : null;
  const date = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: zone });
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone: zone });
  const day = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: zone });
  const first = `${date.format(start)}, ${time.format(start)}`;
  if (!end) return { text: first, zone };
  const second = day.format(start) === day.format(end) ? time.format(end) : `${date.format(end)}, ${time.format(end)}`;
  return { text: `${first} – ${second}`, zone };
}

export function ViewerTime({ startAt, endAt }: Props) {
  const [value, setValue] = useState<Value | null>(null);
  useEffect(() => setValue(format(startAt, endAt)), [startAt, endAt]);
  return <p className="portal-copy mt-1 text-sm" title={value ? `Displayed in ${value.zone}` : undefined}>{value?.text ?? "Loading your local time…"}</p>;
}
