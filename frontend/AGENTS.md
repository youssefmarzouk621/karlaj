<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Validating changes

Before considering a page/component/flow change done, drive it with
Playwright rather than `curl`-ing a route or just checking the dev server's
port is open:

```bash
npx playwright test              # whole suite, headless, against :3000
npx playwright test e2e/cart.spec.ts   # a single spec while iterating
```

The config (`playwright.config.ts`) reuses the dev server already running on
:3000 if there is one. Smoke coverage lives in `e2e/`; if your change touches
a page or flow that isn't covered yet, add a spec for it (navigate, interact
with the actual elements, assert on the resulting state/text) instead of only
re-running what's already there.
<!-- END:nextjs-agent-rules -->
