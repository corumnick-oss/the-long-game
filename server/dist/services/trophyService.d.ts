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
export declare function calculateWeeklyTrophies(week: number, season: number): Promise<WeeklyTrophyResults>;
export declare function awardWeeklyTrophies(week: number, season: number, specificType?: string): Promise<number>;
