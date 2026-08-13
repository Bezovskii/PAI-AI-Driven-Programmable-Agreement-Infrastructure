# ADR-002: PostgreSQL Stores Application State and Chain Projections

Status: Accepted

## Decision

PostgreSQL will store native off-chain application data and rebuildable blockchain projections.

## Consequence

The schema must explicitly distinguish application-native records from chain-derived records.
