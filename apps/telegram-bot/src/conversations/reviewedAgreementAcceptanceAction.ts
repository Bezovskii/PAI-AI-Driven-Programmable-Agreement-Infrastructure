import {
  randomBytes,
} from "node:crypto";

import type {
  AgreementPartyRole,
} from "@pai/agreement-contract";

export interface ReviewedAgreementAcceptanceAction {
  readonly telegramUserId:
    number;

  readonly invitationHandle:
    string;

  readonly agreementId:
    string;

  readonly partyId:
    string;

  readonly role:
    AgreementPartyRole;

  readonly expectedAgreementVersion:
    number;

  readonly expectedAgreementHash:
    string;
}

export interface CreateReviewedAgreementAcceptanceActionInput
  extends ReviewedAgreementAcceptanceAction {}

export interface ReviewedAgreementAcceptanceActionStore {
  create(
    input:
      CreateReviewedAgreementAcceptanceActionInput,
  ): string;

  resolve(
    actionHandle:
      string,
  ): ReviewedAgreementAcceptanceAction | undefined;

  delete(
    actionHandle:
      string,
  ): void;
}

export interface CreateReviewedAgreementAcceptanceActionStoreOptions {
  readonly generateHandle?:
    () => string;
}

function defaultActionHandle():
  string {
  return randomBytes(
    24,
  ).toString(
    "base64url",
  );
}

function requireText(
  value:
    string,

  field:
    string,
): string {
  const trimmed =
    value.trim();

  if (!trimmed) {
    throw new Error(
      `${field} must not be empty.`,
    );
  }

  return trimmed;
}

function requireAgreementVersion(
  value:
    number,
): number {
  if (
    !Number.isSafeInteger(
      value,
    ) ||
    value < 1
  ) {
    throw new Error(
      "Expected agreement version must be a positive safe integer.",
    );
  }

  return value;
}

export function createReviewedAgreementAcceptanceActionStore(
  options:
    CreateReviewedAgreementAcceptanceActionStoreOptions = {},
): ReviewedAgreementAcceptanceActionStore {
  const generateHandle =
    options.generateHandle ??
    defaultActionHandle;

  const actions =
    new Map<
      string,
      ReviewedAgreementAcceptanceAction
    >();

  return {
    create(
      input,
    ): string {
      const action:
        ReviewedAgreementAcceptanceAction = {
        telegramUserId:
          input.telegramUserId,

        invitationHandle:
          requireText(
            input.invitationHandle,
            "Invitation handle",
          ),

        agreementId:
          requireText(
            input.agreementId,
            "Agreement ID",
          ),

        partyId:
          requireText(
            input.partyId,
            "Party ID",
          ),

        role:
          input.role,

        expectedAgreementVersion:
          requireAgreementVersion(
            input.expectedAgreementVersion,
          ),

        expectedAgreementHash:
          requireText(
            input.expectedAgreementHash,
            "Expected agreement hash",
          ),
      };

      let actionHandle =
        requireText(
          generateHandle(),
          "Acceptance action handle",
        );

      while (
        actions.has(
          actionHandle,
        )
      ) {
        actionHandle =
          requireText(
            generateHandle(),
            "Acceptance action handle",
          );
      }

      actions.set(
        actionHandle,
        action,
      );

      return actionHandle;
    },

    resolve(
      actionHandle,
    ) {
      return actions.get(
        actionHandle,
      );
    },

    delete(
      actionHandle,
    ): void {
      actions.delete(
        actionHandle,
      );
    },
  };
}
