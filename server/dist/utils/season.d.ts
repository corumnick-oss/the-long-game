export declare function getCurrentNFLSeason(): number;
export declare function getCurrentWeekAndType(): Promise<{
    week: number;
    seasonType: 'preseason' | 'regular';
}>;
export declare function isForceRegularSeason(): Promise<boolean>;
export declare function getNextWeekToUnlock(): Promise<{
    week: number;
    seasonType: 'preseason' | 'regular';
}>;
export declare function getCurrentNFLWeek(): Promise<number>;
export declare function isPreseasonMode(): Promise<boolean>;
