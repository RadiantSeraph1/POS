# Environment

## Core Services

- PostgreSQL for cloud source of truth
- Redis for queue and cache
- SQLite per branch and warehouse device

## Important Variables

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `PIPEFLOW_DATA_DIR`

## Recommended Practice

Keep a current `.env.example` and document any new required variable here whenever the architecture grows.

