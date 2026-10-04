# BrickArt Keycloak login theme

Restyles Keycloak's login pages (sign in, register, forgot password, OTP, errors…)
with the site's split-screen design: a mosaic panel on the left, the form on the right,
Familjen Grotesk headings, pill buttons, light and dark mode. It extends Keycloak's default `keycloak.v2` theme,
so every page keeps working — it only adds CSS (`login/resources/css/brickart.css`),
the decorative panel (`login/footer.ftl`), page copy and self-hosted fonts.

## Use it

The theme is mounted into the Keycloak container by `../keycloak.yml`
(`./themes` → `/opt/keycloak/themes`). After the first mount, recreate the container:

```bash
cd infra && npm run services:up      # or: docker compose -f docker/services.yml up -d keycloak
```

Then select it for the realm:

1. Open the admin console — http://localhost:9080/admin (admin / admin).
2. Switch to the **brickart** realm (top-left realm dropdown).
3. **Realm settings → Themes**.
4. **Login theme** → choose **brickart**.
5. **Save**.

Open any login page (e.g. the dashboard at http://localhost:3002) in a private window to see it.

To make a fresh realm start with it, add `"loginTheme": "brickart"` to the realm JSON
you import (`docker/realm-config/`).

## Change it

- **Images:** the panel on the left uses `login/resources/img/mosaic-portrait.png` (login) and
  the four `mosaic-*.png` files (register). Replace those files, keeping the names, or edit
  `login/footer.ftl`. They are placeholders — use images you have the rights to.
- **Copy:** `login/messages/messages_en.properties` (page titles, button labels).
- **Look:** `login/resources/css/brickart.css` (tokens are at the top).
- In dev (`start-dev`) theme files are re-read on every request, so reload the page.
  In production restart Keycloak (or disable theme caching) after changes.

## Deploy

Copy `themes/brickart/` into the server's `/opt/keycloak/themes/` (or mount it, as here),
then select it as above.
