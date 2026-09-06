import type {
  Bot,
  Context,
} from "grammy";

import {
  processAgreementDraftMessage,
} from "../conversations/agreementConversation.js";

import {
  createAgreementDraftSessionStore,
} from "../conversations/agreementSession.js";

import type {
  PaiClient,
} from "../services/paiClient.js";

const AGREEMENT_PROMPT = [
  "Describe your agreement in your own words.",
  "",
  "Include whatever you already know: who is doing what, the payment, milestones, deadlines, or other important terms.",
  "",
  "Example:",
  "",
  "Sarah will design my landing page for 1,000 USDC. 500 after the first version and 500 after final delivery.",
].join("\n");

async function beginAgreement(
  ctx: Context,
  startSession:
    (
      userId: number,
    ) => void,
): Promise<void> {
  const userId =
    ctx.from?.id;

  if (!userId) {
    await ctx.reply(
      "I could not identify your Telegram account for this agreement session.",
    );

    return;
  }

  startSession(
    userId,
  );

  await ctx.reply(
    AGREEMENT_PROMPT,
  );
}

export function registerCreateAgreementHandler(
  bot: Bot,
  paiClient: PaiClient,
): void {
  const sessions =
    createAgreementDraftSessionStore();

  bot.command(
    "new",
    async (
      ctx,
    ) => {
      await beginAgreement(
        ctx,
        (
          userId,
        ) =>
          sessions.start(
            userId,
          ),
      );
    },
  );

  bot.callbackQuery(
    "agreement:create",
    async (
      ctx,
    ) => {
      await ctx.answerCallbackQuery();

      await beginAgreement(
        ctx,
        (
          userId,
        ) =>
          sessions.start(
            userId,
          ),
      );
    },
  );

  bot.on(
    "message:text",
    async (
      ctx,
    ) => {
      const userId =
        ctx.from.id;

      if (
        !sessions.has(
          userId,
        )
      ) {
        return;
      }

      try {
        const result =
          await processAgreementDraftMessage({
            userId,

            message:
              ctx.message.text,

            paiClient,

            sessions,
          });

        await ctx.reply(
          result.message,
        );
      } catch (
        error
      ) {
        console.error(
          "PAI Intelligence request failed:",
          error,
        );

        await ctx.reply(
          [
            "I could not reach PAI Intelligence.",
            "Your agreement session is still open.",
            "Please send your message again to retry.",
          ].join("\n"),
        );
      }
    },
  );
}