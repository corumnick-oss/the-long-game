import { Router } from 'express';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';

const router = Router();

// POST /api/push-tokens
router.post('/', requireAuth, async (req, res) => {
  const { token, platform } = req.body as { token: string; platform: 'ios' | 'android' };

  if (!token || !platform || !['ios', 'android'].includes(platform)) {
    res.status(400).json({ error: 'token and platform (ios|android) required' });
    return;
  }

  await db.insert(schema.pushTokens).values({
    userId: req.currentUser!.id,
    token,
    platform,
  }).onConflictDoUpdate({
    target: schema.pushTokens.token,
    set: { userId: req.currentUser!.id, updatedAt: new Date() },
  });

  res.status(204).send();
});

// DELETE /api/push-tokens/:token
router.delete('/:token', requireAuth, async (req, res) => {
  await db.delete(schema.pushTokens).where(
    and(eq(schema.pushTokens.token, req.params['token']!), eq(schema.pushTokens.userId, req.currentUser!.id))
  );
  res.status(204).send();
});

export default router;
