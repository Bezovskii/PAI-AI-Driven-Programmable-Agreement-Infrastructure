# ESCT Protocol — Slither Finding Triage

## Analysis scope

Slither was executed against the hardened ESCT `MultiPayment` contract after:

* 67 Hardhat tests passed
* Functional and state-transition testing
* Adversarial reentrancy testing
* Malicious ERC20 testing
* Failed-payout testing
* Liability and solvency testing
* Coverage analysis

Dependencies, mock tokens, and intentionally malicious testing contracts were filtered from the production-code analysis.

## Final production-code findings

The filtered Slither analysis reported three findings:

1. `reentrancy-balance` in `_pullExactToken`
2. `reentrancy-balance` in `_sendExactToken`
3. `low-level-calls` in `_sendETH`

No confirmed `reentrancy-eth` or `reentrancy-no-eth` finding was reported.

---

## Finding 1: `_pullExactToken` reentrancy-balance

### Description

`_pullExactToken` reads the receiver's ERC20 balance, calls the token's `safeTransferFrom`, reads the balance again, and verifies that the exact requested amount arrived.

Slither reports that the token transfer is an external call and that the balance recorded before the call could theoretically become stale during malicious token execution.

### Existing mitigations

* Public token-payment entry points are protected with `ReentrancyGuard`.
* Tokens must be explicitly allowlisted.
* The received balance delta must exactly equal the requested amount.
* A mismatch causes the complete transaction to revert.
* Order creation and liability changes roll back after failure.
* An adversarial ERC20 callback-reentrancy test passes.

### Residual risk

A malicious or upgradeable token controls its own transfer and balance-reporting behavior. ESCT cannot make a deliberately dishonest token trustworthy.

### Decision

Accepted as a mitigated token-trust risk for the testnet MVP.

Only reviewed and explicitly approved tokens should be allowlisted. Upgradeable or unusually behaving tokens require additional review before approval.

---

## Finding 2: `_sendExactToken` reentrancy-balance

### Description

`_sendExactToken` reads the receiver's balance, calls the token's `safeTransfer`, and verifies the exact balance increase afterward.

Slither reports the external token call as a possible reentrancy and stale-balance boundary.

### Existing mitigations

* Settlement entry points are protected with `ReentrancyGuard`.
* Escrow state and liability are updated before external interaction.
* Failed or non-exact transfers revert the complete transaction.
* Existing escrow remains recorded when payout fails.
* Fee-on-transfer payout behavior has an adversarial test.
* ERC20 callback reentrancy has an adversarial test.

### Residual risk

The token contract controls balance reporting and may change behavior after it is allowlisted.

### Decision

Accepted as a mitigated token-trust risk for the testnet MVP.

The exact-transfer validation remains in place because removing it would weaken escrow accounting.

---

## Finding 3: `_sendETH` low-level call

### Description

ESCT uses a low-level `call` to send ETH to payout recipients.

### Existing mitigations

* The returned success value is checked.
* Failure produces a custom error and reverts the complete transaction.
* Payment entry points are protected against reentrancy.
* State and liability changes roll back after payout failure.
* Malicious reentrant-receiver tests pass.
* Rejecting-receiver tests pass.
* An escrow is not silently marked complete after a failed payout.

### Decision

Accepted and intentional.

Using `call` supports modern ETH-transfer behavior. The call is protected through explicit failure checking, state ordering, transaction rollback, and reentrancy protection.

---

## Security conclusion

The Slither results did not identify a confirmed direct fund-loss exploit in the current frozen contract version.

The remaining ERC20 findings represent an explicit trust boundary: ESCT must only approve reviewed token contracts.

This analysis is not an independent audit. The contract remains a security-hardened testnet MVP pending compiler review, deployment verification, and independent Solidity review.
