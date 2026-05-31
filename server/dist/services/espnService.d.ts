export declare function syncWeekGames(week: number, season: number, seasonType?: 'regular' | 'preseason' | 'postseason'): Promise<number>;
export declare function updateLiveScores(): Promise<void>;
export declare function syncWeekScores(week: number, season: number, seasonType?: 'regular' | 'preseason' | 'postseason'): Promise<number>;
export declare function syncWinProbabilities(week: number, season: number): Promise<void>;
