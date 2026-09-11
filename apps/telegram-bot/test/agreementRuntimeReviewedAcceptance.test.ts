import assert from "node:assert/strict";
import test from "node:test";

import {
  createAgreementRuntime,
} from "../src/runtime/agreementRuntime.js";

test(
  "agreement runtime owns the shared reviewed acceptance action store",
  () => {
    const runtime =
      createAgreementRuntime({
        generateHandle:
          () =>
            "opaque-invitation",

        generateAcceptanceActionHandle:
          () =>
            "opaque-acceptance-action",
      });

    const actionHandle =
      runtime
        .reviewedAcceptanceActions
        .create({
          telegramUserId:
            101,

          invitationHandle:
            "opaque-invitation",

          agreementId:
            "agreement-1",

          partyId:
            "party-client",

          role:
            "CLIENT",

          expectedAgreementVersion:
            3,

          expectedAgreementHash:
            "canonical-hash-v3",
        });

    assert.equal(
      actionHandle,
      "opaque-acceptance-action",
    );

    assert.deepEqual(
      runtime
        .reviewedAcceptanceActions
        .resolve(
          actionHandle,
        ),
      {
        telegramUserId:
          101,

        invitationHandle:
          "opaque-invitation",

        agreementId:
          "agreement-1",

        partyId:
          "party-client",

        role:
          "CLIENT",

        expectedAgreementVersion:
          3,

        expectedAgreementHash:
          "canonical-hash-v3",
      },
    );
  },
);
