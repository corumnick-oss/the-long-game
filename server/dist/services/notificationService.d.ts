export declare function sendPushToUsers(userIds: string[], title: string, body: string, data?: Record<string, unknown>): Promise<void>;
export declare function sendPushToAllUsers(title: string, body: string, data?: Record<string, unknown>): Promise<void>;
export declare function notifyWeekUnlocked(week: number): Promise<void>;
export declare function notifyDeadlineApproaching(week: number): Promise<void>;
export declare function notifyPicksLocked(week: number): Promise<void>;
export declare function notifyTrophyEarned(userId: string, trophyName: string, week: number): Promise<void>;
export declare function notifyGameFinal(userId: string, homeTeam: string, awayTeam: string, homeScore: number, awayScore: number, isCorrect: boolean): Promise<void>;
