# Deploy Checklist

## Files to transfer

- entire source tree except `node_modules`, `.next`, local cache directories and local-only secrets
- `docker-compose.yml`
- `Dockerfile`
- `package.json`
- `next.config.ts`
- `app/`
- `pages/`
- `public/`
- `.env` on host based on `.env.example`


## What changed in project

- added payment provider switcher in a separate checkout modal before redirect to payment
- added `/admin` dashboard protected by Steam ID from `ADMIN_STEAM_IDS`
- added admin shortcut in header for authorized admins
- added T-Bank env-driven success and fail URLs
- added Enot payment creation and webhook handling

## Host notes

- `DATABASE_URL` with hostname `database` is intended for Docker Compose where Postgres service name is `database`
- if the app is started outside Docker, replace `database` with the actual database host, often `localhost` or external DB hostname
- after env changes restart the app completely, hot reload is not enough for all server-side env usage
- for Enot use the public HTTPS domain in `APP_BASE_URL` or explicit `ENOT_*_URL` variables, otherwise redirects and webhook can point to an internal host

## Start commands

### Docker Compose

```bash
docker compose up -d --build
```

### Without Docker

```bash
npm ci
npm run build
npm run start
```
