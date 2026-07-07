export const DB_INTEGRATION_TEST_FLAG = "MCD_RUN_DB_INTEGRATION_TESTS";
export const DB_INTEGRATION_TEST_URL = "MCD_TEST_DATABASE_URL";

type RuntimeEnv = Record<string, string | undefined>;

function nonEmpty(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function databaseIdentity(value: string) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname}`.toLowerCase();
  } catch {
    throw new Error("Integration-test database URLs must be valid absolute URLs.");
  }
}

export function resolveDatabaseUrlForRuntime(env: RuntimeEnv = process.env) {
  const primaryUrl = nonEmpty(env.DATABASE_URL);
  if (env[DB_INTEGRATION_TEST_FLAG] !== "1") return primaryUrl ?? undefined;

  const testUrl = nonEmpty(env[DB_INTEGRATION_TEST_URL]);
  if (!testUrl) {
    throw new Error(`${DB_INTEGRATION_TEST_URL} is required when ${DB_INTEGRATION_TEST_FLAG}=1.`);
  }
  if (!primaryUrl) {
    throw new Error("DATABASE_URL is required so the integration harness can prove the test target is different.");
  }
  if (databaseIdentity(primaryUrl) === databaseIdentity(testUrl)) {
    throw new Error("Integration tests refuse to use the same database target as DATABASE_URL.");
  }

  return testUrl;
}

export function assertDatabaseIntegrationTestEnvironment(env: RuntimeEnv = process.env) {
  if (env[DB_INTEGRATION_TEST_FLAG] !== "1") {
    throw new Error(`${DB_INTEGRATION_TEST_FLAG}=1 is required before running database integration tests.`);
  }
  return resolveDatabaseUrlForRuntime(env);
}
