# ESCT Source of Truth

Status: Foundation V1
Branch: feature/production-foundation

## 1. Purpose

This document defines which ESCT component is authoritative for each type of state.

When two components disagree, this document determines which state wins.

## 2. Fundamental Rule

Blockchain is authoritative for protocol-critical financial state.

PostgreSQL is authoritative for native off-chain application state.

Object storage is authoritative for stored file bytes.

External services are authoritative only for their own external resources.

Frontend state is never authoritative.

## 3. Authority Matrix

| Data / State | Authoritative Source | Notes |
|---|---|---|
| Agreement on-chain ID | Blockchain | Database may index it |
| Client wallet | Blockchain | For protocol participant identity |
| Contractor wallet | Blockchain | For protocol participant identity |
| Payment token | Blockchain | Financial authority |
| Milestone amount | Blockchain | Financial authority |
| Agreement acceptance | Blockchain | Database is projection only |
| Escrow funding | Blockchain | Never inferred from DB |
| Remaining escrow | Blockchain | Never computed as authoritative DB value |
| Milestone protocol status | Blockchain | Pending / Submitted / Disputed / Released / Refunded |
| Evidence commitment hash | Blockchain | Cryptographic commitment |
| Release | Blockchain | Financial authority |
| Refund | Blockchain | Financial authority |
| Dispute state | Blockchain | Protocol authority |
| Arbitration result | Blockchain | Protocol authority |
| Agreement title | PostgreSQL | Off-chain application data |
| Rich agreement description | PostgreSQL / storage | Depending on representation |
| Delivery note | PostgreSQL | Included in evidence manifest when required |
| Uploaded file bytes | Object storage | Hash commitment may be anchored on-chain |
| File metadata | PostgreSQL | Filename, size, MIME type, etc. |
| GitHub reference | PostgreSQL | GitHub remains external authority for GitHub object |
| Git commit contents | GitHub / Git repository | ESCT may record immutable commit SHA |
| Demo URL | PostgreSQL | Target service owns actual URL content |
| User profile | PostgreSQL | Wallet ownership still proven cryptographically |
| Email address | PostgreSQL | Subject to verification |
| Notification state | PostgreSQL | Not protocol authority |
| Search index | Derived system | Never authoritative |
| Blockchain event projection | PostgreSQL | Rebuildable from chain |
| Frontend cache | None | Disposable |
| Mobile local state | None | Disposable |

## 4. Conflict Rules

### Rule 1 - Chain beats database for financial state

Example:

Blockchain:

Milestone #2 = Submitted

Database:

Milestone #2 = Released

Result:

Milestone #2 is treated as Submitted.

The database projection is stale or corrupt and must be repaired.

### Rule 2 - Database cannot cause financial settlement

A database transition such as:

status = RELEASED

must never itself transfer funds.

Settlement requires a valid smart-contract transaction.

### Rule 3 - Frontend cannot grant authority

Hiding or showing a button is UX only.

Authorization must be enforced by:

- backend authorization for off-chain resources;
- smart-contract authorization for protocol actions.

### Rule 4 - Indexer data is rebuildable

Blockchain event projections must be reconstructable from chain history plus deployment metadata.

The indexer must support safe replay.

### Rule 5 - Duplicate events must be harmless

Processing the same blockchain event twice must not create duplicate economic/application effects.

Event processing must be idempotent.

### Rule 6 - Files require integrity verification

Stored evidence files must have cryptographic hashes.

If file bytes change, integrity verification must fail.

### Rule 7 - Delivery manifest is immutable after commitment

Once a delivery manifest hash has been committed on-chain, the committed manifest must not be silently edited.

Corrections require a new version/submission according to protocol rules.

## 5. Blockchain Projection Requirements

A blockchain projection record should eventually include enough information to uniquely identify its source:

- chain ID;
- contract address;
- transaction hash;
- block number;
- block hash where useful;
- log index;
- event name;
- decoded event data;
- processing timestamp.

At minimum, the tuple identifying an event must prevent duplicate processing.

## 6. Chain Reconciliation

The backend must eventually support reconciliation.

Example:

Database says:

Agreement #14 = Active
remainingEscrow = 2 ETH

Chain says:

Agreement #14 = Active
remainingEscrow = 1 ETH

The chain value wins.

The projection must be repaired and the inconsistency logged.

## 7. Off-Chain State Authority

For application-native information, PostgreSQL may be authoritative.

Examples:

- profile display name;
- agreement title;
- delivery note;
- notification read status.

However, off-chain records that correspond to on-chain participants must preserve the relevant chain and wallet identifiers.

## 8. External Integrations

External systems are not silently copied into ESCT truth.

Example GitHub delivery:

ESCT records:

- repository identifier;
- commit SHA;
- pull-request URL;
- retrieved metadata;
- retrieval time.

The commit SHA is preferred over a mutable branch reference.

## 9. Security Consequence

The architecture should remain safe if an attacker modifies ordinary backend database state but does not control:

- user wallets;
- protocol administrator keys;
- arbitrator keys;
- smart contracts.

Database compromise may expose or corrupt off-chain information and therefore remains serious.

It must not, by itself, authorize valid escrow settlement.

## 10. Engineering Rule

Every new ESCT field must answer:

1. Who owns this data?
2. What is its authoritative source?
3. Is it mutable?
4. Can it be reconstructed?
5. What happens if it disagrees with another component?
6. Can changing it affect funds?
7. What authorization protects it?

No production data model should be accepted without answering these questions.

This document is normative for ESCT Production Foundation V1.
