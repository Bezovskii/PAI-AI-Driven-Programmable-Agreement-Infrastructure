import {
  InlineKeyboard,
  type Bot,
  type Context,
} from "grammy";

import {
  processAgreementDraftMessage,
} from "../conversations/agreementConversation.js";

import {
  createAgreementDraftSessionStore,
} from "../conversations/agreementSession.js";

import type {
  AgreementRuntime,
} from "../runtime/agreementRuntime.js";

import {
  persistReviewedAgreementForTelegram,
} from "../conversations/canonicalAgreementCreation.js";

import {
  buildPartyInvitationDeepLinks,
  formatPartyInvitationDeepLinks,
} from "../conversations/partyInvitationLink.js";

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
  runtime: AgreementRuntime,
): void {
  const sessions =
    createAgreementDraftSessionStore();

  const {
    flowSessions,
    credentialVault,
  } =
    runtime;

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

  bot.callbackQuery(
    "agreement:confirm-create",
    async (
      ctx,
    ) => {
      await ctx.answerCallbackQuery();

      const userId =
        ctx.from.id;

      const reviewedTerms =
        flowSessions
          .getPendingReview(
            userId,
          );

      if (!reviewedTerms) {
        await ctx.reply(
          [
            "This agreement review is no longer available.",
            "Use /new to start a new agreement.",
          ].join("\n"),
        );

        return;
      }

      try {
        const canonicalSession =
          await persistReviewedAgreementForTelegram({
            userId,

            terms:
              reviewedTerms,

            paiClient,

            flowSessions,

            credentialVault,
          });

        const reference =
          canonicalSession.reference;

        const hash =
          reference.agreementHash;

        const shortHash =
          hash.length > 18
            ? `${hash.slice(0, 10)}...${hash.slice(-8)}`
            : hash;

        const invitationLinks =
          buildPartyInvitationDeepLinks(
            ctx.me.username,
            canonicalSession.parties,
          );

        await ctx.reply(
          [
            "Agreement created.",
            "",
            `Agreement: ${reference.agreementId}`,
            `Version: ${reference.agreementVersion}`,
            `Hash: ${shortHash}`,
            "",
            "CLIENT: Waiting for acceptance",
            "CONTRACTOR: Waiting for acceptance",
            "",
            "Share the correct invitation with each party:",
            "",
            formatPartyInvitationDeepLinks(
              invitationLinks,
            ),
          ].join("\n"),
        );
      } catch {
        await ctx.reply(
          [
            "I could not create the canonical agreement.",
            "Your reviewed agreement is still available.",
            "Please try Confirm & Create again.",
          ].join("\n"),
        );
      }
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

        if (
          result.reviewedTerms
        ) {
          flowSessions.setPendingReview(
            userId,
            result.reviewedTerms,
          );

          const reviewKeyboard =
            new InlineKeyboard()
              .text(
                "Confirm & Create",
                "agreement:confirm-create",
              );

          await ctx.reply(
            result.message,
            {
              reply_markup:
                reviewKeyboard,
            },
          );

          return;
        }

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