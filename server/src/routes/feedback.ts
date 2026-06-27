import { Router } from 'express';
import nodemailer from 'nodemailer';
import { promises as dns } from 'dns';
import { requireAuth } from '../middleware/auth';

const router = Router();

async function sendMail(opts: nodemailer.SendMailOptions): Promise<void> {
  const [ip] = await dns.resolve4('smtp.gmail.com');
  const transporter = nodemailer.createTransport({
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
    await sendMail({
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
