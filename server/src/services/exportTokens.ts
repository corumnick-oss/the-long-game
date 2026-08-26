// Short-lived, single-use tokens for admin CSV export links opened in a system browser
// (which can't carry a Firebase Bearer header). Minted via an authenticated admin request,
// then embedded in a plain URL the admin opens outside the app.

type ExportPayload = { week: number; season: number; seasonType: string };

const TTL_MS = 5 * 60 * 1000;
const tokens = new Map<string, { payload: ExportPayload; expiresAt: number }>();

export function createExportToken(payload: ExportPayload): string {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  tokens.set(token, { payload, expiresAt: Date.now() + TTL_MS });
  return token;
}

export function consumeExportToken(token: string): ExportPayload | null {
  const entry = tokens.get(token);
  if (!entry) return null;
  tokens.delete(token); // single-use
  if (Date.now() > entry.expiresAt) return null;
  return entry.payload;
}
