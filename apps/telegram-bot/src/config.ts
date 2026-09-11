import "dotenv/config";

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const config = {
  telegramBotToken:
    requireEnvironmentVariable(
      "TELEGRAM_BOT_TOKEN",
    ),

  paiApiBaseUrl:
    requireEnvironmentVariable(
      "PAI_API_BASE_URL",
    ),

  paiFrontendBaseUrl:
    requireEnvironmentVariable(
      "PAI_FRONTEND_BASE_URL",
    ),

  paiTelegramServiceToken:
    requireEnvironmentVariable(
      "PAI_TELEGRAM_SERVICE_TOKEN",
    ),
} as const;
