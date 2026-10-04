# Customer sign-in (Keycloak)

The storefront (`frontend/`) signs customers in through Keycloak with Auth.js
(`next-auth`). The `/login` route hands the visitor to Keycloak's themed login
page (see `infra/docker/themes/brickart`) and Keycloak sends them back signed in.
The dashboard uses the same realm with its own client (`brickart-dashboard`).

## What lives where

| | |
|---|---|
| `frontend/src/auth.ts` | Auth.js config (Keycloak provider, JWT session cookie) |
| `frontend/src/app/api/auth/[...nextauth]/route.ts` | Auth.js endpoints |
| `frontend/src/app/login/` | `/login` → forwards to Keycloak (`?callbackUrl=/path`, `?register=1` opens sign-up) |
| `frontend/src/lib/logout.ts` | "Log out": ends the local session **and** the Keycloak one |
| `frontend/src/components/Header.tsx` | Log in button / account menu |

Nothing is stored in the shop database; the session is a signed cookie.
No page requires a login yet — the cart still works anonymously.

## Keycloak setup

Admin console: http://localhost:9080/admin (admin / admin) → realm **brickart**.

### 1. Create the client — *Clients → Create client*

| Field | Value |
|---|---|
| Client type | OpenID Connect |
| Client ID | `brickart-frontend` |
| Name | BrickArt storefront |
| Client authentication | **On** (confidential) |
| Authentication flow | **Standard flow** only (turn off Direct access grants, Implicit, Service accounts) |
| Root URL / Home URL | `http://localhost:3000` |
| Valid redirect URIs | `http://localhost:3000/api/auth/callback/keycloak` |
| Valid post logout redirect URIs | `http://localhost:3000/*` |
| Web origins | `http://localhost:3000` |

Then **Credentials** tab → copy the **Client secret**.

### 2. Environment — `frontend/.env`

```
AUTH_KEYCLOAK_ISSUER="http://127.0.0.1:9080/realms/brickart"
AUTH_KEYCLOAK_ID="brickart-frontend"
AUTH_KEYCLOAK_SECRET="<client secret>"
AUTH_SECRET="<openssl rand -base64 32>"
AUTH_URL="http://localhost:3000"
```

Restart `npm run dev` after changing env. (`frontend/.env.example` lists the same keys.)

### 3. Realm settings (optional, your call)

- **Realm settings → Login → User registration: On** (enabled) lets customers create their own account
  (shows "Create account" on the login page).
- **Forgot password**, **Email as username**, **Remember me** are on the same tab. "Forgot password"
  and email verification need an SMTP server under **Realm settings → Email**.
- **Realm settings → Themes → Login theme: `brickart`**.

## Production

Use the real HTTPS origin everywhere: set `AUTH_URL`, and add that origin's
`/api/auth/callback/keycloak` redirect URI, `/*` post-logout URI and web origin to the
client. `AUTH_KEYCLOAK_ISSUER` must be the URL users' browsers reach Keycloak on.

## Tests

`frontend/e2e/auth.spec.ts` creates a throwaway Keycloak user through the admin API
(`KEYCLOAK_ADMIN_USER` / `KEYCLOAK_ADMIN_PASSWORD`, default admin/admin), logs in and out
through the real UI, and deletes the user. It skips itself if Keycloak isn't reachable.
