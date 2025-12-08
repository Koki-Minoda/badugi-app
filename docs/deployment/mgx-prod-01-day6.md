# Day 6 Deployment – mgx-prod-01

## 1. Overview

- **Frontend**: Vite build output lives at `/var/www/mgx-poker`, served directly by nginx.
- **Backend**: FastAPI app (`backend.app.main:app`) runs via systemd service `mgx-backend.service` on `127.0.0.1:8000`.
- **Reverse proxy**: nginx handles `mgx-poker.com`, proxies `/api/*` (and `/healthz`) to the backend, and serves the SPA elsewhere.

## 2. One-time Server Setup

1. Install required packages:

   ```bash
   sudo apt update
   sudo apt install -y nginx python3 python3-venv python3-pip nodejs npm certbot
   ```

2. Clone the repo:

   ```bash
   git clone https://github.com/<org>/badugi-app.git ~/badugi-app
   ```

3. Backend virtualenv:

   ```bash
   cd ~/badugi-app/backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install --upgrade pip
   pip install -r requirements.txt
   deactivate
   ```

4. Systemd service:

   ```bash
   sudo cp infra/systemd/mgx-backend.service.example /etc/systemd/system/mgx-backend.service
   sudo sed -i 's/<USER>/<your-username>/g' /etc/systemd/system/mgx-backend.service
   sudo systemctl daemon-reload
   sudo systemctl enable mgx-backend.service
   sudo systemctl start mgx-backend.service
   ```

## 3. nginx Configuration

1. Copy the config template:

   ```bash
   sudo cp infra/nginx/mgx-poker.com.conf.example /etc/nginx/sites-available/mgx-poker.com
   sudo sed -i 's/<USER>/<your-username>/g' /etc/nginx/sites-available/mgx-poker.com
   sudo ln -s /etc/nginx/sites-available/mgx-poker.com /etc/nginx/sites-enabled/mgx-poker.com
   ```

2. Test and reload:

   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

3. Certbot:

   > Later we’ll run `sudo certbot --nginx -d mgx-poker.com` to add TLS. Keep the config layout consistent so certbot can inject SSL blocks cleanly.

## 4. Deploying a New Version

1. SSH into mgx-prod-01.
2. Run:

   ```bash
   ./scripts/deploy/mgx-prod-01.sh
   ```

3. Optional sanity check:

   ```bash
   ./scripts/deploy/check_mgx_health.sh http://mgx-poker.com
   ```

## 5. Troubleshooting

- Backend service status:

  ```bash
  sudo systemctl status mgx-backend.service
  sudo journalctl -u mgx-backend.service -n 200
  ```

- nginx logs:

  ```bash
  sudo tail -f /var/log/nginx/mgx-poker.error.log
  sudo tail -f /var/log/nginx/mgx-poker.access.log
  ```

- If deploy fails mid-way, rerun the deploy script and watch for npm/pip errors; they usually mean the build failed before rsync/systemctl steps.***

## 6. HTTPS / certbot notes

- HTTP-only template: `infra/nginx/mgx-poker.com.conf.example`
- HTTPS-ready example: `infra/nginx/mgx-poker.com-ssl.conf.example`
- Typical flow (once DNS is live):

  ```bash
  sudo certbot --nginx -d mgx-poker.com
  # or deploy the SSL example, reload nginx, then run certbot in standalone mode
  ```

- Keep certbot’s renewal hooks pointing at nginx so certificates refresh automatically.

## 7. Backup & Rollback

- `scripts/deploy/backup_mgx_prod_01.sh`
  - Creates `/var/backups/mgx/dist/mgx-dist-*.tar.gz` and `db/mgx-db-*.sql`
  - Run before risky deploys or via cron.
  - Replace the placeholder DB credentials in the script or rely on `~/.my.cnf`.
- `scripts/deploy/rollback_mgx_prod_01.sh`
  - Restores the latest dist tarball into `/var/www/mgx-poker`
  - Use if a deploy breaks the SPA; afterwards you may want `sudo systemctl reload nginx`.
- DB restore is manual for now:

  ```bash
  mysql -u DB_USER -p DB_NAME < /var/backups/mgx/db/mgx-db-YYYYmmdd-HHMMSS.sql
  ```
