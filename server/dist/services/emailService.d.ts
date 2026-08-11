export declare function sendPreviewEmail(toEmail: string, teamName?: string): Promise<{
    ok: boolean;
    error?: string;
}>;
export declare function sendWeeklyPicksEmails(week: number, season: number, seasonType: 'regular' | 'preseason', onlyUserId?: string): Promise<number>;
