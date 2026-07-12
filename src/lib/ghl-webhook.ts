import "server-only";

import { timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { allowedGhlLocations, env } from "@/lib/env";

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

export function verifyGhlWebhook(request: Request, locationId: string) {
  const supplied = request.headers.get("x-mcd-webhook-secret") ?? "";
  if (!env.ghl.webhookSecret || !safeEqual(supplied, env.ghl.webhookSecret)) {
    return { ok: false as const, status: 401, message: "Invalid webhook secret." };
  }
  if (!allowedGhlLocations().has(locationId)) {
    return { ok: false as const, status: 202, message: "Unapproved GHL location." };
  }
  return { ok: true as const };
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
