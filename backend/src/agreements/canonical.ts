import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import type {
  AgreementAcceptanceLifecycleStatus,
  AgreementPartyRole,
  CanonicalAgreementTerms,
} from "@pai/agreement-contract";

type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalJsonValue[]
  | {
      readonly [key: string]:
        CanonicalJsonValue;
    };

export interface CanonicalLifecyclePartyState {
  readonly role:
    AgreementPartyRole;

  readonly acceptedCurrentVersion:
    boolean;

  readonly walletAddress:
    string | null;
}

function nullableBusinessValue(
  value:
    string | null | undefined,
): string | null {
  return value ?? null;
}

export function normalizeCanonicalAgreementTerms(
  terms:
    CanonicalAgreementTerms,
): CanonicalAgreementTerms {
  return {
    approvalWindow:
      nullableBusinessValue(
        terms.approvalWindow,
      ),

    deadline:
      nullableBusinessValue(
        terms.deadline,
      ),

    description:
      terms.description,

    milestones:
      terms.milestones.map(
        (milestone) => ({
          acceptanceCriteria:
            nullableBusinessValue(
              milestone
                .acceptanceCriteria,
            ),

          amount:
            nullableBusinessValue(
              milestone.amount,
            ),

          deadline:
            nullableBusinessValue(
              milestone.deadline,
            ),

          deliverable:
            nullableBusinessValue(
              milestone.deliverable,
            ),
        }),
      ),

    settlementAsset:
      nullableBusinessValue(
        terms.settlementAsset,
      ),

    title:
      nullableBusinessValue(
        terms.title,
      ),

    totalValue:
      nullableBusinessValue(
        terms.totalValue,
      ),
  };
}

function canonicalizeJsonValue(
  value:
    CanonicalJsonValue,
): CanonicalJsonValue {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(
      (entry) =>
        canonicalizeJsonValue(
          entry,
        ),
    );
  }

  const objectValue =
    value as Readonly<
      Record<
        string,
        CanonicalJsonValue
      >
    >;

  const result:
    Record<
      string,
      CanonicalJsonValue
    > = {};

  for (
    const key of
      Object.keys(objectValue).sort()
  ) {
    const entry =
      objectValue[key];

    if (entry === undefined) {
      continue;
    }

    result[key] =
      canonicalizeJsonValue(
        entry,
      );
  }

  return result;
}

export function serializeCanonicalAgreementTerms(
  terms:
    CanonicalAgreementTerms,
): string {
  const normalized =
    normalizeCanonicalAgreementTerms(
      terms,
    );

  const canonical:
    CanonicalJsonValue = {
      approvalWindow:
        normalized.approvalWindow,

      deadline:
        normalized.deadline,

      description:
        normalized.description,

      milestones:
        normalized.milestones.map(
          (milestone) => ({
            acceptanceCriteria:
              milestone
                .acceptanceCriteria,

            amount:
              milestone.amount,

            deadline:
              milestone.deadline,

            deliverable:
              milestone.deliverable,
          }),
        ),

      settlementAsset:
        normalized.settlementAsset,

      title:
        normalized.title,

      totalValue:
        normalized.totalValue,
    };

  return JSON.stringify(
    canonicalizeJsonValue(
      canonical,
    ),
  );
}

export function computeCanonicalAgreementHash(
  terms:
    CanonicalAgreementTerms,
): string {
  const serialized =
    serializeCanonicalAgreementTerms(
      terms,
    );

  return (
    "0x" +
    createHash("sha256")
      .update(
        serialized,
        "utf8",
      )
      .digest("hex")
  );
}

export function generatePartyAccessToken():
  string {
  return randomBytes(32)
    .toString("hex");
}

export function hashPartyAccessToken(
  token:
    string,
): string {
  return createHash("sha256")
    .update(
      token,
      "utf8",
    )
    .digest("hex");
}

export function verifyPartyAccessToken(
  rawToken:
    string,
  persistedHash:
    string,
): boolean {
  const candidateHash =
    hashPartyAccessToken(
      rawToken,
    );

  if (
    !/^[0-9a-f]{64}$/.test(
      persistedHash,
    )
  ) {
    return false;
  }

  const candidateBytes =
    Buffer.from(
      candidateHash,
      "hex",
    );

  const persistedBytes =
    Buffer.from(
      persistedHash,
      "hex",
    );

  if (
    candidateBytes.length !==
    persistedBytes.length
  ) {
    return false;
  }

  return timingSafeEqual(
    candidateBytes,
    persistedBytes,
  );
}

export function deriveCanonicalLifecycleStatus(
  parties:
    readonly CanonicalLifecyclePartyState[],
): AgreementAcceptanceLifecycleStatus {
  const client =
    parties.find(
      (party) =>
        party.role === "CLIENT",
    );

  const contractor =
    parties.find(
      (party) =>
        party.role ===
        "CONTRACTOR",
    );

  const acceptanceComplete =
    client
      ?.acceptedCurrentVersion ===
      true &&
    contractor
      ?.acceptedCurrentVersion ===
      true;

  if (!acceptanceComplete) {
    return "AWAITING_ACCEPTANCE";
  }

  const walletBindingComplete =
    client.walletAddress !== null &&
    contractor.walletAddress !== null;

  if (walletBindingComplete) {
    return "READY_TO_FUND";
  }

  return "ACCEPTED";
}