import assert from "node:assert/strict";
import test from "node:test";

import {
  claimPartyInvitationFromStart,
  formatPartyInvitationStartResult,
} from "../src/conversations/partyInvitationStart.js";

import {
  createAgreementRuntime,
} from "../src/runtime/agreementRuntime.js";

function createFixture() {
  const runtime =
    createAgreementRuntime({
      generateHandle:
        () =>
          "opaque-start-handle",
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
            "dummy-start-party-token",
        },
      );

  return {
    runtime,
    safeReference,
  };
}

test(
  "start payload claims the party through the shared invitation runtime",
  () => {
    const {
      runtime,
      safeReference,
    } =
      createFixture();

    const result =
      claimPartyInvitationFromStart(
        runtime
          .partyInvitationSessions,

        101,

        safeReference
          .invitationHandle,
      );

    assert.ok(
      result,
    );

    assert.equal(
      result.status,
      "claimed",
    );

    if (
      result.status !==
      "claimed"
    ) {
      throw new Error(
        "Expected claimed invitation.",
      );
    }

    assert.equal(
      result.session
        .partyId,
      "party-client",
    );

    assert.equal(
      result.session
        .role,
      "CLIENT",
    );

    const message =
      formatPartyInvitationStartResult(
        result,
      );

    assert.equal(
      message.includes(
        "agreement-1",
      ),
      true,
    );

    assert.equal(
      message.includes(
        "CLIENT",
      ),
      true,
    );

    assert.equal(
      message.includes(
        "dummy-start-party-token",
      ),
      false,
    );

    assert.equal(
      message.includes(
        safeReference
          .invitationHandle,
      ),
      false,
    );
  },
);

test(
  "start payload is trimmed before invitation claim",
  () => {
    const {
      runtime,
      safeReference,
    } =
      createFixture();

    const result =
      claimPartyInvitationFromStart(
        runtime
          .partyInvitationSessions,

        101,

        `  ${safeReference.invitationHandle}  `,
      );

    assert.equal(
      result?.status,
      "claimed",
    );
  },
);

test(
  "blank start payload leaves normal start flow untouched",
  () => {
    const {
      runtime,
    } =
      createFixture();

    assert.equal(
      claimPartyInvitationFromStart(
        runtime
          .partyInvitationSessions,

        101,

        "   ",
      ),
      null,
    );
  },
);

test(
  "unknown start payload is reported as invalid without exposing credentials",
  () => {
    const {
      runtime,
    } =
      createFixture();

    const result =
      claimPartyInvitationFromStart(
        runtime
          .partyInvitationSessions,

        101,

        "unknown-opaque-handle",
      );

    assert.deepEqual(
      result,
      {
        status:
          "invalid_invitation",
      },
    );

    if (!result) {
      throw new Error(
        "Expected invalid invitation result.",
      );
    }

    const message =
      formatPartyInvitationStartResult(
        result,
      );

    assert.equal(
      message.includes(
        "dummy-start-party-token",
      ),
      false,
    );
  },
);
