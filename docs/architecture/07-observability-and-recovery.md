# ESCT Observability and Recovery

Status: Production Foundation V1

## 1. Purpose

A failure that nobody can see becomes a silent production defect.

ESCT must make important operational failures observable and recoverable.

## 2. Observability Layers

Production observability should eventually include:

- structured logs;
- metrics;
- health checks;
- alerts;
- audit events;
- blockchain/indexer reconciliation signals.

Exact vendors are not selected in Foundation V1.

## 3. Structured Logging

Backend services should use structured logs rather than uncontrolled console text.

Useful fields include:

- timestamp;
- environment;
- service;
- request ID;
- user/wallet identifier where appropriate;
- agreement ID;
- chain ID;
- transaction hash;
- operation;
- severity;
- error code.

Sensitive values must be redacted.

## 4. Never Log

Never log:

- user private keys;
- seed phrases;
- database passwords;
- secret API keys;
- session secrets;
- full authentication tokens;
- private evidence contents unnecessarily.

Signed URLs and wallet signatures should be handled carefully and redacted where appropriate.

## 5. Required Health Signals

Backend V1 should eventually expose/measure:

- API health;
- database connectivity;
- object-storage connectivity;
- RPC availability;
- indexer health;
- indexer lag;
- worker health;
- failed jobs;
- queue/outbox backlog where used.

## 6. Blockchain Indexer Monitoring

Indexer observability should include:

- current indexed block;
- target/current chain head;
- lag in blocks;
- last successful processing time;
- failed event count;
- replay/rebuild status.

A stale indexer must be visible.

## 7. Transaction Observability

Application transaction lifecycle should distinguish:

- prepared;
- wallet rejected;
- submitted;
- pending;
- confirmed;
- reverted;
- replaced;
- dropped/unknown.

Do not treat "submitted" as "successful."

## 8. Operational Alerts

Production-stage alerts should exist for conditions such as:

- API unavailable;
- database unavailable;
- storage failure;
- indexer lag above threshold;
- repeated worker failures;
- RPC outage;
- high error rate;
- backup failure;
- failed migration;
- suspicious privileged activity.

Thresholds remain deployment-stage decisions.

## 9. Audit Trail

Important application actions should produce auditable records.

Examples:

- wallet authenticated;
- agreement metadata changed;
- delivery created;
- file uploaded;
- manifest generated;
- private evidence accessed;
- privileged action performed.

Blockchain actions already leave on-chain records, but application context may still be useful.

## 10. Recovery from Missed Blockchain Events

The indexer must support:

- checkpoint persistence;
- replay from known block;
- idempotent event processing;
- projection rebuild.

Deployment metadata must include the block from which indexing can safely begin.

## 11. Projection Reconciliation

ESCT must eventually support comparing database projections with authoritative chain state.

Mismatch behavior:

1. detect;
2. log;
3. repair projection;
4. preserve audit record where useful.

Do not modify chain state merely to make it match a stale database.

## 12. Worker Recovery

Background jobs must:

- tolerate restart;
- use bounded retries;
- avoid duplicate effects;
- expose failed jobs;
- support operator retry where safe.

No unbounded retry loops.

## 13. Graceful Shutdown

Backend services/workers/indexers should stop gracefully when possible.

Shutdown should avoid:

- abandoning partially committed database work;
- losing checkpoints;
- corrupting in-progress jobs.

## 14. Database Recovery

Before serious production use:

- backups enabled;
- restore procedure documented;
- restore drill completed.

Blockchain-derived projections may be rebuilt.

Native application data requires backup recovery.

## 15. Object Storage Recovery

Production storage design must define:

- durability expectations;
- versioning/immutability where appropriate;
- deletion policy;
- retention policy;
- recovery behavior.

Anchored evidence hashes may survive even if off-chain data is later deleted.

## 16. Incident Response

Before mainnet/high-value production use, ESCT needs an incident runbook covering:

- identify incident;
- contain;
- preserve evidence/logs;
- assess financial impact;
- pause appropriate functionality if supported;
- communicate internally/users where necessary;
- recover;
- reconcile;
- document post-incident findings.

## 17. Emergency Contract Semantics

Operational procedures must respect actual smart-contract capabilities.

There must be no imaginary backend "admin override" that the protocol does not support.

Pause and arbitration behavior must match deployed contract semantics.

## 18. Recovery Principle

Recovery must restore:

- correctness first;
- integrity second;
- availability third.

Never sacrifice financial correctness merely to make the UI appear healthy.

This document is normative for ESCT Production Foundation V1.
