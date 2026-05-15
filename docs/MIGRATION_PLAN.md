# Migration Plan

## Supported Inputs

- MySQL direct connection
- SQL dump
- CSV
- Excel

## Pipeline

1. Extract
2. Normalize
3. Validate
4. Map
5. Preview
6. Import
7. Verify

## Safety Rules

- always dry-run first
- preserve raw extracts
- record duplicates and rejects
- compare source totals to imported totals

