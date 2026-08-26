type ExportPayload = {
    week: number;
    season: number;
    seasonType: string;
};
export declare function createExportToken(payload: ExportPayload): string;
export declare function consumeExportToken(token: string): ExportPayload | null;
export {};
