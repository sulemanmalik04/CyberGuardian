import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./types";
import { storage } from "./storage";
import { z } from "zod";

/**
 * CRITICAL TENANT SECURITY MODULE
 * 
 * This module provides comprehensive tenant isolation and security utilities
 * to prevent cross-tenant data access in the multi-tenant cybersecurity platform.
 */

// Tenant context interface
export interface TenantContext {
  clientId: string;
  role: 'super_admin' | 'client_admin' | 'end_user';
  canAccessClient: (clientId: string) => boolean;
  mustFilterByClient: boolean;
  authorizedClientIds: string[];
}

/**
 * SECURITY: Creates tenant context from authenticated user
 * This defines what clients a user can access based on their role
 */
export function createTenantContext(user: any): TenantContext {
  const context: TenantContext = {
    clientId: user.clientId || '',
    role: user.role,
    canAccessClient: (clientId: string) => {
      if (user.role === 'super_admin') {
        // Super admins can access any client, but must be explicit about which one
        return true;
      }
      // Client admins and end users can only access their own client
      return user.clientId === clientId;
    },
    mustFilterByClient: user.role !== 'super_admin',
    authorizedClientIds: user.role === 'super_admin' ? [] : [user.clientId]
  };

  return context;
}

/**
 * SECURITY: Validates clientId parameter for tenant access
 * Prevents privilege escalation by validating requested clientId against user permissions
 */
export function validateClientAccess(tenantContext: TenantContext, requestedClientId?: string): string | null {
  // Super admins must explicitly specify which client they want to access
  if (tenantContext.role === 'super_admin') {
    if (!requestedClientId) {
      return null; // Super admin must specify clientId
    }
    // Validate that the requested client exists (this will be checked by the calling code)
    return requestedClientId;
  }

  // Client admins and end users can only access their own client
  if (!tenantContext.clientId) {
    throw new Error('User has no associated client');
  }

  // If a clientId is requested, it must match the user's clientId
  if (requestedClientId && requestedClientId !== tenantContext.clientId) {
    throw new Error('Access denied: Cannot access other client data');
  }

  return tenantContext.clientId;
}

/**
 * SECURITY: Middleware that injects tenant context and validates client access
 */
export function createTenantMiddleware(options: {
  requireClientId?: boolean;
  allowSuperAdminWildcard?: boolean;
} = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest & { tenantContext?: TenantContext };
    
    if (!authReq.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    try {
      // Create tenant context
      const tenantContext = createTenantContext(authReq.user);
      authReq.tenantContext = tenantContext;

      // SECURITY: Validate client access if clientId is provided in query, body, OR path parameters
      const requestedClientId = req.query.clientId as string || req.body.clientId as string || req.params.clientId as string;
      
      if (options.requireClientId || requestedClientId) {
        const validatedClientId = validateClientAccess(tenantContext, requestedClientId);
        
        if (!validatedClientId && options.requireClientId) {
          return res.status(400).json({ message: 'Client ID required' });
        }

        if (!validatedClientId && !options.allowSuperAdminWildcard) {
          return res.status(400).json({ message: 'Client ID required for this operation' });
        }

        // Store validated clientId for use in route handlers
        if (validatedClientId) {
          authReq.validatedClientId = validatedClientId;
        }
      }

      // Additional security: Validate that the client exists and user has access
      if (requestedClientId) {
        const client = await storage.getClient(requestedClientId);
        if (!client) {
          console.warn(`🚨 SECURITY: Client not found: ${requestedClientId} requested by user ${authReq.user.email}`);
          return res.status(404).json({ message: 'Client not found' });
        }

        if (!tenantContext.canAccessClient(requestedClientId)) {
          console.error(`🚨 SECURITY VIOLATION: User ${authReq.user.email} (${authReq.user.role}) attempted to access client ${requestedClientId} without permission`);
          return res.status(403).json({ message: 'Access denied to client' });
        }
        
        // Log successful tenant access for audit
        logTenantAccess(authReq.user.id, 'ACCESS', 'client', requestedClientId, tenantContext.clientId || 'super_admin');
      }

      next();
    } catch (error) {
      console.error('🚨 Tenant security error:', error);
      return res.status(403).json({ 
        message: error instanceof Error ? error.message : 'Access denied' 
      });
    }
  };
}

/**
 * SECURITY: Validates that request body doesn't contain unauthorized clientId manipulation
 */
export function validateRequestBody(body: any, allowedClientId: string | null, tenantContext?: TenantContext): any {
  // Super admins can specify clientId in request body (for operations like creating resources for other clients)
  if (tenantContext?.role === 'super_admin' && body.clientId) {
    // Log super admin cross-tenant operation for audit
    console.log(`🔍 AUDIT: Super admin ${tenantContext.clientId} specifying clientId: ${body.clientId} in request body`);
    return body; // Allow super admin to specify clientId
  }
  
  // For non-super admins, prevent clientId manipulation
  if (body.clientId && body.clientId !== allowedClientId) {
    throw new Error('🚨 SECURITY: Cannot specify different clientId in request body');
  }
  return body;
}

/**
 * SECURITY: Ensures user creation data has proper client association
 */
export function validateUserCreation(userData: any, tenantContext: TenantContext): any {
  if (tenantContext.role === 'client_admin') {
    // Client admins can only create users in their own client
    userData.clientId = tenantContext.clientId;
  } else if (tenantContext.role === 'super_admin') {
    // Super admins must specify which client to create user for
    if (!userData.clientId) {
      throw new Error('Super admin must specify clientId when creating users');
    }
  }
  
  return userData;
}

/**
 * SECURITY: Query helper for tenant-scoped database operations
 */
export class TenantQueryHelper {
  constructor(private tenantContext: TenantContext) {}

  /**
   * Gets users with proper tenant filtering
   */
  async getUsers(requestedClientId?: string): Promise<any[]> {
    const clientId = validateClientAccess(this.tenantContext, requestedClientId);
    if (!clientId) {
      return []; // Super admin with no specified client gets empty array
    }
    return storage.getUsersByClient(clientId);
  }

  /**
   * Gets campaigns with proper tenant filtering
   */
  async getCampaigns(requestedClientId?: string): Promise<any[]> {
    const clientId = validateClientAccess(this.tenantContext, requestedClientId);
    if (!clientId) {
      return []; // Super admin with no specified client gets empty array
    }
    return storage.getCampaignsByClient(clientId);
  }

  /**
   * Gets analytics events with proper tenant filtering
   */
  async getAnalyticsEvents(requestedClientId?: string, startDate?: Date, endDate?: Date): Promise<any[]> {
    const clientId = validateClientAccess(this.tenantContext, requestedClientId);
    if (!clientId) {
      return []; // Super admin with no specified client gets empty array
    }
    return storage.getAnalyticsEventsByClient(clientId, startDate, endDate);
  }

  /**
   * Validates entity access for tenant isolation
   */
  async validateEntityAccess(entityType: 'campaign' | 'user', entityId: string): Promise<boolean> {
    try {
      let entity: any;
      
      switch (entityType) {
        case 'campaign':
          entity = await storage.getCampaign(entityId);
          break;
        case 'user':
          entity = await storage.getUser(entityId);
          break;
        default:
          return false;
      }

      if (!entity) {
        return false;
      }

      // Check if user can access this entity's client
      return this.tenantContext.canAccessClient(entity.clientId);
    } catch (error) {
      console.error(`Entity access validation error:`, error);
      return false;
    }
  }
}

/**
 * SECURITY: Express middleware factory for different tenant access patterns
 */
export const tenantMiddleware = {
  // Requires explicit clientId for all roles
  requireClientId: () => createTenantMiddleware({ requireClientId: true }),
  
  // Allows super admin to access without specifying clientId (returns empty data)
  allowSuperAdminWildcard: () => createTenantMiddleware({ allowSuperAdminWildcard: true }),
  
  // Standard tenant filtering
  standard: () => createTenantMiddleware(),
};

/**
 * SECURITY: Audit log for tenant access
 */
export function logTenantAccess(
  userId: string, 
  action: string, 
  resourceType: string, 
  resourceId: string, 
  clientId: string
): void {
  console.log(`🔍 TENANT ACCESS: User ${userId} performed ${action} on ${resourceType}:${resourceId} for client ${clientId}`);
}

// Type augmentation for AuthenticatedRequest
declare module "./types" {
  interface AuthenticatedRequest {
    tenantContext?: TenantContext;
    validatedClientId?: string;
  }
}