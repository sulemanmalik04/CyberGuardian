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
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'cybersecurity-training-platform-secret';
  private readonly TOKEN_EXPIRY = '7d';

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  generateToken(user: User): string {
    const payload: TokenPayload = {
      userId: user.id,
      role: user.role,
      clientId: user.clientId || undefined
    };

    return jwt.sign(payload, this.JWT_SECRET, { 
      expiresIn: this.TOKEN_EXPIRY,
      issuer: 'cyberaware-platform',
      audience: user.role
    });
  }

  verifyToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as TokenPayload;
      return decoded;
    } catch (error) {
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

  async validateSession(token: string): Promise<User | null> {
    try {
      // Check if session exists and is not expired
      const session = await storage.getSession(token);
      if (!session || session.expiresAt < new Date()) {
        if (session) {
          await storage.deleteSession(token);
        }
        return null;
      }

      // Get user
      const user = await storage.getUser(session.userId);
      if (!user || !user.isActive) {
        await storage.deleteSession(token);
        return null;
      }

      return user;
    } catch (error) {
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
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const user = await this.validateSession(token);
    if (!user) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }

    req.user = user;
    req.token = token;
    next();
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
