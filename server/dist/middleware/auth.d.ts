import type { Request, Response, NextFunction } from 'express';
import '../types';
export declare function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function requireFirebaseToken(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function requireAdmin(req: Request, res: Response, next: NextFunction): void;
