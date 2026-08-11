export declare function syncGamesByEventIds(eventIds: string[], week: number, season: number, seasonType: 'regular' | 'preseason' | 'postseason'): Promise<number>;
export declare function syncWeekGames(week: number, season: number, seasonType?: 'regular' | 'preseason' | 'postseason'): Promise<number>;
export declare function updateLiveScores(): Promise<void>;
export declare function syncWinProbabilities(week: number, season: number): Promise<number>;
export declare function syncBoxScoreStats(game: {
    id: string;
    espnId: string;
    week: number;
    season: number;
    seasonType: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number | null;
    awayScore: number | null;
}): Promise<void>;
export declare function backfillTeamStats(season: number, seasonType?: string): Promise<number>;
