# ADR-001: Blockchain Is Authoritative for Financial State

Status: Accepted

## Decision

ESCT smart contracts are authoritative for escrow custody and protocol-critical financial state.

PostgreSQL, frontend state and indexer projections are not financial authority.

## Consequence

A stale or corrupted database cannot by itself create a valid fund release, refund or dispute resolution.
