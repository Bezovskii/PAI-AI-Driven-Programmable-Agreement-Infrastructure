export type AgreementAcceptanceLifecycleStatus =
  | "AWAITING_ACCEPTANCE"
  | "ACCEPTED"
  | "READY_TO_FUND";

export type AgreementPartyRole =
  | "CLIENT"
  | "CONTRACTOR";

/**
 * Server-computed SHA-256 digest of the canonical
 * agreement terms snapshot.
 *
 * Canonical representation:
 * 0x + 64 lowercase hexadecimal characters.
 *
 * Clients MUST treat this as opaque and MUST NOT
 * independently decide which hash is canonical.
 */
export type AgreementHash =
  string;

export interface CanonicalAgreementMilestone {
  readonly amount:
    string | null;

  readonly deliverable:
    string | null;

  readonly acceptanceCriteria:
    string | null;

  readonly deadline:
    string | null;
}

export interface CanonicalAgreementTerms {
  readonly title:
    string | null;

  readonly description:
    string;

  readonly totalValue:
    string | null;

  readonly settlementAsset:
    string | null;

  readonly deadline:
    string | null;

  readonly approvalWindow:
    string | null;

  readonly milestones:
    readonly CanonicalAgreementMilestone[];
}

export interface AgreementVersionReference {
  readonly agreementId:
    string;

  readonly agreementVersion:
    number;

  readonly agreementHash:
    AgreementHash;
}

export interface AgreementPartyLifecycleView {
  readonly partyId:
    string;

  readonly role:
    AgreementPartyRole;

  readonly displayName?:
    string | null;

  /**
   * True only if this party has accepted the exact
   * current agreementVersion + agreementHash.
   */
  readonly acceptedCurrentVersion:
    boolean;

  readonly walletBound:
    boolean;

  readonly walletAddress:
    string | null;
}

export interface AgreementLifecycleView {
  readonly reference:
    AgreementVersionReference;

  readonly status:
    AgreementAcceptanceLifecycleStatus;

  readonly acceptanceComplete:
    boolean;

  readonly walletBindingComplete:
    boolean;

  readonly parties:
    readonly AgreementPartyLifecycleView[];
}

/**
 * Opaque pre-wallet credential.
 *
 * The raw token is returned only when the agreement
 * parties are created. The backend stores only its hash.
 */
export interface AgreementPartyAccessCredential {
  readonly partyId:
    string;

  readonly role:
    AgreementPartyRole;

  readonly accessToken:
    string;
}

export interface PersistReviewedAgreementRequest {
  readonly terms:
    CanonicalAgreementTerms;

  readonly client:
    {
      readonly displayName?:
        string;
    };

  readonly contractor:
    {
      readonly displayName?:
        string;
    };
}

export interface PersistReviewedAgreementResult {
  readonly lifecycle:
    AgreementLifecycleView;

  /**
   * Returned at creation time so the calling client
   * can retain the CLIENT credential and deliver the
   * CONTRACTOR credential through its invitation UX.
   */
  readonly partyAccess:
    readonly AgreementPartyAccessCredential[];
}

export interface AcceptAgreementVersionRequest
  extends AgreementVersionReference {
  readonly partyId:
    string;
}

export interface AgreementAcceptanceView {
  readonly partyId:
    string;

  readonly role:
    AgreementPartyRole;

  readonly agreementVersion:
    number;

  readonly agreementHash:
    AgreementHash;

  readonly acceptedAt:
    string;

  readonly current:
    boolean;
}

export interface AcceptAgreementVersionResult {
  readonly acceptance:
    AgreementAcceptanceView;

  readonly lifecycle:
    AgreementLifecycleView;
}

export interface ReviseCanonicalAgreementRequest {
  /**
   * Optimistic concurrency guard.
   * Revision succeeds only when this is still the
   * agreement's current canonical tuple.
   */
  readonly expected:
    AgreementVersionReference;

  readonly terms:
    CanonicalAgreementTerms;
}

export interface ReviseCanonicalAgreementResult {
  readonly previous:
    AgreementVersionReference;

  readonly current:
    AgreementVersionReference;

  readonly lifecycle:
    AgreementLifecycleView;
}

/**
 * walletAddress is intentionally absent.
 *
 * The wallet address MUST come from the authenticated
 * wallet/SIWE session used by the binding endpoint.
 */
export interface BindAgreementPartyWalletRequest {
  readonly agreementId:
    string;

  readonly partyId:
    string;
}

export interface BindAgreementPartyWalletResult {
  readonly partyId:
    string;

  readonly role:
    AgreementPartyRole;

  readonly walletAddress:
    string;

  readonly lifecycle:
    AgreementLifecycleView;
}

export interface GetAgreementLifecycleRequest {
  readonly agreementId:
    string;
}

export interface GetCanonicalAgreementReviewRequest {
  readonly agreementId:
    string;
}

export interface CanonicalAgreementReviewPartyView {
  readonly partyId:
    string;

  readonly role:
    AgreementPartyRole;

  readonly displayName?:
    string | null;

  /**
   * True only when this party has accepted the exact
   * current agreementVersion + agreementHash.
   */
  readonly acceptedCurrentVersion:
    boolean;
}

/**
 * Read-only pre-wallet review view for the exact current
 * canonical agreement revision.
 *
 * Authentication is transport-level via x-pai-party-token.
 * The party credential is intentionally absent from this
 * request/response contract.
 */
export interface CanonicalAgreementReviewView {
  readonly reference:
    AgreementVersionReference;

  readonly terms:
    CanonicalAgreementTerms;

  readonly party:
    CanonicalAgreementReviewPartyView;

  readonly status:
    AgreementAcceptanceLifecycleStatus;

  readonly acceptanceComplete:
    boolean;
}
export interface CreateWalletBindingHandoffResult {
  /**
   * High-entropy opaque one-time secret.
   *
   * Core returns this only when the handoff is created.
   * Persisted storage contains only its SHA-256 hash.
   */
  readonly handoffId:
    string;

  readonly expiresAt:
    string;
}

/**
 * walletAddress is intentionally absent.
 *
 * Wallet identity MUST come exclusively from the
 * authenticated browser SIWE/session actor.
 */
export interface RedeemWalletBindingHandoffRequest {
  readonly handoffId:
    string;
}