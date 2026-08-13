# ESCT Failure Model

Status: Production Foundation V1

## 1. Purpose

ESCT must assume that infrastructure components will eventually fail.

A production system is not one where failures never happen.

A production system is one where failures:

- are contained;
- do not silently corrupt financial state;
- are detectable;
- are recoverable;
- do not create duplicate economic actions.

This document defines expected behavior under failure.

---

## 2. Core Failure Principle

The following components may temporarily fail:

- Web frontend
- Mobile application
- ESCT API
- PostgreSQL
- Object storage
- Background workers
- Blockchain indexer
- RPC provider
- GitHub integration
- Notification providers

Their failure may reduce availability.

Their failure must not independently create an invalid blockchain financial transition.

The smart contract remains the final authority for protocol-critical financial state.

---

## 3. Failure Categories

ESCT recognizes:

### Transient failure

Expected to recover automatically.

Examples:

- temporary RPC timeout;
- temporary database connection exhaustion;
- object-storage timeout;
- GitHub rate limit;
- temporary worker crash.

### Persistent failure

Requires operator intervention.

Examples:

- invalid deployment configuration;
- corrupted database;
- expired infrastructure credentials;
- contract address misconfiguration;
- storage bucket misconfiguration.

### Partial failure

One step succeeds while another fails.

These are particularly dangerous.

Example:

file stored successfully
-> database insert fails

or:

wallet transaction confirms
-> backend misses event

### Byzantine / incorrect dependency response

A component returns incorrect or stale information instead of failing visibly.

Examples:

- stale RPC node;
- stale indexer projection;
- corrupted database record;
- cached frontend state.

Financial decisions must not depend on one off-chain observation alone when chain state is authoritative.

---

## 4. Frontend Failure

Possible failures:

- page crash;
- browser closes;
- stale React state;
- user refreshes during transaction;
- wrong cached agreement state;
- network connection disappears;
- duplicate button click.

Required behavior:

- frontend state is disposable;
- reopening the application must reconstruct important state;
- transaction state must be recoverable from transaction hash and chain state;
- buttons must not be relied upon for security;
- duplicate interaction must not produce duplicate settlement.

Example:

Client presses Approve.

Transaction is submitted.

Browser crashes.

The application must not assume failure.

After reopening:

- query transaction/chain state;
- determine whether the milestone became Released;
- update UI accordingly.

---

## 5. Mobile Failure

Mobile introduces additional failure modes:

- application backgrounded;
- operating system kills process;
- wallet application interrupts flow;
- deep-link callback lost;
- weak connection;
- user switches networks;
- device storage cleared.

Required behavior:

mobile local state must not be authoritative.

Critical operations must recover from:

- backend state;
- blockchain state;
- transaction identifiers.

A user must not lose protocol truth because the mobile process died.

---

## 6. API Failure

Possible failures:

- API unavailable;
- process crash;
- deployment restart;
- request timeout;
- validation bug;
- dependency outage.

Required behavior:

- no financial state is invented locally;
- requests have bounded timeouts;
- retries must be safe;
- mutating application operations should support idempotency where appropriate;
- startup configuration must be validated;
- invalid configuration must fail loudly rather than silently default.

API restart must not corrupt persistent application state.

---

## 7. PostgreSQL Failure

Possible failures:

- database unavailable;
- transaction rollback;
- deadlock;
- corrupted projection;
- migration failure;
- accidental deletion;
- storage exhaustion.

Required behavior:

- database transactions used where atomic application changes are required;
- chain-derived state remains rebuildable;
- backups exist before production-critical destructive migrations;
- application does not use stale financial projections to authorize settlement;
- migration failures stop deployment rather than silently continuing.

Example:

Blockchain says:

Milestone = Released

PostgreSQL says:

Milestone = Submitted

Response:

- chain remains authoritative;
- application identifies projection mismatch;
- projection is repaired;
- mismatch is observable.

---

## 8. Object Storage Failure

Possible failures:

- upload timeout;
- partial upload;
- inaccessible object;
- object deleted;
- storage credentials fail;
- hash mismatch.

Required behavior:

A delivery must not become ReadyToSubmit until required evidence has been fully stored and integrity verified.

File existence and file integrity are separate checks.

A file is valid only when expected bytes produce the expected cryptographic hash.

Temporary uploaded objects may require cleanup when the associated delivery operation fails.

---

## 9. Upload / Database Partial Failure

Example:

1. File upload succeeds.
2. Database insert fails.

Required behavior:

- milestone is not represented as successfully delivered;
- uploaded object becomes orphan candidate;
- cleanup/reconciliation process identifies it;
- user may retry safely.

Opposite case:

1. Database record created.
2. File upload fails.

Required behavior:

- delivery record must not be treated as complete;
- record remains Draft/Failed/Preparing according to final Backend V1 model;
- retry or cleanup is possible.

---

## 10. Evidence Manifest Failure

Possible failures:

- one file missing;
- file hash mismatch;
- canonical serialization error;
- unsupported manifest version;
- database failure during manifest creation.

Required behavior:

No blockchain commitment should be requested until:

- required files exist;
- byte hashes are verified;
- manifest is deterministically generated;
- final manifest hash is known.

Once anchored on-chain, the committed manifest must not be mutated.

---

## 11. Wallet Transaction Failure

Possible outcomes:

- user rejects signature;
- user rejects transaction;
- insufficient funds;
- wrong network;
- RPC rejects transaction;
- transaction submitted;
- transaction remains pending;
- transaction replaced;
- transaction reverted;
- transaction dropped;
- transaction confirms successfully.

These states must not be collapsed into one generic "failed" state.

Most importantly:

Transaction submission != transaction confirmation.

---

## 12. RPC Failure

Possible failures:

- timeout;
- rate limit;
- unavailable provider;
- stale response;
- provider outage.

Required behavior:

- use bounded retries;
- no infinite retry loops;
- retry with backoff where appropriate;
- failure becomes observable;
- financial truth remains recoverable from another healthy RPC endpoint or later reconciliation.

Long-term production deployment should support an RPC provider strategy rather than assuming one endpoint is permanently available.

Provider selection remains a later operational decision.

---

## 13. Indexer Failure

Possible failures:

- worker offline;
- RPC outage;
- decoding error;
- crash midway through block processing;
- event received twice;
- block reorganization;
- event processing delayed.

Required behavior:

- processing is idempotent;
- progress/checkpoint is persisted;
- replay is supported;
- duplicate events are harmless;
- derived projections can be rebuilt;
- indexer lag is measurable.

An indexer outage must never prevent the underlying smart contract from remaining correct.

---

## 14. Duplicate Processing

ESCT assumes at-least-once execution may occur in asynchronous systems.

Therefore:

exactly-once delivery is not assumed.

Instead:

operations must be idempotent.

For blockchain events, a unique identity should include:

- chain ID;
- contract address;
- transaction hash;
- log index.

Repeated processing of the same event must not duplicate:

- notifications where avoidable;
- audit events;
- application records;
- settlement projections.

---

## 15. Background Worker Failure

Possible failures:

- worker crashes during task;
- task delivered twice;
- worker loses connection;
- external dependency times out.

Required behavior:

- jobs are retryable when safe;
- retries are bounded;
- jobs have deterministic identifiers where useful;
- non-retryable failures move to an observable failed state;
- graceful shutdown prevents unnecessary partial processing.

---

## 16. GitHub Integration Failure

Possible failures:

- invalid URL;
- private repository;
- GitHub unavailable;
- API rate limit;
- commit deleted from accessible remote;
- authorization revoked.

Required behavior:

GitHub integration failure must not corrupt evidence already anchored.

Where GitHub content is important evidence, ESCT should persist immutable identifiers such as commit SHA and relevant retrieved metadata.

A mutable branch name alone is insufficient proof.

---

## 17. Notification Failure

Email, push, Telegram, Discord, or in-app delivery may fail.

Notification failure must not change:

- agreement state;
- milestone state;
- escrow state;
- dispute state.

Notifications are convenience and observability features, not protocol authority.

---

## 18. Blockchain Event Missed by Backend

Example:

1. Client approves milestone.
2. Transaction confirms.
3. Backend indexer is offline.
4. Database still says Submitted.

Correct system behavior:

Blockchain = Released

Database = stale projection

After recovery:

- indexer resumes/replays;
- event processed;
- database repaired;
- UI eventually reflects Released.

The system must never attempt another release simply because the database missed the original event.

---

## 19. Chain Reorganization

Blockchain indexing must not assume every recently observed block is permanently final.

Backend V1 must eventually define a confirmation/finality policy per network.

Indexer design must preserve enough metadata to detect/reconcile reorganization where relevant.

Exact confirmation depth remains a network/deployment decision.

---

## 20. Configuration Failure

Production configuration includes:

- chain ID;
- contract addresses;
- RPC endpoints;
- database connection;
- storage configuration;
- authentication configuration;
- environment identity.

Required behavior:

- configuration validated during startup;
- missing critical configuration causes startup failure;
- production must not silently fall back to localhost or test keys;
- environment configuration must be explicit.

---

## 21. Deployment Failure

A deployment may fail between:

- code deployment;
- database migration;
- worker deployment;
- indexer deployment.

Production deployment procedure must define ordering.

Backward-compatible migrations should be preferred where practical.

Destructive migrations require additional review and backup.

---

## 22. Backup and Restore Failure

A backup that has never been restored is not proven useful.

Before serious production use:

- PostgreSQL backups must exist;
- restore procedure must be documented;
- restore must be tested periodically;
- object-storage durability/recovery policy must be understood.

Chain-derived database projections may be rebuilt from chain.

Native off-chain records cannot necessarily be reconstructed and therefore require backups.

---

## 23. Recovery Principle

For every production dependency, ESCT must know:

1. How failure is detected.
2. Whether retry is safe.
3. What remains authoritative.
4. Whether data can be reconstructed.
5. Whether operator intervention is required.
6. What the user should see.
7. How normal processing resumes.

---

## 24. Failure Test Requirement

Critical flows require failure tests in addition to happy-path tests.

Delivery V1 must eventually test scenarios including:

- upload succeeds / DB fails;
- DB succeeds / storage fails;
- hashing fails;
- storage succeeds / wallet transaction rejected;
- wallet transaction succeeds / frontend closes;
- chain transaction succeeds / indexer misses event;
- duplicate event received;
- duplicate API request;
- RPC unavailable;
- database unavailable;
- wrong chain selected;
- expired authentication session;
- invalid evidence bytes;
- oversized upload;
- worker restarted mid-job.

---

## 25. Production Rule

Failures must be:

VISIBLE
+
BOUNDED
+
RECOVERABLE
+
NON-DESTRUCTIVE TO FINANCIAL CORRECTNESS

Silent failure is treated as a serious defect.

This document is normative for ESCT Production Foundation V1.
