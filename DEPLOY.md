# Deploying BrickArt

The production setup has two Docker Compose stacks on one server:

```
/opt
├── traefik/                 reverse proxy + Let's Encrypt (its own stack)
│   ├── compose.yml
│   ├── .env                 DOMAIN, Cloudflare credentials, dashboard login
│   └── letsencrypt/         certificates (created on first start)
└── app/                     the BrickArt stack
    ├── compose.yml
    ├── .dockerignore
    ├── .env                 global: DOMAIN (the one line), DB passwords, API keys
    ├── .env-frontend        storefront settings
    ├── .env-dashboard       admin settings
    ├── .env-mosaic          mosaic-generator settings
    ├── frontend/            Dockerfile, entrypoint.sh
    ├── dashboard/           Dockerfile, entrypoint.sh (+ the `dbtools` image target)
    ├── mosaic-generator/    Dockerfile
    ├── database/            shared Prisma schema + seeds (built into frontend & dashboard)
    └── infra/docker/        Keycloak theme, realm import, MySQL init script
```

| URL | Service |
|---|---|
| `https://DOMAIN` (`www.` redirects here) | frontend (storefront) |
| `https://dashboard.DOMAIN` | dashboard (admin) |
| `https://auth.DOMAIN` | Keycloak (customer + admin sign-in) |
| `https://traefik.DOMAIN` | Traefik dashboard (basic auth) |
| internal only | mysql, mosaic-generator |

Traefik and the app talk over the external Docker network `traefik`. Only
Traefik publishes ports (80, 443).

## The shared database

- The **`database/` folder must be in `/opt/app`**. The frontend and dashboard
  images are built from the repo root, and each one compiles the shared Prisma
  package into its image. Without that folder neither image builds.
- One MySQL container (`mysql`, volume `brickart_mysql-data`) holds two databases:
  `brickart` for the app (all three services) and `keycloak` for Keycloak.
  `infra/docker/mysql-init/01-keycloak.sh` creates the Keycloak database **only
  the first time MySQL starts on an empty volume**.
- **Only the dashboard changes the schema.** On start, its `entrypoint.sh` runs
  `prisma migrate deploy` if `database/prisma/migrations/` exists. If it
  doesn't (the case today, because the project uses `db push`), it runs
  `prisma db push`, which refuses changes that would lose data. If it refuses,
  the container exits and the logs say why. The frontend's entrypoint has the
  same logic, but `RUN_MIGRATIONS=false` turns it off, and the frontend waits
  for the dashboard to be healthy before it starts.
- Rendered artwork images live in the `brickart_uploads` volume, mounted at
  `frontend/public/uploads`.

## 0. Snapshot your local data (optional)

To start production with the same database and Keycloak setup you have
locally, run this on your machine with the local infra running
(`cd infra && npm run services:up`):

```bash
infra/scripts/export-local-data.sh
```

It writes three files:

| File | Contents | Loaded on the server by |
|---|---|---|
| `infra/docker/mysql-init/data/brickart.sql.gz` | the `brickart` database; `http://localhost:3000` image URLs replaced by a placeholder | `mysql-init/02-brickart-data.sh`, first start of an empty MySQL volume |
| `infra/docker/realm-config/brickart-realm.json` | Keycloak realm `brickart`: clients, roles, users, theme. Localhost URLs become `https://${DOMAIN}` / `https://dashboard.${DOMAIN}`; client secrets become `${KEYCLOAK_*_CLIENT_SECRET}` | Keycloak `--import-realm`, if the realm doesn't exist yet |
| `infra/docker/data-export/uploads.tgz` | `frontend/public/uploads` (rendered artwork images) | step 3.6 |

They contain real data (customer carts, password hashes), so they're
**gitignored**. Copy them next to the code after step 3.1:

```bash
rsync -avR infra/docker/mysql-init/data infra/docker/realm-config/brickart-realm.json \
  infra/docker/data-export user@server:/opt/app/
```

The MySQL and Keycloak imports only run on a **fresh** stack. To re-import
later, run `docker compose down -v` (this deletes all production data) and
start again.

## 1. Server prerequisites

- Docker Engine 24+ with the Compose plugin (`docker compose version`).
- Cloudflare DNS for the domain: an `A` record for `DOMAIN` and one for `*.DOMAIN`
  (or for `www`, `auth`, `dashboard` and `traefik`), pointing to the server IP.
  If the records are proxied (orange cloud), set SSL/TLS mode to **Full (strict)**.
- Firewall: allow 22, 80 and 443.

## 2. Traefik (once per server)

```bash
sudo mkdir -p /opt/traefik && cd /opt/traefik
# copy traefik/compose.yml and traefik/.env.example from the repo here
cp .env.example .env
nano .env        # DOMAIN, CF_API_EMAIL, CF_API_KEY, ACME_EMAIL, TRAEFIK_DASHBOARD_USERS

docker network create traefik
docker compose up -d
docker compose logs -f      # wait until the certificate for DOMAIN / *.DOMAIN is obtained
```

- Generate `TRAEFIK_DASHBOARD_USERS` with `htpasswd -nbB admin 'password'`
  (`apt install apache2-utils`) and keep the value in **single quotes** in `.env`.
- `CF_API_KEY` is the Cloudflare **Global API Key**, and `CF_API_EMAIL` is that
  account's email.

## 3. The app

### 3.1 Get the code into /opt/app

```bash
sudo git clone <repo-url> /opt/app
# or from your machine:
# rsync -av --exclude node_modules --exclude .next --exclude venv \
#   compose.yml .dockerignore frontend dashboard database infra mosaic-generator \
#   user@server:/opt/app/
```

### 3.2 Environment files

```bash
cd /opt/app
cp .env.example .env
cp .env-frontend.example .env-frontend
cp .env-dashboard.example .env-dashboard
cp .env-mosaic.example .env-mosaic
```

1. In `.env`, set **`DOMAIN=`** (the only place the app's domain is written),
   the MySQL and Keycloak passwords, and the API keys. Generate passwords with
   `openssl rand -hex 24`. They become part of `DATABASE_URL`, so use only
   URL-safe characters.
2. Also in `.env`, set `KEYCLOAK_FRONTEND_CLIENT_SECRET` and
   `KEYCLOAK_DASHBOARD_CLIENT_SECRET` (`openssl rand -hex 32`). Keycloak gets
   them through the realm import, and the apps get them as `AUTH_KEYCLOAK_SECRET`.
3. In `.env-frontend` and `.env-dashboard`, set `AUTH_SECRET` to a different
   value in each (`openssl rand -base64 32`).

The `.env-*` files use `${DOMAIN}`, `${MYSQL_PASSWORD}` and other variables
from `.env`. Compose fills them in, so changing the domain only means editing
`.env` and recreating the containers.

### 3.3 Build and start the infrastructure

```bash
docker compose build                     # BuildKit layer + npm/pip/.next caches → fast rebuilds
docker compose up -d mysql keycloak
docker compose ps                         # wait for both to be (healthy) — Keycloak takes ~1 min
```

### 3.4 Configure Keycloak (first deploy only)

**With the snapshot from step 0** (`realm-config/brickart-realm.json` is present),
nothing needs configuring. On its first start, Keycloak imports the realm with
your clients, roles, users and login theme. In that file, `${DOMAIN}` and the
two `${KEYCLOAK_*_CLIENT_SECRET}` placeholders are filled from `.env`. The realm
is imported only if it doesn't exist yet, so later restarts never overwrite
changes made in the admin console. You still need to replace the temporary
master-realm admin (item 5 below).

**Without a snapshot**, open `https://auth.DOMAIN/admin`, log in with
`KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD`, and set it up by hand:

1. **Create realm** `brickart` (must match `KEYCLOAK_REALM`).
   *Realm settings → Themes → Login theme: `brickart`*. Turn on *User registration*
   if customers should create accounts.
2. **Client `brickart-frontend`** (OpenID Connect, Client authentication **On**,
   Standard flow only):
   - Root/Home URL: `https://DOMAIN`
   - Valid redirect URIs: `https://DOMAIN/api/auth/callback/keycloak`
   - Valid post logout redirect URIs: `https://DOMAIN/*`
   - Web origins: `https://DOMAIN`
   - *Credentials* tab → set the secret to `KEYCLOAK_FRONTEND_CLIENT_SECRET` from `.env`.
3. **Client `brickart-dashboard`**: same settings, with `https://dashboard.DOMAIN`
   in every URL. Its secret is `KEYCLOAK_DASHBOARD_CLIENT_SECRET`.
4. **Realm role `brickart-admin`** (= `KEYCLOAK_ADMIN_ROLE`). Create the admin
   users and assign them this role.
5. Under *Users → admin (master realm)*, replace the temporary bootstrap admin with
   a permanent one.


### 3.5 Start everything

```bash
docker compose up -d
docker compose ps                         # all services (healthy)
docker compose logs dashboard | head      # "[entrypoint] ... db push" / "migrations"
```

### 3.6 Data (first deploy only)

**With the snapshot from step 0**, MySQL loaded your dev database the first time
it started, with image URLs rewritten to `https://DOMAIN`. Restore the artwork
images into the uploads volume:

```bash
docker run --rm -v brickart_uploads:/data -v /opt/app/infra/docker/data-export:/backup \
  alpine sh -c 'tar xzf /backup/uploads.tgz -C /data && chown -R 1000:1000 /data'
```

**Without a snapshot**, seed the configuration tables instead:

```bash
docker compose --profile tools run --rm dbtools npm run db:seed
docker compose --profile tools run --rm dbtools npm run db:seed:bases
docker compose --profile tools run --rm dbtools npm run db:seed:site-images
```

(Always pass `--profile tools`. Without it, Compose doesn't load the env file
for `dbtools`.)

### 3.7 Check it

- `https://DOMAIN`: storefront loads, *Log in* goes to `auth.DOMAIN` and back.
- Create a mosaic (frontend → mosaic-generator → MySQL palette).
- `https://dashboard.DOMAIN`: log in with a `brickart-admin` user.
- `https://traefik.DOMAIN`: Traefik dashboard, all routers green.

## Updating

```bash
cd /opt/app
git pull
docker compose build
docker compose up -d          # recreates only changed services; dashboard applies schema changes first
docker image prune -f
```

Only the layers that changed are rebuilt. Dependencies are reinstalled only
when a `package-lock.json` or `requirements.txt` changes, and Next.js reuses
its build cache.

## Moving to real migrations (recommended)

`db push` is fine early on, but versioned migrations are safer:

```bash
# locally, against a dev DB that matches production
cd database && npx prisma migrate dev --name init
# (for an existing prod DB: `prisma migrate resolve --applied <name>` once, via dbtools)
```

Commit `database/prisma/migrations/`. From then on, the dashboard's entrypoint
runs `prisma migrate deploy` instead of `db push`.

## Operations

```bash
# logs
docker compose logs -f frontend dashboard mosaic-generator

# phpMyAdmin (local-only): on the server
docker compose --profile tools up -d pma
# then from your machine: ssh -L 8080:127.0.0.1:8080 user@server → http://localhost:8080

# backup
docker compose exec mysql sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --all-databases --single-transaction' > backup-$(date +%F).sql
docker run --rm -v brickart_uploads:/data -v "$PWD":/backup alpine tar czf /backup/uploads-$(date +%F).tgz -C /data .

# restore uploads
docker run --rm -v brickart_uploads:/data -v "$PWD":/backup alpine tar xzf /backup/uploads-<date>.tgz -C /data
```

## Troubleshooting

- **Sign-in fails with a fetch/timeout error in the frontend or dashboard logs.**
  The apps call Keycloak at `https://auth.DOMAIN` from inside their containers.
  `extra_hosts` points that name at the host (`host-gateway`), so the request goes
  to Traefik on :443. A host firewall (ufw/iptables) must allow traffic from the
  Docker bridge to 443.
- **Keycloak won't start, "Access denied for user 'keycloak'".** The MySQL volume
  existed before `KEYCLOAK_DB_PASSWORD` was set, so the init script never ran.
  Create the database and user by hand (see `infra/docker/mysql-init/01-keycloak.sh`).
- **No certificate / Traefik default cert.** Check `docker compose logs traefik` in
  `/opt/traefik`: usually wrong Cloudflare credentials or `DOMAIN` mismatch.
- **Dashboard restarts in a loop after an update.** `db push` refused a destructive
  schema change. Read `docker compose logs dashboard`, then migrate the data
  deliberately.
