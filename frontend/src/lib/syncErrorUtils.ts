/**
 * Sync error sanitization and user-facing messages.
 * - Strips RPC URLs (and API keys) from error strings before UI or production logs.
 * - Maps common HTTP/RPC codes to human-readable messages.
 */

const REDACTED = "[RPC URL redacted]";

const URL_REGEX = /https?:\/\/[^\s"')\]]+/gi;

function stripUrls(text: string): string {
  return text.replace(URL_REGEX, REDACTED).trim();
}

function getStatus(err: unknown): number | undefined {
  const msg = err instanceof Error ? err.message : String(err);
  const match = msg.match(/\b(4\d{2}|5\d{2})\b/);
  if (match) return parseInt(match[0], 10);
  return undefined;
}

function getMethod(err: unknown): string | undefined {
  const msg = err instanceof Error ? err.message : String(err);
  const match = msg.match(/\b(get\w+|send\w+|confirm\w+)\b/i);
  return match ? match[0] : undefined;
}

function safeShortDescription(err: unknown): string {
  const status = getStatus(err);
  const method = getMethod(err);
  const parts: string[] = [];
  if (status != null) parts.push(`status ${status}`);
  if (method) parts.push(method);
  if (parts.length) return parts.join(" — ");
  const raw = err instanceof Error ? err.message : String(err);
  return stripUrls(raw) || "RPC error";
}

const USER_MESSAGES: Record<number, string> = {
  429: "Opaque is retrying…",
  500: "Network congestion. Please wait.",
};

export function getUserFacingSyncMessage(err: unknown): string {
  const status = getStatus(err);
  if (status != null && USER_MESSAGES[status]) return USER_MESSAGES[status];
  return safeShortDescription(err);
}

export function sanitizeSyncErrorForLog(err: unknown): string {
  const status = getStatus(err);
  const method = getMethod(err);
  const raw = err instanceof Error ? err.message : String(err);
  const safeMsg = stripUrls(raw);
  const parts: string[] = [];
  if (status != null) parts.push(`status=${status}`);
  if (method) parts.push(`method=${method}`);
  if (safeMsg) parts.push(safeMsg);
  return parts.length ? parts.join(" ") : "sync error (sanitized)";
}

export function sanitizeErrorForProductionLog(err: unknown): Record<string, unknown> {
  const status = getStatus(err);
  const method = getMethod(err);
  const raw = err instanceof Error ? err.message : String(err);
  const safe: Record<string, unknown> = {
    name: err instanceof Error ? err.name : "Error",
    message: stripUrls(raw),
  };
  if (status != null) safe.status = status;
  if (method) safe.method = method;
  return safe;
}

function isProduction(): boolean {
  return (
    (typeof process !== "undefined" && process.env?.NODE_ENV === "production") ||
    (typeof import.meta !== "undefined" && (import.meta.env?.PROD === true || import.meta.env?.MODE === "production"))
  );
}

export function logSyncError(err: unknown, context = "Sync failed"): void {
  if (isProduction()) {
    console.error(`[Opaque] ${context}`, sanitizeErrorForProductionLog(err));
  } else {
    console.error(`[Opaque] ${context}`, err);
  }
}
