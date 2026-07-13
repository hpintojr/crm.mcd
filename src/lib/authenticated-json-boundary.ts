import "server-only";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export const MAX_AUTHENTICATED_JSON_BODY_BYTES = 16_384;

export function authenticatedRequestId(request: Request) {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && supplied.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(supplied) ? supplied : randomUUID();
}

export function authenticatedJson(body: unknown, status: number, requestId: string) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Request-Id": requestId,
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

export function authenticatedNoContent(requestId: string) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Request-Id": requestId,
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

export function authenticatedCsvDownload(csv: string, filename: string, requestId: string) {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, max-age=0",
      "X-Request-Id": requestId,
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

export async function prepareAuthenticatedJson(
  request: Request,
  requestId: string,
  maxBodyBytes = MAX_AUTHENTICATED_JSON_BODY_BYTES,
) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
    return {
      ok: false as const,
      response: authenticatedJson({ error: "Request too large." }, 413, requestId),
    };
  }

  let rawText: string;
  try {
    rawText = await request.text();
  } catch {
    return {
      ok: false as const,
      response: authenticatedJson({ error: "Unable to read request." }, 400, requestId),
    };
  }

  if (new TextEncoder().encode(rawText).byteLength > maxBodyBytes) {
    return {
      ok: false as const,
      response: authenticatedJson({ error: "Request too large." }, 413, requestId),
    };
  }

  try {
    return { ok: true as const, raw: JSON.parse(rawText) as unknown };
  } catch {
    return {
      ok: false as const,
      response: authenticatedJson({ error: "Invalid JSON." }, 400, requestId),
    };
  }
}
