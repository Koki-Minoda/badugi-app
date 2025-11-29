# DB Policy (MySQL → future PostgreSQL compatible)

## 1. Target DB

- Current production DB: **MySQL**
- Future possibility: **PostgreSQL**
- ORM: **SQLAlchemy**
- Migration: **Alembic**

## 2. SQL Usage Rules

- Avoid writing raw SQL as much as possible.
- Prefer SQLAlchemy ORM models and Query APIs.
- If raw SQL is absolutely necessary:
  - Do NOT use MySQL-specific functions (e.g. `IFNULL`, `LIMIT ? OFFSET ?` with weird vendor syntax, etc.).
  - Keep the SQL standard-compliant as much as possible.

## 3. Migrations

- Always use Alembic for schema changes.
- Flow:
  - `alembic revision --autogenerate -m "..."` → `alembic upgrade head`
- NEVER run manual `CREATE TABLE` or `ALTER TABLE` directly on the DB.
- Keep Alembic `env.py` wired to the SQLAlchemy `Base.metadata`.

## 4. JSON Columns

- JSON data is stored as:
  - `JSON` type (if available) or
  - `TEXT` + `json.dumps` / `json.loads`.
- Do NOT invent custom serialization formats.
- The goal is to easily switch to PostgreSQL `JSONB` in the future.

## 5. Connection URL

- Use SQLAlchemy URL style:
  - MySQL example:
    - `mysql+mysqlconnector://user:password@host:3306/badugi_db`
  - SQLite example (for tests):
    - `sqlite:///./badugi_test.db`
- The actual URL is provided via environment variables (.env files).
