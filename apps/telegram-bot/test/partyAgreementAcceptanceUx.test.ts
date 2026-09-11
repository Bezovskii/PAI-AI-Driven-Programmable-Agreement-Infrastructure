import assert from "node:assert/strict";
import test from "node:test";

import type {
  AcceptAgreementVersionResult,
  CanonicalAgreementReviewView,
} from "@pai/agreement-contract";

import {
  createAgreementAcceptanceCallbackData,
  executeAgreementAcceptanceAction,
  formatAgreementAcceptanceReview,
  parseAgreementAcceptanceCallbackData,
  prepareAgreementAcceptanceReview,
} from "../src/conversations/partyAgreementAcceptanceUx.js";

import {
  createAgreementRuntime,
} from "../src/runtime/agreementRuntime.js";

import {
  PaiApiError,
} from "../src/services/paiClient.js";

const PARTY_TOKEN =
  "dummy-party-access-token";

const AGREEMENT_ID =
  "agreement-1";

const AGREEMENT_HASH =
  "canonical-hash-v3";

function createCanonicalReview():
  CanonicalAgreementReviewView {
  return {
    reference: {
      agreementId:
        AGREEMENT_ID,

      agreementVersion:
        3,

      agreementHash:
        AGREEMENT_HASH,
    },

    terms: {
      title:
        "Frontend delivery",

      description:
        "Contractor delivers the agreed frontend.",

      totalValue:
        "1000",

      settlementAsset:
        "USDC",

      deadline:
        "2026-09-20",

      approvalWindow:
        "3 days",

      milestones: [
        {
          amount:
            "1000",

          deliverable:
            "Production frontend",

          acceptanceCriteria:
            "Matches the agreed specification",

          deadline:
            "2026-09-20",
        },
      ],
    },

    party: {
      partyId:
        "party-client",

      role:
        "CLIENT",

      displayName:
        "Client",

      acceptedCurrentVersion:
        false,
    },

    status:
      "AWAITING_ACCEPTANCE",

    acceptanceComplete:
      false,
  };
}

function setupRuntime() {
  const runtime =
    createAgreementRuntime({
      generateHandle:
        () =>
          "opaque-party-invitation",

      generateAcceptanceActionHandle:
        () =>
          "opaque-review-action",
    });

  const safeReference =
    runtime
      .credentialVault
      .store(
        AGREEMENT_ID,
        {
          partyId:
            "party-client",

          role:
            "CLIENT",

          accessToken:
            PARTY_TOKEN,
        },
      );

  const claim =
    runtime
      .partyInvitationSessions
      .claim(
        101,
        safeReference
          .invitationHandle,
      );

  assert.equal(
    claim.status,
    "claimed",
  );

  if (
    claim.status !==
      "claimed"
  ) {
    throw new Error(
      "Expected claimed party session.",
    );
  }

  return {
    runtime,
    session:
      claim.session,
  };
}

function createBackendResult():
  AcceptAgreementVersionResult {
  return {
    acceptance: {
      partyId:
        "party-client",

      role:
        "CLIENT",

      agreementVersion:
        3,

      agreementHash:
        AGREEMENT_HASH,

      acceptedAt:
        "2026-09-10T10:00:00.000Z",

      current:
        true,
    },

    lifecycle: {
      reference: {
        agreementId:
          AGREEMENT_ID,

        agreementVersion:
          3,

        agreementHash:
          AGREEMENT_HASH,
      },

      status:
        "ACCEPTED",

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
            true,

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
  };
}

test(
  "acceptance callback contains opaque action handle rather than agreement identity",
  () => {
    const callbackData =
      createAgreementAcceptanceCallbackData(
        "opaque-review-action",
      );

    assert.equal(
      callbackData,
      "pai_accept:opaque-review-action",
    );

    assert.equal(
      callbackData.includes(
        AGREEMENT_ID,
      ),
      false,
    );

    assert.equal(
      callbackData.includes(
        PARTY_TOKEN,
      ),
      false,
    );

    assert.equal(
      callbackData.includes(
        AGREEMENT_HASH,
      ),
      false,
    );

    assert.equal(
      parseAgreementAcceptanceCallbackData(
        callbackData,
      ),
      "opaque-review-action",
    );
  },
);

test(
  "rejects acceptance callback data that exceeds Telegram 64-byte limit",
  () => {
    assert.throws(
      () =>
        createAgreementAcceptanceCallbackData(
          "a".repeat(
            54,
          ),
        ),
      /too long/i,
    );
  },
);

test(
  "canonical review creates an opaque action bound to exact reviewed tuple",
  async () => {
    const {
      runtime,
      session,
    } =
      setupRuntime();

    const review =
      createCanonicalReview();

    const paiClient = {
      async getCanonicalAgreementReview(
        input: {
          readonly agreementId:
            string;
        },

        token:
          string,
      ) {
        assert.equal(
          input.agreementId,
          AGREEMENT_ID,
        );

        assert.equal(
          token,
          PARTY_TOKEN,
        );

        return review;
      },

      async acceptAgreementVersion() {
        throw new Error(
          "Acceptance must not happen while preparing review.",
        );
      },
    };

    const result =
      await prepareAgreementAcceptanceReview(
        paiClient,
        runtime,
        101,
        session,
      );

    assert.equal(
      result.status,
      "ready",
    );

    if (
      result.status !==
        "ready"
    ) {
      throw new Error(
        "Expected ready acceptance review.",
      );
    }

    assert.equal(
      result.callbackData,
      "pai_accept:opaque-review-action",
    );

    const action =
      runtime
        .reviewedAcceptanceActions
        .resolve(
          "opaque-review-action",
        );

    assert.deepEqual(
      action,
      {
        telegramUserId:
          101,

        invitationHandle:
          "opaque-party-invitation",

        agreementId:
          AGREEMENT_ID,

        partyId:
          "party-client",

        role:
          "CLIENT",

        expectedAgreementVersion:
          3,

        expectedAgreementHash:
          AGREEMENT_HASH,
      },
    );

    assert.equal(
      JSON.stringify(
        action,
      ).includes(
        PARTY_TOKEN,
      ),
      false,
    );

    const message =
      formatAgreementAcceptanceReview(
        result.review,
      );

    assert.match(
      message,
      /Frontend delivery/,
    );

    assert.match(
      message,
      /Contractor delivers the agreed frontend\./,
    );

    assert.match(
      message,
      /1000/,
    );

    assert.match(
      message,
      /USDC/,
    );

    assert.match(
      message,
      /Matches the agreed specification/,
    );
  },
);

test(
  "accept action rechecks review and posts exact previously reviewed tuple",
  async () => {
    const {
      runtime,
    } =
      setupRuntime();

    runtime
      .reviewedAcceptanceActions
      .create({
        telegramUserId:
          101,

        invitationHandle:
          "opaque-party-invitation",

        agreementId:
          AGREEMENT_ID,

        partyId:
          "party-client",

        role:
          "CLIENT",

        expectedAgreementVersion:
          3,

        expectedAgreementHash:
          AGREEMENT_HASH,
      });

    const backendResult =
      createBackendResult();

    let reviewCalls =
      0;

    let acceptanceCalls =
      0;

    const paiClient = {
      async getCanonicalAgreementReview(
        input: {
          readonly agreementId:
            string;
        },

        token:
          string,
      ) {
        reviewCalls +=
          1;

        assert.equal(
          input.agreementId,
          AGREEMENT_ID,
        );

        assert.equal(
          token,
          PARTY_TOKEN,
        );

        return createCanonicalReview();
      },

      async acceptAgreementVersion(
        input: {
          readonly agreementId:
            string;

          readonly agreementVersion:
            number;

          readonly agreementHash:
            string;

          readonly partyId:
            string;
        },

        token:
          string,
      ) {
        acceptanceCalls +=
          1;

        assert.deepEqual(
          input,
          {
            agreementId:
              AGREEMENT_ID,

            agreementVersion:
              3,

            agreementHash:
              AGREEMENT_HASH,

            partyId:
              "party-client",
          },
        );

        assert.equal(
          token,
          PARTY_TOKEN,
        );

        return backendResult;
      },
    };

    const result =
      await executeAgreementAcceptanceAction(
        paiClient,
        runtime,
        101,
        createAgreementAcceptanceCallbackData(
          "opaque-review-action",
        ),
      );

    assert.equal(
      result.status,
      "accepted",
    );

    assert.equal(
      reviewCalls,
      1,
    );

    assert.equal(
      acceptanceCalls,
      1,
    );

    assert.equal(
      runtime
        .reviewedAcceptanceActions
        .resolve(
          "opaque-review-action",
        ),
      undefined,
    );
  },
);

test(
  "changed canonical tuple becomes stale and is never accepted",
  async () => {
    const {
      runtime,
    } =
      setupRuntime();

    runtime
      .reviewedAcceptanceActions
      .create({
        telegramUserId:
          101,

        invitationHandle:
          "opaque-party-invitation",

        agreementId:
          AGREEMENT_ID,

        partyId:
          "party-client",

        role:
          "CLIENT",

        expectedAgreementVersion:
          3,

        expectedAgreementHash:
          AGREEMENT_HASH,
      });

    const changedReview:
      CanonicalAgreementReviewView = {
      ...createCanonicalReview(),

      reference: {
        agreementId:
          AGREEMENT_ID,

        agreementVersion:
          4,

        agreementHash:
          "canonical-hash-v4",
      },
    };

    let acceptanceCalls =
      0;

    const paiClient = {
      async getCanonicalAgreementReview() {
        return changedReview;
      },

      async acceptAgreementVersion() {
        acceptanceCalls +=
          1;

        return createBackendResult();
      },
    };

    const result =
      await executeAgreementAcceptanceAction(
        paiClient,
        runtime,
        101,
        "pai_accept:opaque-review-action",
      );

    assert.deepEqual(
      result,
      {
        status:
          "stale",
      },
    );

    assert.equal(
      acceptanceCalls,
      0,
    );

    assert.equal(
      runtime
        .reviewedAcceptanceActions
        .resolve(
          "opaque-review-action",
        ),
      undefined,
    );
  },
);

test(
  "acceptance action cannot be used by another Telegram user",
  async () => {
    const {
      runtime,
    } =
      setupRuntime();

    runtime
      .reviewedAcceptanceActions
      .create({
        telegramUserId:
          101,

        invitationHandle:
          "opaque-party-invitation",

        agreementId:
          AGREEMENT_ID,

        partyId:
          "party-client",

        role:
          "CLIENT",

        expectedAgreementVersion:
          3,

        expectedAgreementHash:
          AGREEMENT_HASH,
      });

    let reviewCalls =
      0;

    let acceptanceCalls =
      0;

    const paiClient = {
      async getCanonicalAgreementReview() {
        reviewCalls +=
          1;

        return createCanonicalReview();
      },

      async acceptAgreementVersion() {
        acceptanceCalls +=
          1;

        return createBackendResult();
      },
    };

    const result =
      await executeAgreementAcceptanceAction(
        paiClient,
        runtime,
        202,
        "pai_accept:opaque-review-action",
      );

    assert.deepEqual(
      result,
      {
        status:
          "failed",
      },
    );

    assert.equal(
      reviewCalls,
      0,
    );

    assert.equal(
      acceptanceCalls,
      0,
    );
  },
);

test(
  "backend 409 after final review check becomes stale without retry",
  async () => {
    const {
      runtime,
    } =
      setupRuntime();

    runtime
      .reviewedAcceptanceActions
      .create({
        telegramUserId:
          101,

        invitationHandle:
          "opaque-party-invitation",

        agreementId:
          AGREEMENT_ID,

        partyId:
          "party-client",

        role:
          "CLIENT",

        expectedAgreementVersion:
          3,

        expectedAgreementHash:
          AGREEMENT_HASH,
      });

    let acceptanceCalls =
      0;

    const paiClient = {
      async getCanonicalAgreementReview() {
        return createCanonicalReview();
      },

      async acceptAgreementVersion() {
        acceptanceCalls +=
          1;

        throw new PaiApiError(
          409,
          "stale canonical agreement tuple",
        );
      },
    };

    const result =
      await executeAgreementAcceptanceAction(
        paiClient,
        runtime,
        101,
        "pai_accept:opaque-review-action",
      );

    assert.deepEqual(
      result,
      {
        status:
          "stale",
      },
    );

    assert.equal(
      acceptanceCalls,
      1,
    );

    assert.equal(
      runtime
        .reviewedAcceptanceActions
        .resolve(
          "opaque-review-action",
        ),
      undefined,
    );
  },
);
