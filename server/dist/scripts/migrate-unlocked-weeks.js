"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../db");
const schema = __importStar(require("../db/schema"));
const drizzle_orm_1 = require("drizzle-orm");
async function main() {
    console.log('Adding season_type column to unlocked_weeks (IF NOT EXISTS)...');
    await db_1.db.execute((0, drizzle_orm_1.sql) `
    ALTER TABLE unlocked_weeks
    ADD COLUMN IF NOT EXISTS season_type text NOT NULL DEFAULT 'regular'
  `);
    console.log('Column added (or already existed).');
    // Clear any stale 2026 unlock rows — admin will re-unlock preseason week 1
    const deleted = await db_1.db.delete(schema.unlockedWeeks)
        .where((0, drizzle_orm_1.eq)(schema.unlockedWeeks.season, 2026))
        .returning({ id: schema.unlockedWeeks.id });
    console.log(`Deleted ${deleted.length} stale unlocked_weeks rows for 2026.`);
    console.log('Done. Admin should re-unlock preseason week 1 from the NFL Tools tab.');
}
main().catch(console.error).finally(() => process.exit(0));
//# sourceMappingURL=migrate-unlocked-weeks.js.map