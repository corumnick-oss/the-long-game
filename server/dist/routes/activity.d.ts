declare const router: import("express-serve-static-core").Router;
export declare function logActivity(type: string, message: string, visibility: 'global' | 'personal' | 'admin', options?: {
    targetUserId?: string;
    metadata?: Record<string, unknown>;
}): Promise<void>;
export default router;
