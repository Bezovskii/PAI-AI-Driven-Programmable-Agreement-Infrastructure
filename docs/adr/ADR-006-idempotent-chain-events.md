# ADR-006: Blockchain Event Processing Is Idempotent

Status: Accepted

## Decision

Indexer/event processing assumes at-least-once delivery and must be idempotent.

## Consequence

Duplicate blockchain events must not create duplicate application effects.
