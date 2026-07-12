import "server-only";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export const MAX_PORTAL_WRITE_BODY_BYTES = 16_384;

export function portalRequestId(request: Request) {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && supplied.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(supplied) ? supplied : randomUUID();
}

export function portalJson(body: unknown, status: number, requestId: string) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Request-Id": requestId,
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

export function portalNoContent(requestId: string) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Request-Id": requestId,
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

export async function preparePortalJson(request: Request, requestId: string) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PORTAL_WRITE_BODY_BYTES) {
    return {
      ok: false as const,
      response: portalJson({ error: "Request too large." }, 413, requestId),
    };
  }

  let rawText: string;
  try {
    rawText = await request.text();
  } catch {
    return {
      ok: false as const,
      response: portalJson({ error: "Unable to read request." }, 400, requestId),
    };
  }

  if (new TextEncoder().encode(rawText).byteLength > MAX_PORTAL_WRITE_BODY_BYTES) {
    return {
      ok: false as const,
      response: portalJson({ error: "Request too large." }, 413, requestId),
    };
  }

  try {
    return { ok: true as const, raw: JSON.parse(rawText) as unknown };
  } catch {
    return {
      ok: false as const,
      response: portalJson({ error: "Invalid JSON." }, 400, requestId),
    };
  }
}

export function expectedColdLeadCallFailure(error: unknown): { error: string; status: number } | null {
  if (!(error instanceof Error)) return null;

  if (error.message === "Lead access is pending manager certification.") {
    return { error: "Lead access is pending manager certification.", status: 403 };
  }

  if (error.message.startsWith("Admins may only act on controlled test Leads.")) {
    return { error: "This action is not available for this Lead.", status: 403 };
  }

  if (error.message === "This Cold Lead is no longer available for activity logging.") {
    return { error: "This Lead is no longer available for activity logging.", status: 409 };
  }

  return null;
}
