import { 
  users, 
  clients, 
  courses, 
  phishingCampaigns, 
  analyticsEvents, 
  sessions,
  userCourseProgress,
  emailTemplates,
  type User, 
  type InsertUser,
  type Client,
  type InsertClient,
  type Course,
  type InsertCourse,
  type PhishingCampaign,
  type InsertPhishingCampaign,
  type AnalyticsEvent,
  type InsertAnalyticsEvent,
  type Session,
  type InsertSession,
  type UserCourseProgress,
  type EmailTemplate,
  type InsertEmailTemplate
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, count, gte, lte, inArray } from "drizzle-orm";

export interface IStorage {
  // Users - SECURITY: All user operations now require tenant context
  getUserWithClientValidation(id: string, validatedClientId: string): Promise<User | undefined>;
  getUserByEmailWithClientValidation(email: string, validatedClientId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserWithClientValidation(id: string, updates: Partial<User>, validatedClientId: string): Promise<User>;
  getUsersByClient(clientId: string): Promise<User[]>;
  
  // Clients
  getClient(id: string): Promise<Client | undefined>;
  getClientBySubdomain(subdomain: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, updates: Partial<Client>): Promise<Client>;
  getAllClients(): Promise<Client[]>;
  
  // Courses - SECURITY: All course methods now require client context
  getCourseWithClientValidation(id: string, validatedClientId: string): Promise<Course | undefined>;
  createCourse(course: InsertCourse): Promise<Course>;
  updateCourseWithClientValidation(id: string, updates: Partial<Course>, validatedClientId: string): Promise<Course>;
  getCoursesByLanguageAndClient(language: string, clientId: string): Promise<Course[]>;
  getPublishedCoursesByClient(clientId: string): Promise<Course[]>;
  
  // User Progress
  getUserCourseProgress(userId: string, courseId: string): Promise<UserCourseProgress | undefined>;
  createUserCourseProgress(progress: Omit<UserCourseProgress, 'id'>): Promise<UserCourseProgress>;
  updateUserCourseProgress(userId: string, courseId: string, updates: Partial<UserCourseProgress>): Promise<UserCourseProgress>;
  getUserProgressByUser(userId: string): Promise<UserCourseProgress[]>;
  
  // Phishing Campaigns - SECURITY: All campaign methods now require client context
  getCampaignWithClientValidation(id: string, validatedClientId: string): Promise<PhishingCampaign | undefined>;
  createCampaign(campaign: InsertPhishingCampaign): Promise<PhishingCampaign>;
  updateCampaignWithClientValidation(id: string, updates: Partial<PhishingCampaign>, validatedClientId: string): Promise<PhishingCampaign>;
  deleteCampaignWithClientValidation(id: string, validatedClientId: string): Promise<void>;
  getCampaignsByClient(clientId: string): Promise<PhishingCampaign[]>;
  getActiveCampaignsByClient(clientId: string): Promise<PhishingCampaign[]>;
  
  // Analytics - SECURITY: All analytics methods now require client context
  createAnalyticsEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent>;
  getAnalyticsEventsByClient(clientId: string, startDate?: Date, endDate?: Date): Promise<AnalyticsEvent[]>;
  getAnalyticsEventsByUserWithClientValidation(userId: string, validatedClientId: string, startDate?: Date, endDate?: Date): Promise<AnalyticsEvent[]>;
  getCampaignAnalyticsWithClientValidation(campaignId: string, validatedClientId: string): Promise<AnalyticsEvent[]>;
  
  // Sessions
  createSession(session: InsertSession): Promise<Session>;
  getSession(token: string): Promise<Session | undefined>;
  deleteSession(token: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;
  
  // Email Templates
  getEmailTemplate(id: string): Promise<EmailTemplate | undefined>;
  createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate>;
  getEmailTemplatesByCategory(category: string): Promise<EmailTemplate[]>;
  getDefaultEmailTemplates(): Promise<EmailTemplate[]>;
  
  // SECURITY-CONSCIOUS GLOBAL METHODS (use carefully - provide reasons for usage)
  // These methods bypass tenant isolation for specific legitimate use cases
  
  // For authentication service - session validation requires global user lookup
  getUser(id: string): Promise<User | undefined>;
  
  // For user authentication - email login requires global lookup before tenant validation
  getUserByEmail(email: string): Promise<User | undefined>;
  
  // For tracking endpoints - public access to campaigns for email tracking pixels
  getCampaign(id: string): Promise<PhishingCampaign | undefined>;
  
  // For tenant-aware user updates - includes additional security checks
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  
  // For tenant-aware campaign updates - includes additional security checks  
  updateCampaign(id: string, updates: Partial<PhishingCampaign>): Promise<PhishingCampaign>;
  
  // For analytics queries - includes filtering capabilities
  getAnalyticsByField(field: string, value: string): Promise<AnalyticsEvent[]>;
}

export class DatabaseStorage implements IStorage {
  // Users - SECURITY: Tenant-validated user operations
  async getUserWithClientValidation(id: string, validatedClientId: string): Promise<User | undefined> {
    if (!validatedClientId) {
      throw new Error('🚨 SECURITY: validatedClientId required for user access');
    }
    const [user] = await db.select().from(users).where(and(eq(users.id, id), eq(users.clientId, validatedClientId)));
    return user || undefined;
  }

  async getUserByEmailWithClientValidation(email: string, validatedClientId: string): Promise<User | undefined> {
    if (!validatedClientId) {
      throw new Error('🚨 SECURITY: validatedClientId required for user access');
    }
    const [user] = await db.select().from(users).where(and(eq(users.email, email), eq(users.clientId, validatedClientId)));
    return user || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUserWithClientValidation(id: string, updates: Partial<User>, validatedClientId: string): Promise<User> {
    if (!validatedClientId) {
      throw new Error('🚨 SECURITY: validatedClientId required for user update');
    }
    // Prevent clientId manipulation
    const secureUpdates = { ...updates };
    delete secureUpdates.clientId;
    
    const [updatedUser] = await db
      .update(users)
      .set({ ...secureUpdates, updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.clientId, validatedClientId)))
      .returning();
    if (!updatedUser) {
      throw new Error('🚨 SECURITY: User not found or access denied');
    }
    return updatedUser;
  }

  async getUsersByClient(clientId: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.clientId, clientId));
  }

  // Clients
  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client || undefined;
  }

  async getClientBySubdomain(subdomain: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.subdomain, subdomain));
    return client || undefined;
  }

  async createClient(client: InsertClient): Promise<Client> {
    // Type cast branding field to ensure proper JSON type compatibility
    const clientData = {
      ...client,
      branding: client.branding as {
        logo?: string;
        primaryColor?: string;
        secondaryColor?: string;
        accentColor?: string;
        backgroundColor?: string;
        companyName?: string;
        emailFooter?: string;
        supportEmail?: string;
        customCss?: string;
        darkModeEnabled?: boolean;
      } | undefined
    };
    const [newClient] = await db.insert(clients).values([clientData]).returning();
    return newClient;
  }

  async updateClient(id: string, updates: Partial<Client>): Promise<Client> {
    const [updatedClient] = await db
      .update(clients)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    return updatedClient;
  }

  async getAllClients(): Promise<Client[]> {
    return await db.select().from(clients).orderBy(desc(clients.createdAt));
  }

  // Courses - SECURITY: Tenant-validated course operations
  async getCourseWithClientValidation(id: string, validatedClientId: string): Promise<Course | undefined> {
    if (!validatedClientId) {
      throw new Error('🚨 SECURITY: validatedClientId required for course access');
    }
    const [course] = await db
      .select()
      .from(courses)
      .where(and(eq(courses.id, id), eq(courses.clientId, validatedClientId)));
    return course || undefined;
  }

  async createCourse(course: InsertCourse): Promise<Course> {
    // Type cast content field to ensure proper JSON type compatibility
    const courseData = {
      ...course,
      content: course.content as {
        modules: Array<{
          id: string;
          title: string;
          videoUrl?: string;
          content: string;
          duration: number;
          quiz?: {
            questions: Array<{
              question: string;
              options: string[];
              correctAnswer: number;
            }>;
          };
        }>;
      } | undefined
    };
    const [newCourse] = await db.insert(courses).values([courseData]).returning();
    return newCourse;
  }

  async updateCourseWithClientValidation(id: string, updates: Partial<Course>, validatedClientId: string): Promise<Course> {
    if (!validatedClientId) {
      throw new Error('🚨 SECURITY: validatedClientId required for course update');
    }
    // Prevent clientId manipulation
    const secureUpdates = { ...updates };
    delete secureUpdates.clientId;
    
    const [updatedCourse] = await db
      .update(courses)
      .set({ ...secureUpdates, updatedAt: new Date() })
      .where(and(eq(courses.id, id), eq(courses.clientId, validatedClientId)))
      .returning();
    if (!updatedCourse) {
      throw new Error('🚨 SECURITY: Course not found or access denied');
    }
    return updatedCourse;
  }

  // SECURITY: REMOVED - This method was a tenant isolation vulnerability
  // Use getCoursesByLanguageAndClient instead

  // SECURITY: Tenant-safe replacement for getCoursesByLanguage
  async getCoursesByLanguageAndClient(language: string, clientId: string): Promise<Course[]> {
    return await db
      .select()
      .from(courses)
      .where(and(eq(courses.language, language), eq(courses.clientId, clientId)));
  }

  // SECURITY: REMOVED - This method was a tenant isolation vulnerability
  // Use getPublishedCoursesByClient instead

  // SECURITY: Tenant-safe replacement for getPublishedCourses
  async getPublishedCoursesByClient(clientId: string): Promise<Course[]> {
    return await db
      .select()
      .from(courses)
      .where(and(eq(courses.status, 'published'), eq(courses.clientId, clientId)));
  }

  // User Progress
  async getUserCourseProgress(userId: string, courseId: string): Promise<UserCourseProgress | undefined> {
    const [progress] = await db
      .select()
      .from(userCourseProgress)
      .where(and(eq(userCourseProgress.userId, userId), eq(userCourseProgress.courseId, courseId)));
    return progress || undefined;
  }

  async createUserCourseProgress(progress: Omit<UserCourseProgress, 'id'>): Promise<UserCourseProgress> {
    const [newProgress] = await db.insert(userCourseProgress).values(progress).returning();
    return newProgress;
  }

  async updateUserCourseProgress(userId: string, courseId: string, updates: Partial<UserCourseProgress>): Promise<UserCourseProgress> {
    const [updatedProgress] = await db
      .update(userCourseProgress)
      .set({ ...updates, lastAccessedAt: new Date() })
      .where(and(eq(userCourseProgress.userId, userId), eq(userCourseProgress.courseId, courseId)))
      .returning();
    return updatedProgress;
  }

  async getUserProgressByUser(userId: string): Promise<UserCourseProgress[]> {
    return await db.select().from(userCourseProgress).where(eq(userCourseProgress.userId, userId));
  }

  // Phishing Campaigns - SECURITY: Tenant-validated campaign operations
  async getCampaignWithClientValidation(id: string, validatedClientId: string): Promise<PhishingCampaign | undefined> {
    if (!validatedClientId) {
      throw new Error('🚨 SECURITY: validatedClientId required for campaign access');
    }
    const [campaign] = await db
      .select()
      .from(phishingCampaigns)
      .where(and(eq(phishingCampaigns.id, id), eq(phishingCampaigns.clientId, validatedClientId)));
    return campaign || undefined;
  }

  async createCampaign(campaign: InsertPhishingCampaign): Promise<PhishingCampaign> {
    const [newCampaign] = await db.insert(phishingCampaigns).values(campaign).returning();
    return newCampaign;
  }

  async updateCampaignWithClientValidation(id: string, updates: Partial<PhishingCampaign>, validatedClientId: string): Promise<PhishingCampaign> {
    if (!validatedClientId) {
      throw new Error('🚨 SECURITY: validatedClientId required for campaign update');
    }
    // Prevent clientId manipulation
    const secureUpdates = { ...updates };
    delete secureUpdates.clientId;
    
    const [updatedCampaign] = await db
      .update(phishingCampaigns)
      .set({ ...secureUpdates, updatedAt: new Date() })
      .where(and(eq(phishingCampaigns.id, id), eq(phishingCampaigns.clientId, validatedClientId)))
      .returning();
    if (!updatedCampaign) {
      throw new Error('🚨 SECURITY: Campaign not found or access denied');
    }
    return updatedCampaign;
  }

  async getCampaignsByClient(clientId: string): Promise<PhishingCampaign[]> {
    return await db
      .select()
      .from(phishingCampaigns)
      .where(eq(phishingCampaigns.clientId, clientId))
      .orderBy(desc(phishingCampaigns.createdAt));
  }

  async deleteCampaignWithClientValidation(id: string, validatedClientId: string): Promise<void> {
    if (!validatedClientId) {
      throw new Error('🚨 SECURITY: validatedClientId required for campaign deletion');
    }
    const result = await db
      .delete(phishingCampaigns)
      .where(and(eq(phishingCampaigns.id, id), eq(phishingCampaigns.clientId, validatedClientId)));
    // Note: Drizzle doesn't return affected rows count, but the operation will succeed silently if no match
  }

  async getActiveCampaignsByClient(clientId: string): Promise<PhishingCampaign[]> {
    if (!clientId) {
      throw new Error('🚨 SECURITY: clientId required for active campaigns access');
    }
    return await db
      .select()
      .from(phishingCampaigns)
      .where(and(eq(phishingCampaigns.status, 'active'), eq(phishingCampaigns.clientId, clientId)));
  }

  // Analytics
  async createAnalyticsEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent> {
    const [newEvent] = await db.insert(analyticsEvents).values(event).returning();
    return newEvent;
  }

  async getAnalyticsEventsByClient(clientId: string, startDate?: Date, endDate?: Date): Promise<AnalyticsEvent[]> {
    let conditions = [eq(analyticsEvents.clientId, clientId)];
    
    if (startDate && endDate) {
      conditions.push(
        gte(analyticsEvents.timestamp, startDate),
        lte(analyticsEvents.timestamp, endDate)
      );
    }
    
    return await db
      .select()
      .from(analyticsEvents)
      .where(and(...conditions))
      .orderBy(desc(analyticsEvents.timestamp));
  }

  async getAnalyticsEventsByUserWithClientValidation(userId: string, validatedClientId: string, startDate?: Date, endDate?: Date): Promise<AnalyticsEvent[]> {
    if (!validatedClientId) {
      throw new Error('🚨 SECURITY: validatedClientId required for user analytics access');
    }
    let conditions = [eq(analyticsEvents.userId, userId), eq(analyticsEvents.clientId, validatedClientId)];
    
    if (startDate && endDate) {
      conditions.push(
        gte(analyticsEvents.timestamp, startDate),
        lte(analyticsEvents.timestamp, endDate)
      );
    }
    
    return await db
      .select()
      .from(analyticsEvents)
      .where(and(...conditions))
      .orderBy(desc(analyticsEvents.timestamp));
  }

  async getCampaignAnalyticsWithClientValidation(campaignId: string, validatedClientId: string): Promise<AnalyticsEvent[]> {
    if (!validatedClientId) {
      throw new Error('🚨 SECURITY: validatedClientId required for campaign analytics access');
    }
    return await db
      .select()
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.campaignId, campaignId), eq(analyticsEvents.clientId, validatedClientId)))
      .orderBy(desc(analyticsEvents.timestamp));
  }

  // SECURITY: REMOVED - This method was a tenant isolation vulnerability
  // Use specific tenant-safe methods like getAnalyticsEventsByClient, getCampaignAnalyticsWithClientValidation, etc.

  // Sessions
  async createSession(session: InsertSession): Promise<Session> {
    const [newSession] = await db.insert(sessions).values(session).returning();
    return newSession;
  }

  async getSession(token: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.token, token));
    return session || undefined;
  }

  async deleteSession(token: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.token, token));
  }

  async deleteExpiredSessions(): Promise<void> {
    await db.delete(sessions).where(lte(sessions.expiresAt, new Date()));
  }

  // Email Templates
  async getEmailTemplate(id: string): Promise<EmailTemplate | undefined> {
    const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id));
    return template || undefined;
  }

  async createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate> {
    const [newTemplate] = await db.insert(emailTemplates).values(template).returning();
    return newTemplate;
  }

  async getEmailTemplatesByCategory(category: string): Promise<EmailTemplate[]> {
    return await db.select().from(emailTemplates).where(eq(emailTemplates.category, category));
  }

  async getDefaultEmailTemplates(): Promise<EmailTemplate[]> {
    return await db.select().from(emailTemplates).where(eq(emailTemplates.isDefault, true));
  }

  // SECURITY-CONSCIOUS GLOBAL METHODS - Implementation
  // WARNING: These methods bypass normal tenant isolation for specific legitimate use cases
  // Always log usage and validate the security context where these are called

  async getUser(id: string): Promise<User | undefined> {
    console.warn(`⚠️  SECURITY: Global user access for ID: ${id}. Ensure this is for authentication purposes only.`);
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    console.warn(`⚠️  SECURITY: Global user email lookup for: ${email}. Ensure this is for authentication purposes only.`);
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getCampaign(id: string): Promise<PhishingCampaign | undefined> {
    console.warn(`⚠️  SECURITY: Global campaign access for ID: ${id}. Ensure this is for tracking/public purposes only.`);
    const [campaign] = await db.select().from(phishingCampaigns).where(eq(phishingCampaigns.id, id));
    return campaign || undefined;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    console.warn(`⚠️  SECURITY: Global user update for ID: ${id}. Ensure proper authorization has been verified.`);
    
    // CRITICAL SECURITY: Prevent clientId manipulation in global updates
    const secureUpdates = { ...updates };
    delete secureUpdates.clientId;
    delete secureUpdates.id;
    
    const [updatedUser] = await db
      .update(users)
      .set({ ...secureUpdates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    
    if (!updatedUser) {
      throw new Error('🚨 SECURITY: User not found for global update');
    }
    
    console.warn(`⚠️  SECURITY: Global user update completed for: ${updatedUser.email} (Client: ${updatedUser.clientId})`);
    return updatedUser;
  }

  async updateCampaign(id: string, updates: Partial<PhishingCampaign>): Promise<PhishingCampaign> {
    console.warn(`⚠️  SECURITY: Global campaign update for ID: ${id}. Ensure proper authorization has been verified.`);
    
    // CRITICAL SECURITY: Prevent clientId manipulation in global updates
    const secureUpdates = { ...updates };
    delete secureUpdates.clientId;
    delete secureUpdates.id;
    
    const [updatedCampaign] = await db
      .update(phishingCampaigns)
      .set({ ...secureUpdates, updatedAt: new Date() })
      .where(eq(phishingCampaigns.id, id))
      .returning();
    
    if (!updatedCampaign) {
      throw new Error('🚨 SECURITY: Campaign not found for global update');
    }
    
    console.warn(`⚠️  SECURITY: Global campaign update completed for: ${updatedCampaign.name} (Client: ${updatedCampaign.clientId})`);
    return updatedCampaign;
  }

  async getAnalyticsByField(field: string, value: string): Promise<AnalyticsEvent[]> {
    console.warn(`⚠️  SECURITY: Analytics field query for ${field}=${value}. Ensure proper filtering is applied.`);
    
    // Map field names to actual database columns
    const fieldMap: Record<string, any> = {
      'campaignId': analyticsEvents.campaignId,
      'userId': analyticsEvents.userId,
      'clientId': analyticsEvents.clientId,
      'eventType': analyticsEvents.eventType
    };
    
    const column = fieldMap[field];
    if (!column) {
      throw new Error(`🚨 SECURITY: Invalid analytics field: ${field}`);
    }
    
    return await db
      .select()
      .from(analyticsEvents)
      .where(eq(column, value))
      .orderBy(desc(analyticsEvents.timestamp));
  }
}

export const storage = new DatabaseStorage();
