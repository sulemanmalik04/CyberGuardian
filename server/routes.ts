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
      cb(new Error('Invalid file type'), false);
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    try {
      const session = await storage.getSession(token);
      if (!session || session.expiresAt < new Date()) {
        return res.status(403).json({ message: 'Invalid or expired token' });
      }

      const user = await storage.getUser(session.userId);
      if (!user) {
        return res.status(403).json({ message: 'User not found' });
      }

      (req as AuthenticatedRequest).user = user;
      (req as AuthenticatedRequest).session = session;
      next();
    } catch (error) {
      console.error('Authentication error:', error);
      return res.status(403).json({ message: 'Invalid token' });
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
      console.error('Stack trace:', error.stack);
      
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
          
          await storage.createAnalyticsEvent({
            clientId: clientId || (user ? user.clientId : null),
            userId: userId,
            eventType: eventType as any,
            metadata: {
              email: event.email,
              campaignId: campaignId,
              userId: userId,
              clientId: clientId,
              campaignName: campaign ? campaign.name : undefined,
              userEmail: user ? user.email : event.email,
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

      // Update last login
      await storage.updateUser(user.id, { lastLoginAt: new Date() });

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

  // User management routes
  app.get("/api/users", authenticateToken, requireRole(['super_admin', 'client_admin']), async (req, res) => {
    try {
      let users;
      const authReq = req as AuthenticatedRequest;
      if (authReq.user.role === 'super_admin') {
        // Super admin can see all users
        const clientId = req.query.clientId as string;
        users = clientId ? await storage.getUsersByClient(clientId) : [];
      } else {
        // Client admin can only see users from their client
        users = await storage.getUsersByClient(authReq.user.clientId!);
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

  app.post("/api/users", authenticateToken, requireRole(['super_admin', 'client_admin']), async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Hash password
      const hashedPassword = await bcrypt.hash(userData.passwordHash, 12);
      
      // Set client ID for client admins
      const authReq = req as AuthenticatedRequest;
      if (authReq.user.role === 'client_admin') {
        userData.clientId = authReq.user.clientId;
      }

      const user = await storage.createUser({
        ...userData,
        passwordHash: hashedPassword
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
  app.post("/api/users/preview-csv", authenticateToken, requireRole(['client_admin']), upload.single('file'), async (req, res) => {
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
  app.post("/api/users/import-csv", authenticateToken, requireRole(['client_admin']), upload.single('file'), async (req, res) => {
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
  app.put("/api/users/:id", authenticateToken, requireRole(['super_admin', 'client_admin']), async (req, res) => {
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
  app.delete("/api/users/:id", authenticateToken, requireRole(['super_admin', 'client_admin']), async (req, res) => {
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
  app.get("/api/clients", authenticateToken, requireRole(['super_admin']), async (req, res) => {
    try {
      const clients = await storage.getAllClients();
      res.json(clients);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch clients', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/clients", authenticateToken, requireRole(['super_admin']), async (req, res) => {
    try {
      const clientData = insertClientSchema.parse(req.body);
      const client = await storage.createClient(clientData);
      res.json(client);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create client', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.put("/api/clients/:id", authenticateToken, requireRole(['super_admin', 'client_admin']), async (req, res) => {
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

  // Course management routes
  app.get("/api/courses", authenticateToken, async (req, res) => {
    try {
      const language = (req.query.language as string) || 'en';
      const courses = await storage.getCoursesByLanguage(language);
      res.json(courses);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch courses', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/courses/published", authenticateToken, async (req, res) => {
    try {
      const courses = await storage.getPublishedCourses();
      res.json(courses);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch published courses', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/courses", authenticateToken, requireRole(['super_admin', 'client_admin']), async (req, res) => {
    try {
      const courseData = insertCourseSchema.parse(req.body);
      const course = await storage.createCourse({
        ...courseData,
        createdBy: (req as AuthenticatedRequest).user.id
      });
      res.json(course);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create course', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/courses/generate", authenticateToken, requireRole(['super_admin', 'client_admin']), async (req, res) => {
    try {
      const { topic, difficulty, modules } = req.body;
      
      const generatedCourse = await openaiService.generateCourse(topic, difficulty, modules);
      
      const course = await storage.createCourse({
        title: generatedCourse.title,
        description: generatedCourse.description,
        content: generatedCourse,
        difficulty,
        estimatedDuration: generatedCourse.estimatedDuration,
        status: 'draft',
        createdBy: (req as AuthenticatedRequest).user.id
      });

      res.json(course);
    } catch (error) {
      res.status(500).json({ message: 'Failed to generate course', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // User progress routes
  app.get("/api/progress/:userId", authenticateToken, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Users can only see their own progress, admins can see any
      const authReq = req as AuthenticatedRequest;
      if (authReq.user.role === 'end_user' && userId !== authReq.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const progress = await storage.getUserProgressByUser(userId);
      res.json(progress);
    } catch (error) {
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
  app.get("/api/campaigns", authenticateToken, requireRole(['super_admin', 'client_admin']), async (req, res) => {
    try {
      let campaigns;
      const authReq = req as AuthenticatedRequest;
      if (authReq.user.role === 'super_admin') {
        const clientId = req.query.clientId as string;
        campaigns = clientId ? await storage.getCampaignsByClient(clientId) : [];
      } else {
        campaigns = await storage.getCampaignsByClient(authReq.user.clientId!);
      }
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch campaigns', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/campaigns", authenticateToken, requireRole(['super_admin', 'client_admin']), async (req, res) => {
    try {
      const campaignData = insertPhishingCampaignSchema.parse(req.body);
      
      const authReq = req as AuthenticatedRequest;
      if (authReq.user.role === 'client_admin') {
        campaignData.clientId = authReq.user.clientId!;
      }

      const campaign = await storage.createCampaign({
        ...campaignData,
        createdBy: (req as AuthenticatedRequest).user.id
      });

      res.json(campaign);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create campaign', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/campaigns/:id", authenticateToken, requireRole(['super_admin', 'client_admin']), async (req, res) => {
    try {
      const { id } = req.params;
      const campaign = await storage.getCampaign(id);
      
      if (!campaign) {
        return res.status(404).json({ message: 'Campaign not found' });
      }

      // Check access permissions
      const authReq = req as AuthenticatedRequest;
      if (authReq.user.role === 'client_admin' && campaign.clientId !== authReq.user.clientId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      res.json(campaign);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch campaign', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.put("/api/campaigns/:id", authenticateToken, requireRole(['super_admin', 'client_admin']), async (req, res) => {
    try {
      const { id } = req.params;
      const campaign = await storage.getCampaign(id);
      
      if (!campaign) {
        return res.status(404).json({ message: 'Campaign not found' });
      }

      // Check access permissions
      const authReq = req as AuthenticatedRequest;
      if (authReq.user.role === 'client_admin' && campaign.clientId !== authReq.user.clientId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Don't allow updating active campaigns
      if (campaign.status === 'active') {
        return res.status(400).json({ message: 'Cannot update active campaigns' });
      }

      const updates = req.body;
      const updatedCampaign = await storage.updateCampaign(id, updates);
      res.json(updatedCampaign);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update campaign', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.delete("/api/campaigns/:id", authenticateToken, requireRole(['super_admin', 'client_admin']), async (req, res) => {
    try {
      const { id } = req.params;
      const campaign = await storage.getCampaign(id);
      
      if (!campaign) {
        return res.status(404).json({ message: 'Campaign not found' });
      }

      // Check access permissions
      const authReq = req as AuthenticatedRequest;
      if (authReq.user.role === 'client_admin' && campaign.clientId !== authReq.user.clientId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Don't allow deleting active campaigns
      if (campaign.status === 'active') {
        return res.status(400).json({ message: 'Cannot delete active campaigns' });
      }

      await storage.deleteCampaign(id);
      res.json({ message: 'Campaign deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete campaign', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/campaigns/:id/launch", authenticateToken, requireRole(['super_admin', 'client_admin']), async (req, res) => {
    try {
      const { id } = req.params;
      const campaign = await storage.getCampaign(id);
      
      if (!campaign) {
        return res.status(404).json({ message: 'Campaign not found' });
      }

      // Check access permissions
      const authReq = req as AuthenticatedRequest;
      if (authReq.user.role === 'client_admin' && campaign.clientId !== authReq.user.clientId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Get target users
      const targetUsers = await storage.getUsersByClient(campaign.clientId);
      
      // Send emails via SendGrid
      const emailResults = await sendgridService.sendPhishingCampaign(campaign, targetUsers);
      
      // Update campaign status
      await storage.updateCampaign(id, {
        status: 'active',
        emailsSent: emailResults.sent
      });

      res.json({ success: true, emailsSent: emailResults.sent });
    } catch (error) {
      res.status(500).json({ message: 'Failed to launch campaign', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/campaigns/:id/results", authenticateToken, requireRole(['super_admin', 'client_admin']), async (req, res) => {
    try {
      const { id } = req.params;
      const campaign = await storage.getCampaign(id);
      
      if (!campaign) {
        return res.status(404).json({ message: 'Campaign not found' });
      }

      // Check access permissions
      const authReq = req as AuthenticatedRequest;
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
          openRate: campaign.emailsSent > 0 ? ((campaign.emailsOpened || 0) / campaign.emailsSent * 100).toFixed(2) : '0.00',
          clickRate: campaign.emailsSent > 0 ? ((campaign.emailsClicked || 0) / campaign.emailsSent * 100).toFixed(2) : '0.00',
          reportRate: campaign.emailsSent > 0 ? ((campaign.emailsReported || 0) / campaign.emailsSent * 100).toFixed(2) : '0.00'
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
  app.get("/api/analytics", authenticateToken, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      let events;

      const authReq = req as AuthenticatedRequest;
      if (authReq.user.role === 'super_admin') {
        const clientId = req.query.clientId as string;
        if (clientId) {
          events = await storage.getAnalyticsEventsByClient(
            clientId,
            startDate ? new Date(startDate as string) : undefined,
            endDate ? new Date(endDate as string) : undefined
          );
        }
      } else if (authReq.user.clientId) {
        events = await storage.getAnalyticsEventsByClient(
          authReq.user.clientId,
          startDate ? new Date(startDate as string) : undefined,
          endDate ? new Date(endDate as string) : undefined
        );
      }

      res.json(events || []);
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
  app.post("/api/upload/logo", authenticateToken, requireRole(['super_admin', 'client_admin']), upload.single('logo'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const logoUrl = await s3Service.uploadFile(req.file, 'logos');
      
      // Update client branding
      const authReq = req as AuthenticatedRequest;
      if (authReq.user.clientId) {
        const client = await storage.getClient(authReq.user.clientId);
        if (client) {
          await storage.updateClient(authReq.user.clientId, {
            branding: {
              ...client.branding,
              logo: logoUrl
            }
          });
        }
      }

      res.json({ logoUrl });
    } catch (error) {
      res.status(500).json({ message: 'Logo upload failed', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
