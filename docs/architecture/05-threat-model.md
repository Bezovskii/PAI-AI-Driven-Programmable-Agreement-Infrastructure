# ESCT Threat Model

Status: Production Foundation V1

## 1. Purpose

ESCT handles agreements, evidence, identities, and potentially real escrowed assets.

Security must assume that:

- users may be malicious;
- external input is hostile;
- infrastructure may be compromised;
- frontend code may be manipulated;
- API requests may be forged;
- blockchain transactions may be replayed or misunderstood;
- uploaded files may be malicious.

This document defines the initial ESCT security threat model.

---

## 2. Security Objectives

ESCT must protect:

### Financial integrity

An attacker must not be able to:

- steal escrow through backend manipulation;
- settle a milestone twice;
- release funds without protocol authorization;
- forge a dispute resolution;
- create fake funded state.

### Evidence integrity

An attacker must not be able to silently replace committed delivery evidence.

### Evidence confidentiality

Private deliverables must not become public without authorization.

### Identity integrity

A user must not be able to impersonate another wallet merely by claiming its address.

### Application integrity

Backend/database manipulation must not become equivalent to blockchain authorization.

### Availability

Reasonable protections should exist against abuse that makes the service unusable.

---

## 3. Trust Assumptions

Trusted only within defined boundaries:

- deployed ESCT smart-contract bytecode;
- user wallet cryptography;
- authorized administrative/arbitrator wallet control;
- correctly configured cryptographic primitives.

Not inherently trusted:

- browser;
- mobile client;
- frontend JavaScript;
- API requests;
- PostgreSQL records;
- object-storage metadata;
- blockchain indexer;
- RPC provider;
- GitHub URLs;
- uploaded files;
- user-supplied MIME type;
- user-supplied file hashes;
- notification content.

---

## 4. Threat Actors

Potential attackers include:

- malicious client;
- malicious contractor;
- malicious outsider;
- compromised user wallet;
- compromised arbitrator wallet;
- compromised administrator wallet;
- malicious authenticated user;
- anonymous internet attacker;
- compromised backend server;
- compromised database credentials;
- malicious uploaded file;
- compromised external integration.

---

## 5. Wallet Impersonation

Threat:

Attacker submits:

walletAddress = victim

to the backend and claims victim identity.

Control:

Wallet identity must be cryptographically proven.

Authentication should use:

- server-generated nonce;
- wallet signature;
- signature verification;
- session issuance;
- nonce expiration;
- nonce single-use behavior.

Exact authentication protocol will be finalized in Backend V1 specification.

A SIWE-compatible approach is a leading candidate but is not yet frozen by this Foundation document.

---

## 6. Signature Replay

Threat:

A valid previously signed authentication message is replayed.

Controls:

- unique nonce;
- expiration;
- domain binding;
- chain/network context where appropriate;
- one-time nonce consumption;
- session lifecycle controls.

---

## 7. Unauthorized Agreement Access

Threat:

Authenticated user changes an agreement ID in an API URL and accesses another user's private agreement data.

Example:

GET /agreements/104

changed to:

GET /agreements/105

Control:

Every protected resource request must verify authorization server-side.

Never trust that the frontend only shows permitted IDs.

This includes protection against IDOR/BOLA-style access-control failures.

---

## 8. Unauthorized Evidence Access

Threat:

Attacker discovers storage object URL and downloads private deliverable.

Controls:

- private bucket/container by default;
- no public object URLs by default;
- authorization before access;
- short-lived signed URLs where appropriate;
- access scoped to permitted participants;
- arbitrator access granted only where business rules permit;
- access logging where practical.

---

## 9. Malicious File Upload

Threats include:

- executable malware;
- oversized files;
- decompression bombs;
- forged MIME type;
- malicious filenames;
- path traversal attempts;
- dangerous HTML/SVG content;
- storage exhaustion.

Controls:

- file-size limits;
- request-size limits;
- normalized/generated storage keys;
- never trust original filename as storage path;
- MIME detection where appropriate;
- allow/deny policy by feature;
- quarantine/scanning strategy before production;
- safe content-disposition when downloading;
- upload rate limiting.

Exact scanning provider is a later implementation decision.

---

## 10. Evidence Replacement

Threat:

Contractor uploads legitimate evidence, anchors its hash, then replaces storage content with different bytes.

Controls:

- cryptographic hash from actual bytes;
- immutable/versioned object handling where practical;
- final manifest includes file hashes;
- hash verification when evidence is reviewed;
- committed manifest is immutable after anchoring.

Changed bytes must cause verification failure.

---

## 11. Manifest Ambiguity

Threat:

Two different logical manifests serialize into ambiguous representations or produce inconsistent hashes between clients/server.

Control:

Delivery V1 must define:

- manifest schema version;
- canonical field ordering/encoding;
- normalization rules;
- hash algorithm;
- byte representation.

Do not hash arbitrary pretty-printed JSON and assume it is deterministic.

This decision must be frozen before Delivery V1 implementation.

---

## 12. Database Manipulation

Threat:

Attacker gains ability to modify PostgreSQL.

Potential impact:

- profile corruption;
- false application metadata;
- notification manipulation;
- evidence metadata corruption;
- projection corruption.

Financial control:

Database modification alone must not authorize valid on-chain settlement.

Detection/recovery:

- audit logs;
- backups;
- chain reconciliation;
- integrity verification;
- least-privilege database credentials.

Database compromise remains a major security incident despite blockchain financial boundaries.

---

## 13. Indexer Manipulation

Threat:

Indexer incorrectly marks milestone Released.

Control:

Indexer projection is not authoritative.

Financial actions must not trust indexed status when contract validation is required.

Projection can be reconciled with chain state.

---

## 14. RPC Manipulation / Stale RPC

Threat:

RPC returns stale or incorrect information.

Controls:

- treat RPC as access path, not independent authority;
- use transaction receipts and chain confirmations appropriately;
- production may use provider redundancy for critical operations;
- reconcile inconsistent states.

---

## 15. Duplicate Requests

Threat:

Attacker or buggy client repeatedly sends the same backend mutation.

Controls:

For suitable operations:

- idempotency key;
- database uniqueness constraint;
- deterministic operation identity;
- current-state validation.

Blockchain contract state must independently reject invalid duplicate protocol transitions.

---

## 16. Smart-Contract Reentrancy

Threat:

Malicious ETH receiver or ERC20 token re-enters settlement/funding flow.

Current AgreementEscrow and MultiPayment security tests already cover relevant adversarial scenarios.

Required principles remain:

- reentrancy protection;
- checks/effects/interactions discipline;
- exact accounting;
- revert atomicity.

Future contract changes require regression testing.

---

## 17. Malicious ERC20

Threats:

- fee-on-transfer;
- callback behavior;
- abnormal transfer behavior;
- token disabled after escrow deposit.

Current protocol security model includes:

- token allowlisting;
- exact balance-delta verification;
- continued settlement of already-funded escrow where intended.

Future token support must preserve these properties.

---

## 18. Privilege Escalation

Threat:

Normal user gains:

- admin privileges;
- arbitrator privileges;
- another user's private evidence access.

Controls:

- role checks server-side;
- role checks on-chain for protocol actions;
- least privilege;
- no role authority based only on frontend state;
- privileged actions audited.

---

## 19. Compromised Arbitrator Key

Threat:

Attacker controlling arbitrator wallet can resolve legitimate disputes incorrectly.

This cannot be solved purely by backend authorization if the smart contract intentionally grants that wallet arbitration authority.

Mitigations may eventually include:

- hardware wallet;
- multisig arbitration;
- arbitration committee;
- role rotation;
- monitoring;
- transaction alerts.

AgreementEscrow V1 currently uses a designated arbitrator.

Production governance design requires separate review before high-value deployment.

---

## 20. Compromised Owner Key

Threat:

Owner/admin key abused for protocol administrative actions.

Controls before serious production use may include:

- multisig;
- hardware-backed signing;
- least privilege;
- operational separation;
- monitoring;
- explicit emergency procedures.

Exact governance model is not yet frozen.

---

## 21. Secret Leakage

Secrets include:

- database credentials;
- storage credentials;
- RPC API keys;
- session-signing secrets;
- integration credentials.

Controls:

- secrets never committed to Git;
- `.env.example` contains placeholders only;
- environment-specific secrets;
- least privilege;
- rotation procedure;
- production secret manager later.

ESCT infrastructure never stores user seed phrases/private keys.

---

## 22. Injection Attacks

Threats include:

- SQL injection;
- command injection;
- header injection;
- malicious metadata;
- XSS.

Controls:

- parameterized database access;
- schema validation;
- no shell execution from user input;
- output encoding;
- frontend escaping;
- secure headers;
- strict handling of rich content.

---

## 23. API Abuse

Threat:

Attackers flood endpoints or expensive operations.

Controls:

- rate limiting;
- body-size limits;
- upload limits;
- timeouts;
- authentication where required;
- bounded expensive operations;
- monitoring.

DoS prevention is layered; no single control guarantees availability.

---

## 24. Cross-Origin Abuse

Production API must use an explicit CORS policy.

Do not deploy:

Access-Control-Allow-Origin: *

for authenticated/private production APIs without deliberate justification.

Session design must account for CSRF depending on the chosen authentication/session mechanism.

Exact session architecture remains a Backend V1 decision.

---

## 25. Logging Sensitive Data

Threat:

Logs accidentally contain:

- wallet signatures;
- authentication tokens;
- signed URLs;
- private evidence;
- personal information;
- secret credentials.

Controls:

- structured logging;
- sensitive-field redaction;
- no private keys/seeds ever;
- avoid logging full private evidence;
- limited log retention and access.

---

## 26. Supply-Chain Risk

Threat:

Malicious or compromised npm dependency.

Controls:

- lockfile committed;
- dependency versions controlled;
- minimal dependency surface;
- dependency vulnerability scanning in CI;
- review unusual/new dependencies;
- update process.

A dependency should not be added merely because generated code happens to import it.

---

## 27. Environment Confusion

Threat:

Production frontend points at:

- wrong chain;
- local contract;
- outdated contract;
- staging API.

Controls:

- explicit environment configuration;
- chain ID validation;
- contract-address validation;
- visible environment indicator outside production;
- startup/build validation;
- no silent fallback.

---

## 28. Social Engineering / Wallet Safety

ESCT UI must never ask users for:

- seed phrase;
- raw private key.

Wallet signing prompts should clearly describe the intended operation.

Authentication signatures and financial transactions should be visually distinguishable.

---

## 29. Privacy Boundary

Blockchain commitments are public and permanent.

Therefore ESCT must avoid placing:

- confidential agreement text;
- personal information;
- private delivery files;
- secrets

directly on-chain unless intentionally public.

On-chain hashes may remain permanently even after corresponding off-chain data is deleted.

Product/legal/privacy UX must eventually explain this.

---

## 30. Security Review Gate

Before real-value production deployment, ESCT requires:

- smart-contract security review/audit appropriate to risk;
- backend security review;
- infrastructure review;
- authentication review;
- authorization testing;
- file-upload security testing;
- secret-management review;
- recovery procedures;
- monitoring;
- legal/compliance review appropriate to operating jurisdictions.

Passing local tests alone is not sufficient for real-value production readiness.

---

## 31. Security Test Categories

Critical features should include tests for:

- unauthenticated request;
- wrong authenticated user;
- role escalation;
- IDOR/BOLA access;
- replay;
- duplicate request;
- malformed input;
- oversized input;
- invalid signature;
- expired session;
- wrong wallet;
- wrong chain;
- tampered file;
- tampered manifest;
- duplicate blockchain event;
- stale blockchain projection;
- dependency failure.

---

## 32. Threat-Model Rule

Every new subsystem must answer:

1. What assets does it protect?
2. Who can attack it?
3. What input does it trust?
4. What happens if that trust is wrong?
5. What privileges does it have?
6. Can compromise move funds?
7. Can compromise expose private evidence?
8. How is compromise detected?
9. How is access revoked?
10. How is the system recovered?

This document is normative for ESCT Production Foundation V1.
