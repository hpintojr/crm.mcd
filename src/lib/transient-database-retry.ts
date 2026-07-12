const TRANSIENT_DATABASE_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);

const TRANSIENT_DATABASE_MESSAGE_PATTERNS = [
  /can't reach database server/i,
  /cannot reach database server/i,
  /connection (?:was )?(?:closed|terminated|reset)/i,
  /server closed the connection unexpectedly/i,
  /timed out fetching a new connection/i,
  /connection pool timeout/i,
  /socket hang up/i,
  /econnreset/i,
  /etimedout/i,
  /eai_again/i,
  /pgbouncer.*(?:connect|connection)/i,
];

type ErrorLike = {
  name?: unknown;
  message?: unknown;
  code?: unknown;
  cause?: unknown;
};

export type TransientRetryOptions = {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (context: { attempt: number; nextAttempt: number; delayMs: number; error: unknown }) => void;
};

export class TransientDatabaseRetryExhaustedError extends Error {
  readonly attempts: number;
  readonly retryable = true;
  readonly lastError: unknown;

  constructor(attempts: number, lastError: unknown) {
    super(`Transient database operation failed after ${attempts} attempts.`);
    this.name = "TransientDatabaseRetryExhaustedError";
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

function errorChain(error: unknown) {
  const chain: ErrorLike[] = [];
  let current = error;
  const seen = new Set<unknown>();

  while (current && typeof current === "object" && chain.length < 6 && !seen.has(current)) {
    seen.add(current);
    const item = current as ErrorLike;
    chain.push(item);
    current = item.cause;
  }

  return chain;
}

export function databaseErrorCode(error: unknown) {
  for (const item of errorChain(error)) {
    if (typeof item.code === "string" && item.code.trim()) return item.code.trim();
  }
  return null;
}

export function databaseErrorName(error: unknown) {
  for (const item of errorChain(error)) {
    if (typeof item.name === "string" && item.name.trim()) return item.name.trim();
  }
  return "UnknownError";
}

export function isTransientDatabaseError(error: unknown) {
  for (const item of errorChain(error)) {
    if (typeof item.code === "string" && TRANSIENT_DATABASE_CODES.has(item.code)) return true;
    if (typeof item.message === "string" && TRANSIENT_DATABASE_MESSAGE_PATTERNS.some((pattern) => pattern.test(item.message as string))) {
      return true;
    }
  }
  return false;
}

function boundedInteger(value: number | undefined, fallback: number, min: number, max: number) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Retry option must be an integer between ${min} and ${max}.`);
  }
  return value;
}

function delay(ms: number) {
  if (ms <= 0) return Promise.resolve();
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function retryTransientDatabaseOperation<T>(
  operation: (attempt: number) => Promise<T>,
  options: TransientRetryOptions = {},
) {
  const maxAttempts = boundedInteger(options.maxAttempts, 3, 1, 5);
  const initialDelayMs = boundedInteger(options.initialDelayMs, 250, 0, 5_000);
  const maxDelayMs = boundedInteger(options.maxDelayMs, 1_000, 0, 10_000);

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return { value: await operation(attempt), attempts: attempt };
    } catch (error) {
      if (!isTransientDatabaseError(error)) throw error;
      lastError = error;
      if (attempt === maxAttempts) break;

      const delayMs = Math.min(initialDelayMs * 2 ** (attempt - 1), maxDelayMs);
      options.onRetry?.({ attempt, nextAttempt: attempt + 1, delayMs, error });
      await delay(delayMs);
    }
  }

  throw new TransientDatabaseRetryExhaustedError(maxAttempts, lastError);
}
