import {
  InlineKeyboard,
  type Bot,
} from "grammy";

import {
  claimPartyInvitationFromStart,
  formatPartyInvitationStartResult,
} from "../conversations/partyInvitationStart.js";

import {
  formatAgreementAcceptanceReview,
  prepareAgreementAcceptanceReview,
} from "../conversations/partyAgreementAcceptanceUx.js";
import {
  preparePartyWalletBindingHandoff,
} from "../conversations/partyWalletBindingHandoff.js";

import { createMainMenu } from "../keyboards/mainMenu.js";

import type {
  AgreementRuntime,
} from "../runtime/agreementRuntime.js";

import type {
  PaiClient,
} from "../services/paiClient.js";

export function registerStartHandler(
  bot:
    Bot,

  paiClient:
    PaiClient,

  runtime:
    AgreementRuntime,

  frontendBaseUrl:
    string,
): void {
  bot.command(
    "start",
    async (
      ctx,
    ) => {
      const userId =
        ctx.from?.id;

      const firstName =
        ctx.from?.first_name;

      const greeting =
        firstName
          ? `Welcome to PAI, ${firstName}.`
          : "Welcome to PAI.";

      if (!userId) {
        await ctx.reply(
          "I could not identify your Telegram account.",
        );

        return;
      }

      const startPayload =
        typeof ctx.match ===
          "string"
          ? ctx.match
          : "";

      const invitationResult =
        claimPartyInvitationFromStart(
          runtime
            .partyInvitationSessions,

          userId,
          startPayload,
        );

      if (
        invitationResult
      ) {
        const invitationMessage =
          formatPartyInvitationStartResult(
            invitationResult,
          );

        if (
          invitationResult.status ===
            "claimed" ||
          invitationResult.status ===
            "already_claimed"
        ) {
          const acceptanceReview =
            await prepareAgreementAcceptanceReview(
              paiClient,
              runtime,
              userId,
              invitationResult.session,
            );

          if (
            acceptanceReview.status ===
              "failed"
          ) {
            await ctx.reply(
              [
                invitationMessage,
                "",
                "I could not load the canonical agreement for review.",
                "Please reopen this invitation and try again.",
              ].join(
                "\n",
              ),
            );

            return;
          }

          const reviewMessage =
            formatAgreementAcceptanceReview(
              acceptanceReview.review,
            );

          if (
            acceptanceReview.status ===
              "already_accepted"
          ) {
            const walletHandoff =
              await preparePartyWalletBindingHandoff(
                paiClient,
                runtime,
                frontendBaseUrl,
                invitationResult.session,
              );

            if (
              walletHandoff.status ===
                "ready"
            ) {
              const walletKeyboard =
                new InlineKeyboard()
                  .url(
                    "Connect Wallet",
                    walletHandoff.url,
                  );

              await ctx.reply(
                [
                  invitationMessage,
                  "",
                  reviewMessage,
                  "",
                  "Both parties have accepted the current agreement.",
                  "Connect your wallet in PAI to continue.",
                ].join(
                  "\n",
                ),
                {
                  reply_markup:
                    walletKeyboard,
                },
              );

              return;
            }

            if (
              walletHandoff.status ===
                "waiting_for_acceptance"
            ) {
              await ctx.reply(
                [
                  invitationMessage,
                  "",
                  reviewMessage,
                  "",
                  "Your acceptance is recorded.",
                  "Waiting for the other party to accept before wallet connection.",
                ].join(
                  "\n",
                ),
              );

              return;
            }

            if (
              walletHandoff.status ===
                "already_bound"
            ) {
              await ctx.reply(
                [
                  invitationMessage,
                  "",
                  reviewMessage,
                  "",
                  "Your wallet is already connected.",
                  `Agreement status: ${walletHandoff.lifecycleStatus}`,
                ].join(
                  "\n",
                ),
              );

              return;
            }

            if (
              walletHandoff.status ===
                "rejected"
            ) {
              await ctx.reply(
                [
                  invitationMessage,
                  "",
                  reviewMessage,
                  "",
                  "I could not create a wallet connection link right now.",
                  "Reopen this invitation to request a fresh link.",
                ].join(
                  "\n",
                ),
              );

              return;
            }

            await ctx.reply(
              [
                invitationMessage,
                "",
                reviewMessage,
                "",
                "I could not verify this party session for wallet connection.",
              ].join(
                "\n",
              ),
            );

            return;
          }

          const acceptanceKeyboard =
            new InlineKeyboard()
              .text(
                "Accept Exact Agreement",
                acceptanceReview
                  .callbackData,
              );

          await ctx.reply(
            [
              invitationMessage,
              "",
              reviewMessage,
            ].join(
              "\n",
            ),
            {
              reply_markup:
                acceptanceKeyboard,
            },
          );

          return;
        }

        await ctx.reply(
          invitationMessage,
        );

        return;
      }

      await ctx.reply(
        [
          greeting,
          "",
          "Turn a deal into a programmable agreement.",
          "",
          "Describe the deal. PAI will structure it, identify missing terms, and prepare it for both parties to review.",
        ].join(
          "\n",
        ),
        {
          reply_markup:
            createMainMenu(),
        },
      );
    },
  );
}
