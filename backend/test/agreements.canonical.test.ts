import assert from "node:assert/strict";
import test from "node:test";

import type {
  CanonicalAgreementTerms,
} from "@pai/agreement-contract";

import {
  computeCanonicalAgreementHash,
  deriveCanonicalLifecycleStatus,
  generatePartyAccessToken,
  hashPartyAccessToken,
  serializeCanonicalAgreementTerms,
  verifyPartyAccessToken,
} from "../src/agreements/canonical.js";

const TERMS:
  CanonicalAgreementTerms = {
    title:
      "Research brief",

    description:
      "Prepare a competitor research brief.",

    totalValue:
      "1000",

    settlementAsset:
      "USDC",

    deadline:
      "2026-12-10T00:00:00.000Z",

    approvalWindow:
      "P3D",

    milestones: [
      {
        amount:
          "400",

        deliverable:
          "Competitor matrix",

        acceptanceCriteria:
          "Covers all five competitors",

        deadline:
          "2026-11-10T00:00:00.000Z",
      },

      {
        amount:
          "600",

        deliverable:
          "Final research brief",

        acceptanceCriteria:
          "Includes recommendations",

        deadline:
          "2026-12-10T00:00:00.000Z",
      },
    ],
  };

test(
  "canonical agreement hashing is deterministic and formatted as lowercase SHA-256",
  () => {
    const first =
      computeCanonicalAgreementHash(
        TERMS,
      );

    const second =
      computeCanonicalAgreementHash(
        TERMS,
      );

    assert.equal(
      first,
      second,
    );

    assert.match(
      first,
      /^0x[0-9a-f]{64}$/,
    );
  },
);

test(
  "changing a material agreement term changes the canonical hash",
  () => {
    const changed:
      CanonicalAgreementTerms = {
        ...TERMS,

        totalValue:
          "1001",
      };

    assert.notEqual(
      computeCanonicalAgreementHash(
        TERMS,
      ),
      computeCanonicalAgreementHash(
        changed,
      ),
    );
  },
);

test(
  "canonical hashing preserves milestone array order",
  () => {
    const reversed:
      CanonicalAgreementTerms = {
        ...TERMS,

        milestones:
          [...TERMS.milestones]
            .reverse(),
      };

    assert.notEqual(
      computeCanonicalAgreementHash(
        TERMS,
      ),
      computeCanonicalAgreementHash(
        reversed,
      ),
    );
  },
);

test(
  "object insertion order cannot change canonical agreement hashing",
  () => {
    const reordered =
      Object.assign(
        {},
        {
          totalValue:
            TERMS.totalValue,
        },
        {
          title:
            TERMS.title,
        },
        {
          milestones:
            TERMS.milestones,
        },
        {
          description:
            TERMS.description,
        },
        {
          settlementAsset:
            TERMS.settlementAsset,
        },
        {
          approvalWindow:
            TERMS.approvalWindow,
        },
        {
          deadline:
            TERMS.deadline,
        },
      ) as CanonicalAgreementTerms;

    assert.equal(
      computeCanonicalAgreementHash(
        TERMS,
      ),
      computeCanonicalAgreementHash(
        reordered,
      ),
    );
  },
);

test(
  "canonical serialization uses compact recursively sorted JSON",
  () => {
    const serialized =
      serializeCanonicalAgreementTerms(
        TERMS,
      );

    assert.equal(
      serialized.includes("\n"),
      false,
    );

    assert.equal(
      serialized,
      '{"approvalWindow":"P3D","deadline":"2026-12-10T00:00:00.000Z","description":"Prepare a competitor research brief.","milestones":[{"acceptanceCriteria":"Covers all five competitors","amount":"400","deadline":"2026-11-10T00:00:00.000Z","deliverable":"Competitor matrix"},{"acceptanceCriteria":"Includes recommendations","amount":"600","deadline":"2026-12-10T00:00:00.000Z","deliverable":"Final research brief"}],"settlementAsset":"USDC","title":"Research brief","totalValue":"1000"}',
    );
  },
);

test(
  "party access credentials are independent cryptographically random 32-byte tokens",
  () => {
    const clientToken =
      generatePartyAccessToken();

    const contractorToken =
      generatePartyAccessToken();

    assert.equal(
      Buffer.from(
        clientToken,
        "hex",
      ).length,
      32,
    );

    assert.equal(
      Buffer.from(
        contractorToken,
        "hex",
      ).length,
      32,
    );

    assert.notEqual(
      clientToken,
      contractorToken,
    );
  },
);

test(
  "party access credential verification accepts only the matching raw token",
  () => {
    const token =
      generatePartyAccessToken();

    const otherToken =
      generatePartyAccessToken();

    const persistedHash =
      hashPartyAccessToken(
        token,
      );

    assert.equal(
      verifyPartyAccessToken(
        token,
        persistedHash,
      ),
      true,
    );

    assert.equal(
      verifyPartyAccessToken(
        otherToken,
        persistedHash,
      ),
      false,
    );

    assert.equal(
      verifyPartyAccessToken(
        token,
        "invalid",
      ),
      false,
    );
  },
);

test(
  "canonical lifecycle requires both current acceptances before ACCEPTED",
  () => {
    assert.equal(
      deriveCanonicalLifecycleStatus([
        {
          role:
            "CLIENT",

          acceptedCurrentVersion:
            false,

          walletAddress:
            null,
        },

        {
          role:
            "CONTRACTOR",

          acceptedCurrentVersion:
            false,

          walletAddress:
            null,
        },
      ]),
      "AWAITING_ACCEPTANCE",
    );

    assert.equal(
      deriveCanonicalLifecycleStatus([
        {
          role:
            "CLIENT",

          acceptedCurrentVersion:
            true,

          walletAddress:
            null,
        },

        {
          role:
            "CONTRACTOR",

          acceptedCurrentVersion:
            false,

          walletAddress:
            null,
        },
      ]),
      "AWAITING_ACCEPTANCE",
    );

    assert.equal(
      deriveCanonicalLifecycleStatus([
        {
          role:
            "CLIENT",

          acceptedCurrentVersion:
            true,

          walletAddress:
            null,
        },

        {
          role:
            "CONTRACTOR",

          acceptedCurrentVersion:
            true,

          walletAddress:
            null,
        },
      ]),
      "ACCEPTED",
    );
  },
);

test(
  "canonical lifecycle becomes READY_TO_FUND only after both wallets are bound",
  () => {
    assert.equal(
      deriveCanonicalLifecycleStatus([
        {
          role:
            "CLIENT",

          acceptedCurrentVersion:
            true,

          walletAddress:
            "0x1111111111111111111111111111111111111111",
        },

        {
          role:
            "CONTRACTOR",

          acceptedCurrentVersion:
            true,

          walletAddress:
            null,
        },
      ]),
      "ACCEPTED",
    );

    assert.equal(
      deriveCanonicalLifecycleStatus([
        {
          role:
            "CLIENT",

          acceptedCurrentVersion:
            true,

          walletAddress:
            "0x1111111111111111111111111111111111111111",
        },

        {
          role:
            "CONTRACTOR",

          acceptedCurrentVersion:
            true,

          walletAddress:
            "0x2222222222222222222222222222222222222222",
        },
      ]),
      "READY_TO_FUND",
    );
  },
);