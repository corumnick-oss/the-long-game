export interface TrophyCandidate {
    userId: string;
    value: number;
}
export interface LoneWolfCandidate extends TrophyCandidate {
    gameId: string;
    teamName: string;
    opponentName: string;
}
export interface UpsetPickCandidate extends TrophyCandidate {
    teamName: string;
    opponentName: string;
    winProbability: number;
}
export interface ContrarianCandidate extends TrophyCandidate {
    gameId: string;
    teamName: string;
    opponentName: string;
    pickPercentage: number;
}
export interface WeeklyTrophyResults {
    mostWins: TrophyCandidate[];
    mostLosses: TrophyCandidate[];
    upsetPick: UpsetPickCandidate[];
    loneWolf: LoneWolfCandidate[];
    contrarian: ContrarianCandidate[];
}
export declare function calculateWeeklyTrophies(week: number, season: number, seasonType?: string): Promise<WeeklyTrophyResults>;
export interface WeeklyRecord {
    userId: string;
    wins: number;
    losses: number;
}
export declare function getWeeklyRecords(week: number, season: number, seasonType?: string): Promise<WeeklyRecord[]>;
export declare function awardWeeklyTrophies(week: number, season: number, specificType?: string, seasonType?: string): Promise<number>;
export interface SeasonStandingEntry {
    userId: string;
    teamName: string;
    wins: number;
    losses: number;
    rank: number;
}
export declare function calculateSeasonStandings(season: number): Promise<SeasonStandingEntry[]>;
export interface SeasonTrophyAward {
    userId: string;
    teamName: string;
    placement: string;
    wins: number;
    losses: number;
}
export declare function awardSeasonTrophies(season: number): Promise<SeasonTrophyAward[]>;
