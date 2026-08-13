"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// One-off catch-up for a week whose Wednesday 9PM lock cron fired on the buggy
// getCurrentWeekAndType() (before the Aug 12 2026 unlocked_weeks-based fix) and so
// silently ran against the wrong (empty) week instead. Applies default picks and sends
// the proof-of-picks email for the given week, same as the real cron does post-lock.
const scheduler_js_1 = require("../services/scheduler.js");
const emailService_js_1 = require("../services/emailService.js");
async function main() {
    const week = parseInt(process.argv[2] ?? '', 10);
    const season = parseInt(process.argv[3] ?? '2026', 10);
    const seasonType = process.argv[4] ?? 'preseason';
    if (!week) {
        console.error('Usage: npm run backfill:week-lock -- <week> <season> <seasonType>');
        process.exit(1);
    }
    console.log(`Backfilling lock actions: week=${week} season=${season} seasonType=${seasonType}...`);
    await (0, scheduler_js_1.applyDefaultPicks)(week, season, seasonType);
    const sent = await (0, emailService_js_1.sendWeeklyPicksEmails)(week, season, seasonType);
    console.log(`Done. Sent ${sent} weekly picks emails.`);
    process.exit(0);
}
main().catch(err => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
//# sourceMappingURL=backfill-week-lock.js.map