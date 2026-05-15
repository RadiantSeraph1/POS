# Inventory Rules

## Core Rule

Inventory must be driven by immutable events, not manual count overwrites.

## Important Principles

- all stock changes require an event
- adjustments require a reason
- transfers require lifecycle states
- refunds must encode item condition
- reconciliation should detect mismatches without silent auto-fixes

