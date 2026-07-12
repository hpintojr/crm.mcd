import "server-only";

import { randomUUID, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { allowedGhlLocations, env } from "@/lib/env";
import { databaseErrorCode, databaseErrorName } from "@/lib/transient-database-retry";

export const MAX_GHL_WEBHOOK_BODY_BYTES = 1_048_576;

export type GhlInboundEvent = {
  ghlEventId: string;
  locationId: string;
  type: string;
  payload: Prisma.InputJsonValue;
};

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function requestIp(request: Request): string | null {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

export function ghlWebhookRequestId(request: Request) {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && supplied.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(supplied) ? supplied : randomUUID();
}

export function ghlWebhookJson(body: unknown, status: number, requestId: string) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Request-Id": requestId,
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

export function verifyGhlWebhookSecret(request: Request) {
  const supplied = request.headers.get("x-mcd-webhook-secret") ?? "";
  if (!env.ghl.webhookSecret || !safeEqual(supplied, env.ghl.webhookSecret)) {
    return { ok: false as const, status: 401, message: "Invalid webhook secret." };
  }
  return { ok: true as const };
}

export function verifyGhlWebhookLocation(locationId: string) {
  if (!allowedGhlLocations().has(locationId)) {
    return { ok: false as const, status: 202, message: "Unapproved GHL location." };
  }
  return { ok: true as const };
}

export function verifyGhlWebhook(request: Request, locationId: string) {
  const secret = verifyGhlWebhookSecret(request);
  if (!secret.ok) return secret;
  return verifyGhlWebhookLocation(locationId);
}

export async function prepareGhlWebhookRequest(request: Request) {
  const requestId = ghlWebhookRequestId(request);
  const secret = verifyGhlWebhookSecret(request);
  if (!secret.ok) {
    return {
      ok: false as const,
      response: ghlWebhookJson({ error: secret.message }, secret.status, requestId),
    };
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_GHL_WEBHOOK_BODY_BYTES) {
    return {
      ok: false as const,
      response: ghlWebhookJson({ error: "Webhook request too large." }, 413, requestId),
    };
  }

  let rawText: string;
  try {
    rawText = await request.text();
  } catch {
    return {
      ok: false as const,
      response: ghlWebhookJson({ error: "Unable to read webhook request." }, 400, requestId),
    };
  }

  if (new TextEncoder().encode(rawText).byteLength > MAX_GHL_WEBHOOK_BODY_BYTES) {
    return {
      ok: false as const,
      response: ghlWebhookJson({ error: "Webhook request too large." }, 413, requestId),
    };
  }

  try {
    return { ok: true as const, requestId, raw: JSON.parse(rawText) as unknown };
  } catch {
    return {
      ok: false as const,
      response: ghlWebhookJson({ error: "Invalid JSON." }, 400, requestId),
    };
  }
}

export function sanitizedGhlWebhookFailure(error: unknown) {
  return {
    errorName: databaseErrorName(error),
    errorCode: databaseErrorCode(error),
  };
}

export function logGhlWebhookRuntimeFailure(input: {
  source: string;
  requestId: string;
  error: unknown;
  refId?: string | null;
}) {
  console.error(
    "[ghl-webhook] processing failure",
    JSON.stringify({
      source: input.source,
      requestId: input.requestId,
      refId: input.refId ?? null,
      ...sanitizedGhlWebhookFailure(input.error),
    }),
  );
}

export async function recordInboundEvent(event: GhlInboundEvent) {
  try {
    await db.webhookEvent.create({
      data: {
        provider: "GHL",
        ghlEventId: event.ghlEventId,
        locationId: event.locationId,
        type: event.type,
        payload: event.payload,
      },
    });
    return { firstTime: true as const, retry: false as const };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;

    // Exactly one delivery may reopen an event that previously reached ERROR.
    // Concurrent duplicates race on this conditional update; only the winner receives count=1.
    const claimed = await db.webhookEvent.updateMany({
      where: {
        ghlEventId: event.ghlEventId,
        status: "ERROR",
      },
      data: {
        status: "RECEIVED",
        processedAt: null,
        locationId: event.locationId,
        type: event.type,
        payload: event.payload,
      },
    });

    if (claimed.count !== 1) return { firstTime: false as const, retry: false as const };
    return { firstTime: true as const, retry: true as const };
  }
}

export async function finishInboundEvent(ghlEventId: string, status: "PROCESSED" | "ERROR") {
  await db.webhookEvent.update({
    where: { ghlEventId },
    data: { status, processedAt: new Date() },
  });
}

export async function logIntegrationError(input: {
  source: string;
  message: string;
  refId?: string | null;
  payload?: Prisma.InputJsonValue;
}) {
  return db.integrationError.create({
    data: {
      source: input.source,
      message: input.message,
      refId: input.refId ?? null,
      payload: input.payload,
    },
  });
}
