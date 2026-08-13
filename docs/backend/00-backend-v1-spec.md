# ESCT Backend V1 Specification

Status: Backend V1 Specification
Branch: feature/backend-v1-spec
Foundation: v0.3.0-production-foundation-v1

## 1. Objective

Backend V1 exists to support one complete ESCT vertical flow:

Create Agreement
-> Accept
-> Fund
-> Deliver Work
-> Build Verifiable Evidence
-> Anchor Evidence On-Chain
-> Review
-> Approve / Dispute
-> Settle

Backend V1 is not the complete future ESCT platform.

The objective is a technically serious backend that can support:

- ETHOnline;
- the ESCT web application;
- the ESCT mobile application;
- future production hardening.

---

## 2. Non-Goals

Backend V1 will NOT include:

- AI agreement generation;
- reputation system;
- chat/messaging;
- DAO features;
- multi-chain abstraction;
- organization/team management;
- advanced analytics;
- full notification platform;
- social features;
- custodial wallets;
- server-controlled user funds;
- microservices;
- Kubernetes;
- complex event-bus infrastructure.

These belong to later versions.

---

# 3. Technology Decisions

## Runtime

Node.js 22 LTS

Language:

TypeScript

Module system:

ESM

Backend location:

backend/

The backend is an independent package.

It must not modify or replace:

- root Hardhat workspace;
- frontend/ web application;
- future mobile/ application.

---

## HTTP Framework

Fastify 5

Reason:

- small architecture;
- strong request lifecycle;
- schema validation;
- structured logging;
- TypeScript support;
- simple integration testing;
- appropriate for a focused API.

We will not use NestJS for Backend V1.

The additional abstraction is not required for the current scope.

---

## Request Validation

TypeBox + official Fastify Type Provider.

Every external API input must have an explicit schema.

Do not trust:

- request body;
- route parameters;
- query parameters;
- headers;
- wallet addresses;
- URLs;
- filenames;
- MIME types.

---

## Database

PostgreSQL 17

PostgreSQL is authoritative only for ESCT-native off-chain data.

Blockchain-derived financial/protocol state is a projection.

---

## ORM / Migration System

Prisma ORM 7

Required packages:

- prisma
- @prisma/client
- @prisma/adapter-pg
- pg

All schema changes use Prisma migrations.

No undocumented manual production schema edits.

---

## Ethereum Library

ethers 6

Reasons:

- ESCT already uses ethers 6;
- contract interfaces already exist;
- supports contract reads;
- event decoding;
- hashing;
- transaction receipts;
- wallet signature utilities.

Backend V1 will not introduce viem unless a concrete requirement appears.

---

# 4. Wallet Authentication

Authentication standard:

EIP-4361
Sign-In with Ethereum

Flow:

1. User connects wallet.
2. Frontend requests nonce.
3. Backend creates single-use nonce.
4. Backend returns SIWE parameters.
5. Wallet signs SIWE message.
6. Frontend sends message + signature.
7. Backend verifies:
   - signature;
   - address;
   - nonce;
   - domain;
   - URI;
   - expiration;
   - chain ID.
8. Nonce becomes consumed.
9. Backend creates session.
10. Browser/mobile receives opaque session token.

User private keys never enter ESCT infrastructure.

---

# 5. Session Model

Backend V1 uses server-side sessions.

Not stateless JWT authentication.

Cookie name:

esct_session

Web cookie configuration in production:

- HttpOnly = true
- Secure = true
- SameSite = Lax
- Path = /
- session token contains no user information

Cookie contains:

random opaque token

Database stores:

SHA-256 hash of token

Session expiration:

7 days

Sessions can be revoked server-side.

Local development may disable Secure only when running on localhost.

---

# 6. Authentication Nonces

Nonce requirements:

- cryptographically random;
- single-use;
- wallet-associated;
- short lived;
- consumed after successful authentication.

Nonce TTL:

5 minutes

A consumed nonce cannot be reused.

An expired nonce cannot be used.

---

# 7. Core Backend Modules

backend/src/

config/
auth/
users/
agreements/
milestones/
deliveries/
storage/
blockchain/
indexer/
audit/
db/
http/
lib/

No module directly reaches into another module's database internals.

Shared infrastructure goes through explicit services.

---

# 8. Initial Folder Structure

backend/
├── package.json
├── package-lock.json
├── tsconfig.json
├── .env.example
├── prisma.config.ts
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── src/
│   ├── app.ts
│   ├── server.ts
│   │
│   ├── config/
│   │   └── env.ts
│   │
│   ├── db/
│   │   └── prisma.ts
│   │
│   ├── auth/
│   ├── users/
│   ├── agreements/
│   ├── milestones/
│   ├── deliveries/
│   ├── storage/
│   ├── blockchain/
│   ├── indexer/
│   ├── audit/
│   ├── http/
│   └── lib/
│
└── test/

---

# 9. Environment Configuration

Backend must fail startup when required configuration is invalid.

Initial environment variables:

NODE_ENV

HOST
PORT

DATABASE_URL

WEB_ORIGIN

SESSION_COOKIE_NAME
SESSION_TTL_SECONDS

SIWE_DOMAIN
SIWE_URI

CHAIN_ID
RPC_URL

AGREEMENT_ESCROW_ADDRESS
AGREEMENT_ESCROW_DEPLOYMENT_BLOCK

S3_ENDPOINT
S3_REGION
S3_BUCKET
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
S3_FORCE_PATH_STYLE

INDEXER_CONFIRMATIONS
INDEXER_POLL_INTERVAL_MS

No production secret belongs in Git.

.env is ignored.

.env.example contains placeholders.

---

# 10. Chain Identity

An Agreement is never identified only by agreementId.

Canonical application identity is:

chainId
+
contractAddress
+
agreementId

A milestone identity is:

chainId
+
contractAddress
+
agreementId
+
milestoneId

Addresses are normalized before persistence.

---

# 11. Database V1 Models

## User

Fields:

id
createdAt
updatedAt

User exists separately from wallet so future ESCT accounts may support multiple wallets.

---

## Wallet

Fields:

id
userId
address
createdAt

Normalized address must be unique.

Wallet ownership is established through SIWE.

---

## AuthNonce

Fields:

id
walletAddress
nonce
expiresAt
consumedAt
createdAt

---

## Session

Fields:

id
userId
tokenHash
expiresAt
revokedAt
createdAt
lastUsedAt

tokenHash is unique.

Raw session token is never persisted.

---

## AgreementProjection

Fields:

id
chainId
contractAddress
agreementId

clientAddress
contractorAddress
tokenAddress

totalAmount
remainingEscrow
status

metadataURI

createdBlock
updatedBlock

createdAt
updatedAt

Unique:

chainId
contractAddress
agreementId

This record is NOT authoritative for financial state.

---

## MilestoneProjection

Fields:

id
agreementProjectionId

milestoneId
amount
status

metadataURI
evidenceURI
evidenceHash

updatedBlock

createdAt
updatedAt

Unique:

agreementProjectionId
milestoneId

---

## Delivery

Fields:

id

chainId
contractAddress
agreementId
milestoneId

contractorAddress

status

deliveryNote
githubUrl
demoUrl

manifestVersion
manifestCanonical
manifestHash
evidenceURI

anchorTxHash
anchoredAt

createdAt
updatedAt

Backend V1 delivery states:

DRAFT
PREPARING
READY_TO_SUBMIT
TRANSACTION_PENDING
ANCHORED
FAILED

Only chain verification can produce ANCHORED.

---

## DeliveryFile

Fields:

id
deliveryId

storageKey
originalFilename
contentType
sizeBytes

sha256

uploadStatus

createdAt
verifiedAt

storageKey is generated by ESCT.

Original filename is never used as the object-storage key.

---

## ChainEvent

Fields:

id

chainId
contractAddress

transactionHash
logIndex

blockNumber
blockHash

eventName
payload

processedAt

Unique identity:

chainId
contractAddress
transactionHash
logIndex

Duplicate event processing must be harmless.

---

## IndexerCursor

Fields:

id
chainId
contractAddress
lastProcessedBlock
updatedAt

Unique:

chainId
contractAddress

---

## AuditLog

Fields:

id

userId
walletAddress

action
resourceType
resourceId

metadata

createdAt

Audit records describe application actions.

They do not replace blockchain history.

---

# 12. Private Object Storage

Storage interface:

Amazon S3-compatible API

Production provider is intentionally not selected in Backend V1 Spec.

The application must remain provider-portable.

Development storage:

MinIO through Docker.

Production may later use:

- AWS S3;
- another reviewed S3-compatible provider.

Bucket is private.

Public ACL is forbidden by default.

---

# 13. Upload Architecture

Large file bytes should not pass through the main Fastify API process.

Upload flow:

Client
-> Backend authorization
-> presigned PUT URL
-> Object Storage
-> Backend completion call
-> integrity verification
-> DeliveryFile READY

Backend generates storage key.

Example:

deliveries/
  <deliveryId>/
    <fileId>

Never:

deliveries/
  ../../userFilename.exe

---

# 14. Download Architecture

Private evidence download:

Client
-> authenticated ESCT API
-> authorization check
-> short-lived presigned GET URL
-> object storage

Only authorized users may receive signed download URLs.

Initial authorized evidence viewers:

- agreement client;
- agreement contractor.

Arbitrator evidence access will be added when dispute evidence UX is implemented.

---

# 15. File Limits

Backend V1 initial limits:

Maximum files per milestone delivery:

10

Maximum individual file size:

100 MB

Maximum total delivery size:

500 MB

These values are configuration, not protocol constants.

Requests exceeding limits fail before expensive processing where possible.

---

# 16. File Integrity

Every completed upload receives:

SHA-256(file bytes)

Do not trust:

- browser-computed hash;
- filename;
- MIME declaration.

The backend verifies stored object integrity.

The SHA-256 value becomes part of the delivery manifest.

---

# 17. Delivery Manifest V1

Manifest version:

esct.delivery.v1

Conceptual structure:

{
  "version": "esct.delivery.v1",
  "chainId": "31337",
  "contractAddress": "0x...",
  "agreementId": "1",
  "milestoneId": "2",
  "contractor": "0x...",
  "files": [
    {
      "id": "...",
      "name": "frontend.zip",
      "size": "123456",
      "sha256": "..."
    }
  ],
  "github": {
    "url": "...",
    "commit": "..."
  },
  "demoUrl": "...",
  "deliveryNote": "...",
  "createdAt": "..."
}

Blockchain-sized integers are represented as JSON strings.

File ordering is deterministic.

---

# 18. Manifest Canonicalization

Manifest canonicalization standard:

RFC 8785
JSON Canonicalization Scheme

Process:

Manifest object
-> validate schema
-> RFC 8785 canonical JSON
-> UTF-8 bytes
-> keccak256
-> bytes32 manifestHash

The exact canonical byte sequence is stored.

This makes the commitment reproducible.

Do NOT hash:

JSON.stringify(arbitraryObject)

without canonicalization.

---

# 19. Evidence Hash

AgreementEscrow evidenceHash becomes:

keccak256(
  UTF8(
    RFC8785(deliveryManifest)
  )
)

This produces the bytes32 value submitted to:

submitMilestone()

The backend prepares the commitment.

The contractor wallet authorizes the blockchain transaction.

The backend does not sign the user's transaction.

---

# 20. Evidence URI

Backend V1 evidence URI:

esct://delivery/<deliveryId>/manifest/v1

The URI identifies the ESCT application evidence record.

The evidenceURI itself is not proof.

The manifestHash is the cryptographic commitment.

Future public/IPFS evidence may use other URI schemes.

---

# 21. Delivery Workflow

Contractor:

POST create delivery

-> DRAFT

upload files

-> PREPARING

backend verifies files
backend creates manifest

-> READY_TO_SUBMIT

frontend calls AgreementEscrow.submitMilestone()

-> transaction submitted

backend receives transaction hash

-> TRANSACTION_PENDING

chain confirms correct milestone submission event

-> ANCHORED

The database may not directly transition:

READY_TO_SUBMIT
-> ANCHORED

without blockchain verification.

---

# 22. GitHub Evidence V1

Backend V1 accepts:

- repository URL;
- commit URL/SHA;
- pull request URL where applicable.

Preferred immutable evidence identifier:

commit SHA

Branch name alone is not evidence identity.

Backend V1 does not require GitHub OAuth.

Advanced GitHub integration is post-V1.

---

# 23. API V1

Base:

/api/v1

## Health

GET /healthz

GET /readyz

---

## Authentication

POST /api/v1/auth/nonce

POST /api/v1/auth/verify

POST /api/v1/auth/logout

GET /api/v1/me

---

## Agreements

POST /api/v1/agreements/register

GET /api/v1/agreements

GET /api/v1/agreements/:agreementKey

Registration verifies the agreement exists on-chain.

Backend does not invent agreements.

---

## Deliveries

POST
/api/v1/agreements/:agreementKey/milestones/:milestoneId/deliveries

GET
/api/v1/deliveries/:deliveryId

PATCH
/api/v1/deliveries/:deliveryId

POST
/api/v1/deliveries/:deliveryId/prepare

POST
/api/v1/deliveries/:deliveryId/anchor

---

## Files

POST
/api/v1/deliveries/:deliveryId/files/presign

POST
/api/v1/deliveries/:deliveryId/files/:fileId/complete

GET
/api/v1/deliveries/:deliveryId/files/:fileId/download

DELETE
/api/v1/deliveries/:deliveryId/files/:fileId

Deletion is allowed only before manifest commitment.

---

# 24. Authorization Rules

Backend must verify participant identity server-side.

Contractor may:

- create delivery;
- edit draft delivery;
- upload delivery files;
- prepare manifest;
- associate anchor transaction.

Client may:

- read delivery;
- download authorized evidence.

Outsiders receive no private evidence access.

Frontend role state is not trusted.

Where participant identity matters, backend verifies against authoritative chain data or a verified chain projection with reconciliation.

---

# 25. Blockchain Reader

Backend V1 will have one blockchain module responsible for:

- AgreementEscrow reads;
- milestone reads;
- event decoding;
- transaction receipt verification;
- participant verification.

HTTP route handlers do not create ethers providers/contracts directly.

---

# 26. Blockchain Indexer

Backend V1 uses an internal lightweight indexer.

No external indexing service is required for V1.

Algorithm:

1. Read current chain head.
2. Subtract configured confirmations.
3. Read logs from cursor + 1.
4. Decode known AgreementEscrow events.
5. Process events in deterministic order.
6. Persist projection + ChainEvent transactionally.
7. Advance cursor only after successful processing.
8. Repeat.

Polling interval:

5000 ms default.

---

# 27. Confirmation Policy

Local Hardhat:

0 confirmations

Hackathon/testnet:

2 confirmations default

Mainnet confirmation policy:

NOT decided by Backend V1.

It must be reviewed before mainnet deployment.

Configuration:

INDEXER_CONFIRMATIONS

---

# 28. Event Idempotency

Event unique identity:

chainId
+
contractAddress
+
transactionHash
+
logIndex

Processing the same event twice must not produce duplicate state changes.

The indexer assumes at-least-once processing.

Not exactly-once processing.

---

# 29. Indexer Recovery

Indexer stores:

lastProcessedBlock

On restart:

continue from persisted cursor.

If required:

projection can be destroyed and rebuilt from:

AGREEMENT_ESCROW_DEPLOYMENT_BLOCK

Chain-derived data must remain rebuildable.

---

# 30. Transaction Verification

POST /deliveries/:id/anchor receives:

transactionHash

Backend retrieves receipt.

Backend verifies:

- expected chain;
- expected AgreementEscrow address;
- successful receipt;
- expected submitMilestone event;
- correct agreementId;
- correct milestoneId;
- correct evidenceHash;
- correct contractor context.

Only then may Delivery become ANCHORED.

---

# 31. API Idempotency

Important mutating endpoints must tolerate retry.

Examples:

create delivery;
complete upload;
prepare manifest;
anchor transaction.

Where appropriate use:

Idempotency-Key header

plus database constraints.

Duplicate requests must not create duplicate delivery records or duplicate side effects.

---

# 32. Error Format

API errors use a stable structure.

Example:

{
  "error": {
    "code": "DELIVERY_NOT_FOUND",
    "message": "Delivery was not found",
    "requestId": "..."
  }
}

Do not return internal stack traces to production clients.

---

# 33. Logging

Fastify structured logging is enabled.

Every request receives requestId.

Logs may include:

- request ID;
- operation;
- wallet;
- chain ID;
- agreement ID;
- milestone ID;
- transaction hash.

Logs must not contain:

- private keys;
- seed phrases;
- session tokens;
- database passwords;
- storage secrets;
- complete private files.

---

# 34. Rate Limits

Backend V1 must apply rate limits to:

- authentication nonce;
- authentication verification;
- upload presigning;
- expensive blockchain reads.

Exact thresholds remain environment configuration.

---

# 35. CORS

Backend V1 uses explicit origin allowlisting.

Development:

configured localhost frontend origin.

Production:

only explicitly configured ESCT origins.

Wildcard authenticated production CORS is forbidden.

---

# 36. Testing Strategy

Backend tests use:

Node.js built-in test runner

and:

Fastify inject()

No real TCP server is required for most API integration tests.

Test categories:

unit;
API integration;
database integration;
storage integration;
blockchain integration;
failure tests.

---

# 37. Required Backend V1 Tests

Authentication:

- valid SIWE;
- invalid signature;
- wrong nonce;
- expired nonce;
- replayed nonce;
- expired session;
- revoked session.

Authorization:

- contractor permitted;
- client permitted;
- outsider denied;
- wrong agreement denied.

Delivery:

- draft creation;
- duplicate request;
- invalid milestone;
- upload success;
- upload failure;
- hash mismatch;
- oversized file;
- manifest deterministic;
- manifest tampering detected.

Blockchain:

- expected event;
- wrong transaction;
- reverted transaction;
- wrong agreement;
- wrong milestone;
- wrong evidence hash;
- duplicate event;
- missed event recovery.

Partial failure:

- storage succeeds / DB fails;
- DB succeeds / storage fails;
- chain succeeds / indexer offline;
- duplicate completion call.

---

# 38. Development Infrastructure

Backend V1 local development uses Docker for:

PostgreSQL
MinIO

Hardhat node remains the existing local blockchain environment.

Architecture:

Hardhat Node :8545

PostgreSQL :5432

MinIO API :9000

ESCT Backend :3001

Vite Frontend :5173

Ports remain configurable.

---

# 39. CI Minimum

Backend V1 CI must eventually execute:

npm ci

typecheck

tests

build

Prisma schema validation

Existing root contract tests and frontend build remain separate checks.

---

# 40. Definition of Backend V1 Complete

Backend V1 is complete when this works end-to-end:

1. Contractor connects wallet.
2. Contractor signs into ESCT.
3. Backend verifies SIWE.
4. Existing funded Agreement is loaded.
5. Contractor creates milestone delivery.
6. Contractor uploads file.
7. Backend verifies file bytes.
8. Backend computes SHA-256.
9. Backend creates canonical Delivery Manifest V1.
10. Backend computes manifest keccak256.
11. Frontend receives evidenceURI + evidenceHash.
12. Contractor wallet calls submitMilestone().
13. Transaction confirms.
14. Backend verifies/indexes transaction.
15. Delivery becomes ANCHORED.
16. Client signs into ESCT.
17. Client securely downloads evidence.
18. Client can verify manifest commitment.
19. Client uses existing contract flow to:
    - approve;
    OR
    - dispute.
20. Existing AgreementEscrow settles funds.

---

# 41. Hackathon Scope Lock

Before ETHOnline / Shipaton completion, Backend V1 work must primarily improve:

Agreement
-> Delivery
-> Evidence
-> Verification
-> Settlement

New ideas that do not improve this path are placed in backlog.

---

# 42. Explicitly Deferred Decisions

These are NOT required before Backend V1 implementation:

- final cloud provider;
- final production S3 provider;
- mainnet confirmation depth;
- production RPC provider;
- multisig governance architecture;
- advanced malware-scanning provider;
- GitHub OAuth;
- Redis;
- external job queue;
- microservices;
- Kubernetes;
- full notification service.

They require concrete need before introduction.

---

# 43. Backend V1 Engineering Rule

AI-generated code must implement this specification.

Implementation code is not allowed to silently redefine:

- data ownership;
- financial authority;
- authentication model;
- evidence commitment;
- storage privacy;
- state transitions;
- event identity;
- indexing semantics.

If implementation requires changing one of those decisions:

STOP

Update/review the specification first.

Then implement.
