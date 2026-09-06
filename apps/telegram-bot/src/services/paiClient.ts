import type {
  AgreementStructuringResult,
  StructureAgreementInput,
} from "@pai/intelligence-contract";

const STRUCTURE_AGREEMENT_PATH =
  "/api/v1/intelligence/agreements/structure";

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface PaiClient {
  structureAgreement(
    input: StructureAgreementInput,
  ): Promise<AgreementStructuringResult>;
}

export interface CreatePaiClientOptions {
  readonly baseUrl: string;
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

export function createPaiClient(
  options: CreatePaiClientOptions,
): PaiClient {
  const baseUrl =
    normalizeBaseUrl(
      options.baseUrl,
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

      if (!response.ok) {
        const responseBody =
          await response.text();

        throw new PaiApiError(
          response.status,
          responseBody,
        );
      }

      return (
        await response.json()
      ) as AgreementStructuringResult;
    },
  };
}