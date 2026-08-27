# MGX Deployment Scripts

## mgx-prod-01.sh

Helper used on the `mgx-prod-01` VPS to deploy both the Vite frontend and the FastAPI backend.

### Usage

```bash
chmod +x scripts/deploy/mgx-prod-01.sh   # one-time
./scripts/deploy/mgx-prod-01.sh
```

### What it does

1. `cd ~/badugi-app` then `git pull origin main` (remote/branch can be overridden with `GIT_REMOTE` / `GIT_BRANCH` environment variables)
2. `npm install && npm run build`
3. `cd backend && source .venv/bin/activate && pip install -r requirements.txt`
4. `rsync dist/ -> /var/www/mgx-poker`
5. `sudo systemctl restart mgx-backend.service`
6. Verify the existing HTTP health endpoints and authenticated P2P REST route

> **Note:** The deploy user does not modify nginx configuration. Friend Match prefers WebSocket when the route is available and automatically falls back to the authenticated HTTPS REST transport when it is not. Deploy verification checks that the P2P REST endpoint reaches FastAPI and rejects an unauthenticated request.
