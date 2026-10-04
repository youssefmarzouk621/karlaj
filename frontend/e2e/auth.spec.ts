import { test, expect } from "@playwright/test";

/**
 * Customer sign-in goes through Keycloak (realm "brickart", client
 * "brickart-frontend" — see docs/keycloak-auth.md). Each run creates a throwaway
 * user through Keycloak's admin API (dev defaults admin/admin) and deletes it
 * afterwards, so no real account or password is involved. Skipped when
 * Keycloak isn't reachable.
 */

const KC = process.env.KEYCLOAK_URL ?? "http://127.0.0.1:9080";
const REALM = "brickart";
const ADMIN = {
  user: process.env.KEYCLOAK_ADMIN_USER ?? "admin",
  password: process.env.KEYCLOAK_ADMIN_PASSWORD ?? "admin",
};

const stamp = Date.now();
const user = {
  username: `e2e-${stamp}`,
  email: `e2e-${stamp}@example.com`,
  firstName: "Test",
  lastName: "Customer",
  password: "Pa55word-e2e",
};
let userId: string | null = null;
let skipReason = "";

async function adminToken(): Promise<string> {
  const res = await fetch(`${KC}/realms/master/protocol/openid-connect/token`, {
    method: "POST",
    body: new URLSearchParams({
      client_id: "admin-cli",
      grant_type: "password",
      username: ADMIN.user,
      password: ADMIN.password,
    }),
  });
  if (!res.ok) throw new Error(`admin login failed (${res.status})`);
  return (await res.json()).access_token;
}

test.beforeAll(async () => {
  try {
    const token = await adminToken();
    const res = await fetch(`${KC}/admin/realms/${REALM}/users`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        enabled: true,
        emailVerified: true,
        credentials: [{ type: "password", value: user.password, temporary: false }],
      }),
    });
    if (res.status !== 201) throw new Error(`create user failed (${res.status})`);
    userId = res.headers.get("location")!.split("/").pop()!;
  } catch (e) {
    skipReason = `Keycloak not usable: ${(e as Error).message}`;
  }
});

test.afterAll(async () => {
  if (!userId) return;
  const token = await adminToken();
  await fetch(`${KC}/admin/realms/${REALM}/users/${userId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
});

test.beforeEach(() => test.skip(!!skipReason, skipReason));

test("log in through Keycloak, see the account menu, log out", async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto("/pricing");
  await page.getByRole("link", { name: "Log in" }).first().click();

  // Keycloak's themed login page.
  await expect(page).toHaveURL(new RegExp(`${KC.replace(/\./g, "\\.")}/realms/${REALM}/`));
  await page.locator("#username").fill(user.username);
  await page.locator("#password").fill(user.password);
  await page.locator("#kc-login").click();

  // Back on the page they came from, signed in.
  await expect(page).toHaveURL(/localhost:3000\/pricing/);
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByText(user.email)).toBeVisible();
  await expect(page.getByText(`${user.firstName} ${user.lastName}`)).toBeVisible();

  // Visiting /login while signed in just goes back to the site.
  await page.keyboard.press("Escape");
  await page.goto("/login");
  await expect(page).toHaveURL(/localhost:3000\/$/);

  // Log out ends the Keycloak session too: logging in again asks for credentials.
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL(/localhost:3000\/$/);
  await expect(page.getByRole("link", { name: "Log in" }).first()).toBeVisible();
  await page.goto("/login");
  await expect(page.locator("#username")).toBeVisible();
});

test("a wrong password stays on Keycloak with an error", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#username").fill(user.username);
  await page.locator("#password").fill("not-the-password");
  await page.locator("#kc-login").click();
  await expect(page.locator("#input-error-username")).toBeVisible();
});

test("an auth error shows a message instead of looping back to Keycloak", async ({ page }) => {
  await page.goto("/login?error=Configuration");
  await expect(page.getByRole("heading", { name: "We couldn't sign you in" })).toBeVisible();
  await expect(page).toHaveURL(/localhost:3000\/login/);
});

test("a visitor can create an account from the site and is signed in afterwards", async ({ page }) => {
  test.setTimeout(90_000);
  const reg = {
    username: `e2e-reg-${stamp}`,
    email: `e2e-reg-${stamp}@example.com`,
    password: "Pa55word-e2e-reg",
  };

  // /login?register=1 opens Keycloak's sign-up form.
  await page.goto("/login?register=1");
  await expect(page.locator("#kc-register-form")).toBeVisible();
  await page.locator("#firstName").fill("New");
  await page.locator("#lastName").fill("Customer");
  await page.locator("#email").fill(reg.email);
  await page.locator("#username").fill(reg.username);
  await page.locator("#password").fill(reg.password);
  await page.locator("#password-confirm").fill(reg.password);
  await page.getByRole("button", { name: "Create account" }).click();

  try {
    // Registration signs them in and returns to the site.
    await expect(page).toHaveURL(/localhost:3000\/$/);
    const menu = page.getByRole("button", { name: "Account menu" });
    await expect(async () => {
      await menu.click(); // may land just before hydration; retry until the menu opens
      await expect(page.getByText(reg.email)).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
  } finally {
    // Remove the account this test created, pass or fail.
    const token = await adminToken();
    const found = await fetch(`${KC}/admin/realms/${REALM}/users?username=${reg.username}&exact=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    for (const u of await found.json()) {
      await fetch(`${KC}/admin/realms/${REALM}/users/${u.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  }
});

test("the login page offers account creation", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
});
