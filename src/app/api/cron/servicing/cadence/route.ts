import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { runServiceCadenceSweep } from "@/lib/service-cadence-jobs";
import { routeJsonResponse, routeRequestId } from "@/lib/route-json-response";
import {
  databaseErrorCode,
  databaseErrorName,
  isTransientDatabaseError,
  retryTransientDatabaseOperation,
  TransientDatabaseRetryExhaustedError,
} from "@/lib/transient-database-retry";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const DATABASE_PROBE_MAX_ATTEMPTS = 5;
const DATABASE_PROBE_INITIAL_DELAY_MS = 1_000;
const DATABASE_PROBE_MAX_DELAY_MS = 8_000;
const RETRY_AFTER_SECONDS = 60;

type FailurePhase = "database-readiness" | "sweep";

function authorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  return Boolean(cronSecret && header === `Bearer ${cronSecret}`);
}

function readDryRun(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("dryRun")?.toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function readLimit(request: NextRequest) {
  const value = Number(request.nextUrl.searchParams.get("limit") ?? "");
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function requestId(request: NextRequest) {
  return routeRequestId(request);
}

function json(body: unknown, status = 200, id?: string, retryable = false) {
  return routeJsonResponse(body, {
    status,
    requestId: id,
    retryAfterSeconds: retryable ? RETRY_AFTER_SECONDS : undefined,
  });
}

function logFailure(input: {
  requestId: string;
  phase: FailurePhase;
  error: unknown;
  databaseProbeAttempts: number;
  retryable: boolean;
}) {
  const sourceError = input.error instanceof TransientDatabaseRetryExhaustedError ? input.error.lastError : input.error;
  console.error(
    "[service-cadence-cron] failure",
    JSON.stringify({
      requestId: input.requestId,
      phase: input.phase,
      retryable: input.retryable,
      databaseProbeAttempts: input.databaseProbeAttempts,
      errorName: databaseErrorName(sourceError),
      errorCode: databaseErrorCode(sourceError),
    }),
  );
}

export async function GET(request: NextRequest) {
  const id = requestId(request);
  if (!features.servicing) return json({ error: "Not found.", requestId: id }, 404, id);
  if (!authorized(request)) return json({ error: "Unauthorized.", requestId: id }, 401, id);

  let phase: FailurePhase = "database-readiness";
  let databaseProbeAttempts = 0;

  try {
    const probe = await retryTransientDatabaseOperation(
      () => db.$queryRaw<Array<{ ready: number }>>(Prisma.sql`SELECT 1 AS "ready"`),
      {
        maxAttempts: DATABASE_PROBE_MAX_ATTEMPTS,
        initialDelayMs: DATABASE_PROBE_INITIAL_DELAY_MS,
        maxDelayMs: DATABASE_PROBE_MAX_DELAY_MS,
        onRetry: ({ attempt, nextAttempt, delayMs, error }) => {
          console.warn(
            "[service-cadence-cron] database readiness retry",
            JSON.stringify({
              requestId: id,
              attempt,
              nextAttempt,
              delayMs,
              errorName: databaseErrorName(error),
              errorCode: databaseErrorCode(error),
            }),
          );
        },
      },
    );
    databaseProbeAttempts = probe.attempts;

    phase = "sweep";
    // The mutating sweep runs exactly once. Only the read-only SELECT 1 readiness probe is retried.
    const result = await runServiceCadenceSweep({ dryRun: readDryRun(request), limit: readLimit(request) });
    return json({ ...result, requestId: id, databaseProbeAttempts }, 200, id);
  } catch (error) {
    const readinessExhausted = error instanceof TransientDatabaseRetryExhaustedError;
    const retryable = readinessExhausted || isTransientDatabaseError(error);
    const attempts = readinessExhausted ? error.attempts : databaseProbeAttempts;

    logFailure({ requestId: id, phase, error, databaseProbeAttempts: attempts, retryable });

    if (retryable) {
      return json(
        {
          ok: false,
          error: "Service cadence sweep could not complete because the database connection was unavailable.",
          retryable: true,
          phase,
          requestId: id,
          databaseProbeAttempts: attempts,
        },
        503,
        id,
        true,
      );
    }

    return json(
      {
        ok: false,
        error: "Service cadence sweep failed.",
        retryable: false,
        phase,
        requestId: id,
        databaseProbeAttempts: attempts,
      },
      500,
      id,
    );
  }
}
