"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const nodemailer_1 = __importDefault(require("nodemailer"));
const dns_1 = require("dns");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
async function sendMail(opts) {
    const [ip] = await dns_1.promises.resolve4('smtp.gmail.com');
    const transporter = nodemailer_1.default.createTransport({
        host: ip,
        port: 587,
        secure: false,
        auth: {
            user: process.env['SMTP_USER'],
            pass: process.env['SMTP_PASS'],
        },
        tls: { servername: 'smtp.gmail.com' },
    });
    await transporter.sendMail(opts);
}
router.post('/', auth_1.requireAuth, async (req, res) => {
    const { subject, message } = req.body;
    if (!message?.trim()) {
        res.status(400).json({ error: 'Message is required' });
        return;
    }
    const user = req.currentUser;
    const fromLabel = user.teamName ?? user.email ?? user.id;
    const emailSubject = subject?.trim()
        ? `[TLG Feedback] ${subject.trim()}`
        : '[TLG Feedback] New message';
    try {
        await sendMail({
            from: `"The Long Game" <${process.env['SMTP_USER']}>`,
            to: 'nickcorum@gmail.com',
            subject: emailSubject,
            text: `From: ${fromLabel} (${user.email})\n\n${message.trim()}`,
        });
        res.json({ ok: true });
    }
    catch (err) {
        const detail = err?.message ?? String(err);
        console.error('[Feedback] Email send failed:', detail, '| SMTP_USER set:', !!process.env['SMTP_USER'], '| SMTP_PASS set:', !!process.env['SMTP_PASS']);
        res.status(500).json({ error: `Email failed: ${detail}` });
    }
});
exports.default = router;
//# sourceMappingURL=feedback.js.map