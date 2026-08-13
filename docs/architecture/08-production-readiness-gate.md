# ESCT Production Readiness Gate

Status: Production Foundation V1

## 1. Purpose

Passing tests on a developer machine does not automatically make ESCT production-ready.

This document defines maturity gates.

## 2. Stage A — Development / Hackathon

Suitable for:

- local development;
- demos;
- hackathons;
- controlled testnet usage.

Required:

- deterministic setup;
- version-controlled code;
- automated contract tests;
- frontend build passes;
- architecture documented;
- no committed secrets;
- explicit environment configuration;
- known limitations documented.

Real-value usage is not implied.

## 3. Stage B — Testnet Beta

Additional requirements:

- backend authentication implemented;
- database migrations;
- private storage controls;
- evidence integrity verification;
- indexer idempotency;
- basic observability;
- failure-path tests;
- staging/testnet deployment;
- CI checks;
- backup procedure;
- recovery procedure;
- authorization tests.

## 4. Stage C — Limited Mainnet / Pilot

Additional requirements:

- smart-contract security review appropriate to value at risk;
- backend security review;
- privileged-key operational plan;
- production secret management;
- monitoring and alerts;
- restore drill;
- incident response procedure;
- RPC redundancy/strategy;
- rate limiting;
- upload security controls;
- legal/compliance review appropriate to jurisdictions;
- clear user risk disclosures;
- production deployment checklist.

Usage/value limits may be appropriate.

## 5. Stage D — Production Scale

Additional requirements:

- load/performance testing;
- capacity planning;
- mature monitoring;
- tested disaster recovery;
- defined RPO/RTO;
- regular security updates;
- dependency scanning;
- operational ownership;
- recurring restore drills;
- incident exercises;
- key rotation procedures;
- ongoing contract/backend security review.

## 6. CI Gate

Before merge/deployment of serious changes, CI should eventually run applicable checks:

- formatting/lint;
- typecheck;
- unit tests;
- smart-contract tests;
- integration tests;
- production frontend build;
- backend build;
- migration validation;
- dependency/security checks.

Exact CI implementation will be defined during Backend V1.

## 7. Configuration Gate

Production startup/build must validate:

- environment;
- chain ID;
- contract address;
- RPC configuration;
- API configuration;
- database configuration;
- storage configuration;
- authentication secrets.

No silent localhost/test fallback.

## 8. Security Gate

Before real-value usage:

- no user private-key custody;
- authorization enforced server-side;
- financial authorization enforced on-chain;
- secret management reviewed;
- file access private by default;
- upload limits active;
- evidence integrity verified;
- privileged roles reviewed.

## 9. Financial Correctness Gate

Money-affecting functionality must have tests for:

- happy path;
- unauthorized user;
- invalid state;
- duplicate/replay;
- reentrancy where relevant;
- dependency failure;
- partial failure;
- recovery/reconciliation.

"It worked once" is not acceptable evidence.

## 10. Deployment Gate

Production deployment must have:

- version identifier;
- migration plan;
- contract/network configuration;
- rollback/recovery plan;
- observability enabled;
- responsible operator identified.

## 11. Smart-Contract Versioning

AgreementEscrow V1 is not assumed upgradeable.

Foundation V1 does not introduce proxy upgradeability.

Future protocol versions should be treated as explicit deployments unless a separately reviewed upgrade architecture is adopted.

Applications must identify contracts using:

- chain ID;
- contract address;
- protocol version.

## 12. Mainnet Gate

ESCT must not describe itself as audited, production-safe, insured, legally compliant, or mainnet-ready without completing the relevant review.

Foundation documentation itself does not satisfy those reviews.

## 13. Scope Discipline

Before September hackathon delivery, ESCT prioritizes one reliable vertical flow:

Create Agreement
-> Accept
-> Fund
-> Deliver
-> Verify
-> Approve / Dispute
-> Settle

Features outside this path should not block the core delivery unless required for security or hackathon submission.

## 14. Production Readiness Decision

A release advances to the next maturity stage only when the requirements for that stage are explicitly reviewed.

No maturity level is inferred simply from feature count.

This document is normative for ESCT Production Foundation V1.
