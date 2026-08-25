import { Resend } from 'resend';
import { db } from '../db';
import * as schema from '../db/schema';
import { eq, and, inArray, asc } from 'drizzle-orm';
import { getWeekLockTime } from '../utils/lockTime';

// Shared sender until a custom domain is verified in Resend -- swap FROM_ADDRESS once one is.
const FROM_ADDRESS = process.env['EMAIL_FROM'] ?? 'The Long Game <onboarding@resend.dev>';

function getClient(): Resend | null {
  const key = process.env['RESEND_API_KEY'];
  if (!key) return null;
  return new Resend(key);
}

type PickRow = {
  awayTeam: string;
  homeTeam: string;
  awayTeamLogo: string | null;
  homeTeamLogo: string | null;
  pickedTeam: string;
  pickedHome: boolean;
  gameTime: Date | null;
};

function formatGameTime(d: Date | null): string {
  if (!d) return '';
  return new Date(d).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles',
  }) + ' PT';
}

function formatLockTime(d: Date): string {
  return d.toLocaleString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles',
  }) + ' PT';
}

function buildEmailHtml(teamName: string, weekLabel: string, season: number, picks: PickRow[], lockTimeText: string): string {
  const rows = picks.map(p => `
    <tr>
      <td style="padding:14px 16px;border-bottom:1px solid #2a2a2a;">
        <div style="color:#9ca3af;font-size:12px;margin-bottom:4px;">${formatGameTime(p.gameTime)}</div>
        <div style="color:#ffffff;font-size:14px;">
          <span style="${p.pickedHome ? 'color:#6b7280;' : 'color:#ffffff;font-weight:600;'}">${p.awayTeam}</span>
          <span style="color:#6b7280;"> @ </span>
          <span style="${p.pickedHome ? 'color:#ffffff;font-weight:600;' : 'color:#6b7280;'}">${p.homeTeam}</span>
        </div>
      </td>
    </tr>
  `).join('');

  return `
<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a2a;">
          <tr>
            <td style="padding:24px 20px 16px;text-align:center;border-bottom:1px solid #2a2a2a;">
              <div style="color:#3b82f6;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">The Long Game</div>
              <div style="color:#ffffff;font-size:20px;font-weight:700;">${weekLabel} Picks</div>
              <div style="color:#9ca3af;font-size:13px;margin-top:4px;">${season} Season · ${teamName}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 4px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${rows}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 20px;text-align:center;">
              <div style="color:#9ca3af;font-size:12px;">
                This is your official record of picks for ${weekLabel.toLowerCase()}, locked at ${lockTimeText}.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const DUMMY_PICKS: PickRow[] = [
  { awayTeam: 'Dallas Cowboys', homeTeam: 'Seattle Seahawks', awayTeamLogo: null, homeTeamLogo: null, pickedTeam: 'Dallas Cowboys', pickedHome: false, gameTime: new Date('2026-08-15T17:00:00Z') },
  { awayTeam: 'Philadelphia Eagles', homeTeam: 'Baltimore Ravens', awayTeamLogo: null, homeTeamLogo: null, pickedTeam: 'Baltimore Ravens', pickedHome: true, gameTime: new Date('2026-08-15T23:00:00Z') },
  { awayTeam: 'Los Angeles Rams', homeTeam: 'Kansas City Chiefs', awayTeamLogo: null, homeTeamLogo: null, pickedTeam: 'Kansas City Chiefs', pickedHome: true, gameTime: new Date('2026-08-16T00:00:00Z') },
  { awayTeam: 'Green Bay Packers', homeTeam: 'Pittsburgh Steelers', awayTeamLogo: null, homeTeamLogo: null, pickedTeam: 'Green Bay Packers', pickedHome: false, gameTime: new Date('2026-08-16T02:30:00Z') },
];

// Preview/testing only — sends the real template with made-up picks so the design can be
// checked without needing real locked-in data for the current week.
export async function sendPreviewEmail(toEmail: string, teamName = 'Preview'): Promise<{ ok: boolean; error?: string }> {
  const client = getClient();
  if (!client) return { ok: false, error: 'RESEND_API_KEY not set' };

  const { error } = await client.emails.send({
    from: FROM_ADDRESS,
    to: toEmail,
    subject: 'Preview: Your Preseason Week 2 picks — The Long Game',
    html: buildEmailHtml(teamName, 'Preseason Week 2', 2026, DUMMY_PICKS, 'Tuesday, Aug 11 at 11:59 PM PT'),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Sends every user their locked-in picks for the week as a proof-of-record email.
// Called right after picks lock (and after default picks are applied), so it reflects
// each user's final state including any auto-assigned picks.
export async function sendWeeklyPicksEmails(week: number, season: number, seasonType: 'regular' | 'preseason', onlyUserId?: string): Promise<number> {
  const client = getClient();
  if (!client) {
    console.warn('[Email] RESEND_API_KEY not set — skipping weekly picks email');
    return 0;
  }

  const weekGames = await db.query.games.findMany({
    where: and(eq(schema.games.week, week), eq(schema.games.season, season), eq(schema.games.seasonType, seasonType), eq(schema.games.sport, 'nfl')),
    orderBy: [asc(schema.games.gameTime)],
  });
  if (weekGames.length === 0) return 0;

  const gameMap = new Map(weekGames.map(g => [g.id, g]));
  const gameIds = weekGames.map(g => g.id);

  const [allUsersRaw, allPicks] = await Promise.all([
    db.query.users.findMany({ where: eq(schema.users.nflAccess, true) }),
    db.query.picks.findMany({ where: inArray(schema.picks.gameId, gameIds) }),
  ]);
  const allUsers = onlyUserId ? allUsersRaw.filter(u => u.id === onlyUserId) : allUsersRaw;

  const picksByUser = new Map<string, typeof allPicks>();
  for (const p of allPicks) {
    if (!picksByUser.has(p.userId)) picksByUser.set(p.userId, []);
    picksByUser.get(p.userId)!.push(p);
  }

  const weekLabel = seasonType === 'preseason' ? `Preseason Week ${week}` : `Week ${week}`;
  const lockTime = await getWeekLockTime(week, season, seasonType);
  const lockTimeText = lockTime ? formatLockTime(lockTime) : '11:59 PM PT';
  let sent = 0;

  for (const user of allUsers) {
    const userPicks = picksByUser.get(user.id) ?? [];
    if (userPicks.length === 0) continue; // nothing to send proof of

    const rows: PickRow[] = userPicks
      .map(p => {
        const g = gameMap.get(p.gameId)!;
        return {
          awayTeam: g.awayTeam, homeTeam: g.homeTeam,
          awayTeamLogo: g.awayTeamLogo, homeTeamLogo: g.homeTeamLogo,
          pickedTeam: p.pick === 'home' ? g.homeTeam : g.awayTeam,
          pickedHome: p.pick === 'home',
          gameTime: g.gameTime,
        };
      })
      .sort((a, b) => (a.gameTime?.getTime() ?? 0) - (b.gameTime?.getTime() ?? 0));

    try {
      // The Resend SDK returns API errors as { error } instead of throwing -- a rejected
      // send resolves normally, so this must be checked explicitly or a 403/422/etc gets
      // silently counted as delivered.
      const { error } = await client.emails.send({
        from: FROM_ADDRESS,
        to: user.email,
        subject: `Your ${weekLabel} picks — The Long Game`,
        html: buildEmailHtml(user.teamName, weekLabel, season, rows, lockTimeText),
      });
      if (error) {
        console.error(`[Email] Resend rejected send to ${user.email}:`, error);
        continue;
      }
      sent++;
    } catch (err) {
      console.error(`[Email] failed to send weekly picks email to ${user.email}:`, err);
    }
  }

  console.log(`[Email] Sent ${sent}/${allUsers.length} weekly picks emails for ${seasonType} week ${week}`);
  return sent;
}
