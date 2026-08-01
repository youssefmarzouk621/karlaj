import { defineConfig, devices } from "@playwright/test";

// Agent-facing validation harness: run a real browser against the app instead
// of curling routes or checking whether a port is open. See AGENTS.md.
//
// Note: /dashboard/* and most /api/* routes require a real Keycloak session
// (see src/middleware.ts) — this config can't drive those without live
// admin credentials. It covers the public routes and the auth redirect.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3002",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Reuses whatever dev server is already running on :3002 (the common case
  // while iterating); starts one only if none is up. Requires the infra
  // services (MySQL + Keycloak) to already be running — see AGENTS.md.
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3002",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
