<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Validating changes

Before considering a page/component/flow change done, drive it with
Playwright rather than `curl`-ing a route or just checking the dev server's
port is open:

```bash
npx playwright test              # whole suite, headless, against :3002
npx playwright test e2e/smoke.spec.ts   # a single spec while iterating
```

The config (`playwright.config.ts`) reuses the dev server already running on
:3002 if there is one (needs the infra services up first — see the root
`AGENTS.md`). Smoke coverage lives in `e2e/`.

`/dashboard/*` pages and most `/api/*` routes require a real Keycloak session
(`src/middleware.ts`) that Playwright can't obtain without live admin
credentials — it can only exercise public routes (`/login`) and confirm the
auth redirect happens. It cannot verify what an authenticated admin actually
sees on e.g. the Pricing or Palettes pages. When your change is on an
authenticated page, say explicitly that Playwright coverage stops at the auth
gate rather than claiming the page itself was verified.
<!-- END:nextjs-agent-rules -->
