import {
  Bot,
  GrammyError,
  HttpError,
} from "grammy";

import { config } from "./config.js";
import { registerCreateAgreementHandler } from "./handlers/createAgreement.js";
import { registerStartHandler } from "./handlers/start.js";

export function createBot(): Bot {
  const bot = new Bot(config.telegramBotToken);

  registerStartHandler(bot);
  registerCreateAgreementHandler(bot);

  bot.catch((error) => {
    console.error(
      `Telegram bot error while handling update ${error.ctx.update.update_id}`,
    );

    const cause = error.error;

    if (cause instanceof GrammyError) {
      console.error("Telegram API error:", cause.description);
      return;
    }

    if (cause instanceof HttpError) {
      console.error("Telegram network error:", cause);
      return;
    }

    console.error("Unexpected bot error:", cause);
  });

  return bot;
}
