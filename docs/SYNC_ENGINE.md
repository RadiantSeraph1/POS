# Sync Engine

## Principle

Write locally first. Sync later asynchronously.

## Required Guarantees

- local commit before cloud sync
- idempotent event ingestion
- retry with backoff
- dead-letter visibility
- no silent event loss

## Near-Term Work

1. Define event envelope.
2. Define queue table schema.
3. Define retry rules.
4. Define acknowledgement contract.
5. Define reconciliation jobs.

## Current State

The project now includes:

- local queue persistence in SQLite
- pending, failed, synced, and dead-letter queue states
- mock local transport processing
- a lightweight backend `POST /sync/events` endpoint
- idempotent duplicate detection by `eventId`
