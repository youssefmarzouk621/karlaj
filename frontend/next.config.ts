import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // The shared @lego/database package is a sibling folder, so point Turbopack at
  // the repo root to resolve the symlinked dependency and transpile it.
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  transpilePackages: ["@lego/database"],
};

export default nextConfig;
