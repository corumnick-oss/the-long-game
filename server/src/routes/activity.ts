import { Router } from 'express';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq, and, or, desc } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';

const router = Router();

const PAGE_SIZE = 20;

// GET /api/activity?tab=global|personal&page=1
router.get('/', requireAuth, async (req, res) => {
  const tab = (req.query['tab'] as string) ?? 'global';
  const page = Math.max(1, parseInt(req.query['page'] as string ?? '1', 10));
  const offset = (page - 1) * PAGE_SIZE;

  let conditions;
  if (tab === 'personal') {
    conditions = and(
      eq(schema.activityLog.targetUserId, req.currentUser!.id),
      or(eq(schema.activityLog.visibility, 'personal'), eq(schema.activityLog.visibility, 'global'))
    );
  } else {
    conditions = eq(schema.activityLog.visibility, 'global');
  }

  const items = await db.query.activityLog.findMany({
    where: conditions,
    orderBy: [desc(schema.activityLog.createdAt)],
    limit: PAGE_SIZE,
    offset,
  });

  res.json({ tab, page, pageSize: PAGE_SIZE, items });
});

// Internal helper — other services call this to log events
export async function logActivity(
  type: string,
  message: string,
  visibility: 'global' | 'personal' | 'admin',
  options?: { targetUserId?: string; metadata?: Record<string, unknown> }
) {
  await db.insert(schema.activityLog).values({
    type,
    message,
    visibility,
    targetUserId: options?.targetUserId ?? null,
    metadata: options?.metadata ?? null,
  });
}

export default router;
