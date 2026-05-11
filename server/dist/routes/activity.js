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
exports.logActivity = logActivity;
const express_1 = require("express");
const db_1 = require("../db");
const schema = __importStar(require("../db/schema"));
const drizzle_orm_1 = require("drizzle-orm");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const PAGE_SIZE = 20;
// GET /api/activity?tab=global|personal&page=1
router.get('/', auth_1.requireAuth, async (req, res) => {
    const tab = req.query['tab'] ?? 'global';
    const page = Math.max(1, parseInt(req.query['page'] ?? '1', 10));
    const offset = (page - 1) * PAGE_SIZE;
    let conditions;
    if (tab === 'personal') {
        conditions = (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema.activityLog.targetUserId, req.currentUser.id), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema.activityLog.visibility, 'personal'), (0, drizzle_orm_1.eq)(schema.activityLog.visibility, 'global')));
    }
    else {
        conditions = (0, drizzle_orm_1.eq)(schema.activityLog.visibility, 'global');
    }
    const items = await db_1.db.query.activityLog.findMany({
        where: conditions,
        orderBy: [(0, drizzle_orm_1.desc)(schema.activityLog.createdAt)],
        limit: PAGE_SIZE,
        offset,
    });
    res.json({ tab, page, pageSize: PAGE_SIZE, items });
});
// Internal helper — other services call this to log events
async function logActivity(type, message, visibility, options) {
    await db_1.db.insert(schema.activityLog).values({
        type,
        message,
        visibility,
        targetUserId: options?.targetUserId ?? null,
        metadata: options?.metadata ?? null,
    });
}
exports.default = router;
//# sourceMappingURL=activity.js.map