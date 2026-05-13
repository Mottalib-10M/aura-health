import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export enum UserRole {
  PATIENT = 'patient',
  DOCTOR = 'doctor',
  HOSPITAL_ADMIN = 'hospital_admin',
  ANALYST = 'analyst',
  SYSTEM_ADMIN = 'system_admin',
}

export interface JwtPayload {
  sub: string; // user ID
  role: UserRole;
  auraId?: string;
  institutionId?: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  auraId?: string;
  institutionId?: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// ---------------------------------------------------------------------------
// JWT authentication middleware
// ---------------------------------------------------------------------------

/**
 * Extracts the Bearer token from the Authorization header, verifies it,
 * and attaches the decoded user to `req.user`.
 *
 * If the token is missing the request proceeds without `req.user`
 * (useful for public endpoints and the GraphQL introspection query).
 * If the token is present but invalid, a 401 is returned.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token — let the request through unauthenticated.
    // Individual resolvers / routes decide whether to require auth.
    return next();
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    req.user = {
      id: decoded.sub,
      role: decoded.role,
      auraId: decoded.auraId,
      institutionId: decoded.institutionId,
    };

    logger.debug({ userId: decoded.sub, role: decoded.role }, 'JWT authenticated');
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    logger.error({ err }, 'Unexpected JWT verification error');
    res.status(500).json({ error: 'Internal authentication error' });
  }
}

// ---------------------------------------------------------------------------
// Role-based authorization middleware factory
// ---------------------------------------------------------------------------

/**
 * Returns middleware that rejects requests from users without one of the
 * specified roles.  Must be placed *after* `authenticate`.
 *
 * @example
 *   router.get('/admin', authenticate, authorize(UserRole.SYSTEM_ADMIN), handler);
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(
        { userId: req.user.id, role: req.user.role, required: allowedRoles },
        'Authorization denied',
      );
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Issue a signed JWT for a given user.
 */
export function signToken(user: { id: string; role: UserRole; auraId?: string; institutionId?: string }): string {
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    sub: user.id,
    role: user.role,
    ...(user.auraId && { auraId: user.auraId }),
    ...(user.institutionId && { institutionId: user.institutionId }),
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

/**
 * Require an authenticated user in a GraphQL resolver context.
 * Throws an Apollo-style error if unauthenticated.
 */
export function requireAuth(user: AuthenticatedUser | undefined): AuthenticatedUser {
  if (!user) {
    throw new Error('UNAUTHENTICATED');
  }
  return user;
}

/**
 * Require an authenticated user with one of the specified roles.
 */
export function requireRole(user: AuthenticatedUser | undefined, ...roles: UserRole[]): AuthenticatedUser {
  const authed = requireAuth(user);
  if (!roles.includes(authed.role)) {
    throw new Error('FORBIDDEN');
  }
  return authed;
}
