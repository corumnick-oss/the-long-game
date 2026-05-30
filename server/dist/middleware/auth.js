"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.optionalAuth = optionalAuth;
exports.requireAdmin = requireAdmin;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
require("../types");
async function requireAuth(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    try {
        const decoded = await firebase_admin_1.default.auth().verifyIdToken(token);
        req.uid = decoded.uid;
        const user = await db_1.db.query.users.findFirst({ where: (0, drizzle_orm_1.eq)(schema_1.users.id, decoded.uid) });
        if (!user) {
            res.status(403).json({ error: 'User not found — sign up first' });
            return;
        }
        req.currentUser = user;
        next();
    }
    catch {
        res.status(401).json({ error: 'Invalid token' });
    }
}
async function optionalAuth(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        next();
        return;
    }
    try {
        const decoded = await firebase_admin_1.default.auth().verifyIdToken(token);
        req.uid = decoded.uid;
        const user = await db_1.db.query.users.findFirst({ where: (0, drizzle_orm_1.eq)(schema_1.users.id, decoded.uid) });
        if (user)
            req.currentUser = user;
        else
            console.warn('[optionalAuth] token verified but no DB user for uid:', decoded.uid);
    }
    catch (err) {
        console.error('[optionalAuth] token verification failed:', err?.message ?? err);
    }
    next();
}
function requireAdmin(req, res, next) {
    if (!req.currentUser?.isAdmin) {
        res.status(403).json({ error: 'Admin only' });
        return;
    }
    next();
}
//# sourceMappingURL=auth.js.map