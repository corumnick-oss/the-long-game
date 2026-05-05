CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"visibility" text DEFAULT 'global' NOT NULL,
	"target_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"espn_id" text NOT NULL,
	"week" integer NOT NULL,
	"season" integer NOT NULL,
	"season_type" text NOT NULL,
	"sport" text DEFAULT 'nfl' NOT NULL,
	"home_team" text NOT NULL,
	"away_team" text NOT NULL,
	"home_team_logo" text,
	"away_team_logo" text,
	"home_team_record" text,
	"away_team_record" text,
	"spread" real,
	"favorite_team" text,
	"game_time" timestamp,
	"status" text DEFAULT 'pre' NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"home_team_ppg" real,
	"home_team_ppg_allowed" real,
	"home_team_fpi" real,
	"away_team_ppg" real,
	"away_team_ppg_allowed" real,
	"away_team_fpi" real,
	"period" integer,
	"display_clock" text,
	"status_type" text,
	"winning_team_win_prob" real,
	"losing_team_win_prob" real,
	"is_score_locked" boolean DEFAULT false NOT NULL,
	CONSTRAINT "games_espn_id_unique" UNIQUE("espn_id")
);
--> statement-breakpoint
CREATE TABLE "pick_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"game_id" uuid NOT NULL,
	"action" text NOT NULL,
	"previous_pick" text,
	"new_pick" text,
	"admin_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "picks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"game_id" uuid NOT NULL,
	"pick" text NOT NULL,
	"is_correct" boolean,
	"pick_win_probability" real,
	"points_earned" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"sport" text DEFAULT 'nfl' NOT NULL,
	"team_name" text NOT NULL,
	"position" text NOT NULL,
	"player_name" text NOT NULL,
	"stat1" real,
	"stat2" real,
	"stat3" real,
	"stat4" real,
	"additional_stats" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"platform" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "team_game_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"sport" text DEFAULT 'nfl' NOT NULL,
	"team_name" text NOT NULL,
	"is_home_team" boolean NOT NULL,
	"offensive_rank" integer,
	"defensive_rank" integer,
	"yards_per_game" real,
	"yards_allowed_per_game" real,
	"points_per_game" real,
	"points_allowed_per_game" real,
	"sack_rate" real,
	"third_down_conversion" real,
	"red_zone_efficiency" real,
	"home_record" text,
	"away_record" text,
	"last_3_games" text,
	"additional_stats" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tiebreaker_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"game_id" uuid NOT NULL,
	"description" text NOT NULL,
	"actual_total" integer,
	"designated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tiebreaker_picks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"tiebreaker_game_id" uuid NOT NULL,
	"season" integer NOT NULL,
	"predicted_total" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trophies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"week" integer NOT NULL,
	"season" integer NOT NULL,
	"sport" text DEFAULT 'nfl' NOT NULL,
	"game_id" uuid,
	"earned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unlocked_weeks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week" integer NOT NULL,
	"season" integer NOT NULL,
	"unlocked_at" timestamp DEFAULT now() NOT NULL,
	"unlocked_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"team_name" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"is_longie" boolean DEFAULT false NOT NULL,
	"is_premium" boolean DEFAULT false NOT NULL,
	"nfl_access" boolean DEFAULT true NOT NULL,
	"profile_image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "week_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week" integer NOT NULL,
	"season" integer NOT NULL,
	"lock_time" timestamp,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "picks" ADD CONSTRAINT "picks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "picks" ADD CONSTRAINT "picks_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_game_stats" ADD CONSTRAINT "team_game_stats_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tiebreaker_games" ADD CONSTRAINT "tiebreaker_games_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tiebreaker_picks" ADD CONSTRAINT "tiebreaker_picks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tiebreaker_picks" ADD CONSTRAINT "tiebreaker_picks_tiebreaker_game_id_tiebreaker_games_id_fk" FOREIGN KEY ("tiebreaker_game_id") REFERENCES "public"."tiebreaker_games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trophies" ADD CONSTRAINT "trophies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trophies" ADD CONSTRAINT "trophies_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;