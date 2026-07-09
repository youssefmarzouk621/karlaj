import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // The shared @lego/database package lives outside this folder (sibling
  // package), so point Turbopack at the repo root to resolve the symlinked
  // dependency, and transpile it since it ships compiled JS + the Prisma client.
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  transpilePackages: ["@lego/database"],
};

export default nextConfig;
