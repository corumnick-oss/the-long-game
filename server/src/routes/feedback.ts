import { Router } from 'express';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { logActivity } from './activity';
import { sendPushToUsers } from '../services/notificationService';

const router = Router();

router.post('/', requireAuth, async (req, res) => {
  const { subject, message } = req.body as { subject?: string; message: string };

  if (!message?.trim()) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  const user = req.currentUser!;
  const fromLabel = user.teamName ?? user.email ?? user.id;

  try {
    await logActivity('feedback', `Feedback from ${fromLabel}`, 'admin', {
      targetUserId: user.id,
      metadata: {
        subject: subject?.trim() || null,
        message: message.trim(),
        userEmail: user.email,
        teamName: user.teamName,
      },
    });

    const admins = await db.query.users.findMany({ where: eq(schema.users.isAdmin, true) });
    const adminIds = admins.map(u => u.id);
    if (adminIds.length > 0) {
      const preview = message.trim().slice(0, 60);
      await sendPushToUsers(
        adminIds,
        `Feedback from ${fromLabel}`,
        subject?.trim() ? `${subject.trim()}: ${preview}` : preview,
        { type: 'feedback' },
      );
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[Feedback] Failed to save:', err?.message);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

export default router;
