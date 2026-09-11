import assert from "node:assert/strict";
import test from "node:test";

import type {
  PersistReviewedAgreementResult,
  CanonicalAgreementTerms,
} from "@pai/agreement-contract";

import {
  persistReviewedAgreementForTelegram,
} from "../src/conversations/canonicalAgreementCreation.js";

import {
  createAgreementFlowSessionStore,
  createPartyCredentialVault,
} from "../src/conversations/canonicalAgreementSession.js";

import type {
  PaiClient,
} from "../src/services/paiClient.js";

const terms = {
  title:
    "Frontend delivery",

  description:
    "Alex will build the frontend for 1000 USDC.",

  totalValue:
    "1000",

  settlementAsset:
    "USDC",

  deadline:
    "2026-09-30",

  approvalWindow:
    "3 days",

  milestones:
    [],
} satisfies CanonicalAgreementTerms;

const backendResult = {
  lifecycle: {
    reference: {
      agreementId:
        "agreement-1",

      agreementVersion:
        1,

      agreementHash:
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    },

    status:
      "AWAITING_ACCEPTANCE",

    acceptanceComplete:
      false,

    walletBindingComplete:
      false,

    parties: [
      {
        partyId:
          "party-client",

        role:
          "CLIENT",

        acceptedCurrentVersion:
          false,

        walletBound:
          false,

        walletAddress:
          null,
      },

      {
        partyId:
          "party-contractor",

        role:
          "CONTRACTOR",

        acceptedCurrentVersion:
          false,

        walletBound:
          false,

        walletAddress:
          null,
      },
    ],
  },

  partyAccess: [
    {
      partyId:
        "party-client",

      role:
        "CLIENT",

      accessToken:
        "dummy-client-access-token",
    },

    {
      partyId:
        "party-contractor",

      role:
        "CONTRACTOR",

      accessToken:
        "dummy-contractor-access-token",
    },
  ],
} satisfies PersistReviewedAgreementResult;

test(
  "confirmed review persists canonical agreement and vaults raw party credentials",
  async () => {
    let receivedInput:
      unknown;

    const client: PaiClient = {
      async structureAgreement() {
        throw new Error(
          "structureAgreement must not run during canonical persistence.",
        );
      },

      async persistReviewedAgreement(
        input,
      ) {
        receivedInput =
          input;

        return backendResult;
      },
    };

    const flowSessions =
      createAgreementFlowSessionStore();

    flowSessions.setPendingReview(
      42,
      terms,
    );

    const handles = [
      "opaque-client-handle",
      "opaque-contractor-handle",
    ];

    let handleIndex =
      0;

    const credentialVault =
      createPartyCredentialVault({
        generateHandle:
          () =>
            handles[
              handleIndex++
            ] ??
            "unexpected-handle",
      });

    const session =
      await persistReviewedAgreementForTelegram({
        userId:
          42,

        terms,

        paiClient:
          client,

        flowSessions,

        credentialVault,
      });

    assert.deepEqual(
      receivedInput,
      {
        terms,

        client:
          {},

        contractor:
          {},
      },
    );

    assert.deepEqual(
      session.reference,
      backendResult
        .lifecycle
        .reference,
    );

    assert.equal(
      session.reference
        .agreementHash,
      backendResult
        .lifecycle
        .reference
        .agreementHash,
    );

    assert.deepEqual(
      session.parties,
      [
        {
          partyId:
            "party-client",

          role:
            "CLIENT",

          invitationHandle:
            "opaque-client-handle",
        },

        {
          partyId:
            "party-contractor",

          role:
            "CONTRACTOR",

          invitationHandle:
            "opaque-contractor-handle",
        },
      ],
    );

    const serializedSession =
      JSON.stringify(
        session,
      );

    assert.equal(
      serializedSession.includes(
        "dummy-client-access-token",
      ),
      false,
    );

    assert.equal(
      serializedSession.includes(
        "dummy-contractor-access-token",
      ),
      false,
    );

    assert.deepEqual(
      credentialVault.resolve(
        "opaque-client-handle",
      ),
      {
        agreementId:
          "agreement-1",

        partyId:
          "party-client",

        role:
          "CLIENT",

        accessToken:
          "dummy-client-access-token",
      },
    );

    assert.deepEqual(
      credentialVault.resolve(
        "opaque-contractor-handle",
      ),
      {
        agreementId:
          "agreement-1",

        partyId:
          "party-contractor",

        role:
          "CONTRACTOR",

        accessToken:
          "dummy-contractor-access-token",
      },
    );

    assert.equal(
      flowSessions.getPendingReview(
        42,
      ),
      undefined,
    );

    assert.deepEqual(
      flowSessions.getCanonicalAgreement(
        42,
      ),
      session,
    );
  },
);

test(
  "failed canonical persistence preserves pending review for retry",
  async () => {
    const client: PaiClient = {
      async structureAgreement() {
        throw new Error(
          "not used",
        );
      },

      async persistReviewedAgreement() {
        throw new Error(
          "backend unavailable",
        );
      },
    };

    const flowSessions =
      createAgreementFlowSessionStore();

    flowSessions.setPendingReview(
      42,
      terms,
    );

    const credentialVault =
      createPartyCredentialVault({
        generateHandle:
          () =>
            "unused-handle",
      });

    await assert.rejects(
      () =>
        persistReviewedAgreementForTelegram({
          userId:
            42,

          terms,

          paiClient:
            client,

          flowSessions,

          credentialVault,
        }),
      /backend unavailable/,
    );

    assert.deepEqual(
      flowSessions.getPendingReview(
        42,
      ),
      terms,
    );

    assert.equal(
      flowSessions.getCanonicalAgreement(
        42,
      ),
      undefined,
    );
  },
);
