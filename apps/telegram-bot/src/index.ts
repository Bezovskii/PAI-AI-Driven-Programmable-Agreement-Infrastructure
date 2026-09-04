import { createBot } from "./bot.js";

const bot = createBot();

await bot.api.setMyCommands([
  {
    command: "start",
    description: "Open PAI",
  },
  {
    command: "new",
    description: "Create an agreement",
  },
]);

bot.start({
  onStart: (botInfo) => {
    console.log(`PAI Telegram bot started as @${botInfo.username}`);
  },
});

process.once("SIGINT", () => {
  void bot.stop();
});

process.once("SIGTERM", () => {
  void bot.stop();
});
