import {
  pgTable,
  text,
  uuid,
  integer,
  boolean,
  real,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  teamName: text('team_name').notNull(),
  isAdmin: boolean('is_admin').notNull().default(false),
  isGridiron: boolean('is_gridiron').notNull().default(false),
  isPremium: boolean('is_premium').notNull().default(false),
  nflAccess: boolean('nfl_access').notNull().default(true),
  profileImageUrl: text('profile_image_url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const games = pgTable('games', {
  id: uuid('id').primaryKey().defaultRandom(),
  espnId: text('espn_id').notNull().unique(),
  week: integer('week').notNull(),
  season: integer('season').notNull(),
  seasonType: text('season_type').notNull(), // 'regular' | 'preseason' | 'postseason'
  sport: text('sport').notNull().default('nfl'),
  homeTeam: text('home_team').notNull(),
  awayTeam: text('away_team').notNull(),
  homeTeamLogo: text('home_team_logo'),
  awayTeamLogo: text('away_team_logo'),
  homeTeamRecord: text('home_team_record'),
  awayTeamRecord: text('away_team_record'),
  spread: real('spread'),
  favoriteTeam: text('favorite_team'),
  gameTime: timestamp('game_time'),
  status: text('status').notNull().default('pre'), // 'pre' | 'in' | 'post'
  homeScore: integer('home_score'),
  awayScore: integer('away_score'),
  homeTeamPPG: real('home_team_ppg'),
  homeTeamPPGAllowed: real('home_team_ppg_allowed'),
  homeTeamFPI: real('home_team_fpi'),
  awayTeamPPG: real('away_team_ppg'),
  awayTeamPPGAllowed: real('away_team_ppg_allowed'),
  awayTeamFPI: real('away_team_fpi'),
  period: integer('period'),
  displayClock: text('display_clock'),
  statusType: text('status_type'),
  winningTeamWinProb: real('winning_team_win_prob'),
  losingTeamWinProb: real('losing_team_win_prob'),
  isScoreLocked: boolean('is_score_locked').notNull().default(false),
});

export const picks = pgTable('picks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id),
  gameId: uuid('game_id').notNull().references(() => games.id),
  pick: text('pick').notNull(), // 'home' | 'away'
  isCorrect: boolean('is_correct'),
  pickWinProbability: real('pick_win_probability'),
  pointsEarned: real('points_earned'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const trophies = pgTable('trophies', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id),
  type: text('type').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  week: integer('week').notNull(),
  season: integer('season').notNull(),
  sport: text('sport').notNull().default('nfl'),
  gameId: uuid('game_id').references(() => games.id),
  earnedAt: timestamp('earned_at').notNull().defaultNow(),
});

export const seasonTrophies = pgTable('season_trophies', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id),
  season: integer('season').notNull(),
  sport: text('sport').notNull().default('nfl'),
  placement: text('placement').notNull(), // 'champion' | 'runner_up' | 'third_place' | 'last_place'
  wins: integer('wins').notNull(),
  losses: integer('losses').notNull(),
  awardedAt: timestamp('awarded_at').notNull().defaultNow(),
});

export const teamGameStats = pgTable('team_game_stats', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameId: uuid('game_id').notNull().references(() => games.id),
  season: integer('season').notNull(),
  week: integer('week').notNull(),
  sport: text('sport').notNull().default('nfl'),
  teamName: text('team_name').notNull(),
  isHomeTeam: boolean('is_home_team').notNull(),
  offensiveRank: integer('offensive_rank'),
  defensiveRank: integer('defensive_rank'),
  yardsPerGame: real('yards_per_game'),
  yardsAllowedPerGame: real('yards_allowed_per_game'),
  pointsPerGame: real('points_per_game'),
  pointsAllowedPerGame: real('points_allowed_per_game'),
  sackRate: real('sack_rate'),
  thirdDownConversion: real('third_down_conversion'),
  redZoneEfficiency: real('red_zone_efficiency'),
  homeRecord: text('home_record'),
  awayRecord: text('away_record'),
  last3Games: text('last_3_games'),
  additionalStats: jsonb('additional_stats'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const playerStats = pgTable('player_stats', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameId: uuid('game_id').notNull().references(() => games.id),
  season: integer('season').notNull(),
  week: integer('week').notNull(),
  sport: text('sport').notNull().default('nfl'),
  teamName: text('team_name').notNull(),
  position: text('position').notNull(), // 'QB' | 'RB' | 'WR' | 'DEF'
  playerName: text('player_name').notNull(),
  stat1: real('stat1'),
  stat2: real('stat2'),
  stat3: real('stat3'),
  stat4: real('stat4'),
  additionalStats: jsonb('additional_stats'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const activityLog = pgTable('activity_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(),
  message: text('message').notNull(),
  metadata: jsonb('metadata'),
  visibility: text('visibility').notNull().default('global'), // 'global' | 'personal' | 'admin'
  targetUserId: text('target_user_id').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const pushTokens = pgTable('push_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id),
  token: text('token').notNull().unique(),
  platform: text('platform').notNull(), // 'ios' | 'android'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const tiebreakerGames = pgTable('tiebreaker_games', {
  id: uuid('id').primaryKey().defaultRandom(),
  season: integer('season').notNull(),
  week: integer('week').notNull(),
  gameId: uuid('game_id').notNull().references(() => games.id),
  description: text('description').notNull(),
  actualTotal: integer('actual_total'),
  designatedAt: timestamp('designated_at').notNull().defaultNow(),
});

export const tiebreakerPicks = pgTable('tiebreaker_picks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id),
  tiebreakerGameId: uuid('tiebreaker_game_id').notNull().references(() => tiebreakerGames.id),
  season: integer('season').notNull(),
  predictedTotal: integer('predicted_total').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const weekSettings = pgTable('week_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  week: integer('week').notNull(),
  season: integer('season').notNull(),
  seasonType: text('season_type').notNull().default('regular'),
  lockTime: timestamp('lock_time'),
  notes: text('notes'),
});

export const appSettings = pgTable('app_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const pickAuditLog = pgTable('pick_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  gameId: uuid('game_id').notNull(),
  action: text('action').notNull(),
  previousPick: text('previous_pick'),
  newPick: text('new_pick'),
  adminId: text('admin_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const unlockedWeeks = pgTable('unlocked_weeks', {
  id: uuid('id').primaryKey().defaultRandom(),
  week: integer('week').notNull(),
  season: integer('season').notNull(),
  seasonType: text('season_type').notNull().default('regular'),
  unlockedAt: timestamp('unlocked_at').notNull().defaultNow(),
  unlockedBy: text('unlocked_by').notNull(),
});
