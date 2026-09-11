import type {
  AcceptAgreementVersionResult,
  CanonicalAgreementReviewView,
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

const ACCEPT_CALLBACK_PREFIX =
  "pai_accept:";

const TELEGRAM_CALLBACK_MAX_BYTES =
  64;

const ACCEPT_ACTION_HANDLE_PATTERN =
  /^[A-Za-z0-9_-]+$/;

type AcceptancePaiClient =
  Pick<
    PaiClient,
    | "acceptAgreementVersion"
    | "getCanonicalAgreementReview"
  >;

type AcceptanceRuntime =
  Pick<
    AgreementRuntime,
    | "credentialVault"
    | "reviewedAcceptanceActions"
  >;

export type PartyAgreementAcceptanceReviewResult =
  | {
      readonly status:
        "ready";

      readonly review:
        CanonicalAgreementReviewView;

      readonly callbackData:
        string;
    }
  | {
      readonly status:
        "already_accepted";

      readonly review:
        CanonicalAgreementReviewView;
    }
  | {
      readonly status:
        "failed";
    };

export type PartyAgreementAcceptanceActionResult =
  | {
      readonly status:
        "accepted";

      readonly result:
        AcceptAgreementVersionResult;
    }
  | {
      readonly status:
        "stale";
    }
  | {
      readonly status:
        "failed";
    };

function isSafeActionHandle(
  actionHandle:
    string,
): boolean {
  return (
    actionHandle.length >
      0 &&
    actionHandle ===
      actionHandle.trim() &&
    ACCEPT_ACTION_HANDLE_PATTERN.test(
      actionHandle,
    )
  );
}

export function createAgreementAcceptanceCallbackData(
  actionHandle:
    string,
): string {
  if (
    !isSafeActionHandle(
      actionHandle,
    )
  ) {
    throw new Error(
      "Acceptance action handle is not valid for Telegram callback data.",
    );
  }

  const callbackData =
    `${ACCEPT_CALLBACK_PREFIX}${actionHandle}`;

  if (
    Buffer.byteLength(
      callbackData,
      "utf8",
    ) >
    TELEGRAM_CALLBACK_MAX_BYTES
  ) {
    throw new Error(
      "Acceptance action handle is too long for Telegram callback data.",
    );
  }

  return callbackData;
}

export function parseAgreementAcceptanceCallbackData(
  callbackData:
    string,
): string | undefined {
  if (
    !callbackData.startsWith(
      ACCEPT_CALLBACK_PREFIX,
    )
  ) {
    return undefined;
  }

  if (
    Buffer.byteLength(
      callbackData,
      "utf8",
    ) >
    TELEGRAM_CALLBACK_MAX_BYTES
  ) {
    return undefined;
  }

  const actionHandle =
    callbackData.slice(
      ACCEPT_CALLBACK_PREFIX.length,
    );

  if (
    !isSafeActionHandle(
      actionHandle,
    )
  ) {
    return undefined;
  }

  return actionHandle;
}

function credentialMatchesSession(
  credential: {
    readonly agreementId:
      string;

    readonly partyId:
      string;

    readonly role:
      string;
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

function reviewMatchesSession(
  review:
    CanonicalAgreementReviewView,

  session:
    ClaimedPartySession,
): boolean {
  return (
    review.reference.agreementId ===
      session.agreementId &&
    review.party.partyId ===
      session.partyId &&
    review.party.role ===
      session.role
  );
}

export async function prepareAgreementAcceptanceReview(
  paiClient:
    AcceptancePaiClient,

  runtime:
    AcceptanceRuntime,

  telegramUserId:
    number,

  session:
    ClaimedPartySession,
): Promise<PartyAgreementAcceptanceReviewResult> {
  const credential =
    runtime
      .credentialVault
      .resolve(
        session.invitationHandle,
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
        "failed",
    };
  }

  try {
    const review =
      await paiClient
        .getCanonicalAgreementReview(
          {
            agreementId:
              session.agreementId,
          },
          credential.accessToken,
        );

    if (
      !reviewMatchesSession(
        review,
        session,
      )
    ) {
      return {
        status:
          "failed",
      };
    }

    if (
      review.party
        .acceptedCurrentVersion
    ) {
      return {
        status:
          "already_accepted",

        review,
      };
    }

    const actionHandle =
      runtime
        .reviewedAcceptanceActions
        .create({
          telegramUserId,

          invitationHandle:
            session.invitationHandle,

          agreementId:
            session.agreementId,

          partyId:
            session.partyId,

          role:
            session.role,

          expectedAgreementVersion:
            review.reference
              .agreementVersion,

          expectedAgreementHash:
            review.reference
              .agreementHash,
        });

    try {
      return {
        status:
          "ready",

        review,

        callbackData:
          createAgreementAcceptanceCallbackData(
            actionHandle,
          ),
      };
    } catch (
      error
    ) {
      runtime
        .reviewedAcceptanceActions
        .delete(
          actionHandle,
        );

      throw error;
    }
  } catch {
    return {
      status:
        "failed",
    };
  }
}

function actionMatchesCredential(
  action: {
    readonly agreementId:
      string;

    readonly partyId:
      string;

    readonly role:
      string;
  },

  credential: {
    readonly agreementId:
      string;

    readonly partyId:
      string;

    readonly role:
      string;
  },
): boolean {
  return (
    action.agreementId ===
      credential.agreementId &&
    action.partyId ===
      credential.partyId &&
    action.role ===
      credential.role
  );
}

function actionMatchesReview(
  action: {
    readonly agreementId:
      string;

    readonly partyId:
      string;

    readonly role:
      string;

    readonly expectedAgreementVersion:
      number;

    readonly expectedAgreementHash:
      string;
  },

  review:
    CanonicalAgreementReviewView,
): boolean {
  return (
    review.reference.agreementId ===
      action.agreementId &&
    review.party.partyId ===
      action.partyId &&
    review.party.role ===
      action.role &&
    review.reference.agreementVersion ===
      action.expectedAgreementVersion &&
    review.reference.agreementHash ===
      action.expectedAgreementHash
  );
}

export async function executeAgreementAcceptanceAction(
  paiClient:
    AcceptancePaiClient,

  runtime:
    AcceptanceRuntime,

  telegramUserId:
    number,

  callbackData:
    string,
): Promise<PartyAgreementAcceptanceActionResult> {
  const actionHandle =
    parseAgreementAcceptanceCallbackData(
      callbackData,
    );

  if (!actionHandle) {
    return {
      status:
        "failed",
    };
  }

  const action =
    runtime
      .reviewedAcceptanceActions
      .resolve(
        actionHandle,
      );

  if (
    !action ||
    action.telegramUserId !==
      telegramUserId
  ) {
    return {
      status:
        "failed",
    };
  }

  const credential =
    runtime
      .credentialVault
      .resolve(
        action.invitationHandle,
      );

  if (
    !credential ||
    !actionMatchesCredential(
      action,
      credential,
    )
  ) {
    runtime
      .reviewedAcceptanceActions
      .delete(
        actionHandle,
      );

    return {
      status:
        "failed",
    };
  }

  try {
    const currentReview =
      await paiClient
        .getCanonicalAgreementReview(
          {
            agreementId:
              action.agreementId,
          },
          credential.accessToken,
        );

    if (
      !actionMatchesReview(
        action,
        currentReview,
      )
    ) {
      runtime
        .reviewedAcceptanceActions
        .delete(
          actionHandle,
        );

      return {
        status:
          "stale",
      };
    }

    const result =
      await paiClient
        .acceptAgreementVersion(
          {
            agreementId:
              action.agreementId,

            agreementVersion:
              action
                .expectedAgreementVersion,

            agreementHash:
              action
                .expectedAgreementHash,

            partyId:
              action.partyId,
          },
          credential.accessToken,
        );

    runtime
      .reviewedAcceptanceActions
      .delete(
        actionHandle,
      );

    return {
      status:
        "accepted",

      result,
    };
  } catch (
    error
  ) {
    if (
      error instanceof
        PaiApiError &&
      error.status ===
        409
    ) {
      runtime
        .reviewedAcceptanceActions
        .delete(
          actionHandle,
        );

      return {
        status:
          "stale",
      };
    }

    return {
      status:
        "failed",
    };
  }
}

function displayValue(
  value:
    string | null,
): string {
  return value ??
    "Not specified";
}

function shortAgreementHash(
  hash:
    string,
): string {
  if (
    hash.length <=
      22
  ) {
    return hash;
  }

  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

export function formatAgreementAcceptanceReview(
  review:
    CanonicalAgreementReviewView,
): string {
  const terms =
    review.terms;

  const lines: string[] = [
    "Review this exact agreement before accepting.",
    "",
    `Agreement: ${review.reference.agreementId}`,
    `Version: ${review.reference.agreementVersion}`,
    `Hash: ${shortAgreementHash(review.reference.agreementHash)}`,
    `Your role: ${review.party.role}`,
    "",
    `Title: ${displayValue(terms.title)}`,
    `Description: ${terms.description}`,
    `Total value: ${displayValue(terms.totalValue)}`,
    `Settlement asset: ${displayValue(terms.settlementAsset)}`,
    `Deadline: ${displayValue(terms.deadline)}`,
    `Approval window: ${displayValue(terms.approvalWindow)}`,
    "",
    "Milestones:",
  ];

  if (
    terms.milestones.length ===
      0
  ) {
    lines.push(
      "None",
    );
  } else {
    terms.milestones.forEach(
      (
        milestone,
        index,
      ) => {
        lines.push(
          "",
          `Milestone ${index + 1}`,
          `Amount: ${displayValue(milestone.amount)}`,
          `Deliverable: ${displayValue(milestone.deliverable)}`,
          `Acceptance criteria: ${displayValue(milestone.acceptanceCriteria)}`,
          `Deadline: ${displayValue(milestone.deadline)}`,
        );
      },
    );
  }

  lines.push(
    "",
    review.party
      .acceptedCurrentVersion
      ? "You have already accepted this exact version."
      : "Accept only if these exact terms are correct.",
  );

  return lines.join(
    "\n",
  );
}

export function formatAcceptedAgreementResult(
  result:
    AcceptAgreementVersionResult,
): string {
  const lifecycle =
    result.lifecycle;

  const lines = [
    "Agreement accepted.",
    "",
    `Agreement: ${lifecycle.reference.agreementId}`,
    `Version: ${lifecycle.reference.agreementVersion}`,
    `Role: ${result.acceptance.role}`,
    `Status: ${lifecycle.status}`,
    "",
  ];

  if (
    lifecycle.acceptanceComplete
  ) {
    lines.push(
      "Both parties have accepted the current agreement version.",
    );
  } else {
    lines.push(
      "Your acceptance is recorded. Waiting for the other party.",
    );
  }

  return lines.join(
    "\n",
  );
}
