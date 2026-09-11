import type {
  AgreementLifecycleView,
  AgreementPartyRole,
} from "@pai/agreement-contract";

import type {
  ClaimedPartySession,
} from "./partyInvitationSession.js";

import type {
  AgreementRuntime,
} from "../runtime/agreementRuntime.js";

import {
  PaiApiError,
  type PaiClient,
} from "../services/paiClient.js";

type WalletHandoffPaiClient =
  Pick<
    PaiClient,
    | "createWalletBindingHandoff"
    | "getAgreementLifecycle"
  >;

type WalletHandoffRuntime =
  Pick<
    AgreementRuntime,
    "credentialVault"
  >;

export type PartyWalletBindingHandoffResult =
  | {
      readonly status:
        "ready";

      readonly url:
        string;

      readonly expiresAt:
        string;
    }
  | {
      readonly status:
        "waiting_for_acceptance";
    }
  | {
      readonly status:
        "already_bound";

      readonly lifecycleStatus:
        AgreementLifecycleView["status"];
    }
  | {
      readonly status:
        "invalid_session";
    }
  | {
      readonly status:
        "rejected";
    };

function normalizeFrontendBaseUrl(
  value: string,
): URL {
  const trimmed =
    value.trim();

  if (!trimmed) {
    throw new Error(
      "PAI frontend base URL must not be empty.",
    );
  }

  const parsed =
    new URL(
      trimmed,
    );

  if (
    parsed.protocol !== "http:" &&
    parsed.protocol !== "https:"
  ) {
    throw new Error(
      "PAI frontend base URL must use http:// or https://.",
    );
  }

  return parsed;
}

function buildWalletBindingUrl(
  frontendBaseUrl: string,
  input: {
    readonly agreementId:
      string;

    readonly partyId:
      string;

    readonly handoffId:
      string;
  },
): string {
  const base =
    normalizeFrontendBaseUrl(
      frontendBaseUrl,
    );

  const url =
    new URL(
      "/wallet-binding",
      base,
    );

  url.searchParams.set(
    "agreementId",
    input.agreementId,
  );

  url.searchParams.set(
    "partyId",
    input.partyId,
  );

  url.searchParams.set(
    "handoffId",
    input.handoffId,
  );

  return url.toString();
}

function findLifecycleParty(
  lifecycle:
    AgreementLifecycleView,

  partyId:
    string,
) {
  return lifecycle.parties.find(
    (
      party,
    ) =>
      party.partyId ===
      partyId,
  );
}

function credentialMatchesSession(
  credential: {
    readonly agreementId:
      string;

    readonly partyId:
      string;

    readonly role:
      AgreementPartyRole;
  },

  session:
    ClaimedPartySession,
): boolean {
  return (
    credential.agreementId ===
      session.agreementId &&
    credential.partyId ===
      session.partyId &&
    credential.role ===
      session.role
  );
}

export async function preparePartyWalletBindingHandoff(
  paiClient:
    WalletHandoffPaiClient,

  runtime:
    WalletHandoffRuntime,

  frontendBaseUrl:
    string,

  session:
    ClaimedPartySession,

  knownLifecycle?:
    AgreementLifecycleView,
): Promise<PartyWalletBindingHandoffResult> {
  const lifecycle =
    knownLifecycle ??
    await paiClient
      .getAgreementLifecycle({
        agreementId:
          session.agreementId,
      });

  if (
    !lifecycle
      .acceptanceComplete
  ) {
    return {
      status:
        "waiting_for_acceptance",
    };
  }

  const lifecycleParty =
    findLifecycleParty(
      lifecycle,
      session.partyId,
    );

  if (
    !lifecycleParty ||
    lifecycleParty.role !==
      session.role ||
    !lifecycleParty
      .acceptedCurrentVersion
  ) {
    return {
      status:
        "invalid_session",
    };
  }

  if (
    lifecycleParty
      .walletBound
  ) {
    return {
      status:
        "already_bound",

      lifecycleStatus:
        lifecycle.status,
    };
  }

  const credential =
    runtime
      .credentialVault
      .resolve(
        session
          .invitationHandle,
      );

  if (
    !credential ||
    !credentialMatchesSession(
      credential,
      session,
    )
  ) {
    return {
      status:
        "invalid_session",
    };
  }

  try {
    const handoff =
      await paiClient
        .createWalletBindingHandoff({
          agreementId:
            session.agreementId,

          partyId:
            session.partyId,

          partyAccessToken:
            credential.accessToken,
        });

    return {
      status:
        "ready",

      url:
        buildWalletBindingUrl(
          frontendBaseUrl,
          {
            agreementId:
              session.agreementId,

            partyId:
              session.partyId,

            handoffId:
              handoff.handoffId,
          },
        ),

      expiresAt:
        handoff.expiresAt,
    };
  } catch (
    error:
      unknown
  ) {
    if (
      error instanceof
        PaiApiError
    ) {
      return {
        status:
          "rejected",
      };
    }

    throw error;
  }
}
