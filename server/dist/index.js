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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const games_1 = __importDefault(require("./routes/games"));
const picks_1 = __importDefault(require("./routes/picks"));
const leaderboard_1 = __importDefault(require("./routes/leaderboard"));
const users_1 = __importDefault(require("./routes/users"));
const trophies_1 = __importDefault(require("./routes/trophies"));
const activity_1 = __importDefault(require("./routes/activity"));
const tiebreaker_1 = __importDefault(require("./routes/tiebreaker"));
const pushTokens_1 = __importDefault(require("./routes/pushTokens"));
const admin_1 = __importDefault(require("./routes/admin"));
const teams_1 = __importDefault(require("./routes/teams"));
const feedback_1 = __importDefault(require("./routes/feedback"));
const exports_1 = __importDefault(require("./routes/exports"));
// ── Firebase Admin ────────────────────────────────────────────────────────────
firebase_admin_1.default.initializeApp({
    credential: firebase_admin_1.default.credential.cert({
        projectId: process.env['FIREBASE_PROJECT_ID'],
        clientEmail: process.env['FIREBASE_CLIENT_EMAIL'],
        privateKey: process.env['FIREBASE_PRIVATE_KEY'].replace(/\\n/g, '\n'),
    }),
});
// ── Express App ───────────────────────────────────────────────────────────────
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/health', (req, res) => { res.json({ ok: true, env: process.env['NODE_ENV'] }); });
app.use('/api/games', games_1.default);
app.use('/api/picks', picks_1.default);
app.use('/api/leaderboard', leaderboard_1.default);
app.use('/api/users', users_1.default);
app.use('/api/trophies', trophies_1.default);
app.use('/api/activity', activity_1.default);
app.use('/api/tiebreaker', tiebreaker_1.default);
app.use('/api/push-tokens', pushTokens_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/teams', teams_1.default);
app.use('/api/feedback', feedback_1.default);
app.use('/api/exports', exports_1.default);
// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('[Error]', err.message);
    res.status(500).json({ error: 'Internal server error' });
});
// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (${process.env['NODE_ENV'] ?? 'development'})`);
    // Start scheduler unless explicitly running in local dev
    if (process.env['NODE_ENV'] !== 'development') {
        Promise.resolve().then(() => __importStar(require('./services/scheduler'))).catch(console.error);
    }
});
exports.default = app;
//# sourceMappingURL=index.js.map