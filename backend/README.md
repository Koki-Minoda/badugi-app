# Badugi Backend (Server-2 Lite)

This directory contains the FastAPI + SQLAlchemy skeleton for the multi-game Badugi platform. The current milestone focuses on DB readiness: the API can be started, report database reachability, and expose placeholder routes even when no database server is available.

## Requirements

- Python 3.10+
- Optional: MySQL or PostgreSQL instance (the backend handles the “DB offline” case gracefully)

## Configuration

Copy the sample environment file and adjust it as needed:

```bash
cd backend
cp .env.example .env
```

Available environment variables (with defaults):

```
BACKEND_ENV=local
BACKEND_DB_DRIVER=mysql       # supports mysql / postgresql
BACKEND_DB_HOST=localhost
BACKEND_DB_PORT=3306
BACKEND_DB_USER=badugi_user
BACKEND_DB_PASSWORD=badugi_pass
BACKEND_DB_NAME=badugi_app
```

To use SQLite locally (no external DB), set:

```
BACKEND_DB_DRIVER=sqlite
BACKEND_DB_NAME=:memory:   # or absolute/relative path to a .db file
```

For MySQL/PostgreSQL, keep the driver at `mysql` / `postgresql` and update host/user/password accordingly.

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e .[test]
```

## Running the server

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Available endpoints (always safe, even without a DB):

- `GET /api/health` – reports backend environment & DB reachability (`db: "ok"` or `"unreachable"`).
- `GET /api/users` – placeholder users API that returns an empty list when the DB is offline.
- `POST /api/badugi/rl/decision` – deterministic RL stub that accepts a 22-dim state vector + valid actions and responds with a chosen action/scores.
- `POST /api/badugi/hands` – validates Badugi hand-log payloads and persists them to the configured database (or returns `accepted:false` if the DB is unreachable).
- `GET /api/badugi/hands/{hand_id}` – fetches a fully structured hand with actions/results.
- `GET /api/badugi/hands/by-table/{table_id}` – returns the latest hands for a table (limit=5 by default).
- `GET /api/badugi/hands/recent` – temporary in-memory buffer mirroring the last few accepted payloads (used while the UI migrates to DB-backed feeds).

### Schema overview

Tables created by the ORM:

- `badugi_hand_logs` – base record for each hand (`hand_id`, `table_id`, `tournament_id`, level, metadata, timestamps).
- `badugi_hand_actions` – child rows for every betting/draw action (`seat_index`, `action`, `amount`, round, phase).
- `badugi_hand_results` – child rows summarizing final stacks/payouts (`is_winner`, `pot_share`, `hand_label`).

Run `Base.metadata.create_all(bind=engine)` (automatic on startup) or later use Alembic migrations for schema changes.

### Upcoming migrations

An Alembic setup will be added in a future step. Once available:

```bash
cd backend
alembic upgrade head
```

Until then, the startup hook will create tables automatically for local/dev usage.

## Tests

The backend ships with pytest-based checks that assume **no database server is running** by default; individual tests monkeypatch in-memory SQLite engines when persistence is required. They cover the health endpoint, DB connection helper, `/api/users`, the RL stub, and the Badugi hand-log persistence.

```bash
cd backend
pytest
```
