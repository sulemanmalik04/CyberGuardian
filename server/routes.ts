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

const upload = multer({ storage: multer.memoryStorage() });

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

  app.post("/api/users/import-csv", authenticateToken, requireRole(['client_admin']), upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const results: any[] = [];
      const errors: string[] = [];
      
      const stream = Readable.from(req.file.buffer);
      
      stream
        .pipe(csvParser())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
          const createdUsers = [];
          
          for (const [index, row] of Array.from(results.entries())) {
            try {
              if (!row.email || !row.firstName || !row.lastName) {
                errors.push(`Row ${index + 1}: Missing required fields (email, firstName, lastName)`);
                continue;
              }

              const hashedPassword = await bcrypt.hash('TempPass123!', 12);
              
              const user = await storage.createUser({
                email: row.email,
                firstName: row.firstName,
                lastName: row.lastName,
                passwordHash: hashedPassword,
                role: 'end_user',
                clientId: (req as AuthenticatedRequest).user.clientId,
                department: row.department || null,
                language: row.language || 'en'
              });

              createdUsers.push(user);
            } catch (error) {
              errors.push(`Row ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }

          res.json({
            success: true,
            created: createdUsers.length,
            errors
          });
        });
    } catch (error) {
      res.status(500).json({ message: 'CSV import failed', error: error instanceof Error ? error.message : 'Unknown error' });
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

  app.post("/api/campaigns/:id/launch", authenticateToken, requireRole(['super_admin', 'client_admin']), async (req, res) => {
    try {
      const { id } = req.params;
      const campaign = await storage.getCampaign(id);
      
      if (!campaign) {
        return res.status(404).json({ message: 'Campaign not found' });
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
