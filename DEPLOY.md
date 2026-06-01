# Slate — deployment runbook

Prod runs on **`188.40.114.23`** (Ubuntu 24.04), served at **https://slate.ammarbrohi.com**.

## Layout

- Repo: `/home/ubuntu/slate` (run as the `ubuntu` user — it's in the `docker` group, no sudo needed)
- Stack: `server/docker-compose.yml` → `frontend` + `server` + `postgres` + `minio`
- Host ports (localhost only): server `127.0.0.1:3030`, frontend `127.0.0.1:3031`
- TLS + routing: **Caddy** (`/etc/caddy/Caddyfile`) — the `slate.ammarbrohi.com` block sends `/api/*` and `/socket.io/*` to `:3030`, everything else to `:3031`
- Secrets: `server/.env` (gitignored, `chmod 600`, generated on-box). Template: `server/.env.example`

## Redeploy (after pushing to `main`)

```sh
ssh -i <key> root@188.40.114.23
sh /home/ubuntu/slate/deploy.sh    # git pull --ff-only && docker compose up -d --build
```

`deploy.sh` lives at the repo root. The frontend bakes `VITE_APP_*` at build time, so a
rebuild is required whenever those change (public URL, Clerk key).

## First-time / infra notes

- **DNS**: `slate.ammarbrohi.com` → A record to the server IP. Caddy auto-issues TLS.
- **Clerk (production instance)**: the prod publishable key targets `clerk.slate.ammarbrohi.com`.
  A Clerk *production* instance needs its own DNS records (CNAMEs shown in the Clerk
  dashboard → Domains: `clerk`, `accounts`, `clkmail`, `clk._domainkey`, …). Until those
  resolve, the Clerk SDK and JWKS (`https://clerk.slate.ammarbrohi.com/.well-known/jwks.json`)
  are unreachable and auth will fail. Verify with:
  ```sh
  curl -s -o /dev/null -w '%{http_code}\n' https://clerk.slate.ammarbrohi.com/.well-known/jwks.json
  ```
  Only rebuild with the `pk_live` key + `CLERK_ISSUER=https://clerk.slate.ammarbrohi.com`
  once that returns `200`.
- **Disk**: keep an eye on `df -h /`. Docker json logs can run away — cap them in
  `/etc/docker/daemon.json` (`"log-opts": {"max-size": "50m", "max-file": "3"}`).

## Prompt for Claude (redeploy)

> Deploy the latest Slate to prod. SSH to `root@188.40.114.23` with the hangar key, run
> `sh /home/ubuntu/slate/deploy.sh`, then verify `https://slate.ammarbrohi.com` returns 200
> and `/api/me` returns 401. If `server/.env` or Clerk settings changed, confirm the Clerk
> JWKS endpoint resolves before rebuilding.
