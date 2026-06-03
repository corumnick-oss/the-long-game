import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';

import gamesRouter from './routes/games';
import picksRouter from './routes/picks';
import leaderboardRouter from './routes/leaderboard';
import usersRouter from './routes/users';
import trophiesRouter from './routes/trophies';
import activityRouter from './routes/activity';
import tiebreakerRouter from './routes/tiebreaker';
import pushTokensRouter from './routes/pushTokens';
import adminRouter from './routes/admin';
import teamsRouter from './routes/teams';

// ── Firebase Admin ────────────────────────────────────────────────────────────
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env['FIREBASE_PROJECT_ID']!,
    clientEmail: process.env['FIREBASE_CLIENT_EMAIL']!,
    privateKey: process.env['FIREBASE_PRIVATE_KEY']!.replace(/\\n/g, '\n'),
  }),
});

// ── Express App ───────────────────────────────────────────────────────────────
const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => { res.json({ ok: true, env: process.env['NODE_ENV'] }); });

app.use('/api/games',       gamesRouter);
app.use('/api/picks',       picksRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/users',       usersRouter);
app.use('/api/trophies',    trophiesRouter);
app.use('/api/activity',    activityRouter);
app.use('/api/tiebreaker',  tiebreakerRouter);
app.use('/api/push-tokens', pushTokensRouter);
app.use('/api/admin',       adminRouter);
app.use('/api/teams',       teamsRouter);

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (${process.env['NODE_ENV'] ?? 'development'})`);

  // Start scheduler unless explicitly running in local dev
  if (process.env['NODE_ENV'] !== 'development') {
    import('./services/scheduler').catch(console.error);
  }
});

export default app;
