import type {
  AgreementStructuringStatus,
} from "@pai/intelligence-contract";

import type {
  AgreementDraftSessionStore,
} from "./agreementSession.js";

import {
  formatAgreementStructuringResult,
} from "../presentation/agreementResult.js";

import type {
  PaiClient,
} from "../services/paiClient.js";

export interface ProcessAgreementDraftOptions {
  readonly userId: number;
  readonly message: string;
  readonly paiClient: PaiClient;
  readonly sessions:
    AgreementDraftSessionStore;
}

export interface AgreementConversationResult {
  readonly status:
    AgreementStructuringStatus;

  readonly message:
    string;
}

export async function processAgreementDraftMessage(
  options:
    ProcessAgreementDraftOptions,
): Promise<AgreementConversationResult> {
  const requestText =
    options.sessions.preview(
      options.userId,
      options.message,
    );

  const result =
    await options
      .paiClient
      .structureAgreement({
        text:
          requestText,
      });

  if (
    result.status ===
    "needs_clarification"
  ) {
    options.sessions.commit(
      options.userId,
      options.message,
    );
  } else {
    options.sessions.clear(
      options.userId,
    );
  }

  return {
    status:
      result.status,

    message:
      formatAgreementStructuringResult(
        result,
      ),
  };
}