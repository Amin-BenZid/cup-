import type { TranslationKey } from "@/lib/i18n/translations";

/**
 * API responses carry an English `error` for logs and a stable `code`.
 * Screens show the translated text for the code, never the raw English.
 */
const BY_CODE: Record<string, TranslationKey> = {
  INVALID_CREDENTIALS: "login.error.invalid",
  TOO_MANY_ATTEMPTS: "login.error.tooMany",
  NAME_REQUIRED: "setup.error.nameRequired",
  PIN_LENGTH: "setup.error.pinLength",
  INVALID_NUMBER: "order.error.number",
  INVALID_PHONE: "order.error.phone",
  DUPLICATE_ORDER_NUMBER: "order.error.duplicate",
  FILE_TYPE: "logo.error.type",
  FILE_TOO_LARGE: "logo.error.size",
};

type T = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function apiErrorText(t: T, json: unknown, fallback: TranslationKey): string {
  const code = (json as { code?: unknown } | null)?.code;
  const key = typeof code === "string" ? BY_CODE[code] : undefined;
  return t(key ?? fallback);
}
