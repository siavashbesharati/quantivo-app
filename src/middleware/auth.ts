import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../utils/auth';

export interface AuthRequest extends Request {
  user?: JWTPayload;
}

// JWT Authentication Middleware
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'No authorization token provided' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.user = payload;
  next();
}

// Admin-only middleware
export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

// Error handling middleware
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Error:', err);

  if (err.statusCode) {
    res.status(err.statusCode).json({ error: err.message });
  } else {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Validation middleware
export function validateRequestBody(requiredFields: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missing = requiredFields.filter((field) => !(field in req.body));
    if (missing.length > 0) {
      res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
      return;
    }
    next();
  };
}
