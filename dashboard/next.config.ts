import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Self-contained server build for the Docker image (see Dockerfile). Traced
  // from the repo root so the shared database package is bundled in.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, ".."),
  // The shared @lego/database package lives outside this folder (sibling
  // package), so point Turbopack at the repo root to resolve the symlinked
  // dependency, and transpile it since it ships compiled JS + the Prisma client.
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  transpilePackages: ["@lego/database"],
};

export default nextConfig;
