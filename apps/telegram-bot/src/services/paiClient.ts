import type {
  AcceptAgreementVersionRequest,
  AcceptAgreementVersionResult,
  AgreementLifecycleView,
  CanonicalAgreementReviewView,
  CreateWalletBindingHandoffResult,
  GetAgreementLifecycleRequest,
  GetCanonicalAgreementReviewRequest,
  PersistReviewedAgreementRequest,
  PersistReviewedAgreementResult,
} from "@pai/agreement-contract";

import type {
  AgreementStructuringResult,
  StructureAgreementInput,
} from "@pai/intelligence-contract";

const STRUCTURE_AGREEMENT_PATH =
  "/api/v1/intelligence/agreements/structure";

const PERSIST_REVIEWED_AGREEMENT_PATH =
  "/api/v1/agreements/reviewed";

function canonicalAgreementPath(
  agreementId: string,
): string {
  return `/api/v1/agreements/${encodeURIComponent(agreementId)}`;
}

function requirePartyAccessToken(
  value: string,
): string {
  const trimmed =
    value.trim();

  if (!trimmed) {
    throw new Error(
      "PAI party access token must not be empty.",
    );
  }

  return trimmed;
}

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface CreateWalletBindingHandoffInput {
  readonly agreementId:
    string;

  readonly partyId:
    string;

  readonly partyAccessToken:
    string;
}

export interface PaiClient {
  structureAgreement(
    input: StructureAgreementInput,
  ): Promise<AgreementStructuringResult>;

  persistReviewedAgreement(
    input: PersistReviewedAgreementRequest,
  ): Promise<PersistReviewedAgreementResult>;

  acceptAgreementVersion(
    input: AcceptAgreementVersionRequest,
    partyAccessToken: string,
  ): Promise<AcceptAgreementVersionResult>;

  getAgreementLifecycle(
    input: GetAgreementLifecycleRequest,
  ): Promise<AgreementLifecycleView>;

  createWalletBindingHandoff(
    input:
      CreateWalletBindingHandoffInput,
  ): Promise<CreateWalletBindingHandoffResult>;

  getCanonicalAgreementReview(
    input: GetCanonicalAgreementReviewRequest,
    partyAccessToken: string,
  ): Promise<CanonicalAgreementReviewView>;
}

export interface CreatePaiClientOptions {
  readonly baseUrl: string;
  readonly authoringServiceToken: string;
  readonly fetchImpl?: FetchLike;
}

export class PaiApiError extends Error {
  constructor(
    readonly status: number,
    readonly responseBody: string,
  ) {
    super(
      `PAI API request failed with status ${status}.`,
    );

    this.name =
      "PaiApiError";
  }
}

function normalizeBaseUrl(
  value: string,
): string {
  const trimmed =
    value.trim();

  if (!trimmed) {
    throw new Error(
      "PAI API base URL must not be empty.",
    );
  }

  let parsed: URL;

  try {
    parsed =
      new URL(trimmed);
  } catch {
    throw new Error(
      "PAI API base URL must be a valid URL.",
    );
  }

  if (
    parsed.protocol !== "http:" &&
    parsed.protocol !== "https:"
  ) {
    throw new Error(
      "PAI API base URL must use http:// or https://.",
    );
  }

  return trimmed.replace(
    /\/+$/,
    "",
  );
}

function requireAuthoringServiceToken(
  value: string,
): string {
  const trimmed =
    value.trim();

  if (!trimmed) {
    throw new Error(
      "PAI Telegram service token must not be empty.",
    );
  }

  return trimmed;
}

async function requireSuccess(
  response: Response,
): Promise<void> {
  if (response.ok) {
    return;
  }

  const responseBody =
    await response.text();

  throw new PaiApiError(
    response.status,
    responseBody,
  );
}

export function createPaiClient(
  options: CreatePaiClientOptions,
): PaiClient {
  const baseUrl =
    normalizeBaseUrl(
      options.baseUrl,
    );

  const authoringServiceToken =
    requireAuthoringServiceToken(
      options.authoringServiceToken,
    );

  const fetchImpl =
    options.fetchImpl ??
    fetch;

  return {
    async structureAgreement(
      input: StructureAgreementInput,
    ): Promise<AgreementStructuringResult> {
      const response =
        await fetchImpl(
          `${baseUrl}${STRUCTURE_AGREEMENT_PATH}`,
          {
            method:
              "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body:
              JSON.stringify(
                input,
              ),
          },
        );

      await requireSuccess(
        response,
      );

      return (
        await response.json()
      ) as AgreementStructuringResult;
    },

    async persistReviewedAgreement(
      input: PersistReviewedAgreementRequest,
    ): Promise<PersistReviewedAgreementResult> {
      const response =
        await fetchImpl(
          `${baseUrl}${PERSIST_REVIEWED_AGREEMENT_PATH}`,
          {
            method:
              "POST",

            headers: {
              authorization:
                `Bearer ${authoringServiceToken}`,

              "content-type":
                "application/json",
            },

            body:
              JSON.stringify(
                input,
              ),
          },
        );

      await requireSuccess(
        response,
      );

      return (
        await response.json()
      ) as PersistReviewedAgreementResult;
    },

    async acceptAgreementVersion(
      input: AcceptAgreementVersionRequest,
      partyAccessToken: string,
    ): Promise<AcceptAgreementVersionResult> {
      const token =
        requirePartyAccessToken(
          partyAccessToken,
        );

      const response =
        await fetchImpl(
          `${baseUrl}${canonicalAgreementPath(input.agreementId)}/acceptances`,
          {
            method:
              "POST",

            headers: {
              "content-type":
                "application/json",

              "x-pai-party-token":
                token,
            },

            body:
              JSON.stringify(
                input,
              ),
          },
        );

      await requireSuccess(
        response,
      );

      return (
        await response.json()
      ) as AcceptAgreementVersionResult;
    },

    async getAgreementLifecycle(
      input: GetAgreementLifecycleRequest,
    ): Promise<AgreementLifecycleView> {
      const response =
        await fetchImpl(
          `${baseUrl}${canonicalAgreementPath(input.agreementId)}/lifecycle`,
          {
            method:
              "GET",
          },
        );

      await requireSuccess(
        response,
      );

      return (
        await response.json()
      ) as AgreementLifecycleView;
    },

    async createWalletBindingHandoff(
      input:
        CreateWalletBindingHandoffInput,
    ): Promise<CreateWalletBindingHandoffResult> {
      const token =
        requirePartyAccessToken(
          input.partyAccessToken,
        );

      const response =
        await fetchImpl(
          `${baseUrl}${canonicalAgreementPath(input.agreementId)}/parties/${encodeURIComponent(input.partyId)}/wallet-binding-handoffs`,
          {
            method:
              "POST",

            headers: {
              "x-pai-party-token":
                token,
            },
          },
        );

      await requireSuccess(
        response,
      );

      return (
        await response.json()
      ) as CreateWalletBindingHandoffResult;
    },

    async getCanonicalAgreementReview(
      input: GetCanonicalAgreementReviewRequest,
      partyAccessToken: string,
    ): Promise<CanonicalAgreementReviewView> {
      const token =
        requirePartyAccessToken(
          partyAccessToken,
        );

      const response =
        await fetchImpl(
          `${baseUrl}${canonicalAgreementPath(input.agreementId)}/review`,
          {
            method:
              "GET",

            headers: {
              "x-pai-party-token":
                token,
            },
          },
        );

      await requireSuccess(
        response,
      );

      return (
        await response.json()
      ) as CanonicalAgreementReviewView;
    },
  };
}
