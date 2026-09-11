import {
  randomBytes,
} from "node:crypto";

import type {
  AgreementPartyAccessCredential,
  AgreementPartyRole,
  AgreementVersionReference,
  CanonicalAgreementTerms,
} from "@pai/agreement-contract";

export interface SafePartySessionReference {
  readonly partyId:
    string;

  readonly role:
    AgreementPartyRole;

  readonly invitationHandle:
    string;
}

export interface CanonicalAgreementTelegramSession {
  readonly reference:
    AgreementVersionReference;

  readonly parties:
    readonly SafePartySessionReference[];
}

export interface AgreementFlowSessionStore {
  setPendingReview(
    userId: number,
    terms: CanonicalAgreementTerms,
  ): void;

  getPendingReview(
    userId: number,
  ): CanonicalAgreementTerms | undefined;

  clearPendingReview(
    userId: number,
  ): void;

  setCanonicalAgreement(
    userId: number,
    session: CanonicalAgreementTelegramSession,
  ): void;

  getCanonicalAgreement(
    userId: number,
  ): CanonicalAgreementTelegramSession | undefined;
}

export interface StoredPartyCredential {
  readonly agreementId:
    string;

  readonly partyId:
    string;

  readonly role:
    AgreementPartyRole;

  readonly accessToken:
    string;
}

export interface PartyCredentialVault {
  store(
    agreementId: string,
    credential: AgreementPartyAccessCredential,
  ): SafePartySessionReference;

  resolve(
    invitationHandle: string,
  ): StoredPartyCredential | undefined;
}

export interface CreatePartyCredentialVaultOptions {
  readonly generateHandle?:
    () => string;
}

function defaultInvitationHandle():
  string {
  return randomBytes(
    24,
  ).toString(
    "base64url",
  );
}

export function createAgreementFlowSessionStore():
  AgreementFlowSessionStore {
  const pendingReviews =
    new Map<
      number,
      CanonicalAgreementTerms
    >();

  const canonicalAgreements =
    new Map<
      number,
      CanonicalAgreementTelegramSession
    >();

  return {
    setPendingReview(
      userId,
      terms,
    ): void {
      pendingReviews.set(
        userId,
        terms,
      );
    },

    getPendingReview(
      userId,
    ) {
      return pendingReviews.get(
        userId,
      );
    },

    clearPendingReview(
      userId,
    ): void {
      pendingReviews.delete(
        userId,
      );
    },

    setCanonicalAgreement(
      userId,
      session,
    ): void {
      canonicalAgreements.set(
        userId,
        session,
      );
    },

    getCanonicalAgreement(
      userId,
    ) {
      return canonicalAgreements.get(
        userId,
      );
    },
  };
}

export function createPartyCredentialVault(
  options:
    CreatePartyCredentialVaultOptions = {},
): PartyCredentialVault {
  const generateHandle =
    options.generateHandle ??
    defaultInvitationHandle;

  const credentials =
    new Map<
      string,
      StoredPartyCredential
    >();

  return {
    store(
      agreementId,
      credential,
    ): SafePartySessionReference {
      let invitationHandle =
        generateHandle();

      if (
        !invitationHandle.trim()
      ) {
        throw new Error(
          "Invitation handle must not be empty.",
        );
      }

      while (
        credentials.has(
          invitationHandle,
        )
      ) {
        invitationHandle =
          generateHandle();

        if (
          !invitationHandle.trim()
        ) {
          throw new Error(
            "Invitation handle must not be empty.",
          );
        }
      }

      credentials.set(
        invitationHandle,
        {
          agreementId,

          partyId:
            credential.partyId,

          role:
            credential.role,

          accessToken:
            credential.accessToken,
        },
      );

      return {
        partyId:
          credential.partyId,

        role:
          credential.role,

        invitationHandle,
      };
    },

    resolve(
      invitationHandle,
    ) {
      return credentials.get(
        invitationHandle,
      );
    },
  };
}
