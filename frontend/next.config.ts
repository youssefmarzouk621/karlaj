import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // The shared @lego/database package is a sibling folder, so point Turbopack at
  // the repo root to resolve the symlinked dependency and transpile it.
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  transpilePackages: ["@lego/database"],
  // @napi-rs/canvas ships a native .node binding — exclude it from Turbopack's
  // bundling and load it via native `require` instead (like the plain
  // `canvas` package, which Next externalizes by default; this one isn't on
  // that built-in list).
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default nextConfig;
