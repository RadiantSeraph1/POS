# SQL Schemas

This folder contains the first draft database schemas for:

- local branch and warehouse SQLite
- cloud PostgreSQL

## Files

- `sqlite/001_initial_branch_schema.sql`
- `postgres/001_initial_cloud_schema.sql`

## Design Intent

SQLite is optimized for:

- local checkout
- offline inventory events
- local sync queue durability

PostgreSQL is optimized for:

- centralized coordination
- reporting
- user and device governance
- organization-wide auditability

## Important Rule

Both databases use event-driven inventory tracking. `inventory_levels` is a fast projection, not the only source of truth.

