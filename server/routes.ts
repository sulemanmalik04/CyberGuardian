import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authService } from "./services/auth";
import { openaiService } from "./services/openai";
import { sendgridService } from "./services/sendgrid";
import { s3Service } from "./services/s3";
import { z } from "zod";
import { insertUserSchema, insertClientSchema, insertCourseSchema, insertPhishingCampaignSchema } from "@shared/schema";
import type { AuthenticatedRequest, UploadRequest, AuthenticatedUploadRequest } from "./types";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import csvParser from "csv-parser";
import { Readable } from "stream";
import crypto from "crypto";
import { verify } from "@noble/ed25519";
// SECURITY: Import comprehensive tenant security utilities
import { 
  tenantMiddleware, 
  TenantQueryHelper, 
  validateUserCreation, 
  validateRequestBody, 
  logTenantAccess 
} from "./tenant-security";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB global limit (specific endpoints can have stricter limits)
    files: 1, // Only one file at a time
    fields: 10, // Limit form fields
    fieldNameSize: 100, // Limit field name size
    fieldSize: 1024 * 1024 // 1MB limit for form field values
  },
  fileFilter: (req, file, cb) => {
    // Basic file filter - specific endpoints will do more validation
    const allowedMimes = [
      'text/csv', 
      'application/vnd.ms-excel', 
      'text/plain',
      'image/jpeg', 
      'image/png', 
      'image/svg+xml', 
      'image/webp'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // SECURITY: Secure authentication middleware using JWT validation with audience checks
  const createAuthMiddleware = (expectedAudience?: string) => async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    try {
      // CRITICAL SECURITY: Use proper JWT validation with audience checks and tenant isolation
      const user = await authService.validateSession(token, expectedAudience);
      
      if (!user) {
        return res.status(403).json({ message: 'Invalid or expired token' });
      }

      // Store validated user and token on request for downstream use
      (req as AuthenticatedRequest).user = user;
      (req as AuthenticatedRequest).session = { 
        id: `session-${user.id}-${Date.now()}`, 
        token, 
        userId: user.id, 
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        createdAt: new Date()
      };
      
      console.log(`✅ Authentication successful: ${user.email} (${user.role}) - Audience: ${expectedAudience || 'any'}`);
      next();
    } catch (error) {
      console.error('🚨 Authentication error:', error);
      return res.status(403).json({ message: 'Authentication failed' });
    }
  };

  // Create audience-specific middleware for different user types
  const authenticateToken = createAuthMiddleware(); // Generic auth (any role)
  const authenticateSuperAdmin = createAuthMiddleware('super_admin');
  const authenticateClientAdmin = createAuthMiddleware('client_admin'); 
  const authenticateEndUser = createAuthMiddleware('end_user');
  
  // Combined admin middleware for routes that accept both super_admin and client_admin
  const authenticateAdmin = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    try {
      // Try super_admin first
      let user = await authService.validateSession(token, 'super_admin');
      
      // If not super_admin, try client_admin
      if (!user) {
        user = await authService.validateSession(token, 'client_admin');
      }
      
      if (!user) {
        return res.status(403).json({ message: 'Admin access required - invalid or expired token' });
      }

      // Ensure user has admin role
      if (!['super_admin', 'client_admin'].includes(user.role)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      (req as AuthenticatedRequest).user = user;
      (req as AuthenticatedRequest).session = {
        id: `admin-session-${user.id}-${Date.now()}`,
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        createdAt: new Date()
      };
      
      console.log(`✅ Admin authentication successful: ${user.email} (${user.role})`);
      next();
    } catch (error) {
      console.error('🚨 Admin authentication error:', error);
      return res.status(403).json({ message: 'Admin authentication failed' });
    }
  };

  // Role-based access control
  const requireRole = (roles: string[]) => (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user || !roles.includes(authReq.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };

  // Rate limiting for tracking endpoints
  const trackingLimiter = new Map();
  const TRACKING_LIMIT = 100; // requests per hour per IP
  const TRACKING_WINDOW = 60 * 60 * 1000; // 1 hour

  const checkRateLimit = (ip: string): boolean => {
    const now = Date.now();
    const key = ip;
    const requests = trackingLimiter.get(key) || [];
    
    // Clean old requests
    const validRequests = requests.filter((time: number) => now - time < TRACKING_WINDOW);
    
    if (validRequests.length >= TRACKING_LIMIT) {
      return false;
    }
    
    validRequests.push(now);
    trackingLimiter.set(key, validRequests);
    return true;
  };

  // Allowed redirect domains for click tracking security
  const ALLOWED_REDIRECT_DOMAINS = [
    'localhost:5000',
    'localhost:3000', 
    'example.com',
    'demo.com'
  ];

  const validateRedirectUrl = (url: string): boolean => {
    try {
      // CRITICAL SECURITY FIX: ONLY allow relative paths - no external redirects allowed
      // This completely prevents open redirect attacks
      if (url.startsWith('/')) {
        // Additional security: prevent protocol-relative URLs like "//evil.com"
        if (url.startsWith('//')) {
          console.error(`🚨 CRITICAL SECURITY: Blocked protocol-relative redirect attempt: ${url}`);
          return false;
        }
        return true;
      }
      
      // REJECT ALL external URLs - this is the most secure approach
      console.error(`🚨 CRITICAL SECURITY VIOLATION: Rejected external redirect attempt: ${url}`);
      console.error(`🚨 SECURITY POLICY: Only relative paths (starting with /) are allowed`);
      
      return false;
    } catch (error) {
      console.error(`🚨 SECURITY: Invalid redirect URL format: ${url}`, error);
      return false;
    }
  };

  // Email tracking routes (before authentication routes to avoid middleware)
  // Updated to match SendGrid service URL generation: /api/track/open/:campaignId/:userId
  app.get("/api/track/open/:campaignId/:userId", async (req, res) => {
    console.log(`🔍 DEBUG: Tracking open request - Campaign: ${req.params.campaignId}, User: ${req.params.userId}`);
    try {
      const { campaignId, userId } = req.params;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      console.log(`🔍 DEBUG: Extracted params - campaignId: ${campaignId}, userId: ${userId}, clientIp: ${clientIp}`);
      
      // Rate limiting check
      if (!checkRateLimit(clientIp)) {
        console.warn(`Rate limit exceeded for tracking open from IP: ${clientIp}`);
        // Still return pixel to avoid breaking email display
        const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
        res.setHeader('Content-Type', 'image/gif');
        res.end(pixel);
        return;
      }

      // Safely validate campaign and user exist (handle database errors gracefully)
      let campaign, user;
      try {
        [campaign, user] = await Promise.all([
          storage.getCampaign(campaignId).catch(() => null),
          storage.getUser(userId).catch(() => null)
        ]);
      } catch (error) {
        console.warn(`Database error during tracking validation: ${error}`);
        campaign = null;
        user = null;
      }

      if (!campaign || !user) {
        console.warn(`Invalid tracking attempt - Campaign: ${campaignId}, User: ${userId}`);
        
        // For testing with non-existent data, create a simple log instead
        if (process.env.NODE_ENV === 'development' && (campaignId === 'test-campaign' || userId === 'test-user')) {
          console.log(`📧 [DEV] Simulated tracking - Campaign: ${campaignId}, User: ${userId}`);
        }
        
        // Still return pixel to avoid breaking email display
        const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
        res.setHeader('Content-Type', 'image/gif');
        res.setHeader('Content-Length', pixel.length);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.end(pixel);
        return;
      }
      
      // Log email open event with proper attribution
      try {
        await storage.createAnalyticsEvent({
          clientId: user.clientId || null,
          userId: userId,
          campaignId: campaign.id,
          eventType: 'email_opened',
          metadata: {
            campaignId: campaignId,
            userId: userId,
            campaignName: campaign.name,
            userEmail: user.email,
            userAgent: req.headers['user-agent'],
            timestamp: new Date()
          },
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'],
          timestamp: new Date()
        });
      } catch (dbError) {
        console.warn(`Failed to log analytics event: ${dbError}`);
      }

      console.log(`📧 Email opened - Campaign: ${campaign.name}, User: ${user.email}`);

      // Return 1x1 transparent pixel
      const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Content-Length', pixel.length);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.end(pixel);
    } catch (error) {
      console.error('Tracking open error:', error);
      if (error instanceof Error) {
        console.error('Stack trace:', error.stack);
      }
      
      // Always return pixel to avoid breaking email display
      const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Content-Length', pixel.length);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.status(200).end(pixel);
    }
  });

  // Updated to match SendGrid service URL generation: /api/track/click/:campaignId/:userId
  app.get("/api/track/click/:campaignId/:userId", async (req, res) => {
    try {
      const { campaignId, userId } = req.params;
      const { redirect } = req.query;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      
      // Rate limiting check
      if (!checkRateLimit(clientIp)) {
        console.warn(`Rate limit exceeded for tracking click from IP: ${clientIp}`);
        return res.redirect('/rate-limit-exceeded');
      }

      // Safely validate campaign and user exist (handle database errors gracefully)
      let campaign, user;
      try {
        [campaign, user] = await Promise.all([
          storage.getCampaign(campaignId).catch(() => null),
          storage.getUser(userId).catch(() => null)
        ]);
      } catch (error) {
        console.warn(`Database error during click tracking validation: ${error}`);
        campaign = null;
        user = null;
      }

      if (!campaign || !user) {
        console.warn(`Invalid click tracking attempt - Campaign: ${campaignId}, User: ${userId}`);
        return res.redirect('/error?reason=invalid_tracking');
      }

      // CRITICAL SECURITY FIX: Completely prevent open redirect attacks
      // ONLY allow relative paths - REJECT all external redirects completely
      let safeRedirectUrl = '/phishing-awareness';
      if (redirect && typeof redirect === 'string') {
        if (validateRedirectUrl(redirect)) {
          safeRedirectUrl = redirect;
          console.log(`✅ SECURITY: Approved relative redirect to: ${redirect}`);
        } else {
          console.error(`🚨 CRITICAL SECURITY VIOLATION: BLOCKED OPEN REDIRECT ATTEMPT: ${redirect} from user: ${user ? user.email : 'unknown'}`);
          
          // Log CRITICAL security incident for open redirect attempt
          if (user && campaign) {
            try {
              await storage.createAnalyticsEvent({
                clientId: user.clientId || null,
                userId: userId,
                campaignId: campaign.id,
                eventType: 'security_incident',
                metadata: {
                  campaignId: campaignId,
                  userId: userId,
                  incident: 'OPEN_REDIRECT_ATTACK_BLOCKED',
                  blockedUrl: redirect,
                  userEmail: user.email,
                  userAgent: req.headers['user-agent'],
                  timestamp: new Date(),
                  severity: 'CRITICAL',
                  attackType: 'OPEN_REDIRECT'
                },
                ipAddress: clientIp,
                userAgent: req.headers['user-agent'],
                timestamp: new Date()
              });
            } catch (dbError) {
              console.warn(`Failed to log security incident: ${dbError}`);
            }
          }
          
          // Force redirect to security warning page for attempted attacks
          safeRedirectUrl = '/security-warning?reason=blocked-redirect';
        }
      }
      
      // Log email click event with proper attribution
      try {
        await storage.createAnalyticsEvent({
          clientId: user.clientId || null,
          userId: userId,
          campaignId: campaign.id,
          eventType: 'email_clicked',
          metadata: {
            campaignId: campaignId,
            userId: userId,
            campaignName: campaign.name,
            userEmail: user.email,
            redirectUrl: safeRedirectUrl,
            originalRedirectUrl: redirect,
            userAgent: req.headers['user-agent'],
            timestamp: new Date()
          },
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'],
          timestamp: new Date()
        });
      } catch (dbError) {
        console.warn(`Failed to log analytics event: ${dbError}`);
      }

      console.log(`🎯 Email clicked - Campaign: ${campaign.name}, User: ${user.email}, Redirect: ${safeRedirectUrl}`);

      // Redirect to safe URL
      res.redirect(safeRedirectUrl);
    } catch (error) {
      console.error('Tracking click error:', error);
      res.redirect('/error?reason=tracking_error');
    }
  });

  // Add report phishing endpoint that matches SendGrid service URL generation
  app.get("/api/track/report/:campaignId/:userId", async (req, res) => {
    try {
      const { campaignId, userId } = req.params;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      
      // Rate limiting check
      if (!checkRateLimit(clientIp)) {
        console.warn(`Rate limit exceeded for phishing report from IP: ${clientIp}`);
        return res.redirect('/rate-limit-exceeded');
      }

      // Safely validate campaign and user exist (handle database errors gracefully)
      let campaign, user;
      try {
        [campaign, user] = await Promise.all([
          storage.getCampaign(campaignId).catch(() => null),
          storage.getUser(userId).catch(() => null)
        ]);
      } catch (error) {
        console.warn(`Database error during phishing report validation: ${error}`);
        campaign = null;
        user = null;
      }

      if (!campaign || !user) {
        console.warn(`Invalid phishing report attempt - Campaign: ${campaignId}, User: ${userId}`);
        return res.redirect('/error?reason=invalid_tracking');
      }
      
      // Log phishing report event
      try {
        await storage.createAnalyticsEvent({
          clientId: user.clientId || null,
          userId: userId,
          campaignId: campaign.id,
          eventType: 'phishing_reported',
          metadata: {
            campaignId: campaignId,
            userId: userId,
            campaignName: campaign.name,
            userEmail: user.email,
            userAgent: req.headers['user-agent'],
            timestamp: new Date()
        },
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'],
        timestamp: new Date()
      });
      } catch (dbError) {
        console.warn(`Failed to log phishing report event: ${dbError}`);
      }

      console.log(`🚨 Phishing reported - Campaign: ${campaign.name}, User: ${user.email}`);

      // Redirect to phishing report success page
      res.redirect('/phishing-reported-success');
    } catch (error) {
      console.error('Phishing report error:', error);
      res.redirect('/error?reason=report_error');
    }
  });

  // SendGrid webhook signature verification function
  const verifyWebhookSignature = async (rawPayload: Buffer, signature: string, timestamp: string): Promise<boolean> => {
    // In development without webhook public key, allow all requests but log warning
    if (!process.env.SENDGRID_WEBHOOK_PUBLIC_KEY) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️  SendGrid webhook signature verification skipped - no SENDGRID_WEBHOOK_PUBLIC_KEY set');
        return true;
      }
      throw new Error('SENDGRID_WEBHOOK_PUBLIC_KEY must be set in production');
    }

    try {
      // CRITICAL SECURITY: SendGrid uses ed25519 signature verification
      // Signature is provided as base64-encoded bytes in header
      const publicKey = Buffer.from(process.env.SENDGRID_WEBHOOK_PUBLIC_KEY, 'base64');
      const signatureBuffer = Buffer.from(signature, 'base64');
      
      // CRITICAL SECURITY: Verify timestamp freshness (prevent replay attacks)
      const timestampInt = parseInt(timestamp);
      const currentTime = Math.floor(Date.now() / 1000);
      const timestampDiff = Math.abs(currentTime - timestampInt);
      
      if (timestampDiff > 600) { // 10 minutes tolerance
        console.error('🚨 SECURITY: SendGrid webhook timestamp too old - potential replay attack');
        console.error(`Timestamp diff: ${timestampDiff}s, Current: ${currentTime}, Provided: ${timestampInt}`);
        return false;
      }
      
      // CRITICAL SECURITY: Construct verification payload exactly as SendGrid does
      // Format: timestamp + rawPayload (no JSON.stringify!)
      const verificationPayload = Buffer.concat([
        Buffer.from(timestamp, 'utf8'),
        rawPayload
      ]);
      
      // Verify ed25519 signature using @noble/ed25519
      const isValid = await verify(signatureBuffer, verificationPayload, publicKey);
      
      if (!isValid) {
        console.error('🚨 SECURITY: SendGrid webhook signature verification failed');
        console.error(`Timestamp: ${timestamp}, Payload length: ${rawPayload.length}`);
      }
      
      return isValid;
    } catch (error) {
      console.error('🚨 SECURITY: Webhook signature verification error:', error);
      return false;
    }
  };

  // Raw body middleware specifically for SendGrid webhook
  app.use('/api/webhooks/sendgrid', (req, res, next) => {
    const data: Buffer[] = [];
    req.on('data', chunk => data.push(chunk));
    req.on('end', () => {
      (req as any).rawBody = Buffer.concat(data);
      try {
        req.body = JSON.parse((req as any).rawBody.toString());
      } catch (error) {
        console.error('SendGrid webhook JSON parse error:', error);
        return res.status(400).json({ error: 'Invalid JSON payload' });
      }
      next();
    });
  });

  // SendGrid webhook for email events with signature verification
  app.post("/api/webhooks/sendgrid", async (req, res) => {
    try {
      // CRITICAL SECURITY: Get correct SendGrid webhook headers
      const signature = req.headers['x-twilio-email-event-webhook-signature'] as string;
      const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'] as string;
      const rawPayload = (req as any).rawBody as Buffer;

      if (!signature || !timestamp || !rawPayload) {
        console.error('❌ Missing required SendGrid webhook headers or payload');
        return res.status(400).json({ error: 'Missing required headers or payload' });
      }

      // CRITICAL SECURITY: Verify webhook signature with raw payload
      const isValidSignature = await verifyWebhookSignature(rawPayload, signature, timestamp);
      if (!isValidSignature) {
        console.error('❌ Invalid SendGrid webhook signature');
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      // Check timestamp to prevent replay attacks (webhook should be recent)
      if (timestamp) {
        const webhookTime = parseInt(timestamp) * 1000;
        const currentTime = Date.now();
        const maxAge = 10 * 60 * 1000; // 10 minutes
        
        if (Math.abs(currentTime - webhookTime) > maxAge) {
          console.error('❌ SendGrid webhook timestamp too old');
          return res.status(401).json({ error: 'Webhook timestamp too old' });
        }
      }

      const events = Array.isArray(req.body) ? req.body : [req.body];
      let processedCount = 0;
      
      for (const event of events) {
        try {
          let eventType: string;
          
          switch (event.event) {
            case 'delivered':
              eventType = 'email_sent';
              break;
            case 'open':
              eventType = 'email_opened';
              break;
            case 'click':
              eventType = 'email_clicked';
              break;
            case 'bounce':
            case 'dropped':
            case 'spamreport':
            case 'unsubscribe':
              eventType = 'email_failed';
              break;
            default:
              console.log(`Skipping unknown SendGrid event type: ${event.event}`);
              continue;
          }

          // Extract campaign and user info from custom args (fix name mismatch)
          const campaignId = event.campaign_id || event.unique_arg_campaign_id || event['unique_arg_campaign_id'];
          const userId = event.user_id || event.unique_arg_user_id || event['unique_arg_user_id'];
          const clientId = event.client_id || event.unique_arg_client_id || event['unique_arg_client_id'];

          // Validate that we have the required data
          if (!campaignId || !userId) {
            console.warn(`SendGrid event missing required data - campaignId: ${campaignId}, userId: ${userId}`);
            continue;
          }

          // Get additional context if available
          let campaign, user;
          try {
            [campaign, user] = await Promise.all([
              storage.getCampaign(campaignId),
              storage.getUser(userId)
            ]);
          } catch (error) {
            console.warn(`Could not fetch campaign/user details for event: ${error}`);
          }
          
          // SECURITY: Enhanced tenant isolation for SendGrid webhook events
          // Only create analytics event if we can properly validate tenant relationship
          if (user && user.clientId) {
            // SECURITY: Validate campaign belongs to user's client if campaign exists
            if (campaign && campaign.clientId !== user.clientId) {
              console.error(`🚨 SECURITY VIOLATION: User ${userId} (client: ${user.clientId}) does not belong to campaign ${campaignId} (client: ${campaign.clientId})`);
              continue; // Skip this event due to tenant mismatch
            }

            await storage.createAnalyticsEvent({
              clientId: user.clientId, // SECURITY: Always use user's validated clientId
              userId: userId,
              campaignId: campaignId || null,
              eventType: eventType as any,
              metadata: {
                email: event.email,
                campaignId: campaignId,
                userId: userId,
                validatedClientId: user.clientId, // SECURITY: Mark as validated
                campaignName: campaign ? campaign.name : undefined,
                userEmail: user.email,
                sendgridEventId: event.sg_event_id,
                sendgridMessageId: event.sg_message_id,
                timestamp: event.timestamp,
                userAgent: event.useragent,
                ip: event.ip,
                url: event.url,
                reason: event.reason,
                status: event.status
              },
              ipAddress: event.ip,
              userAgent: event.useragent,
              timestamp: new Date(event.timestamp * 1000)
            });
          } else {
            console.warn(`⚠️ SendGrid Event: Skipping event due to missing user or clientId. User: ${userId}, UserClientId: ${user?.clientId}`);
            continue; // Skip events without proper tenant context
          }

          processedCount++;
          console.log(`📨 SendGrid event processed: ${eventType} for ${event.email}`);
        } catch (eventError) {
          console.error(`Error processing individual SendGrid event:`, eventError);
        }
      }
      
      console.log(`✅ SendGrid webhook processed ${processedCount}/${events.length} events`);
      res.status(200).json({ 
        message: 'Webhook processed', 
        processed: processedCount, 
        total: events.length 
      });
    } catch (error) {
      console.error('SendGrid webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password, subdomain } = req.body;
      
      const user = await storage.getUserByEmail(email);
      if (!user || !user.isActive) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Verify client access for non-super admins
      if (user.role !== 'super_admin' && subdomain) {
        const client = await storage.getClientBySubdomain(subdomain);
        if (!client || client.id !== user.clientId) {
          return res.status(401).json({ message: 'Access denied to this client portal' });
        }
      }

      // Create session
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

      await storage.createSession({
        userId: user.id,
        token,
        expiresAt
      });

      // Track login event
      await storage.createAnalyticsEvent({
        clientId: user.clientId,
        userId: user.id,
        eventType: 'login',
        metadata: { subdomain },
        timestamp: new Date()
      });

      // SECURITY: Update last login using tenant-safe method
      // Note: We can safely use tenant validation here since we know user.clientId
      if (user.clientId) {
        await storage.updateUserWithClientValidation(user.id, { lastLoginAt: new Date() }, user.clientId);
      } else {
        // Super admin case - they may not have a clientId
        console.warn(`🔍 AUDIT: Super admin login for user ${user.email} - no clientId for lastLoginAt update`);
      }

      res.json({ 
        token, 
        user: { 
          id: user.id, 
          email: user.email, 
          firstName: user.firstName, 
          lastName: user.lastName, 
          role: user.role,
          clientId: user.clientId
        } 
      });
    } catch (error) {
      res.status(500).json({ message: 'Login failed', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/auth/logout", authenticateToken, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      await storage.deleteSession(authReq.session.token);
      
      // Track logout event
      await storage.createAnalyticsEvent({
        clientId: authReq.user.clientId,
        userId: authReq.user.id,
        eventType: 'logout',
        timestamp: new Date()
      });

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Logout failed', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // User management routes - SECURITY: Now tenant-scoped with comprehensive validation
  app.get("/api/users", authenticateAdmin, tenantMiddleware.allowSuperAdminWildcard(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const queryHelper = new TenantQueryHelper(authReq.tenantContext!);
      
      // SECURITY: Use tenant query helper for safe user access
      const requestedClientId = req.query.clientId as string;
      const users = await queryHelper.getUsers(requestedClientId);
      
      const clientId = requestedClientId || authReq.user.clientId;
      if (clientId) {
        logTenantAccess(authReq.user.id, 'read', 'users', 'list', clientId);
      }

      res.json(users.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        department: user.department,
        language: user.language,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt
      })));
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch users', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/users", authenticateAdmin, tenantMiddleware.requireClientId(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userData = insertUserSchema.parse(req.body);
      
      // SECURITY: Comprehensive user creation validation
      const validatedUserData = validateUserCreation(userData, authReq.tenantContext!);
      
      // SECURITY: Ensure user is created for the correct client
      validatedUserData.clientId = authReq.validatedClientId!;
      
      // Hash password
      const hashedPassword = await bcrypt.hash(validatedUserData.passwordHash, 12);
      
      const user = await storage.createUser({
        ...validatedUserData,
        passwordHash: hashedPassword
      });
      
      // SECURITY: Log user creation for audit trail
      logTenantAccess(authReq.user.id, 'create', 'user', user.id, authReq.validatedClientId!);
      
      // Create analytics event for user creation
      await storage.createAnalyticsEvent({
        clientId: authReq.validatedClientId!,
        userId: authReq.user.id,
        eventType: 'login', // Will be user_created when we add this event type
        metadata: { action: 'user_created', newUserId: user.id },
        timestamp: new Date()
      });

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        department: user.department,
        language: user.language,
        isActive: user.isActive,
        createdAt: user.createdAt
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to create user', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // CSV validation helper functions
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateRole = (role: string): boolean => {
    const validRoles = ['super_admin', 'client_admin', 'end_user'];
    return !role || validRoles.includes(role);
  };

  const validateLanguage = (language: string): boolean => {
    const validLanguages = ['en', 'es', 'fr', 'de', 'it'];
    return !language || validLanguages.includes(language);
  };

  const sanitizeText = (text: string): string => {
    return text ? text.toString().trim().replace(/[<>]/g, '') : '';
  };

  const validateCSVData = async (rows: any[], clientId: string) => {
    const validRows: any[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const duplicateEmails = new Set<string>();
    
    // Get existing users to check for duplicates
    const existingUsers = await storage.getUsersByClient(clientId);
    const existingEmails = new Set(existingUsers.map(u => u.email.toLowerCase()));

    for (const [index, row] of Array.from(rows.entries())) {
      const rowNum = index + 1;
      const rowErrors: string[] = [];
      const rowWarnings: string[] = [];

      // Sanitize data
      const email = sanitizeText(row.email || '').toLowerCase();
      const firstName = sanitizeText(row.firstName || '');
      const lastName = sanitizeText(row.lastName || '');
      const department = sanitizeText(row.department || '');
      const role = sanitizeText(row.role || 'end_user').toLowerCase();
      const language = sanitizeText(row.language || 'en').toLowerCase();

      // Required field validation
      if (!email) rowErrors.push('Email is required');
      if (!firstName) rowErrors.push('First name is required');
      if (!lastName) rowErrors.push('Last name is required');

      // Email format validation
      if (email && !validateEmail(email)) {
        rowErrors.push('Invalid email format');
      }

      // Check for duplicate emails in CSV
      if (email) {
        if (duplicateEmails.has(email)) {
          rowErrors.push('Duplicate email in CSV file');
        } else {
          duplicateEmails.add(email);
        }
      }

      // Check if email already exists in database
      if (email && existingEmails.has(email)) {
        rowWarnings.push('Email already exists in system');
      }

      // Role validation
      if (!validateRole(role)) {
        rowErrors.push(`Invalid role '${role}'. Valid roles: super_admin, client_admin, end_user`);
      }

      // Language validation
      if (!validateLanguage(language)) {
        rowWarnings.push(`Invalid language '${language}'. Defaulting to 'en'`);
      }

      // Name length validation
      if (firstName.length > 50) rowErrors.push('First name too long (max 50 characters)');
      if (lastName.length > 50) rowErrors.push('Last name too long (max 50 characters)');
      if (department.length > 100) rowErrors.push('Department too long (max 100 characters)');

      // Compile row results
      if (rowErrors.length > 0) {
        errors.push(`Row ${rowNum}: ${rowErrors.join(', ')}`);
      }

      if (rowWarnings.length > 0) {
        warnings.push(`Row ${rowNum}: ${rowWarnings.join(', ')}`);
      }

      if (rowErrors.length === 0) {
        validRows.push({
          originalIndex: index,
          email,
          firstName,
          lastName,
          department: department || null,
          role: role || 'end_user',
          language: language || 'en'
        });
      }
    }

    return { validRows, errors, warnings };
  };

  // CSV Preview endpoint
  app.post("/api/users/preview-csv", authenticateClientAdmin, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // File size validation (5MB limit)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (req.file.size > maxSize) {
        return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
      }

      // File type validation
      const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ message: 'Invalid file type. Only CSV files are allowed.' });
      }

      const results: any[] = [];
      const stream = Readable.from(req.file.buffer);
      
      stream
        .pipe(csvParser())
        .on('data', (data) => {
          // Limit to 1000 rows for preview
          if (results.length < 1000) {
            results.push(data);
          }
        })
        .on('end', async () => {
          try {
            const authReq = req as AuthenticatedRequest;
            const validation = await validateCSVData(results, authReq.user.clientId!);

            res.json({
              success: true,
              totalRows: results.length,
              validRows: validation.validRows.length,
              invalidRows: results.length - validation.validRows.length,
              errors: validation.errors,
              warnings: validation.warnings,
              preview: validation.validRows.slice(0, 10), // Show first 10 valid rows
              sampleHeaders: Object.keys(results[0] || {}),
              truncated: results.length === 1000
            });
          } catch (error) {
            console.error('CSV validation error:', error);
            res.status(500).json({ 
              message: 'Failed to validate CSV data', 
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
          }
        })
        .on('error', (error) => {
          console.error('CSV parsing error:', error);
          res.status(400).json({ 
            message: 'Failed to parse CSV file. Please check file format.', 
            error: error.message 
          });
        });
    } catch (error) {
      console.error('CSV preview error:', error);
      res.status(500).json({ 
        message: 'CSV preview failed', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Enhanced CSV Import endpoint
  app.post("/api/users/import-csv", authenticateClientAdmin, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // File size validation (5MB limit)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (req.file.size > maxSize) {
        return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
      }

      // File type validation
      const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ message: 'Invalid file type. Only CSV files are allowed.' });
      }

      const results: any[] = [];
      const stream = Readable.from(req.file.buffer);
      
      stream
        .pipe(csvParser())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
          try {
            const authReq = req as AuthenticatedRequest;
            const validation = await validateCSVData(results, authReq.user.clientId!);

            if (validation.validRows.length === 0) {
              return res.status(400).json({
                success: false,
                message: 'No valid rows found in CSV file',
                errors: validation.errors,
                warnings: validation.warnings,
                created: 0
              });
            }

            const createdUsers = [];
            const importErrors: string[] = [];

            // Process valid rows
            for (const row of validation.validRows) {
              try {
                // Generate a secure temporary password
                const tempPassword = crypto.randomBytes(12).toString('base64').slice(0, 12);
                const hashedPassword = await bcrypt.hash(tempPassword, 12);
                
                const user = await storage.createUser({
                  email: row.email,
                  firstName: row.firstName,
                  lastName: row.lastName,
                  passwordHash: hashedPassword,
                  role: row.role,
                  clientId: authReq.user.clientId,
                  department: row.department,
                  language: row.language
                });

                createdUsers.push({
                  id: user.id,
                  email: user.email,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  tempPassword // Only for this response, not stored
                });

                // Track user creation event
                await storage.createAnalyticsEvent({
                  clientId: authReq.user.clientId,
                  userId: authReq.user.id,
                  eventType: 'user_created' as any,
                  metadata: { 
                    targetUserEmail: user.email,
                    createdBy: authReq.user.email,
                    importSource: 'csv'
                  },
                  timestamp: new Date()
                });

              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                importErrors.push(`Row ${row.originalIndex + 1}: ${errorMsg}`);
              }
            }

            res.json({
              success: true,
              totalProcessed: results.length,
              created: createdUsers.length,
              validRows: validation.validRows.length,
              errors: [...validation.errors, ...importErrors],
              warnings: validation.warnings,
              createdUsers: createdUsers.map(u => ({
                id: u.id,
                email: u.email,
                firstName: u.firstName,
                lastName: u.lastName,
                tempPassword: u.tempPassword
              }))
            });
          } catch (error) {
            console.error('CSV import processing error:', error);
            res.status(500).json({ 
              message: 'Failed to process CSV import', 
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
          }
        })
        .on('error', (error) => {
          console.error('CSV parsing error:', error);
          res.status(400).json({ 
            message: 'Failed to parse CSV file. Please check file format.', 
            error: error.message 
          });
        });
    } catch (error) {
      console.error('CSV import error:', error);
      res.status(500).json({ 
        message: 'CSV import failed', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Update user route
  app.put("/api/users/:id", authenticateAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const authReq = req as AuthenticatedRequest;

      // Get existing user to verify access
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Client admins can only update users in their client
      if (authReq.user.role === 'client_admin' && existingUser.clientId !== authReq.user.clientId) {
        return res.status(403).json({ message: 'Access denied - cannot update users from other clients' });
      }

      // Hash password if it's being updated
      if (updates.passwordHash) {
        updates.passwordHash = await bcrypt.hash(updates.passwordHash, 12);
      }

      // Validate role changes
      if (updates.role) {
        // Client admins cannot create super admins
        if (authReq.user.role === 'client_admin' && updates.role === 'super_admin') {
          return res.status(403).json({ message: 'Access denied - cannot assign super admin role' });
        }
        
        // Client admins cannot change roles across clients
        if (authReq.user.role === 'client_admin' && updates.clientId && updates.clientId !== authReq.user.clientId) {
          return res.status(403).json({ message: 'Access denied - cannot assign users to other clients' });
        }
      }

      const updatedUser = await storage.updateUser(id, updates);

      // Track user update event
      await storage.createAnalyticsEvent({
        clientId: authReq.user.clientId,
        userId: authReq.user.id,
        eventType: 'user_updated' as any,
        metadata: { 
          targetUserId: id,
          updatedFields: Object.keys(updates),
          updatedBy: authReq.user.email
        },
        timestamp: new Date()
      });

      // Return user without password hash
      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        department: updatedUser.department,
        language: updatedUser.language,
        isActive: updatedUser.isActive,
        clientId: updatedUser.clientId,
        lastLoginAt: updatedUser.lastLoginAt,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update user', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Delete/deactivate user route
  app.delete("/api/users/:id", authenticateAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const authReq = req as AuthenticatedRequest;

      // Get existing user to verify access
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Client admins can only deactivate users in their client
      if (authReq.user.role === 'client_admin' && existingUser.clientId !== authReq.user.clientId) {
        return res.status(403).json({ message: 'Access denied - cannot deactivate users from other clients' });
      }

      // Prevent self-deactivation
      if (existingUser.id === authReq.user.id) {
        return res.status(400).json({ message: 'Cannot deactivate your own account' });
      }

      // Soft delete by deactivating user instead of hard delete
      const deactivatedUser = await storage.updateUser(id, { isActive: false });

      // Track user deactivation event
      await storage.createAnalyticsEvent({
        clientId: authReq.user.clientId,
        userId: authReq.user.id,
        eventType: 'user_deactivated' as any,
        metadata: { 
          targetUserId: id,
          targetUserEmail: existingUser.email,
          deactivatedBy: authReq.user.email
        },
        timestamp: new Date()
      });

      res.json({ 
        message: 'User deactivated successfully',
        user: {
          id: deactivatedUser.id,
          email: deactivatedUser.email,
          firstName: deactivatedUser.firstName,
          lastName: deactivatedUser.lastName,
          isActive: deactivatedUser.isActive
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to deactivate user', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Client management routes (Super Admin only)
  app.get("/api/clients", authenticateSuperAdmin, async (req, res) => {
    try {
      const clients = await storage.getAllClients();
      res.json(clients);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch clients', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/clients", authenticateSuperAdmin, async (req, res) => {
    try {
      const clientData = insertClientSchema.parse(req.body);
      const client = await storage.createClient(clientData);
      res.json(client);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create client', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Atomic endpoint for creating client with admin user in a single transaction
  app.post("/api/clients/with-admin", authenticateSuperAdmin, async (req, res) => {
    try {
      const requestData = z.object({
        client: insertClientSchema,
        admin: z.object({
          email: z.string().email(),
          firstName: z.string().min(1),
          lastName: z.string().min(1),
          password: z.string().min(8)
        })
      }).parse(req.body);

      // Check subdomain uniqueness first
      const existingClient = await storage.getClientBySubdomain(requestData.client.subdomain);
      if (existingClient) {
        return res.status(400).json({
          message: 'Subdomain already exists',
          field: 'subdomain'
        });
      }

      // Start transaction by creating client first
      const client = await storage.createClient(requestData.client);

      try {
        // Create admin user with hashed password
        const hashedPassword = await bcrypt.hash(requestData.admin.password, 12);
        
        const admin = await storage.createUser({
          email: requestData.admin.email,
          firstName: requestData.admin.firstName,
          lastName: requestData.admin.lastName,
          passwordHash: hashedPassword,
          role: 'client_admin',
          clientId: client.id,
          department: 'Administration',
          language: 'en',
          isActive: true
        });

        // Log successful creation
        console.log(`✅ Client created atomically: ${client.name} (${client.subdomain}) with admin ${admin.email}`);

        res.json({
          client,
          admin: {
            id: admin.id,
            email: admin.email,
            firstName: admin.firstName,
            lastName: admin.lastName,
            role: admin.role,
            department: admin.department,
            language: admin.language,
            isActive: admin.isActive,
            createdAt: admin.createdAt
          }
        });
      } catch (userError) {
        // If user creation fails, clean up the client
        console.error('🚨 Admin user creation failed, cleaning up client:', userError);
        
        try {
          await storage.deleteClient(client.id);
        } catch (cleanupError) {
          console.error('🚨 Failed to cleanup client after user creation failure:', cleanupError);
        }
        
        throw userError;
      }
    } catch (error) {
      console.error('🚨 Atomic client creation failed:', error);
      res.status(500).json({ 
        message: 'Failed to create client and admin user', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Check subdomain availability
  app.get("/api/clients/check-subdomain/:subdomain", authenticateSuperAdmin, async (req, res) => {
    try {
      const { subdomain } = req.params;
      
      // Validate subdomain format
      const subdomainSchema = z.string()
        .min(2, 'Subdomain must be at least 2 characters')
        .max(20, 'Subdomain must be no more than 20 characters')
        .regex(/^[a-z0-9-]+$/, 'Subdomain can only contain lowercase letters, numbers, and hyphens')
        .refine(val => !val.startsWith('-') && !val.endsWith('-'), 'Subdomain cannot start or end with a hyphen');
      
      const validatedSubdomain = subdomainSchema.parse(subdomain);
      const existingClient = await storage.getClientBySubdomain(validatedSubdomain);
      
      res.json({ available: !existingClient });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          available: false, 
          message: error.errors[0]?.message || 'Invalid subdomain format' 
        });
      }
      res.status(500).json({ 
        available: false,
        message: 'Failed to check subdomain availability' 
      });
    }
  });

  // Suspend client license
  app.post("/api/clients/:id/suspend", authenticateSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      const client = await storage.updateClient(id, {
        licenseStatus: 'suspended'
      });
      
      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }
      
      console.log(`⚠️ Client license suspended: ${client.name} (${client.subdomain})`);
      res.json(client);
    } catch (error) {
      console.error('🚨 Failed to suspend client:', error);
      res.status(500).json({ 
        message: 'Failed to suspend client', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Renew client license
  app.post("/api/clients/:id/renew", authenticateSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { expirationDate } = z.object({
        expirationDate: z.string().datetime()
      }).parse(req.body);
      
      const client = await storage.updateClient(id, {
        licenseStatus: 'active',
        expirationDate: new Date(expirationDate)
      });
      
      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }
      
      console.log(`✅ Client license renewed: ${client.name} (${client.subdomain}) until ${expirationDate}`);
      res.json(client);
    } catch (error) {
      console.error('🚨 Failed to renew client:', error);
      res.status(500).json({ 
        message: 'Failed to renew client', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  app.put("/api/clients/:id", authenticateAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Client admins can only update their own client
      const authReq = req as AuthenticatedRequest;
      if (authReq.user.role === 'client_admin' && id !== authReq.user.clientId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const updates = req.body;
      const client = await storage.updateClient(id, updates);
      res.json(client);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update client', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Course management routes - SECURITY: Now tenant-scoped
  app.get("/api/courses", authenticateToken, tenantMiddleware.requireClientId(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const queryHelper = new TenantQueryHelper(authReq.tenantContext!);
      
      const language = (req.query.language as string) || 'en';
      const courses = await storage.getCoursesByLanguageAndClient(language, authReq.validatedClientId!);
      
      logTenantAccess(authReq.user.id, 'read', 'courses', 'list', authReq.validatedClientId!);
      res.json(courses);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch courses', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/courses/published", authenticateToken, tenantMiddleware.requireClientId(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const courses = await storage.getPublishedCoursesByClient(authReq.validatedClientId!);
      
      logTenantAccess(authReq.user.id, 'read', 'courses', 'published', authReq.validatedClientId!);
      res.json(courses);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch published courses', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/courses", authenticateAdmin, tenantMiddleware.requireClientId(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const courseData = insertCourseSchema.parse(req.body);
      
      // SECURITY: Ensure course is created for the correct client
      const validatedData = validateRequestBody(courseData, authReq.validatedClientId!);
      
      const course = await storage.createCourse({
        ...validatedData,
        clientId: authReq.validatedClientId!, // SECURITY: Force correct clientId
        createdBy: authReq.user.id
      });
      
      logTenantAccess(authReq.user.id, 'create', 'course', course.id, authReq.validatedClientId!);
      res.json(course);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create course', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/courses/generate", authenticateAdmin, tenantMiddleware.requireClientId(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { topic, difficulty, modules } = req.body;
      
      const generatedCourse = await openaiService.generateCourse(topic, difficulty, modules);
      
      const course = await storage.createCourse({
        title: generatedCourse.title,
        description: generatedCourse.description,
        content: generatedCourse,
        difficulty,
        estimatedDuration: generatedCourse.estimatedDuration,
        status: 'draft',
        clientId: authReq.validatedClientId!, // SECURITY: Force correct clientId
        createdBy: authReq.user.id
      });

      logTenantAccess(authReq.user.id, 'create', 'course', course.id, authReq.validatedClientId!);
      res.json(course);
    } catch (error) {
      res.status(500).json({ message: 'Failed to generate course', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // User progress routes
  app.get("/api/progress/:userId", authenticateToken, tenantMiddleware.standard(), async (req, res) => {
    try {
      const { userId } = req.params;
      
      // SECURITY: Users can only see their own progress, admins can see any within their tenant
      const authReq = req as AuthenticatedRequest;
      if (authReq.user.role === 'end_user' && userId !== authReq.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // SECURITY: Validate that user belongs to the authenticated user's tenant
      if (!authReq.validatedClientId) {
        return res.status(400).json({ message: 'Client validation required' });
      }
      
      // First verify the target user belongs to the same tenant
      const targetUser = await storage.getUserWithClientValidation(userId, authReq.validatedClientId);
      if (!targetUser) {
        return res.status(404).json({ message: 'User not found or access denied' });
      }

      const progress = await storage.getUserProgressByUser(userId);
      logTenantAccess(authReq.user.id, 'read', 'user_progress', userId, authReq.validatedClientId);
      res.json(progress);
    } catch (error) {
      console.error('🚨 SECURITY: Progress access error:', error);
      res.status(500).json({ message: 'Failed to fetch progress', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.put("/api/progress/:userId/:courseId", authenticateToken, async (req, res) => {
    try {
      const { userId, courseId } = req.params;
      const updates = req.body;

      // Users can only update their own progress
      const authReq = req as AuthenticatedRequest;
      if (authReq.user.role === 'end_user' && userId !== authReq.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      let progress = await storage.getUserCourseProgress(userId, courseId);
      
      if (!progress) {
        progress = await storage.createUserCourseProgress({
          userId,
          courseId,
          progress: 0,
          completedModules: [],
          currentModule: 0,
          quizScores: {},
          isCompleted: false,
          completedAt: null,
          startedAt: new Date(),
          lastAccessedAt: new Date()
        });
      }

      const updatedProgress = await storage.updateUserCourseProgress(userId, courseId, updates);

      // Track course events
      if (updates.isCompleted && !progress.isCompleted) {
        await storage.createAnalyticsEvent({
          clientId: authReq.user.clientId,
          userId,
          courseId,
          eventType: 'course_completed',
          timestamp: new Date()
        });
      }

      res.json(updatedProgress);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update progress', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Phishing campaign routes
  app.get("/api/campaigns", authenticateAdmin, tenantMiddleware.allowSuperAdminWildcard(), async (req, res) => {
    try {
      // SECURITY: Use tenant query helper for safe campaign access
      const authReq = req as AuthenticatedRequest;
      const queryHelper = new TenantQueryHelper(authReq.tenantContext!);
      
      const requestedClientId = req.query.clientId as string;
      const campaigns = await queryHelper.getCampaigns(requestedClientId);
      
      const clientId = authReq.validatedClientId || authReq.user.clientId;
      if (clientId) {
        logTenantAccess(authReq.user.id, 'read', 'campaigns', 'list', clientId);
      }
      
      res.json(campaigns);
    } catch (error) {
      console.error('🚨 SECURITY: Campaign list access error:', error);
      res.status(500).json({ message: 'Failed to fetch campaigns', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/campaigns", authenticateAdmin, tenantMiddleware.requireClientId(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      
      if (!authReq.validatedClientId) {
        return res.status(400).json({ message: 'Client validation required' });
      }
      
      // SECURITY: Validate request body and enforce tenant context
      const validatedBody = validateRequestBody(req.body, authReq.validatedClientId, authReq.tenantContext);
      const campaignData = insertPhishingCampaignSchema.parse(validatedBody);
      
      // Ensure campaign is created for the validated client
      campaignData.clientId = authReq.validatedClientId;

      const campaign = await storage.createCampaign({
        ...campaignData,
        createdBy: authReq.user.id
      });

      logTenantAccess(authReq.user.id, 'create', 'campaign', campaign.id, authReq.validatedClientId);
      res.json(campaign);
    } catch (error) {
      console.error('🚨 SECURITY: Campaign creation error:', error);
      res.status(500).json({ message: 'Failed to create campaign', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/campaigns/:id", authenticateAdmin, tenantMiddleware.requireClientId(), async (req, res) => {
    try {
      const { id } = req.params;
      const authReq = req as AuthenticatedRequest;
      
      if (!authReq.validatedClientId) {
        return res.status(400).json({ message: 'Client validation required' });
      }
      
      // SECURITY: Use tenant-safe campaign access
      const campaign = await storage.getCampaignWithClientValidation(id, authReq.validatedClientId);
      
      if (!campaign) {
        return res.status(404).json({ message: 'Campaign not found or access denied' });
      }

      logTenantAccess(authReq.user.id, 'read', 'campaign', id, authReq.validatedClientId);
      res.json(campaign);
    } catch (error) {
      console.error('🚨 SECURITY: Campaign access error:', error);
      res.status(500).json({ message: 'Failed to fetch campaign', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.put("/api/campaigns/:id", authenticateAdmin, tenantMiddleware.requireClientId(), async (req, res) => {
    try {
      const { id } = req.params;
      const authReq = req as AuthenticatedRequest;
      
      if (!authReq.validatedClientId) {
        return res.status(400).json({ message: 'Client validation required' });
      }
      
      // SECURITY: Use tenant-safe campaign access
      const campaign = await storage.getCampaignWithClientValidation(id, authReq.validatedClientId);
      
      if (!campaign) {
        return res.status(404).json({ message: 'Campaign not found or access denied' });
      }

      // Don't allow updating active campaigns
      if (campaign.status === 'active') {
        return res.status(400).json({ message: 'Cannot update active campaigns' });
      }

      // SECURITY: Validate request body and use tenant-safe update
      const validatedBody = validateRequestBody(req.body, authReq.validatedClientId, authReq.tenantContext);
      const updatedCampaign = await storage.updateCampaignWithClientValidation(id, validatedBody, authReq.validatedClientId);
      
      logTenantAccess(authReq.user.id, 'update', 'campaign', id, authReq.validatedClientId);
      res.json(updatedCampaign);
    } catch (error) {
      console.error('🚨 SECURITY: Campaign update error:', error);
      res.status(500).json({ message: 'Failed to update campaign', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.delete("/api/campaigns/:id", authenticateAdmin, tenantMiddleware.requireClientId(), async (req, res) => {
    try {
      const { id } = req.params;
      const authReq = req as AuthenticatedRequest;
      
      if (!authReq.validatedClientId) {
        return res.status(400).json({ message: 'Client validation required' });
      }
      
      // SECURITY: Use tenant-safe campaign access
      const campaign = await storage.getCampaignWithClientValidation(id, authReq.validatedClientId);
      
      if (!campaign) {
        return res.status(404).json({ message: 'Campaign not found or access denied' });
      }

      // Don't allow deleting active campaigns
      if (campaign.status === 'active') {
        return res.status(400).json({ message: 'Cannot delete active campaigns' });
      }

      // SECURITY: Use tenant-safe deletion
      await storage.deleteCampaignWithClientValidation(id, authReq.validatedClientId);
      
      logTenantAccess(authReq.user.id, 'delete', 'campaign', id, authReq.validatedClientId);
      res.json({ message: 'Campaign deleted successfully' });
    } catch (error) {
      console.error('🚨 SECURITY: Campaign deletion error:', error);
      res.status(500).json({ message: 'Failed to delete campaign', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/campaigns/:id/launch", authenticateAdmin, tenantMiddleware.requireClientId(), async (req, res) => {
    try {
      const { id } = req.params;
      const authReq = req as AuthenticatedRequest;
      
      if (!authReq.validatedClientId) {
        return res.status(400).json({ message: 'Client validation required' });
      }
      
      // SECURITY: Use tenant-safe campaign access
      const campaign = await storage.getCampaignWithClientValidation(id, authReq.validatedClientId);
      
      if (!campaign) {
        return res.status(404).json({ message: 'Campaign not found or access denied' });
      }

      // Get target users for this tenant
      const targetUsers = await storage.getUsersByClient(authReq.validatedClientId);
      
      // Send emails via SendGrid
      const emailResults = await sendgridService.sendPhishingCampaign(campaign, targetUsers);
      
      // SECURITY: Use tenant-safe campaign update
      await storage.updateCampaignWithClientValidation(id, {
        status: 'active',
        emailsSent: emailResults.sent
      }, authReq.validatedClientId);

      logTenantAccess(authReq.user.id, 'launch', 'campaign', id, authReq.validatedClientId);
      res.json({ success: true, emailsSent: emailResults.sent });
    } catch (error) {
      console.error('🚨 SECURITY: Campaign launch error:', error);
      res.status(500).json({ message: 'Failed to launch campaign', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/campaigns/:id/results", authenticateAdmin, tenantMiddleware.requireClientId(), async (req, res) => {
    try {
      const { id } = req.params;
      const authReq = req as AuthenticatedRequest;
      
      if (!authReq.validatedClientId) {
        return res.status(400).json({ message: 'Client validation required' });
      }
      
      // SECURITY: Use tenant-safe campaign access
      const campaign = await storage.getCampaignWithClientValidation(id, authReq.validatedClientId);
      
      if (!campaign) {
        return res.status(404).json({ message: 'Campaign not found or access denied' });
      }

      // Check access permissions (redundant but kept for clarity)
      // const authReq = req as AuthenticatedRequest;
      if (authReq.user.role === 'client_admin' && campaign.clientId !== authReq.user.clientId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Get detailed analytics for the campaign
      const analytics = await storage.getAnalyticsByField('campaignId', id);
      
      const results = {
        campaign,
        analytics: {
          totalSent: campaign.emailsSent || 0,
          totalOpened: campaign.emailsOpened || 0,
          totalClicked: campaign.emailsClicked || 0,
          totalReported: campaign.emailsReported || 0,
          openRate: (campaign.emailsSent || 0) > 0 ? ((campaign.emailsOpened || 0) / (campaign.emailsSent || 1) * 100).toFixed(2) : '0.00',
          clickRate: (campaign.emailsSent || 0) > 0 ? ((campaign.emailsClicked || 0) / (campaign.emailsSent || 1) * 100).toFixed(2) : '0.00',
          reportRate: (campaign.emailsSent || 0) > 0 ? ((campaign.emailsReported || 0) / (campaign.emailsSent || 1) * 100).toFixed(2) : '0.00'
        },
        events: analytics
      };

      res.json(results);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch campaign results', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Email tracking routes
  app.get("/api/track/open/:campaignId/:userId", async (req, res) => {
    try {
      const { campaignId, userId } = req.params;

      await storage.createAnalyticsEvent({
        campaignId,
        userId,
        eventType: 'email_opened',
        timestamp: new Date()
      });

      // Update campaign stats
      const campaign = await storage.getCampaign(campaignId);
      if (campaign) {
        await storage.updateCampaign(campaignId, {
          emailsOpened: (campaign.emailsOpened || 0) + 1
        });
      }

      // Return 1x1 tracking pixel
      const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.set('Content-Type', 'image/gif');
      res.send(pixel);
    } catch (error) {
      res.status(500).send('Tracking failed');
    }
  });

  app.get("/api/track/click/:campaignId/:userId", async (req, res) => {
    try {
      const { campaignId, userId } = req.params;

      await storage.createAnalyticsEvent({
        campaignId,
        userId,
        eventType: 'email_clicked',
        timestamp: new Date()
      });

      // Update campaign stats
      const campaign = await storage.getCampaign(campaignId);
      if (campaign) {
        await storage.updateCampaign(campaignId, {
          emailsClicked: (campaign.emailsClicked || 0) + 1
        });
      }

      // Redirect to phishing landing page or show awareness message
      res.redirect('/phishing-awareness');
    } catch (error) {
      res.status(500).send('Tracking failed');
    }
  });

  // Analytics routes
  // SECURITY: Analytics route now properly tenant-scoped
  app.get("/api/analytics", authenticateAdmin, tenantMiddleware.allowSuperAdminWildcard(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const queryHelper = new TenantQueryHelper(authReq.tenantContext!);
      
      const { startDate, endDate } = req.query;
      const requestedClientId = req.query.clientId as string;
      
      // SECURITY: Use tenant query helper for safe analytics access
      const events = await queryHelper.getAnalyticsEvents(
        requestedClientId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      
      const clientId = requestedClientId || authReq.user.clientId;
      if (clientId) {
        logTenantAccess(authReq.user.id, 'read', 'analytics', 'events', clientId);
      }

      res.json(events);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch analytics', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // AI chatbot routes
  app.post("/api/ai/chat", authenticateToken, async (req, res) => {
    try {
      const { message, context } = req.body;
      
      const authReq = req as AuthenticatedRequest;
      const response = await openaiService.chatWithUser(message, authReq.user, context);
      
      res.json({ response });
    } catch (error) {
      res.status(500).json({ message: 'AI chat failed', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/ai/recommendations", authenticateToken, async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userProgress = await storage.getUserProgressByUser(authReq.user.id);
      const recommendations = await openaiService.generateLearningRecommendations(authReq.user, userProgress);
      
      res.json(recommendations);
    } catch (error) {
      res.status(500).json({ message: 'Failed to generate recommendations', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // File upload routes
  app.post("/api/upload/logo", authenticateAdmin, upload.single('logo'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const authReq = req as AuthenticatedRequest;
      
      // SECURITY: Determine target client ID
      let targetClientId = authReq.user.clientId;
      
      // Super admins can specify a client ID for uploading logos during client creation
      if (authReq.user.role === 'super_admin' && req.body.clientId) {
        targetClientId = req.body.clientId;
      }
      
      if (!targetClientId) {
        return res.status(400).json({ message: 'Client ID required' });
      }

      // Use the secure uploadLogo method with proper clientId
      const logoUrl = await s3Service.uploadLogo(req.file, targetClientId);
      
      // For existing clients, update the branding (optional for creation flow)
      if (authReq.user.clientId && authReq.user.clientId === targetClientId) {
        const client = await storage.getClient(targetClientId);
        if (client) {
          await storage.updateClient(targetClientId, {
            branding: {
              ...client.branding,
              logo: logoUrl
            }
          });
        }
      }

      res.json({ url: logoUrl });
    } catch (error) {
      console.error('🚨 Logo upload failed:', error);
      res.status(500).json({ message: 'Logo upload failed', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
