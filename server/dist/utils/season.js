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
exports.getCurrentNFLSeason = getCurrentNFLSeason;
exports.getCurrentNFLWeek = getCurrentNFLWeek;
exports.isPreseasonMode = isPreseasonMode;
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
function getCurrentNFLSeason() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    return month >= 9 ? year : year - 1;
}
async function getCurrentNFLWeek() {
    const setting = await db_1.db.query.appSettings.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_1.appSettings.key, 'currentWeek'),
    });
    if (setting)
        return parseInt(setting.value, 10);
    // Derive from most recent game data
    const { games } = await Promise.resolve().then(() => __importStar(require('../db/schema')));
    const { desc, and } = await Promise.resolve().then(() => __importStar(require('drizzle-orm')));
    const season = getCurrentNFLSeason();
    const now = new Date();
    const game = await db_1.db.query.games.findFirst({
        where: and((0, drizzle_orm_1.eq)(games.season, season), (0, drizzle_orm_1.eq)(games.sport, 'nfl')),
        orderBy: [desc(games.week)],
    });
    return game?.week ?? 1;
}
async function isPreseasonMode() {
    const setting = await db_1.db.query.appSettings.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_1.appSettings.key, 'preseasonMode'),
    });
    return setting?.value === 'true';
}
//# sourceMappingURL=season.js.map