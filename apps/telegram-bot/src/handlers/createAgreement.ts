import type { Bot, Context } from "grammy";

const AGREEMENT_PROMPT = [
  "Describe your agreement in your own words.",
  "",
  "Include whatever you already know: who is doing what, the payment, milestones, deadlines, or other important terms.",
  "",
  "Example:",
  "",
  "Sarah will design my landing page for 1,000 USDC. 500 after the first version and 500 after final delivery.",
].join("\n");

async function promptForAgreement(ctx: Context): Promise<void> {
  await ctx.reply(AGREEMENT_PROMPT);
}

export function registerCreateAgreementHandler(bot: Bot): void {
  bot.command("new", async (ctx) => {
    await promptForAgreement(ctx);
  });

  bot.callbackQuery("agreement:create", async (ctx) => {
    await ctx.answerCallbackQuery();
    await promptForAgreement(ctx);
  });
}
