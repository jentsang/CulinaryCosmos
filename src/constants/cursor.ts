/**
 * Cursor Cloud Agents API configuration
 * API key: set NEXT_PUBLIC_CURSOR_API_KEY in .env (get from cursor.com/dashboard → Integrations)
 */

export const CURSOR_API_BASE = "https://api.cursor.com";

/** Model ID for Composer 1.5 (Cursor's agentic coding model) */
export const COMPOSER_1_5_MODEL = "composer-1.5";

export function getCursorApiKey(): string | undefined {
  return typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_CURSOR_API_KEY as string | undefined)
    : undefined;
}
