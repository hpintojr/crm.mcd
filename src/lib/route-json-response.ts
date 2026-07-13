import "server-only";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
const MAX_REQUEST_ID_LENGTH = 128;

export type RouteJsonResponseOptions = {
  status?: number;
  requestId?: string;
  noindex?: boolean;
  retryAfterSeconds?: number;
};

export function routeRequestId(request: Request) {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && supplied.length <= MAX_REQUEST_ID_LENGTH && REQUEST_ID_PATTERN.test(supplied)
    ? supplied
    : randomUUID();
}

export function routeJsonResponse(
  body: unknown,
  { status = 200, requestId, noindex = false, retryAfterSeconds }: RouteJsonResponseOptions = {},
) {
  const headers: Record<string, string> = {
    "Cache-Control": "no-store, max-age=0",
  };

  if (requestId) headers["X-Request-Id"] = requestId;
  if (noindex) headers["X-Robots-Tag"] = "noindex, nofollow, noarchive";
  if (retryAfterSeconds !== undefined) headers["Retry-After"] = String(retryAfterSeconds);

  return NextResponse.json(body, { status, headers });
}
