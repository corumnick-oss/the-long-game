"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Flips the app out of preseason and into the regular season.
//
//   npm run season:regular          -> sets app_settings.forceRegularSeason = 'true'
//   npm run season:regular -- off   -> sets it back to 'false' (undo)
//
// With the flag on, getCurrentWeekAndType() reports the regular season (Week 1 until a later
// week is unlocked) even before Week 1 has been unlocked or the first game has kicked off, so
// every screen defaults to regular-season Week 1. Picks for a week still only open once that
// week is actually unlocked (Admin -> NFL Tools -> Unlock Week), so this is display-only until
// then. Safe to leave on permanently -- it's a no-op once the season truly starts.
const db_1 = require("../db");
const schema_1 = require("../db/schema");
async function main() {
    const off = (process.argv[2] ?? '').toLowerCase() === 'off';
    const value = off ? 'false' : 'true';
    await db_1.db.insert(schema_1.appSettings)
        .values({ key: 'forceRegularSeason', value, updatedAt: new Date() })
        .onConflictDoUpdate({ target: schema_1.appSettings.key, set: { value, updatedAt: new Date() } });
    console.log(`app_settings.forceRegularSeason = '${value}'`);
    process.exit(0);
}
main().catch(err => {
    console.error('Failed:', err);
    process.exit(1);
});
//# sourceMappingURL=set-regular-season.js.map