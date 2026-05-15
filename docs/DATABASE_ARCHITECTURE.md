# Database Architecture

This document explains how PipeFlow POS uses two database layers:

- SQLite locally at branch and warehouse apps
- PostgreSQL centrally in the cloud

The system is intentionally asymmetric. Local databases optimize for resilience and speed during outages. The cloud database optimizes for coordination, reporting, and organization-wide consistency.

## 1. Local SQLite Purpose

Local SQLite is the branch runtime database.

It must support:

- instant checkout
- offline inventory events
- local queue persistence
- offline auth cache
- local transfer receiving

SQLite is not a cache of the cloud database. It is an operational store that can continue functioning independently for a period of time.

## 2. Cloud PostgreSQL Purpose

Cloud PostgreSQL is the centralized business database.

It must support:

- organization-wide reporting
- global inventory visibility
- user and device management
- warehouse orchestration
- branch and warehouse reconciliation
- audit and compliance

## 3. Modeling Principle

Inventory movement is event-driven in both databases.

`inventory_levels` is a read model for speed.

`inventory_events` is the durable movement history used for:

- audit
- reconciliation
- recovery
- debugging

## 4. Local SQLite Scope

The local schema includes:

- product and pricing snapshots needed for sales
- customers needed for lookup and loyalty flows
- sales and sale items
- payments and refunds
- inventory events and inventory levels
- transfer receiving data
- sync queue
- device and auth cache data

It should not depend on the cloud to complete core branch workflows.

## 5. Cloud PostgreSQL Scope

The cloud schema includes:

- canonical organization structure
- users, roles, permissions, and devices
- canonical products and supplier data
- branch and warehouse inventory views
- transfer orchestration
- global sales records
- audit and security events

## 6. Sync Boundary

The branch writes to SQLite first. Sync moves event batches and selected transactional records to PostgreSQL.

The local queue must preserve:

- event ID
- payload
- retry state
- error state
- acknowledgement state

## 7. Near-Term Build Order

1. Finalize local SQLite schema.
2. Finalize cloud PostgreSQL schema.
3. Lock shared TypeScript event shapes.
4. Implement local sale transaction.
5. Implement sync queue writer.
6. Implement cloud ingestion endpoint.

