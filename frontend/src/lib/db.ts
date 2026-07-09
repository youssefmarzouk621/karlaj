// Shared Prisma client for the whole platform. The frontend reads mosaic sizes
// from it (server-side only). See @lego/database.
export { prisma, default } from "@lego/database";
export * from "@lego/database";
