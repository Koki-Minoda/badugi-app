# Logging & Logs – mgx-prod-01

## Journald limits for mgx-prod-01

- Example snippet: `infra/systemd/journald-mgx-logging.conf.example`
- Usage:
  ```bash
  sudo mkdir -p /etc/systemd/journald.conf.d
  sudo cp infra/systemd/journald-mgx-logging.conf.example /etc/systemd/journald.conf.d/mgx-logging.conf
  sudo systemctl restart systemd-journald
  ```
- Inspect log usage:
  ```bash
  journalctl --disk-usage
  journalctl -u mgx-backend.service --since "1 hour ago"
  ```

Tune `SystemMaxUse` / `SystemMaxFileSize` / `MaxRetentionSec` if the server has more or less space.

## Changing backend log level

- Edit `/etc/systemd/system/mgx-backend.service` and adjust `Environment=MGX_LOG_LEVEL=...`
- Supported values mirror uvicorn logging (`debug`, `info`, `warning`, etc.)
- Apply changes:
  ```bash
  sudo systemctl daemon-reload
  sudo systemctl restart mgx-backend.service
  ```
- Check logs:
  ```bash
  journalctl -u mgx-backend.service -f
  ```
