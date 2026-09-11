import type {
  CanonicalAgreementTerms,
} from "@pai/agreement-contract";

import type {
  AgreementFlowSessionStore,
  CanonicalAgreementTelegramSession,
  PartyCredentialVault,
} from "./canonicalAgreementSession.js";

import type {
  PaiClient,
} from "../services/paiClient.js";

export interface PersistReviewedAgreementForTelegramOptions {
  readonly userId:
    number;

  readonly terms:
    CanonicalAgreementTerms;

  readonly paiClient:
    PaiClient;

  readonly flowSessions:
    AgreementFlowSessionStore;

  readonly credentialVault:
    PartyCredentialVault;
}

export async function persistReviewedAgreementForTelegram(
  options:
    PersistReviewedAgreementForTelegramOptions,
): Promise<CanonicalAgreementTelegramSession> {
  const result =
    await options
      .paiClient
      .persistReviewedAgreement({
        terms:
          options.terms,

        client:
          {},

        contractor:
          {},
      });

  const agreementId =
    result.lifecycle.reference
      .agreementId;

  const parties =
    result.partyAccess.map(
      (
        credential,
      ) =>
        options
          .credentialVault
          .store(
            agreementId,
            credential,
          ),
    );

  const session: CanonicalAgreementTelegramSession = {
    reference:
      result.lifecycle.reference,

    parties,
  };

  options.flowSessions
    .setCanonicalAgreement(
      options.userId,
      session,
    );

  options.flowSessions
    .clearPendingReview(
      options.userId,
    );

  return session;
}
