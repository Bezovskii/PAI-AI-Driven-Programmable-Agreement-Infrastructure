# ESCT Protocol Invariants

Status: Production Foundation V1
Scope: AgreementEscrow V1 + future ESCT application layers

## 1. Purpose

An invariant is a condition that must remain true regardless of:

- frontend behavior;
- backend behavior;
- database state;
- indexer delays;
- RPC failures;
- retries;
- duplicate requests;
- malicious users;
- application bugs.

If an implementation can violate one of these invariants, the implementation is not acceptable.

---

## 2. Financial Invariants

### INV-FIN-001 — Escrow cannot be created from nothing

A successful funded agreement must correspond to actual ETH or supported ERC20 value received by the contract.

For ERC20 funding, accounting must reflect the exact amount actually transferred.

Fee-on-transfer behavior must not silently create incorrect accounting.

### INV-FIN-002 — Recorded liability must remain solvent

For every asset:

recorded escrow liability <= assets controlled by the contract for that liability.

Unexpected direct/forced ETH may make actual balance larger than liability.

It must never make recorded liability larger than available escrow assets.

### INV-FIN-003 — A milestone may settle only once

A milestone must never release or refund its monetary amount more than once.

Terminal financial states are:

- Released
- Refunded

After either state is reached, the same milestone amount cannot be transferred again.

### INV-FIN-004 — Settlement amount equals milestone amount

A milestone settlement must transfer exactly the amount assigned to that milestone.

No backend field, UI value, or client-provided amount may override the on-chain milestone amount.

### INV-FIN-005 — Remaining escrow cannot become negative

For a funded agreement:

remainingEscrow >= 0

Each milestone settlement reduces remainingEscrow by that milestone's on-chain amount exactly once.

### INV-FIN-006 — Agreement completion requires exhausted escrow

A funded agreement may become Completed only when all escrow assigned to its milestones has been settled according to protocol rules.

For AgreementEscrow V1:

remainingEscrow == 0

is required for financial completion.

### INV-FIN-007 — Database state cannot move funds

No PostgreSQL update, API request, worker job, indexer event, notification, or frontend state change is sufficient to release or refund escrow.

Financial settlement requires a valid smart-contract state transition.

---

## 3. Authorization Invariants

### INV-AUTH-001 — Only the client defines a proposed agreement

Only the agreement client may add milestones while the agreement is still configurable.

### INV-AUTH-002 — Only the contractor accepts

Agreement acceptance requires authorization from the configured contractor.

A backend role or database role must not substitute for wallet ownership.

### INV-AUTH-003 — Only the client funds the agreement

Funding authority belongs to the configured client.

### INV-AUTH-004 — Only the contractor submits milestone delivery

Milestone submission requires the configured contractor.

### INV-AUTH-005 — Only the client approves normal release

Normal milestone approval and release requires the configured client.

### INV-AUTH-006 — Only protocol participants may open milestone disputes

Only the relevant client or contractor may open a milestone dispute.

### INV-AUTH-007 — Only the active arbitrator resolves disputes

Dispute resolution requires the currently authorized on-chain arbitrator.

A previous arbitrator must lose authority after a completed role transfer.

### INV-AUTH-008 — Backend authentication never becomes wallet custody

The ESCT backend must never possess user private keys or seed phrases.

Authentication may prove wallet ownership using signatures.

Financial transactions remain wallet-signed.

---

## 4. Agreement Lifecycle Invariants

### INV-AGR-001 — Agreement IDs are immutable

Once created, an on-chain agreement ID identifies the same agreement record permanently.

### INV-AGR-002 — Participants cannot silently change

The client and contractor attached to an existing AgreementEscrow V1 agreement are immutable.

A future protocol version requiring participant replacement must define an explicit transition rather than mutating history.

### INV-AGR-003 — Payment asset cannot silently change

The payment asset selected for an agreement cannot be replaced after creation.

### INV-AGR-004 — Milestones cannot change after acceptance

AgreementEscrow V1 milestone construction is frozen once the contractor accepts.

The application must not pretend that changing PostgreSQL milestone metadata changes the on-chain financial agreement.

### INV-AGR-005 — Funding occurs only after acceptance

A proposed agreement cannot become financially active before valid contractor acceptance.

### INV-AGR-006 — Agreement cannot be funded twice

An already-funded agreement cannot receive a second protocol funding transition.

### INV-AGR-007 — Funded agreements cannot use pre-funding cancellation

Cancellation intended for Proposed or Accepted-but-unfunded agreements must not be used to bypass settlement of active escrow.

---

## 5. Milestone Lifecycle Invariants

### INV-MIL-001 — Submission requires an active funded agreement

A milestone cannot be validly delivered through the protocol before the agreement is Active.

### INV-MIL-002 — Evidence commitment cannot be zero

A milestone submission must contain a non-zero evidence commitment hash.

### INV-MIL-003 — Pending is the only normal pre-submission state

A milestone starts Pending.

A normal contractor delivery transitions it to Submitted.

### INV-MIL-004 — Submitted milestone cannot be submitted again

Repeated UI clicks, retries, duplicated API calls, or malicious calls must not create multiple valid submissions for the same V1 milestone state.

### INV-MIL-005 — Normal approval requires Submitted state

The client cannot release a milestone through the normal approval path before contractor submission.

### INV-MIL-006 — Disputed milestone cannot use normal approval path

Once a milestone enters Disputed, settlement must go through dispute resolution.

### INV-MIL-007 — Terminal states are immutable

Released and Refunded milestones are terminal for AgreementEscrow V1.

They must not transition back to:

- Pending;
- Submitted;
- Disputed.

---

## 6. Evidence Invariants

### INV-EVD-001 — On-chain hash commits to exact evidence representation

The evidence hash stored on-chain must correspond to a deterministic representation defined by ESCT.

For the future Delivery V1 system, this will be a versioned canonical delivery manifest.

### INV-EVD-002 — Anchored evidence cannot be silently edited

Once a manifest commitment has been placed on-chain, the committed manifest must be immutable.

Corrections require a new explicit version or protocol-supported resubmission.

### INV-EVD-003 — File hashes derive from actual file bytes

The backend must not trust a user-supplied file hash without verifying it against the uploaded bytes.

### INV-EVD-004 — Mutable references are not sufficient evidence identity

A branch name, ordinary mutable URL, filename, or database ID alone is not a cryptographic commitment.

Where integrity matters, ESCT records immutable identifiers and/or content hashes.

### INV-EVD-005 — Private evidence remains private by default

Evidence storage must not become publicly accessible merely because its commitment is on-chain.

The hash may be public while the underlying file remains access-controlled.

---

## 7. Projection and Indexer Invariants

### INV-IDX-001 — Blockchain remains authoritative

An indexed PostgreSQL status is a projection.

If it disagrees with the chain, the chain wins.

### INV-IDX-002 — Event processing is idempotent

The same blockchain event may be received or replayed multiple times.

Processing it repeatedly must not create duplicate application effects.

### INV-IDX-003 — Chain identity is explicit

Indexed protocol data must be scoped by at least:

- chain ID;
- contract address.

An agreement ID alone is not globally unique.

### INV-IDX-004 — Event identity is explicit

The backend must be capable of uniquely identifying processed events using blockchain transaction/log identity.

A suitable identity includes:

- chain ID;
- transaction hash;
- log index.

### INV-IDX-005 — Projections are rebuildable

ESCT must be able to reconstruct blockchain-derived database state from authoritative chain history and known deployment metadata.

---

## 8. Retry and Failure Invariants

### INV-FAIL-001 — Retrying cannot create duplicate settlement

A network timeout after transaction submission must not cause the application to assume failure and create a second economic action without checking transaction/chain state.

### INV-FAIL-002 — Partial backend failure cannot forge chain success

Example:

file upload succeeds;
database write fails.

The application must not report that an on-chain milestone submission succeeded unless the corresponding blockchain transaction actually succeeded.

### INV-FAIL-003 — Missing an event does not change protocol truth

If the indexer is offline while a transaction confirms, protocol state remains correct.

The backend must recover by replay/reconciliation.

### INV-FAIL-004 — Dependency outage reduces availability, not financial correctness

RPC, PostgreSQL, object storage, worker, email, GitHub, or notification failures must not independently authorize an invalid financial transition.

---

## 9. Administrative Invariants

### INV-ADM-001 — Ownership renunciation must not strand required protocol administration

AgreementEscrow V1 intentionally disables ownership renunciation.

### INV-ADM-002 — Arbitrator transfer is explicit and two-step

Changing arbitration authority requires proposal and acceptance.

### INV-ADM-003 — Pause does not become a fund-trapping mechanism

Pause may prevent new protocol activity according to contract rules.

It must not block required exits/settlement paths for already funded escrow where AgreementEscrow V1 intentionally allows them.

---

## 10. Engineering Enforcement

Every serious ESCT feature must identify:

- which invariants it depends on;
- which invariants it could violate;
- tests protecting those invariants;
- failure behavior;
- recovery behavior.

For money-affecting code, happy-path tests alone are insufficient.

Required categories include:

- happy path;
- unauthorized caller;
- invalid state;
- duplicate/replay;
- dependency failure;
- partial failure;
- recovery/reconciliation.

These invariants are normative for ESCT Production Foundation V1.
