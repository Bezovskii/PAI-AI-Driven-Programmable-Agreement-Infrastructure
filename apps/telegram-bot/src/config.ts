import "dotenv/config";

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const config = {
  telegramBotToken: requireEnvironmentVariable("TELEGRAM_BOT_TOKEN"),
} as const;
