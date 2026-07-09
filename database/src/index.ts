import { PrismaClient } from "@prisma/client";

/**
 * Single shared Prisma client for the whole platform.
 *
 * The dashboard and the Next.js frontend both consume this package so there is
 * exactly one schema and one generated client. In long-running Node processes
 * (and across Next.js dev hot-reloads) we cache the instance on `globalThis` to
 * avoid exhausting the MySQL connection pool.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
export * from "./settings";
export default prisma;
