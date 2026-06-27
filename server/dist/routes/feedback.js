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
const express_1 = require("express");
const db_1 = require("../db");
const schema = __importStar(require("../db/schema"));
const drizzle_orm_1 = require("drizzle-orm");
const auth_1 = require("../middleware/auth");
const activity_1 = require("./activity");
const notificationService_1 = require("../services/notificationService");
const router = (0, express_1.Router)();
router.post('/', auth_1.requireAuth, async (req, res) => {
    const { subject, message } = req.body;
    if (!message?.trim()) {
        res.status(400).json({ error: 'Message is required' });
        return;
    }
    const user = req.currentUser;
    const fromLabel = user.teamName ?? user.email ?? user.id;
    try {
        await (0, activity_1.logActivity)('feedback', `Feedback from ${fromLabel}`, 'admin', {
            targetUserId: user.id,
            metadata: {
                subject: subject?.trim() || null,
                message: message.trim(),
                userEmail: user.email,
                teamName: user.teamName,
            },
        });
        const admins = await db_1.db.query.users.findMany({ where: (0, drizzle_orm_1.eq)(schema.users.isAdmin, true) });
        const adminIds = admins.map(u => u.id);
        if (adminIds.length > 0) {
            const preview = message.trim().slice(0, 60);
            await (0, notificationService_1.sendPushToUsers)(adminIds, `Feedback from ${fromLabel}`, subject?.trim() ? `${subject.trim()}: ${preview}` : preview, { type: 'feedback' });
        }
        res.json({ ok: true });
    }
    catch (err) {
        console.error('[Feedback] Failed to save:', err?.message);
        res.status(500).json({ error: 'Failed to submit feedback' });
    }
});
exports.default = router;
//# sourceMappingURL=feedback.js.map