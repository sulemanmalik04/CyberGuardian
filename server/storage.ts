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
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  getUsersByClient(clientId: string): Promise<User[]>;
  
  // Clients
  getClient(id: string): Promise<Client | undefined>;
  getClientBySubdomain(subdomain: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, updates: Partial<Client>): Promise<Client>;
  getAllClients(): Promise<Client[]>;
  
  // Courses
  getCourse(id: string): Promise<Course | undefined>;
  createCourse(course: InsertCourse): Promise<Course>;
  updateCourse(id: string, updates: Partial<Course>): Promise<Course>;
  getCoursesByLanguage(language: string): Promise<Course[]>;
  getPublishedCourses(): Promise<Course[]>;
  
  // User Progress
  getUserCourseProgress(userId: string, courseId: string): Promise<UserCourseProgress | undefined>;
  createUserCourseProgress(progress: Omit<UserCourseProgress, 'id'>): Promise<UserCourseProgress>;
  updateUserCourseProgress(userId: string, courseId: string, updates: Partial<UserCourseProgress>): Promise<UserCourseProgress>;
  getUserProgressByUser(userId: string): Promise<UserCourseProgress[]>;
  
  // Phishing Campaigns
  getCampaign(id: string): Promise<PhishingCampaign | undefined>;
  createCampaign(campaign: InsertPhishingCampaign): Promise<PhishingCampaign>;
  updateCampaign(id: string, updates: Partial<PhishingCampaign>): Promise<PhishingCampaign>;
  getCampaignsByClient(clientId: string): Promise<PhishingCampaign[]>;
  getActiveCampaigns(): Promise<PhishingCampaign[]>;
  
  // Analytics
  createAnalyticsEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent>;
  getAnalyticsEventsByClient(clientId: string, startDate?: Date, endDate?: Date): Promise<AnalyticsEvent[]>;
  getAnalyticsEventsByUser(userId: string, startDate?: Date, endDate?: Date): Promise<AnalyticsEvent[]>;
  getCampaignAnalytics(campaignId: string): Promise<AnalyticsEvent[]>;
  
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
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
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
    const [newClient] = await db.insert(clients).values(client).returning();
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

  // Courses
  async getCourse(id: string): Promise<Course | undefined> {
    const [course] = await db.select().from(courses).where(eq(courses.id, id));
    return course || undefined;
  }

  async createCourse(course: InsertCourse): Promise<Course> {
    const [newCourse] = await db.insert(courses).values(course).returning();
    return newCourse;
  }

  async updateCourse(id: string, updates: Partial<Course>): Promise<Course> {
    const [updatedCourse] = await db
      .update(courses)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(courses.id, id))
      .returning();
    return updatedCourse;
  }

  async getCoursesByLanguage(language: string): Promise<Course[]> {
    return await db.select().from(courses).where(eq(courses.language, language));
  }

  async getPublishedCourses(): Promise<Course[]> {
    return await db.select().from(courses).where(eq(courses.status, 'published'));
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

  // Phishing Campaigns
  async getCampaign(id: string): Promise<PhishingCampaign | undefined> {
    const [campaign] = await db.select().from(phishingCampaigns).where(eq(phishingCampaigns.id, id));
    return campaign || undefined;
  }

  async createCampaign(campaign: InsertPhishingCampaign): Promise<PhishingCampaign> {
    const [newCampaign] = await db.insert(phishingCampaigns).values(campaign).returning();
    return newCampaign;
  }

  async updateCampaign(id: string, updates: Partial<PhishingCampaign>): Promise<PhishingCampaign> {
    const [updatedCampaign] = await db
      .update(phishingCampaigns)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(phishingCampaigns.id, id))
      .returning();
    return updatedCampaign;
  }

  async getCampaignsByClient(clientId: string): Promise<PhishingCampaign[]> {
    return await db
      .select()
      .from(phishingCampaigns)
      .where(eq(phishingCampaigns.clientId, clientId))
      .orderBy(desc(phishingCampaigns.createdAt));
  }

  async getActiveCampaigns(): Promise<PhishingCampaign[]> {
    return await db
      .select()
      .from(phishingCampaigns)
      .where(eq(phishingCampaigns.status, 'active'));
  }

  // Analytics
  async createAnalyticsEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent> {
    const [newEvent] = await db.insert(analyticsEvents).values(event).returning();
    return newEvent;
  }

  async getAnalyticsEventsByClient(clientId: string, startDate?: Date, endDate?: Date): Promise<AnalyticsEvent[]> {
    let query = db.select().from(analyticsEvents).where(eq(analyticsEvents.clientId, clientId));
    
    if (startDate && endDate) {
      query = query.where(and(
        eq(analyticsEvents.clientId, clientId),
        gte(analyticsEvents.timestamp, startDate),
        lte(analyticsEvents.timestamp, endDate)
      ));
    }
    
    return await query.orderBy(desc(analyticsEvents.timestamp));
  }

  async getAnalyticsEventsByUser(userId: string, startDate?: Date, endDate?: Date): Promise<AnalyticsEvent[]> {
    let query = db.select().from(analyticsEvents).where(eq(analyticsEvents.userId, userId));
    
    if (startDate && endDate) {
      query = query.where(and(
        eq(analyticsEvents.userId, userId),
        gte(analyticsEvents.timestamp, startDate),
        lte(analyticsEvents.timestamp, endDate)
      ));
    }
    
    return await query.orderBy(desc(analyticsEvents.timestamp));
  }

  async getCampaignAnalytics(campaignId: string): Promise<AnalyticsEvent[]> {
    return await db
      .select()
      .from(analyticsEvents)
      .where(eq(analyticsEvents.campaignId, campaignId))
      .orderBy(desc(analyticsEvents.timestamp));
  }

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
}

export const storage = new DatabaseStorage();
