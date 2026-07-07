import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrlForRuntime } from "@/lib/db-integration-test-guard";

// Prisma singleton — avoids exhausting connections during dev hot-reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const databaseUrl = resolveDatabaseUrlForRuntime();

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
