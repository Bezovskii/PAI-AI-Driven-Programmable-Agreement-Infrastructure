import type { Bot } from "grammy";
import { createMainMenu } from "../keyboards/mainMenu.js";

export function registerStartHandler(bot: Bot): void {
  bot.command("start", async (ctx) => {
    const firstName = ctx.from?.first_name;

    const greeting = firstName
      ? `Welcome to PAI, ${firstName}.`
      : "Welcome to PAI.";

    await ctx.reply(
      [
        greeting,
        "",
        "Turn a deal into a programmable agreement.",
        "",
        "Describe the deal. PAI will structure it, identify missing terms, and prepare it for both parties to review.",
      ].join("\n"),
      {
        reply_markup: createMainMenu(),
      },
    );
  });
}
