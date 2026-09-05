import type {
  StructureAgreement,
} from "./types.js";

/**
 * Phase 2A contract stub.
 *
 * This intentionally performs no LLM inference and no
 * financial/protocol decision-making. It exists so clients
 * can integrate against a stable intelligence API contract
 * before the model-backed implementation is introduced.
 */
export function createDeterministicAgreementStructurer():
  StructureAgreement {
  return async (
    input,
  ) => {
    return {
      status:
        "needs_clarification",

      agreement: {
        title:
          null,

        description:
          input.text,

        totalValue:
          null,

        settlementAsset:
          null,

        deadline:
          null,

        approvalWindow:
          null,

        milestones:
          [],
      },

      questions: [
        "Please confirm the payment amount, settlement asset, milestones, deadlines, and acceptance criteria.",
      ],

      risks:
        [],
    };
  };
}
