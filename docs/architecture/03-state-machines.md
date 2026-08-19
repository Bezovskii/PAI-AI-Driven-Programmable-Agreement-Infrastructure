# ESCT State Machines

Status: Production Foundation V1
Scope: AgreementEscrow V1 and future application integration

## 1. Purpose

ESCT state transitions must be explicit.

Frontend components, backend APIs, workers, database projections, and mobile clients must not invent alternative protocol transitions.

The smart contract defines authoritative financial/protocol state.

This document makes those transitions visible to the rest of the system.

---

## 2. AgreementEscrow V1 Agreement States

Agreement states:

- Proposed
- Accepted
- Active
- Completed
- Cancelled

### Primary state machine

Proposed
  |
  | contractor accepts
  v
Accepted
  |
  | client funds exact agreement total
  v
Active
  |
  | all milestone escrow settled
  v
Completed

Cancellation paths:

Proposed
  |
  | permitted cancellation
  v
Cancelled

Accepted
  |
  | permitted cancellation before funding
  v
Cancelled

There is no normal transition from Active to Cancelled in AgreementEscrow V1.

---

## 3. Agreement State Rules

### Proposed

Meaning:

- agreement exists;
- contractor is configured;
- payment asset is configured;
- client may construct milestones;
- escrow is not funded.

Permitted protocol progression:

- add milestone;
- contractor accept;
- permitted cancellation.

Forbidden concepts:

- funding before acceptance;
- milestone submission;
- milestone release;
- milestone arbitration.

### Accepted

Meaning:

- contractor accepted the configured milestone set;
- milestone financial structure is frozen;
- agreement remains unfunded.

Permitted progression:

- exact client funding;
- permitted cancellation before funding.

Not permitted:

- modifying milestone financial structure;
- milestone delivery before activation.

### Active

Meaning:

- full V1 agreement escrow has been funded;
- milestones may progress through delivery and settlement;
- remainingEscrow tracks unsettled value.

Permitted progression:

- contractor milestone submission;
- client milestone approval;
- participant dispute;
- arbitrator resolution;
- eventual completion.

The active agreement is not cancelled merely because the application/backend is unavailable.

### Completed

Meaning:

- agreement financial obligations represented by the funded milestone escrow have been settled;
- remainingEscrow is zero.

Completed is terminal in AgreementEscrow V1.

### Cancelled

Meaning:

- pre-funding agreement lifecycle ended without activating escrow.

Cancelled is terminal in AgreementEscrow V1.

---

## 4. Milestone States

Milestone states:

- Pending
- Submitted
- Disputed
- Released
- Refunded

### Normal happy path

Pending
  |
  | contractor submits evidence commitment
  v
Submitted
  |
  | client approves
  v
Released

### Dispute path

Pending
  |
  | contractor submits
  v
Submitted
  |
  | client OR contractor opens dispute
  v
Disputed
  |
  +----------------------------+
  |                            |
  | arbitrator: contractor     | arbitrator: client
  v                            v
Released                    Refunded

Released and Refunded are terminal.

---

## 5. Milestone Transition Matrix

| Current State | Action | Authorized Actor | Next State |
|---|---|---|---|
| Pending | submit milestone | Contractor | Submitted |
| Submitted | approve milestone | Client | Released |
| Submitted | open dispute | Client | Disputed |
| Submitted | open dispute | Contractor | Disputed |
| Disputed | resolve to contractor | Arbitrator | Released |
| Disputed | resolve to client | Arbitrator | Refunded |

Any transition not explicitly permitted must be rejected.

---

## 6. Important Invalid Transitions

The application must never present these as legitimate protocol actions:

Pending -> Released

Pending -> Refunded

Pending -> Disputed

Released -> Submitted

Released -> Disputed

Released -> Refunded

Refunded -> Submitted

Refunded -> Disputed

Refunded -> Released

Disputed -> Submitted

Disputed -> normal client approval

Completed agreement -> Active

Cancelled agreement -> Active

Active agreement -> pre-funding cancellation

UI controls may hide invalid actions for usability.

Security still depends on smart-contract enforcement.

---

## 7. Agreement Completion

Agreement completion is derived from settlement of funded escrow.

Example:

Agreement total: 3 ETH

Milestone 1: 1 ETH
Milestone 2: 2 ETH

Initial active state:

remainingEscrow = 3 ETH

After Milestone 1 Released:

remainingEscrow = 2 ETH
agreement = Active

After Milestone 2 Refunded or Released:

remainingEscrow = 0
agreement = Completed

Completion does not require every milestone to be Released.

A mixture of Released and Refunded terminal outcomes may complete the agreement.

---

## 8. Pause State

Pause is an administrative protocol condition, not an AgreementStatus value.

Conceptually:

Protocol
  |
  +-- Unpaused
  |
  +-- Paused

AgreementEscrow V1 pause semantics must preserve the tested distinction between:

- preventing selected new protocol activity; and
- not trapping already-funded escrow exits.

Current tested behavior includes:

- new agreement creation blocked while paused;
- agreement funding blocked while paused;
- already-funded milestone release can continue;
- existing dispute resolution can continue.

Future backend/mobile code must not reinterpret pause as:

"all actions are impossible."

The UI must follow actual contract semantics.

---

## 9. Arbitrator Role State Machine

Arbitrator role transfer is two-step.

Current Arbitrator
  |
  | proposes new arbitrator
  v
Pending Arbitrator
  |
  | proposed wallet accepts
  v
New Current Arbitrator

Cancellation:

Pending Arbitrator
  |
  | authorized cancellation
  v
No Pending Transfer

After successful acceptance:

- previous arbitrator loses arbitration authority;
- new arbitrator becomes authoritative.

A cancelled transfer cannot later be accepted.

---

## 10. Future Delivery V1 Application State

The following is an OFF-CHAIN application state machine proposed for the backend phase.

It does not replace MilestoneStatus.

Delivery records may use application states such as:

Draft
  |
  | contractor starts/upload begins
  v
Preparing
  |
  | files verified + manifest generated
  v
ReadyToSubmit
  |
  | wallet transaction submitted
  v
TransactionPending
  |
  +----------------------+
  |                      |
  | chain success        | chain revert/drop
  v                      v
Anchored                 Failed

Important:

"Anchored" may only be reached after confirmed chain evidence demonstrates successful milestone submission.

A database update alone cannot create Anchored state.

Exact naming and schema remain a Backend V1 design decision.

---

## 11. Blockchain Transaction Lifecycle

The future backend/frontend must distinguish transaction lifecycle from protocol lifecycle.

A transaction may be:

Prepared
  |
  | user signs/sends
  v
Pending
  |
  +-----------------------+
  |                       |
  | confirmed success     | reverted
  v                       v
Confirmed              Reverted

Additional real-world cases that implementation must support:

- user rejects signature;
- RPC submission timeout;
- transaction dropped;
- transaction replaced;
- transaction remains pending;
- frontend closes before confirmation;
- backend misses confirmation event.

A pending transaction is not equivalent to a successful protocol transition.

---

## 12. Backend Projection State

A database projection of blockchain state may temporarily be:

Synced

Lagging

Rebuilding

Error

These are operational states only.

They do not alter the underlying agreement or milestone state.

Example:

Database projection = Lagging

Blockchain milestone = Released

Authoritative state remains Released.

---

## 13. State Transition Engineering Rule

For every future state transition, ESCT must define:

1. Current state.
2. Requested action.
3. Authorized actor.
4. Preconditions.
5. Authoritative component.
6. Side effects.
7. Next state.
8. Failure behavior.
9. Retry behavior.
10. Audit information.
11. Tests.

If these cannot be answered, the transition is not ready for implementation.

---

## 14. No Hidden States

The application must not use undocumented status values to patch UI or backend behavior.

If a new business state is required:

- define it;
- define its authority;
- define its transitions;
- define failure behavior;
- add tests;
- update this document or its successor.

This document is normative for ESCT Production Foundation V1.
