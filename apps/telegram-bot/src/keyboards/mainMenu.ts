import { InlineKeyboard } from "grammy";

export function createMainMenu(): InlineKeyboard {
  return new InlineKeyboard().text(
    "Create Agreement",
    "agreement:create",
  );
}
