import { Router } from 'express';
import nodemailer from 'nodemailer';
import { requireAuth } from '../middleware/auth';

const router = Router();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env['SMTP_USER'],
    pass: process.env['SMTP_PASS'],
  },
});

router.post('/', requireAuth, async (req, res) => {
  const { subject, message } = req.body as { subject?: string; message: string };

  if (!message?.trim()) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  const user = req.currentUser!;
  const fromLabel = user.teamName ?? user.email ?? user.id;
  const emailSubject = subject?.trim()
    ? `[TLG Feedback] ${subject.trim()}`
    : '[TLG Feedback] New message';

  try {
    await transporter.sendMail({
      from: `"The Long Game" <${process.env['SMTP_USER']}>`,
      to: 'nickcorum@gmail.com',
      subject: emailSubject,
      text: `From: ${fromLabel} (${user.email})\n\n${message.trim()}`,
    });
    res.json({ ok: true });
  } catch (err: any) {
    const detail = err?.message ?? String(err);
    console.error('[Feedback] Email send failed:', detail, '| SMTP_USER set:', !!process.env['SMTP_USER'], '| SMTP_PASS set:', !!process.env['SMTP_PASS']);
    res.status(500).json({ error: `Email failed: ${detail}` });
  }
});

export default router;
