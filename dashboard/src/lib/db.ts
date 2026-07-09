// The Prisma client + all generated types now live in the shared @lego/database
// package (one schema for the whole platform). Re-exported here so existing
// imports (`@/lib/db`) keep working unchanged.
export { prisma, default } from "@lego/database";
export * from "@lego/database";
