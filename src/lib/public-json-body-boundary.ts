import "server-only";

import { routeJsonResponse } from "@/lib/route-json-response";

export type PublicJsonBodyOptions = {
  maxBodyBytes: number;
  requestId: string;
};

export async function preparePublicJsonBody(
  request: Request,
  { maxBodyBytes, requestId }: PublicJsonBodyOptions,
) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
    return {
      ok: false as const,
      response: routeJsonResponse(
        { error: "Request too large." },
        { status: 413, requestId, noindex: true },
      ),
    };
  }

  let rawText: string;
  try {
    rawText = await request.text();
  } catch {
    return {
      ok: false as const,
      response: routeJsonResponse(
        { error: "Unable to read request." },
        { status: 400, requestId, noindex: true },
      ),
    };
  }

  if (new TextEncoder().encode(rawText).byteLength > maxBodyBytes) {
    return {
      ok: false as const,
      response: routeJsonResponse(
        { error: "Request too large." },
        { status: 413, requestId, noindex: true },
      ),
    };
  }

  try {
    return { ok: true as const, body: JSON.parse(rawText) as unknown };
  } catch {
    return {
      ok: false as const,
      response: routeJsonResponse(
        { error: "Invalid JSON" },
        { status: 400, requestId, noindex: true },
      ),
    };
  }
}
