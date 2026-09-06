# @pai/agreement-contract

Canonical pre-funding agreement lifecycle contract for PAI.

## Core identity rule

Agreement party identity and wallet identity are separate.

A party is assigned an opaque `partyId` before any wallet is bound.

Wallet binding happens only after the current agreement revision has been
accepted by both required parties.

## Canonical agreement tuple

Every frozen agreement revision is identified by:

- `agreementId`
- `agreementVersion`
- `agreementHash`

The backend is the authority that computes `agreementHash`.

The canonical hash representation is:

`0x` followed by 64 lowercase hexadecimal SHA-256 characters.

Clients treat the hash as opaque.

## Revision rules

Persisting a reviewed agreement creates revision 1.

Every terms change creates a new immutable revision:

`agreementVersion = previousVersion + 1`

and a newly computed `agreementHash`.

Old acceptance records remain historical records, but they are not valid
for the new current revision.

## Acceptance rules

Both required roles must explicitly accept the exact current tuple:

- CLIENT
- CONTRACTOR

An acceptance request with a stale version or stale hash is rejected.

A party acceptance is current only when both its version and hash equal
the agreement's current version and hash.

One current acceptance:

`AWAITING_ACCEPTANCE`

Both current acceptances:

`ACCEPTED`

Exact duplicate acceptance of the same tuple should be idempotent.

## Wallet binding rules

Wallet binding is not agreement acceptance.

Wallet binding does not change the agreement hash.

A party wallet may be bound only after both current agreement acceptances
are complete.

The wallet address comes from an authenticated wallet/SIWE session, not
from an arbitrary wallet address supplied in the request body.

Both current acceptances plus both wallet bindings:

`READY_TO_FUND`

## Terms changes

Before `READY_TO_FUND`, an authorized canonical terms revision may create
a new agreement version.

The new revision moves the agreement back to:

`AWAITING_ACCEPTANCE`

Prior acceptances automatically become non-current because they refer to
the previous version/hash.

The acceptance contract does not permit terms revision after
`READY_TO_FUND`.

## Party access

Before wallet binding, a party acts using an opaque party access token.

Raw party access tokens must not be persisted.

The backend stores only a cryptographic hash of each token.

HTTP implementations should transmit the party token through:

`x-pai-party-token`

rather than inside normal agreement JSON bodies.

## Client responsibilities

Telegram, web, and other clients may own:

- review confirmation UX
- invitation delivery
- acceptance buttons
- displaying the canonical version/hash
- wallet handoff
- notifications

Clients do not own:

- hash generation
- version increments
- acceptance validity
- acceptance invalidation
- wallet-binding validity
- READY_TO_FUND semantics