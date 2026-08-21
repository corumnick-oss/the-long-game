type PushTicket = {
    status: string;
    id?: string;
    message?: string;
    details?: unknown;
};
export declare function sendPushToUsers(userIds: string[], title: string, body: string, data?: Record<string, unknown>): Promise<PushTicket[]>;
export declare function sendPushToAllUsers(title: string, body: string, data?: Record<string, unknown>): Promise<void>;
export declare function notifyWeekUnlocked(week: number, seasonType?: 'regular' | 'preseason'): Promise<void>;
export declare function notifyDeadlineApproaching(week: number, seasonType?: 'regular' | 'preseason'): Promise<void>;
export declare function notifyPicksLocked(week: number, seasonType?: 'regular' | 'preseason'): Promise<void>;
export declare function notifyAchievementEarned(userId: string, achievementName: string, week: number): Promise<void>;
export declare function notifyDefaultPicksApplied(userId: string, count: number, week: number, seasonType?: 'regular' | 'preseason'): Promise<void>;
export declare function notifyWeekSummary(userId: string, week: number, seasonType: 'regular' | 'preseason', wins: number, losses: number): Promise<void>;
export {};
