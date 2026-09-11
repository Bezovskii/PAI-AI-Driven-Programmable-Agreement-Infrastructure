import assert from "node:assert/strict";
import test from "node:test";

import {
  createAgreementRuntime,
} from "../src/runtime/agreementRuntime.js";

test(
  "agreement runtime shares one credential vault with invitation sessions",
  () => {
    const runtime =
      createAgreementRuntime({
        generateHandle:
          () =>
            "opaque-runtime-handle",
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
              "dummy-runtime-party-token",
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
        "Expected invitation to be claimed.",
      );
    }

    assert.equal(
      claim.session
        .agreementId,
      "agreement-1",
    );

    assert.equal(
      claim.session
        .partyId,
      "party-client",
    );

    assert.equal(
      claim.session
        .role,
      "CLIENT",
    );

    assert.equal(
      JSON.stringify(
        claim,
      ).includes(
        "dummy-runtime-party-token",
      ),
      false,
    );
  },
);
