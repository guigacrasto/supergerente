import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './requireAuth.js';

export function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.userRole !== 'superadmin') {
    res.status(403).json({ error: 'Acesso restrito ao super-admin' });
    return;
  }
  next();
}
