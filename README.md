# PipeFlow POS

Offline-first POS and retail operations platform for a multi-branch plumbing retail chain.

## Current State

This repository currently contains:

- architecture and product planning
- monorepo scaffold
- domain package placeholders
- app placeholders for backend, branch desktop, and warehouse
- continuation docs for moving development to another PC

## Key Principle

Branch operations must continue even when the internet or cloud backend is unavailable.

## Repository Layout

```text
/apps
  /backend
  /desktop
  /warehouse

/packages
  /auth
  /inventory
  /payments
  /reporting
  /sync-engine
  /types

/docs
  /adr
  /api
  /migration
```

## First Build Priorities

1. Define shared domain types.
2. Design SQLite and PostgreSQL schemas.
3. Define inventory event contracts.
4. Define the local sync queue schema.
5. Implement first sale transaction flow locally.

## Core Reference

See [PIPEFLOW_POS_ARCHITECTURE.md](./PIPEFLOW_POS_ARCHITECTURE.md).

