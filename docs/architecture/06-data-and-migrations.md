# ESCT Data and Migration Discipline

Status: Production Foundation V1

## 1. Purpose

This document defines how future ESCT backend data must be created, changed, migrated and recovered.

PostgreSQL will contain two fundamentally different categories of data:

1. Native off-chain ESCT application data.
2. Projections derived from blockchain state.

These categories must never be confused.

## 2. Native Off-Chain Data

Examples:

- user profiles;
- agreement titles and descriptions;
- delivery records;
- delivery notes;
- file metadata;
- notification state;
- audit/application activity;
- authentication/session data.

This data may not be reconstructable from blockchain history.

It therefore requires backups and controlled migrations.

## 3. Blockchain-Derived Data

Examples:

- agreement protocol status;
- milestone protocol status;
- funding events;
- settlement events;
- dispute events;
- arbitration events.

These records are projections.

They must be rebuildable from:

- chain ID;
- contract address;
- deployment block;
- blockchain history.

They are never authoritative for financial state.

## 4. Global Identity Rule

Agreement ID alone is not a globally safe identifier.

Protocol records must include appropriate chain identity.

At minimum:

- chain ID;
- contract address;
- on-chain entity ID.

## 5. Event Identity

Indexed blockchain events must have a unique identity sufficient to prevent duplicate processing.

Preferred identity:

- chain ID;
- contract address;
- transaction hash;
- log index.

Database uniqueness constraints should enforce this where appropriate.

## 6. Migration Rule

All schema changes must use explicit migrations.

Production schema must never be changed manually as an undocumented fix.

Migration files are committed to version control.

## 7. Migration Safety

Before destructive migration:

- review impact;
- verify backup;
- define rollback/recovery;
- test against staging or equivalent environment.

Prefer backward-compatible migrations where practical.

Example deployment sequence:

1. Add new nullable field/table.
2. Deploy code supporting old + new structure.
3. Backfill data.
4. Validate.
5. Remove obsolete structure later.

## 8. Database Transactions

Use database transactions when multiple writes must succeed or fail together.

Do not assume a database transaction can atomically include:

- blockchain transactions;
- object storage;
- external APIs.

Cross-system operations require explicit partial-failure handling.

## 9. Idempotency

Backend mutations that may be retried should use appropriate idempotency controls.

Possible mechanisms:

- idempotency keys;
- unique constraints;
- deterministic operation IDs;
- current-state validation.

## 10. Outbox Pattern

For important future operations where a database write must trigger asynchronous work, ESCT should consider a transactional outbox pattern.

Example:

Database transaction:
- create delivery record;
- create outbox event.

Worker:
- reads outbox;
- performs async action;
- records completion.

Exact implementation remains a Backend V1 design decision.

## 11. Evidence Immutability

Once a delivery manifest is cryptographically committed on-chain:

- the committed representation is immutable;
- file hashes are immutable;
- silent edits are forbidden.

Corrections require a new explicit version or submission flow.

## 12. File Identity

Stored file metadata should eventually include:

- internal file ID;
- storage key;
- original filename;
- content type;
- byte size;
- cryptographic content hash;
- creation time;
- owner/resource relationship.

The cryptographic hash must derive from actual file bytes.

## 13. Environment Isolation

ESCT must separate:

- local development;
- automated test;
- testnet/staging;
- production.

Each environment must have separate:

- database;
- storage;
- credentials;
- configuration;
- contract addresses where applicable.

Production must never silently use local/test configuration.

## 14. Seed/Test Data

Fake/demo data must not be inserted into production through ordinary migrations.

Development fixtures must be explicitly environment-scoped.

## 15. Backup Rule

Native PostgreSQL data requires backups before serious production use.

Backup policy must eventually define:

- retention;
- frequency;
- encryption;
- access;
- restore procedure.

Exact RPO/RTO targets remain a production-stage decision.

## 16. Restore Rule

Backups must be restore-tested.

A backup that has never been successfully restored is not considered proven.

## 17. Schema Acceptance Rule

Every new field must answer:

1. Is it native or blockchain-derived?
2. What is its authoritative source?
3. Is it mutable?
4. Can it be reconstructed?
5. Does it contain sensitive information?
6. What indexes/constraints protect it?
7. What happens during migration?
8. What happens if it disagrees with chain state?

This document is normative for ESCT Production Foundation V1.
