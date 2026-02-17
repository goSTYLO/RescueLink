# RescueLink Backend – Deployment Guide

## Pre-deployment checklist

### Security

- [ ] Set `NODE_ENV=production`
- [ ] Set `JWT_SECRET` to a secure random value (32+ characters). Generate with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] Do **not** use default or example secrets. In production, `JWT_SECRET` must be explicitly set or the server will refuse to start.
- [ ] Use a secrets manager or vault for `DATABASE_URL`, `JWT_SECRET`, SMTP credentials, and Firebase service account.
- [ ] Serve over HTTPS (use a reverse proxy like nginx or a platform with built-in SSL).

### Database

- [ ] Create PostgreSQL database and run `schema.sql` (or use `npm run setup-db` for fresh setup)
- [ ] Run migrations for existing databases:
  ```bash
  psql $DATABASE_URL -f migrations/add_dispatcher_audit_logs.sql
  psql $DATABASE_URL -f migrations/add_token_blacklist.sql
  psql $DATABASE_URL -f migrations/add_dispatcher_login_otp.sql
  # ... other migrations as needed
  ```
- [ ] Enable TLS for the database connection in production: set `DATABASE_SSL=true` or use a `DATABASE_URL` that includes `?sslmode=require`. The app enables SSL when `NODE_ENV=production` or `DATABASE_SSL=true` (see `src/config/db.js`). Ensure your CA is trusted when using `rejectUnauthorized: true`.
- [ ] **Encryption at rest**: Use your provider’s or host’s option for encrypted storage (e.g. managed PostgreSQL disk encryption). This is not configured in application code.
- [ ] **Backups**: Schedule regular backups (e.g. `pg_dump` or provider backups). See the [Backups](#backups) section below.

### Environment

- [ ] `FRONTEND_URL` – Set to your dispatcher dashboard URL (e.g. `https://dashboard.rescuelink.example.com`)
- [ ] `BLOCKCHAIN_SERVICE_URL` – If using incident verification, point to your blockchain service
- [ ] SMTP – Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` for password reset emails
- [ ] Firebase – Place service account JSON and set `FIREBASE_SERVICE_ACCOUNT_PATH` for phone auth

### Logging

- [ ] Logs are redacted by default (passwords, tokens, PII not logged). Use `LOG_LEVEL=debug` only in non-production if you need verbose logs.

## Build and run

```bash
npm ci
npm start
```

For development:
```bash
npm run dev
```

## Process manager (PM2 example)

```bash
pm2 start src/server.js --name rescuelink-api
pm2 save
pm2 startup
```

## Reverse proxy (nginx example)

```nginx
server {
  listen 443 ssl;
  server_name api.rescuelink.example.com;
  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;

  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## File uploads

- Ensure `UPLOAD_DIR` (default: `uploads/incidents`) exists and is writable
- Configure `MAX_AUDIO_SIZE`, `MAX_PHOTO_SIZE`, `MAX_VIDEO_SIZE` if you need different limits

## Backups

- Schedule regular PostgreSQL backups (e.g. daily). Use your provider’s backup feature or run `pg_dump` (see optional script below).
- Retain backups according to your policy (e.g. 7–30 days) and store them in a separate region or account.
- Test restore periodically. Restore with `psql $DATABASE_URL < backup.sql` (or your provider’s restore procedure).
- Optional: from the project root, run `npm run backup-db` to create a timestamped dump in `Backend/backups/` (requires `DATABASE_URL` and `pg_dump` on `PATH`). Schedule this via cron or your platform’s job runner.

## Common issues

- **"JWT_SECRET must be set"** – Set `JWT_SECRET` in your environment; it is required in production.
- **"Failed to start server"** – Check `DATABASE_URL` is correct and the database is reachable.
- **Token still works after logout** – Ensure the `token_blacklist` table exists (run `migrations/add_token_blacklist.sql`).
