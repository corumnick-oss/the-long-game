"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlockedWeeks = exports.pickAuditLog = exports.appSettings = exports.weekSettings = exports.tiebreakerPicks = exports.tiebreakerGames = exports.pushTokens = exports.activityLog = exports.playerStats = exports.teamGameStats = exports.seasonTrophies = exports.trophies = exports.picks = exports.games = exports.users = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.text)('id').primaryKey(),
    email: (0, pg_core_1.text)('email').notNull(),
    teamName: (0, pg_core_1.text)('team_name').notNull(),
    isAdmin: (0, pg_core_1.boolean)('is_admin').notNull().default(false),
    isGridiron: (0, pg_core_1.boolean)('is_gridiron').notNull().default(false),
    isPremium: (0, pg_core_1.boolean)('is_premium').notNull().default(false),
    nflAccess: (0, pg_core_1.boolean)('nfl_access').notNull().default(true),
    profileImageUrl: (0, pg_core_1.text)('profile_image_url'),
    notifyWeekUnlocked: (0, pg_core_1.boolean)('notify_week_unlocked').notNull().default(true),
    notifyWeekLocked: (0, pg_core_1.boolean)('notify_week_locked').notNull().default(true),
    notifyWeekSummary: (0, pg_core_1.boolean)('notify_week_summary').notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow(),
});
exports.games = (0, pg_core_1.pgTable)('games', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    espnId: (0, pg_core_1.text)('espn_id').notNull().unique(),
    week: (0, pg_core_1.integer)('week').notNull(),
    season: (0, pg_core_1.integer)('season').notNull(),
    seasonType: (0, pg_core_1.text)('season_type').notNull(), // 'regular' | 'preseason' | 'postseason'
    sport: (0, pg_core_1.text)('sport').notNull().default('nfl'),
    homeTeam: (0, pg_core_1.text)('home_team').notNull(),
    awayTeam: (0, pg_core_1.text)('away_team').notNull(),
    homeTeamLogo: (0, pg_core_1.text)('home_team_logo'),
    awayTeamLogo: (0, pg_core_1.text)('away_team_logo'),
    homeTeamRecord: (0, pg_core_1.text)('home_team_record'),
    awayTeamRecord: (0, pg_core_1.text)('away_team_record'),
    spread: (0, pg_core_1.real)('spread'),
    favoriteTeam: (0, pg_core_1.text)('favorite_team'),
    gameTime: (0, pg_core_1.timestamp)('game_time'),
    status: (0, pg_core_1.text)('status').notNull().default('pre'), // 'pre' | 'in' | 'post'
    homeScore: (0, pg_core_1.integer)('home_score'),
    awayScore: (0, pg_core_1.integer)('away_score'),
    homeTeamPPG: (0, pg_core_1.real)('home_team_ppg'),
    homeTeamPPGAllowed: (0, pg_core_1.real)('home_team_ppg_allowed'),
    homeTeamFPI: (0, pg_core_1.real)('home_team_fpi'),
    awayTeamPPG: (0, pg_core_1.real)('away_team_ppg'),
    awayTeamPPGAllowed: (0, pg_core_1.real)('away_team_ppg_allowed'),
    awayTeamFPI: (0, pg_core_1.real)('away_team_fpi'),
    period: (0, pg_core_1.integer)('period'),
    displayClock: (0, pg_core_1.text)('display_clock'),
    statusType: (0, pg_core_1.text)('status_type'),
    winningTeamWinProb: (0, pg_core_1.real)('winning_team_win_prob'),
    losingTeamWinProb: (0, pg_core_1.real)('losing_team_win_prob'),
    isScoreLocked: (0, pg_core_1.boolean)('is_score_locked').notNull().default(false),
});
exports.picks = (0, pg_core_1.pgTable)('picks', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.text)('user_id').notNull().references(() => exports.users.id),
    gameId: (0, pg_core_1.uuid)('game_id').notNull().references(() => exports.games.id),
    pick: (0, pg_core_1.text)('pick').notNull(), // 'home' | 'away'
    isCorrect: (0, pg_core_1.boolean)('is_correct'),
    pickWinProbability: (0, pg_core_1.real)('pick_win_probability'),
    pointsEarned: (0, pg_core_1.real)('points_earned'),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
});
exports.trophies = (0, pg_core_1.pgTable)('trophies', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.text)('user_id').notNull().references(() => exports.users.id),
    type: (0, pg_core_1.text)('type').notNull(),
    name: (0, pg_core_1.text)('name').notNull(),
    description: (0, pg_core_1.text)('description').notNull(),
    week: (0, pg_core_1.integer)('week').notNull(),
    season: (0, pg_core_1.integer)('season').notNull(),
    sport: (0, pg_core_1.text)('sport').notNull().default('nfl'),
    gameId: (0, pg_core_1.uuid)('game_id').references(() => exports.games.id),
    earnedAt: (0, pg_core_1.timestamp)('earned_at').notNull().defaultNow(),
});
exports.seasonTrophies = (0, pg_core_1.pgTable)('season_trophies', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.text)('user_id').notNull().references(() => exports.users.id),
    season: (0, pg_core_1.integer)('season').notNull(),
    sport: (0, pg_core_1.text)('sport').notNull().default('nfl'),
    placement: (0, pg_core_1.text)('placement').notNull(), // 'champion' | 'runner_up' | 'third_place' | 'last_place'
    wins: (0, pg_core_1.integer)('wins').notNull(),
    losses: (0, pg_core_1.integer)('losses').notNull(),
    awardedAt: (0, pg_core_1.timestamp)('awarded_at').notNull().defaultNow(),
});
exports.teamGameStats = (0, pg_core_1.pgTable)('team_game_stats', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    gameId: (0, pg_core_1.uuid)('game_id').notNull().references(() => exports.games.id),
    season: (0, pg_core_1.integer)('season').notNull(),
    week: (0, pg_core_1.integer)('week').notNull(),
    sport: (0, pg_core_1.text)('sport').notNull().default('nfl'),
    teamName: (0, pg_core_1.text)('team_name').notNull(),
    isHomeTeam: (0, pg_core_1.boolean)('is_home_team').notNull(),
    offensiveRank: (0, pg_core_1.integer)('offensive_rank'),
    defensiveRank: (0, pg_core_1.integer)('defensive_rank'),
    yardsPerGame: (0, pg_core_1.real)('yards_per_game'),
    yardsAllowedPerGame: (0, pg_core_1.real)('yards_allowed_per_game'),
    pointsPerGame: (0, pg_core_1.real)('points_per_game'),
    pointsAllowedPerGame: (0, pg_core_1.real)('points_allowed_per_game'),
    sackRate: (0, pg_core_1.real)('sack_rate'),
    thirdDownConversion: (0, pg_core_1.real)('third_down_conversion'),
    redZoneEfficiency: (0, pg_core_1.real)('red_zone_efficiency'),
    homeRecord: (0, pg_core_1.text)('home_record'),
    awayRecord: (0, pg_core_1.text)('away_record'),
    last3Games: (0, pg_core_1.text)('last_3_games'),
    additionalStats: (0, pg_core_1.jsonb)('additional_stats'),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
});
exports.playerStats = (0, pg_core_1.pgTable)('player_stats', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    gameId: (0, pg_core_1.uuid)('game_id').notNull().references(() => exports.games.id),
    season: (0, pg_core_1.integer)('season').notNull(),
    week: (0, pg_core_1.integer)('week').notNull(),
    sport: (0, pg_core_1.text)('sport').notNull().default('nfl'),
    teamName: (0, pg_core_1.text)('team_name').notNull(),
    position: (0, pg_core_1.text)('position').notNull(), // 'QB' | 'RB' | 'WR' | 'DEF'
    playerName: (0, pg_core_1.text)('player_name').notNull(),
    stat1: (0, pg_core_1.real)('stat1'),
    stat2: (0, pg_core_1.real)('stat2'),
    stat3: (0, pg_core_1.real)('stat3'),
    stat4: (0, pg_core_1.real)('stat4'),
    additionalStats: (0, pg_core_1.jsonb)('additional_stats'),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
});
exports.activityLog = (0, pg_core_1.pgTable)('activity_log', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    type: (0, pg_core_1.text)('type').notNull(),
    message: (0, pg_core_1.text)('message').notNull(),
    metadata: (0, pg_core_1.jsonb)('metadata'),
    visibility: (0, pg_core_1.text)('visibility').notNull().default('global'), // 'global' | 'personal' | 'admin'
    targetUserId: (0, pg_core_1.text)('target_user_id').references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
});
exports.pushTokens = (0, pg_core_1.pgTable)('push_tokens', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.text)('user_id').notNull().references(() => exports.users.id),
    token: (0, pg_core_1.text)('token').notNull().unique(),
    platform: (0, pg_core_1.text)('platform').notNull(), // 'ios' | 'android'
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow(),
});
exports.tiebreakerGames = (0, pg_core_1.pgTable)('tiebreaker_games', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    season: (0, pg_core_1.integer)('season').notNull(),
    week: (0, pg_core_1.integer)('week').notNull(),
    gameId: (0, pg_core_1.uuid)('game_id').notNull().references(() => exports.games.id),
    description: (0, pg_core_1.text)('description').notNull(),
    actualTotal: (0, pg_core_1.integer)('actual_total'),
    designatedAt: (0, pg_core_1.timestamp)('designated_at').notNull().defaultNow(),
});
exports.tiebreakerPicks = (0, pg_core_1.pgTable)('tiebreaker_picks', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.text)('user_id').notNull().references(() => exports.users.id),
    tiebreakerGameId: (0, pg_core_1.uuid)('tiebreaker_game_id').notNull().references(() => exports.tiebreakerGames.id),
    season: (0, pg_core_1.integer)('season').notNull(),
    predictedTotal: (0, pg_core_1.integer)('predicted_total').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow(),
});
exports.weekSettings = (0, pg_core_1.pgTable)('week_settings', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    week: (0, pg_core_1.integer)('week').notNull(),
    season: (0, pg_core_1.integer)('season').notNull(),
    seasonType: (0, pg_core_1.text)('season_type').notNull().default('regular'),
    lockTime: (0, pg_core_1.timestamp)('lock_time'),
    notes: (0, pg_core_1.text)('notes'),
});
exports.appSettings = (0, pg_core_1.pgTable)('app_settings', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    key: (0, pg_core_1.text)('key').notNull().unique(),
    value: (0, pg_core_1.text)('value').notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').notNull().defaultNow(),
});
exports.pickAuditLog = (0, pg_core_1.pgTable)('pick_audit_log', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.text)('user_id').notNull(),
    gameId: (0, pg_core_1.uuid)('game_id').notNull(),
    action: (0, pg_core_1.text)('action').notNull(),
    previousPick: (0, pg_core_1.text)('previous_pick'),
    newPick: (0, pg_core_1.text)('new_pick'),
    adminId: (0, pg_core_1.text)('admin_id'),
    createdAt: (0, pg_core_1.timestamp)('created_at').notNull().defaultNow(),
});
exports.unlockedWeeks = (0, pg_core_1.pgTable)('unlocked_weeks', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    week: (0, pg_core_1.integer)('week').notNull(),
    season: (0, pg_core_1.integer)('season').notNull(),
    seasonType: (0, pg_core_1.text)('season_type').notNull().default('regular'),
    unlockedAt: (0, pg_core_1.timestamp)('unlocked_at').notNull().defaultNow(),
    unlockedBy: (0, pg_core_1.text)('unlocked_by').notNull(),
});
//# sourceMappingURL=schema.js.map