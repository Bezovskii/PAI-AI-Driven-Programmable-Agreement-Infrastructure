import assert from "node:assert/strict";
import test from "node:test";

import type {
  AgreementLifecycleView,
} from "@pai/agreement-contract";

import {
  preparePartyWalletBindingHandoff,
} from "../src/conversations/partyWalletBindingHandoff.js";

import {
  createAgreementRuntime,
} from "../src/runtime/agreementRuntime.js";

function lifecycle(
  options?: {
    readonly acceptanceComplete?:
      boolean;

    readonly walletBound?:
      boolean;

    readonly status?:
      AgreementLifecycleView["status"];
  },
): AgreementLifecycleView {
  const acceptanceComplete =
    options?.acceptanceComplete ??
    true;

  const walletBound =
    options?.walletBound ??
    false;

  return {
    reference: {
      agreementId:
        "agreement-1",

      agreementVersion:
        1,

      agreementHash:
        "canonical-hash-v1",
    },

    status:
      options?.status ??
      (
        acceptanceComplete
          ? "ACCEPTED"
          : "AWAITING_ACCEPTANCE"
      ),

    acceptanceComplete,

    walletBindingComplete:
      false,

    parties: [
      {
        partyId:
          "party-client",

        role:
          "CLIENT",

        acceptedCurrentVersion:
          acceptanceComplete,

        walletBound,

        walletAddress:
          walletBound
            ? "0x1111111111111111111111111111111111111111"
            : null,
      },

      {
        partyId:
          "party-contractor",

        role:
          "CONTRACTOR",

        acceptedCurrentVersion:
          acceptanceComplete,

        walletBound:
          false,

        walletAddress:
          null,
      },
    ],
  };
}

function fixture() {
  const runtime =
    createAgreementRuntime({
      generateHandle:
        () =>
          "opaque-invitation-handle",
    });

  const safeReference =
    runtime
      .credentialVault
      .store(
        "agreement-1",
        {
          partyId:
            "party-client",

          role:
            "CLIENT",

          accessToken:
            "dummy-wallet-party-token",
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

  if (
    claim.status !==
      "claimed"
  ) {
    throw new Error(
      "Expected invitation claim.",
    );
  }

  return {
    runtime,
    session:
      claim.session,
  };
}

test(
  "dual-accepted CLIENT receives opaque browser wallet handoff URL",
  async () => {
    const {
      runtime,
      session,
    } =
      fixture();

    let capturedToken =
      "";

    let createCalls =
      0;

    const result =
      await preparePartyWalletBindingHandoff(
        {
          async getAgreementLifecycle() {
            return lifecycle();
          },

          async createWalletBindingHandoff(
            input,
          ) {
            createCalls +=
              1;

            capturedToken =
              input
                .partyAccessToken;

            return {
              handoffId:
                "opaque-handoff-123",

              expiresAt:
                "2026-09-11T10:30:00.000Z",
            };
          },
        },

        runtime,

        "https://app.pai.example",

        session,
      );

    assert.equal(
      result.status,
      "ready",
    );

    assert.equal(
      createCalls,
      1,
    );

    assert.equal(
      capturedToken,
      "dummy-wallet-party-token",
    );

    if (
      result.status !==
        "ready"
    ) {
      throw new Error(
        "Expected ready handoff.",
      );
    }

    const url =
      new URL(
        result.url,
      );

    assert.equal(
      url.origin,
      "https://app.pai.example",
    );

    assert.equal(
      url.pathname,
      "/wallet-binding",
    );

    assert.equal(
      url.searchParams
        .get(
          "agreementId",
        ),
      "agreement-1",
    );

    assert.equal(
      url.searchParams
        .get(
          "partyId",
        ),
      "party-client",
    );

    assert.equal(
      url.searchParams
        .get(
          "handoffId",
        ),
      "opaque-handoff-123",
    );

    assert.deepEqual(
      Array.from(
        url.searchParams
          .keys(),
      ).sort(),
      [
        "agreementId",
        "handoffId",
        "partyId",
      ],
    );

    assert.equal(
      result.url.includes(
        "dummy-wallet-party-token",
      ),
      false,
    );
  },
);

test(
  "pre-dual-acceptance lifecycle does not request a wallet handoff",
  async () => {
    const {
      runtime,
      session,
    } =
      fixture();

    let createCalls =
      0;

    const result =
      await preparePartyWalletBindingHandoff(
        {
          async getAgreementLifecycle() {
            return lifecycle({
              acceptanceComplete:
                false,
            });
          },

          async createWalletBindingHandoff() {
            createCalls +=
              1;

            throw new Error(
              "must not execute",
            );
          },
        },

        runtime,

        "https://app.pai.example",

        session,
      );

    assert.equal(
      result.status,
      "waiting_for_acceptance",
    );

    assert.equal(
      createCalls,
      0,
    );
  },
);

test(
  "already-bound party does not create another wallet handoff",
  async () => {
    const {
      runtime,
      session,
    } =
      fixture();

    let createCalls =
      0;

    const result =
      await preparePartyWalletBindingHandoff(
        {
          async getAgreementLifecycle() {
            return lifecycle({
              walletBound:
                true,
              status:
                "ACCEPTED",
            });
          },

          async createWalletBindingHandoff() {
            createCalls +=
              1;

            throw new Error(
              "must not execute",
            );
          },
        },

        runtime,

        "https://app.pai.example",

        session,
      );

    assert.equal(
      result.status,
      "already_bound",
    );

    assert.equal(
      createCalls,
      0,
    );
  },
);

test(
  "reopening an accepted invitation creates a fresh handoff each time",
  async () => {
    const {
      runtime,
      session,
    } =
      fixture();

    let counter =
      0;

    const paiClient = {
      async getAgreementLifecycle() {
        return lifecycle();
      },

      async createWalletBindingHandoff() {
        counter +=
          1;

        return {
          handoffId:
            `opaque-handoff-${counter}`,

          expiresAt:
            "2026-09-11T10:30:00.000Z",
        };
      },
    };

    const first =
      await preparePartyWalletBindingHandoff(
        paiClient,
        runtime,
        "https://app.pai.example",
        session,
      );

    const second =
      await preparePartyWalletBindingHandoff(
        paiClient,
        runtime,
        "https://app.pai.example",
        session,
      );

    assert.equal(
      first.status,
      "ready",
    );

    assert.equal(
      second.status,
      "ready",
    );

    if (
      first.status !==
        "ready" ||
      second.status !==
        "ready"
    ) {
      throw new Error(
        "Expected fresh handoffs.",
      );
    }

    assert.notEqual(
      first.url,
      second.url,
    );

    assert.equal(
      counter,
      2,
    );
  },
);

test(
  "dual-accepted CONTRACTOR receives opaque browser wallet handoff URL",
  async () => {
    const runtime =
      createAgreementRuntime({
        generateHandle:
          () =>
            "opaque-contractor-invitation",
      });

    const safeReference =
      runtime
        .credentialVault
        .store(
          "agreement-1",
          {
            partyId:
              "party-contractor",

            role:
              "CONTRACTOR",

            accessToken:
              "dummy-contractor-party-token",
          },
        );

    const claim =
      runtime
        .partyInvitationSessions
        .claim(
          202,
          safeReference
            .invitationHandle,
        );

    if (
      claim.status !==
        "claimed"
    ) {
      throw new Error(
        "Expected contractor invitation claim.",
      );
    }

    let capturedToken =
      "";

    const result =
      await preparePartyWalletBindingHandoff(
        {
          async getAgreementLifecycle() {
            return lifecycle();
          },

          async createWalletBindingHandoff(
            input,
          ) {
            capturedToken =
              input
                .partyAccessToken;

            return {
              handoffId:
                "opaque-contractor-handoff",

              expiresAt:
                "2026-09-11T10:45:00.000Z",
            };
          },
        },

        runtime,

        "https://app.pai.example",

        claim.session,
      );

    assert.equal(
      result.status,
      "ready",
    );

    assert.equal(
      capturedToken,
      "dummy-contractor-party-token",
    );

    if (
      result.status !==
        "ready"
    ) {
      throw new Error(
        "Expected contractor wallet handoff.",
      );
    }

    const url =
      new URL(
        result.url,
      );

    assert.equal(
      url.searchParams
        .get(
          "partyId",
        ),
      "party-contractor",
    );

    assert.equal(
      url.searchParams
        .get(
          "handoffId",
        ),
      "opaque-contractor-handoff",
    );

    assert.equal(
      result.url.includes(
        "dummy-contractor-party-token",
      ),
      false,
    );

    assert.deepEqual(
      Array.from(
        url.searchParams
          .keys(),
      ).sort(),
      [
        "agreementId",
        "handoffId",
        "partyId",
      ],
    );
  },
);
test(
  "successful second acceptance lifecycle creates handoff without lifecycle refetch",
  async () => {
    const {
      runtime,
      session,
    } =
      fixture();

    let lifecycleFetches =
      0;

    let handoffCalls =
      0;

    const acceptedLifecycle =
      lifecycle({
        acceptanceComplete:
          true,
        status:
          "ACCEPTED",
      });

    const result =
      await preparePartyWalletBindingHandoff(
        {
          async getAgreementLifecycle() {
            lifecycleFetches +=
              1;

            throw new Error(
              "known acceptance lifecycle must be reused",
            );
          },

          async createWalletBindingHandoff(
            input,
          ) {
            handoffCalls +=
              1;

            assert.equal(
              input.agreementId,
              "agreement-1",
            );

            assert.equal(
              input.partyId,
              "party-client",
            );

            assert.equal(
              input.partyAccessToken,
              "dummy-wallet-party-token",
            );

            return {
              handoffId:
                "opaque-second-acceptance-handoff",

              expiresAt:
                "2026-09-11T11:30:00.000Z",
            };
          },
        },

        runtime,

        "https://app.pai.example",

        session,

        acceptedLifecycle,
      );

    assert.equal(
      lifecycleFetches,
      0,
    );

    assert.equal(
      handoffCalls,
      1,
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
        "Expected immediate wallet handoff.",
      );
    }

    const url =
      new URL(
        result.url,
      );

    assert.equal(
      url.searchParams
        .get(
          "handoffId",
        ),
      "opaque-second-acceptance-handoff",
    );

    assert.equal(
      result.url.includes(
        "dummy-wallet-party-token",
      ),
      false,
    );
  },
);