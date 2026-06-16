/**
 * sync-2026-local.ts
 * Run: npm run sync:2026
 *
 * Fetches the 2026 NFL schedule from ESPN (local machine — no ESPN block),
 * then upserts games directly into the Railway PostgreSQL database.
 * Safe to re-run; uses espnId as upsert key.
 */
export {};
