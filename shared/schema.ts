import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb, uuid, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum('user_role', ['super_admin', 'client_admin', 'end_user']);
export const campaignStatusEnum = pgEnum('campaign_status', ['draft', 'scheduled', 'active', 'completed', 'paused']);
export const licenseStatusEnum = pgEnum('license_status', ['active', 'expired', 'suspended']);
export const courseStatusEnum = pgEnum('course_status', ['draft', 'published', 'archived']);
export const eventTypeEnum = pgEnum('event_type', ['email_sent', 'email_opened', 'email_clicked', 'course_started', 'course_completed', 'quiz_completed', 'login', 'logout', 'security_incident', 'phishing_reported', 'email_failed']);

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: userRoleEnum("role").notNull().default('end_user'),
  clientId: uuid("client_id").references(() => clients.id),
  department: text("department"),
  language: text("language").default('en'),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
});

// Clients table
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  subdomain: text("subdomain").notNull().unique(),
  branding: jsonb("branding").$type<{
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
  }>().default({}),
  licenseStatus: licenseStatusEnum("license_status").default('active'),
  expirationDate: timestamp("expiration_date"),
  maxUsers: integer("max_users").default(100),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
});

// Courses table
export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  content: jsonb("content").$type<{
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
  }>().default({ modules: [] }),
  language: text("language").default('en'),
  difficulty: text("difficulty").default('beginner'),
  estimatedDuration: integer("estimated_duration"), // in minutes
  status: courseStatusEnum("status").default('draft'),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
});

// User course progress table
export const userCourseProgress = pgTable("user_course_progress", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  courseId: uuid("course_id").references(() => courses.id).notNull(),
  progress: integer("progress").default(0), // percentage 0-100
  completedModules: text("completed_modules").array().default([]),
  currentModule: integer("current_module").default(0),
  quizScores: jsonb("quiz_scores").default({}),
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  startedAt: timestamp("started_at").default(sql`now()`),
  lastAccessedAt: timestamp("last_accessed_at").default(sql`now()`),
});

// Phishing campaigns table
export const phishingCampaigns = pgTable("phishing_campaigns", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: uuid("client_id").references(() => clients.id).notNull(),
  name: text("name").notNull(),
  template: jsonb("template").$type<{
    subject: string;
    htmlContent: string;
    textContent: string;
    fromName: string;
    fromEmail: string;
    domain: string;
  }>().notNull(),
  targetGroups: text("target_groups").array().default([]),
  scheduledAt: timestamp("scheduled_at"),
  status: campaignStatusEnum("status").default('draft'),
  emailsSent: integer("emails_sent").default(0),
  emailsOpened: integer("emails_opened").default(0),
  emailsClicked: integer("emails_clicked").default(0),
  emailsReported: integer("emails_reported").default(0),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
});

// Analytics events table
export const analyticsEvents = pgTable("analytics_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: uuid("client_id").references(() => clients.id),
  userId: uuid("user_id").references(() => users.id),
  campaignId: uuid("campaign_id").references(() => phishingCampaigns.id),
  courseId: uuid("course_id").references(() => courses.id),
  eventType: eventTypeEnum("event_type").notNull(),
  metadata: jsonb("metadata").default({}),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").default(sql`now()`).notNull(),
});

// Sessions table for JWT token management
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

// Email templates table
export const emailTemplates = pgTable("email_templates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category"), // 'phishing', 'notification', etc.
  subject: text("subject").notNull(),
  htmlContent: text("html_content").notNull(),
  textContent: text("text_content"),
  variables: text("variables").array().default([]),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  client: one(clients, {
    fields: [users.clientId],
    references: [clients.id],
  }),
  courseProgress: many(userCourseProgress),
  createdCourses: many(courses),
  analyticsEvents: many(analyticsEvents),
  sessions: many(sessions),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  users: many(users),
  phishingCampaigns: many(phishingCampaigns),
  analyticsEvents: many(analyticsEvents),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  creator: one(users, {
    fields: [courses.createdBy],
    references: [users.id],
  }),
  userProgress: many(userCourseProgress),
  analyticsEvents: many(analyticsEvents),
}));

export const userCourseProgressRelations = relations(userCourseProgress, ({ one }) => ({
  user: one(users, {
    fields: [userCourseProgress.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [userCourseProgress.courseId],
    references: [courses.id],
  }),
}));

export const phishingCampaignsRelations = relations(phishingCampaigns, ({ one, many }) => ({
  client: one(clients, {
    fields: [phishingCampaigns.clientId],
    references: [clients.id],
  }),
  creator: one(users, {
    fields: [phishingCampaigns.createdBy],
    references: [users.id],
  }),
  analyticsEvents: many(analyticsEvents),
}));

export const analyticsEventsRelations = relations(analyticsEvents, ({ one }) => ({
  client: one(clients, {
    fields: [analyticsEvents.clientId],
    references: [clients.id],
  }),
  user: one(users, {
    fields: [analyticsEvents.userId],
    references: [users.id],
  }),
  campaign: one(phishingCampaigns, {
    fields: [analyticsEvents.campaignId],
    references: [phishingCampaigns.id],
  }),
  course: one(courses, {
    fields: [analyticsEvents.courseId],
    references: [courses.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCourseSchema = createInsertSchema(courses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPhishingCampaignSchema = createInsertSchema(phishingCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({
  id: true,
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Course = typeof courses.$inferSelect;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type UserCourseProgress = typeof userCourseProgress.$inferSelect;
export type PhishingCampaign = typeof phishingCampaigns.$inferSelect;
export type InsertPhishingCampaign = z.infer<typeof insertPhishingCampaignSchema>;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
