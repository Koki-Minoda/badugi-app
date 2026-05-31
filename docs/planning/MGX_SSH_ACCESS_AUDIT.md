# MGX SSH Access Audit

Date: 2026-05-30

Scope: repository documentation, deployment scripts, infra examples, and safe
local environment indicators only. This audit does not read or print passwords,
private keys, API tokens, `~/.ssh/*`, or SSH daemon configuration.

## Summary

The MGX repository clearly identifies the production VPS as `mgx-prod-01` and
the public service as `mgx-poker.com`. The likely server IP is
`162.43.19.143`, based on Vite allowed-host configuration and the current host
name observed in this environment.

The repository does not contain a complete SSH connection command. It does not
state a definitive SSH username, does not state whether SSH key auth or
password auth is required, and does not provide Termius-specific setup steps.

Most deployment docs assume a Unix user with a home directory and repo at
`~/badugi-app`; current deployment evidence uses `APP_DIR=/home/mgx/badugi-app`,
which makes `mgx` the strongest candidate application user. However, the
current shell user observed during this audit is `root`, so the actual SSH
login user remains unconfirmed.

## Findings

### 1. Expected SSH Destination IP

Likely IP:

- `162.43.19.143`

Evidence:

- `vite.config.js` allows `162.43.19.143` as a dev server host.
- The current host name is `x162-43-19-143`, matching that IP pattern.
- Public frontend/backend docs consistently use `https://mgx-poker.com/`.

Confidence:

- High for the VPS/public server IP.
- Medium for SSH destination, because no repo doc explicitly says
  `ssh ...@162.43.19.143`.

Termius host candidates:

- Preferred display name: `mgx-prod-01`
- Host/IP: `162.43.19.143`
- Alternate host: `mgx-poker.com`

### 2. Expected SSH Username

Confirmed SSH username:

- Unknown.

Strong candidate:

- `mgx`

Evidence for `mgx`:

- `docs/deploy/MGX_ALPHA_PREVIEW_DEPLOY_CHECK.md` records deploy command with
  `APP_DIR=/home/mgx/badugi-app`.
- Current repository path is `/home/mgx/badugi-app`.
- Several generated docs and reports refer to paths under `/home/mgx/badugi-app`.

Evidence against treating `mgx` as confirmed:

- `docs/deployment/mgx-prod-01-day6.md` uses placeholders such as
  `<your-username>`.
- `infra/systemd/mgx-backend.service.example` uses `User=<USER>`.
- Current shell user during this audit is `root`.
- No doc explicitly states `ssh mgx@...`.

Conclusion:

- Termius should try the human-confirmed user, not assume blindly.
- If the intended app user is unknown, ask the VPS owner whether the login user
  is `mgx`, `root`, or another named deploy user.

### 3. Root Operation vs Dedicated User Operation

Repository docs point toward a dedicated Unix user model:

- Systemd template expects `User=<USER>`.
- Backend working directory template is `/home/<USER>/badugi-app/backend`.
- Setup docs clone the repo to `~/badugi-app`.
- Deploy script defaults `APP_DIR` to `$HOME/badugi-app`.

Current observed environment:

- `whoami` returned `root`.
- Current directory is `/home/mgx/badugi-app`.

Interpretation:

- Production/service design is dedicated-user compatible.
- The active shell for this Codex session appears to be root.
- Actual SSH login policy is not documented and must be confirmed by a human.

Operational recommendation:

- Prefer a non-root deploy user for daily Termius/code-server operation if one
  exists.
- Use root only if the VPS was intentionally provisioned for root SSH and the
  owner confirms it.
- Do not infer password or key material from repo files.

### 4. SSH Key Authentication Assumption

Confirmed:

- Unknown.

Evidence:

- `docs/deploy/MGX_ALPHA_REMOTE_SYNC_STATUS.md` discusses GitHub push auth
  paths and mentions SSH remote/deploy key for GitHub, but this is GitHub
  remote authentication, not VPS SSH login.
- No repo doc states that VPS SSH requires public-key authentication.
- No repo doc includes `authorized_keys` setup instructions.

Conclusion:

- SSH key auth is plausible and preferred for Termius, but not documented.
- A human must confirm which public key is installed on the VPS and for which
  Unix user.

### 5. Password Authentication Assumption

Confirmed:

- Unknown.

Evidence:

- No repo doc states password-based VPS login.
- No password was found or inspected for SSH.
- Backup script contains placeholder database credential text only; it is not
  SSH login information.

Conclusion:

- Do not assume password login is enabled.
- If Termius asks for a password, verify with the VPS owner whether password
  auth is intentionally enabled for the chosen user.

### 6. Termius Settings Needed

Minimum Termius host profile:

- Label: `mgx-prod-01`
- Address: `162.43.19.143`
- Port: `22` unless the VPS owner confirms a custom port.
- Username: human-confirmed value. Candidate: `mgx`; possible current
  operational user: `root`; other deploy user remains possible.
- Authentication: human-confirmed key or password.
- Startup command:

```bash
cd /home/mgx/badugi-app
git status --short
```

If using SSH key auth:

- Import the private key into Termius from the user's secure key store.
- Do not paste the key into chat, docs, shell history, or commit messages.
- Confirm the matching public key is installed for the selected server user.

If using password auth:

- Enter the password only in Termius.
- Do not paste or save it in repository docs.
- Confirm password login is enabled intentionally.

Suggested Termius snippets after login:

```bash
cd /home/mgx/badugi-app
git status --short
git log --oneline -6
```

For dev preview work:

```bash
npm run dev -- --host 127.0.0.1 --port 3000
```

For read-only live checks:

```bash
curl -fsS https://mgx-poker.com/api/health
curl -I https://mgx-poker.com/
```

Do not run deploy commands from Termius unless deployment is explicitly
approved.

### 7. code-server Installation Evidence

Repository/documentation evidence:

- `docs/planning/MGX_IPHONE_AI_ORCHESTRATION_AUDIT.md` and
  `docs/qa/MGX_IPHONE_REAL_DEVICE_QA_CHECKLIST.md` describe code-server as an
  intended iPhone review tool.
- No deploy or infra doc found installation steps for code-server.
- No systemd service template for code-server was found in repo.

Safe local environment indicators:

- `command -v code-server` returned absent.
- `$HOME/.config/code-server` directory was absent.

Conclusion:

- No evidence that code-server is installed in the current environment.
- code-server operation notes exist as desired workflow documentation, not as a
  completed server setup.

Missing for Termius/code-server operation:

- install command or package source,
- service definition,
- bind address and port,
- reverse proxy route if exposed through nginx,
- authentication mode,
- firewall policy.

### 8. tmux Operation Evidence

Repository/documentation evidence:

- No substantial tmux runbook was found in docs.
- The iPhone orchestration audit recommends a future Termius/code-server
  operator guide, but tmux procedures are not documented.

Safe local environment indicators:

- `command -v tmux` returned present.
- No `$HOME/.tmux` directory or `$HOME/.tmux.conf` file was detected.

Conclusion:

- tmux appears installed, but MGX-specific tmux workflow is not documented.

Suggested minimum tmux workflow after SSH:

```bash
tmux new -s mgx
cd /home/mgx/badugi-app
git status --short
```

Useful sessions to standardize later:

- `mgx-dev`: Vite dev server.
- `mgx-backend`: backend dev server.
- `mgx-qa`: test/check commands.

### 9. SSH Procedure Documentation

Found:

- `docs/deployment/mgx-prod-01-day6.md` says "SSH into mgx-prod-01" before
  deployment.

Not found:

- Full SSH command.
- SSH username.
- SSH port.
- Auth method.
- Termius profile steps.
- key setup steps.
- password login policy.
- recovery steps for failed SSH login.

Conclusion:

- SSH procedure documentation is incomplete for iPhone operation.

## Evidence Files

Primary evidence:

- `vite.config.js`
  - includes allowed host `162.43.19.143`.
- `scripts/deploy/README.md`
  - identifies `mgx-prod-01` VPS.
  - deploy flow assumes `~/badugi-app`.
- `scripts/deploy/mgx-prod-01.sh`
  - defaults `APP_DIR` to `$HOME/badugi-app`.
  - deploys to `/var/www/mgx-poker`.
  - restarts `mgx-backend.service`.
- `docs/deploy/MGX_ALPHA_PREVIEW_DEPLOY_CHECK.md`
  - records deploy command with `APP_DIR=/home/mgx/badugi-app`.
  - records live URL and backend health endpoint.
- `docs/deploy/MGX_ALPHA_REMOTE_SYNC_STATUS.md`
  - records preview URL and credential constraints for GitHub remote sync.
  - does not document VPS SSH auth.
- `docs/deployment/mgx-prod-01-day6.md`
  - one-time setup for nginx, backend service, certbot, deploy.
  - says "SSH into mgx-prod-01" but omits SSH details.
- `infra/systemd/mgx-backend.service.example`
  - uses `User=<USER>` and `/home/<USER>/badugi-app/backend`.
- `infra/nginx/mgx-poker.com.conf.example`
- `infra/nginx/mgx-poker.com-ssl.conf.example`
  - identify `mgx-poker.com`, `/var/www/mgx-poker`, and backend
    `127.0.0.1:8000`.
- `docs/ops/logging-and-logs.md`
  - confirms mgx-prod-01 ops/logging context.
- `docs/planning/MGX_IPHONE_AI_ORCHESTRATION_AUDIT.md`
- `docs/qa/MGX_IPHONE_REAL_DEVICE_QA_CHECKLIST.md`
  - define Termius/code-server desired workflow, but not actual SSH auth.

Safe local indicators used:

- `whoami`: current shell user is `root`.
- `pwd`: current repo path is `/home/mgx/badugi-app`.
- `hostname`: current host is `x162-43-19-143`.
- `command -v code-server`: absent.
- `command -v tmux`: present.

## Inferred Connection Profile

This is an inferred profile, not confirmed credentials:

```text
Name: mgx-prod-01
Host: 162.43.19.143
Port: 22
Username: unknown
Likely username candidate: mgx
Possible current operational user: root
Authentication: unknown
Preferred authentication: SSH key, if configured
Start directory: /home/mgx/badugi-app
Public site: https://mgx-poker.com/
Health endpoint: https://mgx-poker.com/api/health
```

Do not treat this as complete until a human confirms username and
authentication method.

## Missing Information

To make Termius login operational, a human must provide or confirm:

1. SSH username.
2. SSH port if not default `22`.
3. Whether root login is allowed or forbidden.
4. Whether password login is enabled.
5. Whether SSH key login is required.
6. Which public key is installed on the server.
7. Whether Termius should use an existing private key or a new one.
8. Whether code-server should be installed and how it should be exposed.
9. Whether tmux should be the standard long-running session manager.
10. Whether firewall rules restrict SSH by source IP.

## Human Verification Checklist

Ask the VPS owner/admin:

- [ ] What exact SSH command should Termius use?
- [ ] Is the host `162.43.19.143`, `mgx-poker.com`, or another management IP?
- [ ] Is the login user `mgx`, `root`, or another deploy user?
- [ ] Is root SSH login allowed?
- [ ] Is password auth enabled?
- [ ] Is key auth required?
- [ ] Which public key is installed for the selected user?
- [ ] Is port `22` open, or is a custom SSH port used?
- [ ] Is code-server already installed outside this repo?
- [ ] Should code-server be installed behind nginx or used through SSH tunnel?
- [ ] Is tmux the expected session manager?

## Recommended Next Documentation Task

Create a short runbook after human confirmation:

- `docs/ops/MGX_TERMIUS_SSH_RUNBOOK.md`

It should include:

- confirmed host,
- confirmed username,
- port,
- auth method without secret values,
- Termius setup screenshots or text steps,
- first-login commands,
- tmux session names,
- code-server status,
- safe commit/deploy rules.

Do not include passwords, private keys, tokens, or one-time recovery codes.

