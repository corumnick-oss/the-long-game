/**
 * Reassigns a Gridiron's 2025 picks/trophies from their old UID to their new Firebase UID.
 *
 * Usage:
 *   npm run reassign:user -- --old BQMdo8NUOgY8n0QxdUophLPMewp2 --email cloud7king10@yahoo.com
 *
 * The script finds the new Firebase UID by looking up the user with that email
 * who is NOT the old UID, then migrates all data over.
 */
export {};
