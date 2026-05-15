# PipeFlow POS

Offline-first retail operations platform for a multi-branch plumbing retail chain.

This document is the primary product, architecture, and continuation reference for the project. It is written so development can resume on another PC with minimal loss of context.

## 1. Project Summary

PipeFlow POS is not just a checkout app. It is a lightweight ERP for a plumbing retail business with:

- branch-level sales
- branch and warehouse inventory control
- offline-first operations
- synchronization to a cloud backend
- migration from a legacy MySQL 5.7 system
- auditability across users, devices, and branches

The highest-risk areas are:

- offline synchronization
- inventory consistency
- warehouse orchestration
- migration integrity
- auditability

If these fail, trust in the system fails.

## 2. Product Vision

Build a resilient retail operations platform that continues to work during:

- internet outages
- backend downtime
- AWS service disruptions
- intermittent sync failures

Sales must never stop because the cloud is unavailable.

## 3. Core Objectives

- Fast POS checkout
- Reliable offline sales
- Accurate inventory tracking
- Warehouse-driven replenishment
- Strong auditing and accountability
- Safe one-time migration from legacy data
- Centralized reporting
- Secure multi-branch management

## 4. Recommended Naming

Suggested internal product names:

- PipeFlow POS
- HydroStack
- ForgePOS
- AquaCore RetailOS

Recommended working codename for documentation and repos: `PipeFlow POS`.

## 5. Product Scope

### 5.1 POS Module

Required features:

- Barcode scanning
- Cart management
- Split payments
- Discounts
- Returns and refunds
- Receipt printing
- Suspended sales
- Offline sales queue
- Shift management
- Cash drawer management

### 5.2 Inventory Management

Required features:

- SKU tracking
- Barcode support
- Batch and lot support
- Expiry tracking
- Serial number support
- Product variants
- Supplier linkage
- Low stock alerts
- Reorder thresholds
- Dead stock detection

### 5.3 Warehouse Management

Required features:

- Central warehouse dashboard
- Stock intake
- Transfer requests
- Approval workflows
- Pick, pack, and dispatch
- Partial fulfillment
- Transfer tracking
- Warehouse receiving
- Damage and spoilage logging

### 5.4 Multi-Branch Operations

Required features:

- Branch inventory isolation
- Cross-branch transfers
- Centralized reporting
- Sync health monitoring
- Branch-level pricing

### 5.5 CRM and Loyalty

Required features:

- Customer profiles
- Loyalty points
- Purchase history
- Customer credit tracking
- SMS receipts
- Promotions

### 5.6 Reporting and Analytics

Required features:

- Sales reports
- Profit and loss views
- Inventory valuation
- Stock aging
- Cashier performance
- Branch comparisons
- Audit reports
- Tax reporting

### 5.7 Authentication and Security

Required features:

- Offline authentication cache
- OTP and SMS login
- Local accounts
- RBAC
- Session tracking
- Device registration
- Immutable audit logs

## 6. Non-Functional Requirements

### 6.1 Availability

Targets:

- `99.9%` cloud uptime
- `100%` local branch operability for core sales

### 6.2 Performance

Targets:

- POS checkout under `300ms`
- Sync reconciliation under `5s` for normal event batches
- Local search results under `100ms`

### 6.3 Reliability

The system must:

- survive internet outages
- survive backend downtime
- queue all transactions safely
- recover automatically after connectivity returns

### 6.4 Security

Requirements:

- AES-256 local encryption
- JWT auth
- refresh tokens
- audit logs
- row-level permissions
- encrypted backups

## 7. Architectural Direction

### 7.1 Core Principle

Use a hybrid local-cloud architecture.

Do not make branches depend directly on cloud database availability. Each branch must operate locally first and synchronize later.

### 7.2 Why Hybrid Local-Cloud

This is the right fit because:

- retail operations cannot stop during outages
- branch internet reliability may be inconsistent
- branch users need instant response times
- inventory and warehouse workflows must survive backend failures
- delayed sync is safer than blocked checkout

### 7.3 High-Level Topology

```text
                ┌──────────────────────┐
                │     AWS CLOUD        │
                │                      │
                │  NestJS API Cluster  │
                │  PostgreSQL          │
                │  Redis               │
                │  Reporting Engine    │
                └─────────┬────────────┘
                          │
                    Sync Engine
                          │
       ┌──────────────────┼──────────────────┐
       │                  │                  │
┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
│ Branch App  │   │ Branch App  │   │ Branch App  │
│ Electron    │   │ Electron    │   │ Electron    │
│ SQLite      │   │ SQLite      │   │ SQLite      │
│ Local Queue │   │ Local Queue │   │ Local Queue │
└──────┬──────┘   └──────┬──────┘   └──────┬──────┘
       │                  │                  │
       └──────────┬───────┴──────────┬──────┘
                  │
          ┌───────▼────────┐
          │   Warehouse    │
          │ Electron App   │
          │ SQLite Local   │
          └────────────────┘
```

## 8. Technology Stack

### 8.1 Frontend

Desktop apps:

- Electron
- React
- TypeScript
- Tailwind CSS
- Zustand
- TanStack Query

### 8.2 Backend

API layer:

- Node.js
- NestJS

Why NestJS:

- scalable modular structure
- strong TypeScript support
- enterprise-friendly patterns
- clear domain separation
- good fit for long-term maintainability

### 8.3 Databases

Cloud primary database:

- PostgreSQL

Reason for PostgreSQL over MySQL:

- stronger concurrency handling
- better transactional consistency
- richer JSON support
- better replication and analytics options
- better long-term flexibility

Local branch database:

- SQLite

Each branch should have:

- local database
- local event store
- local sync queue
- local auth cache

### 8.4 Cache and Queue

Initial:

- Redis
- BullMQ

Future scale option:

- Kafka or RabbitMQ

### 8.5 Infrastructure

Recommended AWS services:

- ECS or EC2 for API hosting
- RDS PostgreSQL for primary database
- ElastiCache Redis for queue and cache
- S3 for backups and receipts
- CloudWatch for monitoring
- SES for email
- SNS for SMS and OTP

## 9. Monorepo Structure

Recommended layout:

```text
/apps
  /desktop
  /backend
  /warehouse

/packages
  /ui
  /types
  /sync-engine
  /auth
  /payments
  /inventory
  /reporting

/infrastructure
  /terraform
  /docker

/docs
  /adr
  /api
  /migration
```

### 9.1 Purpose of Each Area

`/apps/desktop`

- branch POS application
- local SQLite access
- cashier workflows
- local queue management

`/apps/backend`

- NestJS API
- authentication
- cloud sync endpoints
- reporting APIs
- admin workflows

`/apps/warehouse`

- warehouse operator application
- transfer review and receiving workflows
- warehouse inventory operations

`/packages/sync-engine`

- event creation helpers
- queue processor
- sync retry logic
- conflict detection and reconciliation logic

`/packages/inventory`

- inventory domain rules
- stock movement calculations
- event application engine

`/packages/auth`

- JWT utilities
- offline auth cache
- permission sync logic

`/packages/payments`

- payment provider abstraction
- terminal integrations
- mobile money provider adapters

`/packages/reporting`

- report queries
- analytics helpers
- aggregation logic

## 10. Domain Model

### 10.1 Organization

- `organizations`
- `branches`
- `warehouses`

### 10.2 Users and Access

- `users`
- `roles`
- `permissions`
- `sessions`
- `devices`

### 10.3 Products

- `products`
- `product_variants`
- `categories`
- `suppliers`
- `barcodes`

### 10.4 Inventory

- `inventory_levels`
- `inventory_events`
- `stock_adjustments`
- `stock_transfers`
- `transfer_items`

### 10.5 Sales

- `sales`
- `sale_items`
- `payments`
- `refunds`
- `receipts`

### 10.6 Warehouse

- `restock_requests`
- `warehouse_dispatches`
- `warehouse_receipts`

### 10.7 CRM

- `customers`
- `loyalty_transactions`

### 10.8 Audit

- `audit_logs`
- `activity_events`
- `security_events`

## 11. Key Data Modeling Principles

### 11.1 Immutable Event Trail

Never treat inventory as a number that can be casually overwritten.

Inventory must be derived from events such as:

- sale created
- refund completed
- stock received
- stock transferred
- stock adjusted
- spoilage recorded

Use current stock snapshots for speed, but keep the event log as the source of truth for reconciliation and auditing.

### 11.2 Idempotent Sync

Every event must have a globally unique ID. Cloud sync handlers must be idempotent so replays do not create duplicate stock or sales.

### 11.3 Versioned Entities

For mutable business objects like transfers, requests, and product records, include:

- `version`
- `updated_at`
- `updated_by`

This helps detect collisions and drive conflict resolution.

### 11.4 Soft Deletes for Business Data

Avoid hard deletion for user-created business records. Prefer:

- `deleted_at`
- `deleted_by`
- `delete_reason`

Auditability is more important than storage savings.

## 12. Offline-First Sync Design

This is the most important subsystem.

### 12.1 Core Rule

Branches write locally first. Cloud sync is asynchronous.

### 12.2 Example Sale Flow

1. Cashier completes sale.
2. Sale is committed to local SQLite in a single transaction.
3. Sale-related inventory events are written locally.
4. Sync queue entries are created.
5. Receipt can print immediately.
6. Background sync engine pushes unsynced events to cloud.
7. Cloud acknowledges accepted events.
8. Local queue marks them as synced.

### 12.3 Sync Queue Responsibilities

The local queue must track:

- pending events
- retry count
- last error
- next retry time
- sync status
- created time
- acknowledged time

Suggested statuses:

- `pending`
- `processing`
- `synced`
- `failed`
- `dead_letter`

### 12.4 Sync Payload Design

Each sync payload should include:

- event ID
- event type
- aggregate type
- aggregate ID
- organization ID
- branch or warehouse ID
- device ID
- actor user ID
- local timestamp
- optional cloud timestamp
- schema version
- payload signature or checksum
- event data

### 12.5 Retry Strategy

Use exponential backoff with jitter for transient failures.

Recommended behavior:

- immediate retry for short network interruptions
- backoff for repeated failures
- dead-letter after configured hard threshold
- visible alert for branch manager if queue remains blocked

### 12.6 Conflict Resolution Strategy

Use an event-sourcing-inspired model.

Examples of event types:

- `SALE_CREATED`
- `SALE_VOIDED`
- `RETURN_COMPLETED`
- `STOCK_RECEIVED`
- `STOCK_TRANSFER_REQUESTED`
- `STOCK_TRANSFER_DISPATCHED`
- `STOCK_TRANSFER_RECEIVED`
- `STOCK_ADJUSTED`
- `DAMAGE_LOGGED`

Rules:

- avoid blind overwrite of inventory counts
- process duplicate event IDs as no-ops
- use versions for mutable workflows
- flag incompatible inventory mutations for manual review

### 12.7 Queue Safety Rules

- never drop unsynced events silently
- every queue failure must be observable
- local commits and queue writes must happen in one local transaction when possible
- sync acknowledgement must be persisted before clearing retry state

### 12.8 Sync Health Monitoring

Track locally and in cloud:

- last successful sync time
- queue depth
- failed event count
- dead-letter count
- auth token freshness
- connectivity status
- branch drift indicators

## 13. Inventory Consistency Strategy

Inventory corruption is the biggest trust risk in the system.

### 13.1 Inventory Source of Truth

Use `inventory_events` as the historical source of truth and `inventory_levels` as the fast read model.

### 13.2 Stock Change Rules

All stock-changing operations must emit standardized events:

- sale reduces sellable branch stock
- refund increases sellable branch stock or damaged stock depending on condition
- warehouse dispatch reduces warehouse reserved or available stock
- warehouse receipt increases branch stock
- adjustment modifies stock with required reason
- damage moves stock out of sellable quantity

### 13.3 Reservations

To avoid overselling or double-allocating:

- branch cart should not hard-reserve stock for long periods
- warehouse transfer approval should reserve stock explicitly
- reservation expiry rules should be defined

### 13.4 Reconciliation Jobs

Run background reconciliation to compare:

- inventory snapshot totals
- event-derived totals
- transfer dispatch vs receipt balances
- local vs cloud sync counts

Mismatches should raise review tasks, not auto-correct silently.

## 14. Warehouse Operations Design

### 14.1 Restock Request Flow

```text
Branch detects low stock
        ↓
Branch creates request
        ↓
Warehouse Manager reviews
        ↓
Approve / Reject
        ↓
Items reserved
        ↓
Dispatch created
        ↓
Branch receives inventory
        ↓
Stock updated
```

### 14.2 Warehouse Workflow States

Suggested request statuses:

- `requested`
- `under_review`
- `approved`
- `rejected`
- `partially_fulfilled`
- `dispatched`
- `received`
- `closed`

### 14.3 Transfer Lifecycle

Suggested transfer states:

- `draft`
- `approved`
- `reserved`
- `picked`
- `packed`
- `dispatched`
- `in_transit`
- `received_partial`
- `received_complete`
- `cancelled`

### 14.4 Partial Fulfillment

Support partial fulfillment explicitly. Plumbing inventory often has stock fragmentation across items, lengths, fittings, and variants. The system must not assume requested quantity equals dispatched quantity.

## 15. POS Checkout Design

### 15.1 Checkout Priorities

- speed
- reliability
- offline safety
- minimal cashier friction

### 15.2 Checkout Transaction Boundaries

A sale commit should ideally include:

- sale header
- sale items
- payments
- inventory events
- receipt sequence
- sync queue records

If this cannot commit atomically locally, the design is unsafe and must be revised.

### 15.3 Suspended Sales

Suspended sales should be stored locally and optionally sync later. They should not affect inventory until finalized unless there is a deliberate reservation model.

### 15.4 Returns and Refunds

Returns must:

- reference original sale when possible
- record item condition
- capture refund method
- emit reversal inventory events
- require elevated permission for suspicious cases

## 16. Payment Architecture

### 16.1 Supported Payments

- Cash
- Card
- Mobile money

### 16.2 Design Rule

Do not hardcode payment providers directly into sales workflows.

Build a provider abstraction:

```text
Payment Provider Interface
```

Possible methods:

- `authorize()`
- `capture()`
- `void()`
- `refund()`
- `checkStatus()`

### 16.3 Card Integration

Start with:

- Stripe Terminal

Later:

- local POS device APIs

### 16.4 Mobile Money Integration

Prepare adapters for:

- MTN MoMo
- Vodafone Cash
- AirtelTigo Cash

The core app should call a unified internal payment contract so providers can be added or replaced without rewriting checkout logic.

## 17. Authentication and Authorization

### 17.1 Online Authentication

- JWT access tokens
- refresh tokens
- OTP or SMS login
- email login if needed for admins

### 17.2 Offline Authentication

Allow recently authenticated users to log in offline using:

- encrypted local credential cache
- locally cached role and permission grants
- device registration checks

Suggested offline controls:

- offline login expiry window
- forced re-auth after configurable period
- device-bound credential cache
- secure local secret storage

### 17.3 RBAC Roles

Suggested role matrix:

| Role | Purpose |
| --- | --- |
| Super Admin | Full system access |
| Warehouse Manager | Warehouse operations |
| Branch Manager | Branch operations |
| Cashier | POS only |
| Accountant | Financial reports |
| Auditor | Read-only audit access |

### 17.4 Permission Design Guidance

Permissions should be action-based rather than page-based.

Examples:

- `sale.create`
- `sale.refund`
- `sale.discount.override`
- `inventory.adjust`
- `transfer.approve`
- `report.financial.read`
- `audit.read`

## 18. Auditability and Security

### 18.1 Audit Logging

Every important action should log:

- actor user ID
- branch or warehouse ID
- device ID
- event type
- target entity
- target entity ID
- before values when relevant
- after values when relevant
- local timestamp
- synced timestamp

### 18.2 Immutable Audit Strategy

Audit records should be append-only. If correction is needed, create a correcting entry instead of rewriting history.

### 18.3 Encryption

Required protections:

- encrypted local database or encrypted file storage
- encrypted backups
- HTTPS and TLS in transit
- signed sync payloads
- secret management outside source control

### 18.4 Fraud Prevention

Track and alert on:

- suspicious refund patterns
- excessive voids
- manual override abuse
- off-hours stock adjustments
- repeated failed login attempts

## 19. Migration Architecture

Migration is a critical subsystem because legacy data quality often determines whether the new system is trusted.

### 19.1 Legacy Context

Known inputs:

- current system is MySQL 5.7
- migration is one-time
- direct DB access may or may not be available

### 19.2 Supported Source Types

- direct MySQL connection
- SQL dump
- CSV
- Excel

### 19.3 Migration Pipeline

```text
Extract
   ↓
Normalize
   ↓
Validate
   ↓
Map
   ↓
Preview
   ↓
Import
   ↓
Verify
```

### 19.4 Migration Requirements

- dry-run mode
- duplicate detection
- SKU normalization
- rollback snapshots
- validation reports
- import logs

### 19.5 Migration Tooling Design

Build migration as a repeatable pipeline, not as ad hoc scripts.

Suggested pipeline stages:

1. `extract`
2. `transform`
3. `validate`
4. `map`
5. `load`
6. `verify`

Suggested output artifacts:

- source row count report
- rejected records report
- duplicate SKU report
- unmapped field report
- post-import verification report

### 19.6 Migration Safety Rules

- never import directly into production first
- always run dry-run on a staging dataset
- preserve raw extracts
- snapshot database before final load
- compare imported totals against legacy totals

## 20. Hardware Integration Strategy

### 20.1 Barcode Scanners

Use HID keyboard emulation first. It is usually the simplest and most compatible initial approach.

### 20.2 Receipt Printers

Support:

- ESC/POS
- thermal printers

### 20.3 Cash Drawers

Trigger via printer pulse where supported.

### 20.4 Terminal Devices

Use a hardware abstraction layer so vendor-specific device logic stays isolated.

## 21. Backend Service Boundaries

Suggested backend modules in NestJS:

- `auth`
- `users`
- `branches`
- `warehouses`
- `products`
- `inventory`
- `sales`
- `payments`
- `transfers`
- `customers`
- `loyalty`
- `sync`
- `reports`
- `audit`
- `migration`

### 21.1 Sync API Responsibilities

The sync API should:

- accept event batches
- validate branch identity and auth
- enforce idempotency
- persist accepted events
- return per-event result status
- publish downstream processing jobs if needed

### 21.2 Reporting Separation

Heavy reporting should not block operational transaction APIs. Keep reporting queries separated from hot paths and consider dedicated read models later.

## 22. Local App Architecture

### 22.1 Desktop App Layers

Suggested local layering:

1. UI layer
2. application services
3. domain logic
4. local persistence
5. sync adapter
6. hardware adapter

### 22.2 Local Storage Areas

The branch app should manage:

- local operational database
- sync queue store
- auth cache
- configuration store
- printer and device settings
- optional local backup/export files

### 22.3 Failure Handling Principles

- UI should never freeze waiting on cloud sync
- local failures should produce clear operator feedback
- queue failures should be visible to managers
- hardware failures should degrade gracefully where possible

## 23. Reporting Design

Reporting is important, but it should come after operational correctness.

### 23.1 Priority Reports for MVP

- daily sales summary
- branch stock on hand
- low stock report
- cashier shift summary
- transfer status report

### 23.2 Later Reports

- profit and loss
- stock aging
- dead stock
- loyalty analytics
- branch comparison dashboards
- tax and accountant exports

## 24. MVP Roadmap

### Phase 1

- POS
- Inventory
- Offline mode
- Warehouse requests
- Sync engine
- Basic reports
- Migration tooling

### Phase 2

- Loyalty
- E-commerce sync
- Advanced analytics
- SMS notifications
- Forecasting

### Phase 3

- AI demand prediction
- Supplier portal
- Vendor APIs
- Multi-company support

## 25. Recommended Build Order

Do not start with dashboards.

Do not start with advanced analytics.

Build in this order:

1. Core local database schema
2. Inventory event system
3. Offline sync queue
4. Basic POS checkout
5. Warehouse transfer workflow
6. Cloud reconciliation

Reason: if the inventory and sync foundations are weak, everything on top becomes unreliable.

## 26. Biggest Technical Risks and Mitigations

### 26.1 Inventory Corruption

Risk:

- mismatched quantities
- duplicate stock movements
- silent overwrites

Mitigation:

- event-driven inventory tracking
- immutable event log
- reconciliation jobs

### 26.2 Offline Sync Conflicts

Risk:

- duplicate event delivery
- out-of-order updates
- stale versions

Mitigation:

- immutable events
- idempotency keys
- entity versioning
- manual review paths for unreconcilable conflicts

### 26.3 Migration Quality

Risk:

- bad SKUs
- missing customers
- inconsistent totals

Mitigation:

- dry-run pipeline
- validation reports
- rollback snapshots
- import verification

### 26.4 Branch Internet Failures

Risk:

- blocked sales
- delayed reconciliation

Mitigation:

- SQLite local-first architecture
- background sync
- robust retry queue

### 26.5 Hardware Driver Chaos

Risk:

- unreliable printer support
- vendor-specific terminal issues

Mitigation:

- hardware abstraction layer
- start with the most universal protocols first

## 27. Suggested Initial Backlog

### Foundation

- Define canonical domain event schema
- Design local SQLite schema
- Define sync queue schema
- Set up monorepo
- Set up shared TypeScript types

### Inventory

- Implement inventory event writer
- Implement inventory snapshot projector
- Implement stock adjustment rules
- Implement transfer event model

### POS

- Build product search and barcode scan flow
- Build cart and checkout flow
- Build cash payment flow
- Build split payment support
- Build suspended sales

### Sync

- Build local queue processor
- Build cloud sync API
- Implement idempotent event ingestion
- Implement retry and dead-letter handling

### Warehouse

- Build restock request workflow
- Build approval flow
- Build dispatch flow
- Build receiving flow

### Migration

- Build extract adapters
- Build field mapping rules
- Build dry-run reports
- Build verification scripts

## 28. Suggested Initial Environment and Tooling

When setting up on any PC, use:

- Node.js LTS
- pnpm
- PostgreSQL
- SQLite
- Redis
- Docker Desktop if available

Optional but helpful:

- Terraform for infrastructure
- TablePlus or DBeaver for database inspection
- Postman or Insomnia for API testing

## 29. Suggested Repository Bootstrap Checklist

When starting implementation, create:

1. monorepo package manager config
2. shared TypeScript config
3. backend NestJS app
4. Electron desktop app
5. warehouse app
6. shared domain packages
7. docs folder
8. environment example files

Minimum docs to maintain:

- architecture overview
- schema decisions
- sync contract
- migration mapping notes
- deployment notes

## 30. Continuation Guide for Another PC

This section is specifically for migrating development to another computer.

### 30.1 Files to Keep Together

At minimum, copy:

- the full project folder
- this file
- any `.env.example` files
- database schema files
- migration scripts
- seed data
- docs

Never depend on memory alone for architecture decisions.

### 30.2 Setup Checklist on New PC

1. Install Node.js LTS.
2. Install pnpm.
3. Install PostgreSQL.
4. Install Redis.
5. Install Docker Desktop if you want containerized local services.
6. Open the project folder.
7. Install dependencies.
8. Create environment files from examples.
9. Start local infrastructure.
10. Run backend.
11. Run desktop app.
12. Run warehouse app if separated.

### 30.3 Information That Should Always Be Documented

Before switching PCs, keep these up to date:

- current architecture decisions
- current schema version
- sync event contract version
- unresolved technical risks
- next implementation priorities
- any provider credentials setup steps
- local service ports

### 30.4 Recommended Future Docs

As development continues, add:

- `docs/SETUP.md`
- `docs/ENVIRONMENT.md`
- `docs/SYNC_ENGINE.md`
- `docs/INVENTORY_RULES.md`
- `docs/MIGRATION_PLAN.md`
- `docs/DEPLOYMENT.md`
- `docs/TROUBLESHOOTING.md`

### 30.5 Good Handoff Habit

At the end of every major work session, update:

- what was built
- what is pending
- blockers
- next recommended task

This reduces restart time dramatically on a new PC.

## 31. Proposed ADR Topics

As implementation starts, record architecture decisions in `docs/adr`.

Recommended ADRs:

- why PostgreSQL is the cloud source of truth
- why SQLite is used locally
- why inventory uses immutable events
- sync idempotency strategy
- payment abstraction strategy
- migration pipeline design
- audit log retention strategy

## 32. Open Questions To Resolve Early

These are important unknowns that should be answered before deep implementation:

- Will each branch have one device or multiple POS terminals?
- Will branches share one local network service or run standalone per device?
- Is branch pricing global or branch-specific at the SKU level?
- Are serial numbers required for all items or only selected categories?
- What exact mobile money providers are needed at launch?
- Will warehouse and branches use the same app with role-based screens or separate apps?
- Is direct access to the legacy MySQL database available?
- Are tax rules simple or multi-rate by product category?

## 33. Final Recommendation

The correct architecture is hybrid local-cloud, not cloud-only.

The project should begin with inventory correctness, local persistence, and sync reliability. UI polish, analytics, and dashboards should come only after the operational core is trustworthy.

If there is one principle to protect throughout development, it is this:

Sales must succeed locally even when the internet and backend do not.

## 34. Immediate Next Steps

Recommended next implementation actions:

1. Create the monorepo skeleton.
2. Define shared domain types.
3. Design the SQLite and PostgreSQL schemas.
4. Define the inventory event contract.
5. Define the local sync queue schema.
6. Implement the first local sale transaction flow.

## 35. Document Ownership

This file should be treated as the current source-of-truth planning document until it is split into smaller focused docs.

Recommended future split:

- product requirements
- architecture
- sync engine
- inventory rules
- migration plan
- deployment and environment setup

