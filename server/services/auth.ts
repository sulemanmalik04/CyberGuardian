import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { storage } from '../storage';
import type { User } from '@shared/schema';

interface TokenPayload {
  userId: string;
  role: string;
  clientId?: string;
}

class AuthService {
  private readonly JWT_SECRET: string;
  private readonly TOKEN_EXPIRY = '7d';
  private readonly TOKEN_ISSUER = 'cyberaware-platform';
  private readonly isDevelopment = process.env.NODE_ENV === 'development';

  constructor() {
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      if (this.isDevelopment) {
        console.warn('⚠️  JWT_SECRET not set. Using development fallback. DO NOT use in production!');
        this.JWT_SECRET = 'dev-cybersecurity-training-platform-secret-' + Math.random().toString(36);
      } else {
        throw new Error('JWT_SECRET environment variable is required in production');
      }
    } else if (jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long for security');
    } else {
      this.JWT_SECRET = jwtSecret;
    }
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  generateToken(user: User): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: TokenPayload & {
      iat: number;
      exp: number;
      jti: string;
    } = {
      userId: user.id,
      role: user.role,
      clientId: user.clientId || undefined,
      iat: now,
      exp: now + (7 * 24 * 60 * 60), // 7 days in seconds
      jti: `${user.id}-${now}-${Math.random().toString(36).substr(2, 9)}` // Unique token ID
    };

    return jwt.sign(payload, this.JWT_SECRET, {
      algorithm: 'HS256',
      issuer: this.TOKEN_ISSUER,
      audience: user.role,
      noTimestamp: true // We set iat manually
    });
  }

  verifyToken(token: string, expectedAudience?: string): TokenPayload | null {
    try {
      const options: jwt.VerifyOptions = {
        issuer: this.TOKEN_ISSUER,
        algorithms: ['HS256']
      };
      
      if (expectedAudience) {
        options.audience = expectedAudience;
      }

      const decoded = jwt.verify(token, this.JWT_SECRET, options) as TokenPayload;
      
      // Additional validation
      if (!decoded.userId || !decoded.role) {
        return null;
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        console.warn('JWT verification failed:', error.message);
      } else if (error instanceof jwt.TokenExpiredError) {
        console.info('JWT token expired:', error.message);
      }
      return null;
    }
  }

  async createSession(user: User): Promise<{ token: string; expiresAt: Date }> {
    const token = this.generateToken(user);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await storage.createSession({
      userId: user.id,
      token,
      expiresAt
    });

    return { token, expiresAt };
  }

  async validateSession(token: string, expectedAudience?: string): Promise<User | null> {
    try {
      // First verify the JWT token structure and signature with audience verification
      const tokenPayload = this.verifyToken(token, expectedAudience);
      if (!tokenPayload) {
        return null;
      }

      // Check if session exists in storage and is not expired
      const session = await storage.getSession(token);
      if (!session || session.expiresAt < new Date()) {
        if (session) {
          await storage.deleteSession(token);
        }
        return null;
      }

      // Ensure the session user matches the token user
      if (session.userId !== tokenPayload.userId) {
        await storage.deleteSession(token);
        return null;
      }

      // Get user and verify they're still active
      const user = await storage.getUser(session.userId);
      if (!user || !user.isActive) {
        await storage.deleteSession(token);
        return null;
      }

      // Verify user role matches token (in case role was changed)
      if (user.role !== tokenPayload.role) {
        await storage.deleteSession(token);
        return null;
      }

      // SECURITY: Critical tenant isolation check - prevent cross-tenant token usage
      // For tenant-specific roles, verify the token's clientId matches user's current clientId
      if (user.role === 'client_admin' || user.role === 'end_user') {
        if (!user.clientId) {
          console.error('🚨 SECURITY: User with tenant role has no clientId:', user.id);
          await storage.deleteSession(token);
          return null;
        }
        
        if (tokenPayload.clientId !== user.clientId) {
          console.warn(`🚨 SECURITY: Cross-tenant token usage blocked - Token clientId: ${tokenPayload.clientId}, User clientId: ${user.clientId}, User: ${user.id}`);
          await storage.deleteSession(token);
          return null;
        }
      }

      return user;
    } catch (error) {
      console.error('Session validation error:', error);
      return null;
    }
  }

  async logout(token: string): Promise<void> {
    await storage.deleteSession(token);
  }

  async cleanupExpiredSessions(): Promise<void> {
    await storage.deleteExpiredSessions();
  }

  hasPermission(user: User, action: string, resource?: any): boolean {
    switch (user.role) {
      case 'super_admin':
        return true; // Super admin has all permissions

      case 'client_admin':
        // Client admin can manage their own client's resources
        if (resource?.clientId && resource.clientId !== user.clientId) {
          return false;
        }
        return [
          'manage_users',
          'create_campaigns',
          'view_analytics',
          'manage_courses',
          'customize_branding',
          'import_users'
        ].includes(action);

      case 'end_user':
        return [
          'view_courses',
          'complete_training',
          'view_progress',
          'chat_with_ai'
        ].includes(action);

      default:
        return false;
    }
  }

  requireRole(allowedRoles: string[]) {
    return (req: any, res: any, next: any) => {
      if (!req.user || !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ 
          message: 'Insufficient permissions',
          requiredRoles: allowedRoles,
          userRole: req.user?.role
        });
      }
      next();
    };
  }

  requirePermission(action: string) {
    return (req: any, res: any, next: any) => {
      if (!req.user || !this.hasPermission(req.user, action, req.body)) {
        return res.status(403).json({ 
          message: 'Permission denied',
          action,
          userRole: req.user?.role
        });
      }
      next();
    };
  }

  async authenticateRequest(req: any, res: any, next: any) {
    try {
      const authHeader = req.headers['authorization'];
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
          message: 'Access token required',
          error: 'MISSING_AUTH_HEADER'
        });
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      if (!token || token.length < 10) {
        return res.status(401).json({ 
          message: 'Invalid token format',
          error: 'INVALID_TOKEN_FORMAT'
        });
      }

      // SECURITY: Validate session with audience verification based on role
      const tokenPayload = this.verifyToken(token);
      const expectedAudience = tokenPayload?.role;
      
      const user = await this.validateSession(token, expectedAudience);
      if (!user) {
        return res.status(403).json({ 
          message: 'Invalid or expired token',
          error: 'INVALID_SESSION'
        });
      }

      // Add security headers
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      });

      req.user = user;
      req.token = token;
      req.tokenPayload = tokenPayload;
      next();
    } catch (error) {
      console.error('Authentication error:', error);
      return res.status(500).json({ 
        message: 'Authentication service error',
        error: 'AUTH_SERVICE_ERROR'
      });
    }
  }

  // Rate limiting for login attempts
  private loginAttempts = new Map<string, { count: number; lastAttempt: Date }>();

  isRateLimited(email: string): boolean {
    const attempts = this.loginAttempts.get(email);
    if (!attempts) return false;

    const now = new Date();
    const timeDiff = now.getTime() - attempts.lastAttempt.getTime();
    const minutesElapsed = timeDiff / (1000 * 60);

    // Reset counter after 15 minutes
    if (minutesElapsed > 15) {
      this.loginAttempts.delete(email);
      return false;
    }

    // Block after 5 attempts
    return attempts.count >= 5;
  }

  recordLoginAttempt(email: string, success: boolean) {
    if (success) {
      this.loginAttempts.delete(email);
      return;
    }

    const attempts = this.loginAttempts.get(email) || { count: 0, lastAttempt: new Date() };
    attempts.count++;
    attempts.lastAttempt = new Date();
    this.loginAttempts.set(email, attempts);
  }
}

export const authService = new AuthService();
