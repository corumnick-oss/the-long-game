import type { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import '../types';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.uid = decoded.uid;

    const user = await db.query.users.findFirst({ where: eq(users.id, decoded.uid) });
    if (!user) {
      res.status(403).json({ error: 'User not found — sign up first' });
      return;
    }
    req.currentUser = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { next(); return; }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.uid = decoded.uid;
    const user = await db.query.users.findFirst({ where: eq(users.id, decoded.uid) });
    if (user) req.currentUser = user;
    else console.warn('[optionalAuth] token verified but no DB user for uid:', decoded.uid);
  } catch (err: any) {
    console.error('[optionalAuth] token verification failed:', err?.message ?? err);
  }
  next();
}

// For endpoints that create the user record — verifies Firebase token but doesn't require DB user yet
export async function requireFirebaseToken(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.uid = decoded.uid;
    const user = await db.query.users.findFirst({ where: eq(users.id, decoded.uid) });
    if (user) req.currentUser = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.currentUser?.isAdmin) {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  next();
}
