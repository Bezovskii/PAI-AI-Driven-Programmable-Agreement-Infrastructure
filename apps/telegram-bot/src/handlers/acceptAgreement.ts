import {
  InlineKeyboard,
  type Bot,
} from "grammy";

import {
  executeAgreementAcceptanceAction,
  formatAcceptedAgreementResult,
} from "../conversations/partyAgreementAcceptanceUx.js";

import {
  preparePartyWalletBindingHandoff,
} from "../conversations/partyWalletBindingHandoff.js";

import type {
  AgreementRuntime,
} from "../runtime/agreementRuntime.js";

import type {
  PaiClient,
} from "../services/paiClient.js";

export function registerAgreementAcceptanceHandler(
  bot:
    Bot,

  paiClient:
    PaiClient,

  runtime:
    AgreementRuntime,

  frontendBaseUrl:
    string,
): void {
  bot.callbackQuery(
    /^pai_accept:/,
    async (
      ctx,
    ) => {
      const userId =
        ctx.from?.id;

      await ctx
        .answerCallbackQuery();

      if (!userId) {
        await ctx.reply(
          "I could not identify your Telegram account.",
        );

        return;
      }

      const result =
        await executeAgreementAcceptanceAction(
          paiClient,
          runtime,
          userId,
          ctx.callbackQuery.data,
        );

      switch (
        result.status
      ) {
        case "accepted": {
          const acceptedMessage =
            formatAcceptedAgreementResult(
              result.result,
            );

          const lifecycle =
            result.result.lifecycle;

          if (
            !lifecycle
              .acceptanceComplete
          ) {
            await ctx.reply(
              acceptedMessage,
            );

            return;
          }

          const session =
            runtime
              .partyInvitationSessions
              .get(
                userId,
                lifecycle
                  .reference
                  .agreementId,
              );

          if (!session) {
            await ctx.reply(
              [
                acceptedMessage,
                "",
                "Both parties have accepted the current agreement.",
                "Reopen your invitation to continue with wallet connection.",
              ].join(
                "\n",
              ),
            );

            return;
          }

          const walletHandoff =
            await preparePartyWalletBindingHandoff(
              paiClient,
              runtime,
              frontendBaseUrl,
              session,
              lifecycle,
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
                acceptedMessage,
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
              "already_bound"
          ) {
            await ctx.reply(
              [
                acceptedMessage,
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
              "waiting_for_acceptance"
          ) {
            await ctx.reply(
              [
                acceptedMessage,
                "",
                "Waiting for the other party to accept before wallet connection.",
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
                acceptedMessage,
                "",
                "Both parties have accepted the current agreement.",
                "I could not create a wallet connection link right now.",
                "Reopen your invitation to request a fresh link.",
              ].join(
                "\n",
              ),
            );

            return;
          }

          await ctx.reply(
            [
              acceptedMessage,
              "",
              "Both parties have accepted the current agreement.",
              "I could not verify this party session for wallet connection.",
              "Reopen your invitation to continue.",
            ].join(
              "\n",
            ),
          );

          return;
        }

        case "stale":
          await ctx.reply(
            [
              "This agreement changed after you reviewed it.",
              "",
              "Nothing was accepted.",
              "Open your invitation again to review the current version before accepting.",
            ].join(
              "\n",
            ),
          );

          return;

        case "failed":
          await ctx.reply(
            [
              "I could not record this acceptance.",
              "",
              "Nothing was accepted.",
              "Open your invitation again and review the current agreement before retrying.",
            ].join(
              "\n",
            ),
          );

          return;
      }
    },
  );
}
