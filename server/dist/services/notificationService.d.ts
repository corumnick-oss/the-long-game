type PushTicket = {
    status: string;
    id?: string;
    message?: string;
    details?: unknown;
};
export declare function sendPushToUsers(userIds: string[], title: string, body: string, data?: Record<string, unknown>): Promise<PushTicket[]>;
export declare function sendPushToAllUsers(title: string, body: string, data?: Record<string, unknown>): Promise<void>;
export declare function notifyWeekUnlocked(week: number): Promise<void>;
export declare function notifyDeadlineApproaching(week: number): Promise<void>;
export declare function notifyPicksLocked(week: number): Promise<void>;
export declare function notifyAchievementEarned(userId: string, achievementName: string, week: number): Promise<void>;
export declare function notifyDefaultPicksApplied(userId: string, count: number, week: number): Promise<void>;
export declare function notifyGameFinal(userId: string, homeTeam: string, awayTeam: string, homeScore: number, awayScore: number, isCorrect: boolean): Promise<void>;
export {};
