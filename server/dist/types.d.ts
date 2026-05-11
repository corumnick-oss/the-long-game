import type { users } from './db/schema';
export type User = typeof users.$inferSelect;
declare global {
    namespace Express {
        interface Request {
            uid?: string;
            currentUser?: User;
        }
    }
}
