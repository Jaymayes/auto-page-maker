import {
  users,
  scholarships,
  landingPages,
  userScholarships,
  businessEvents,
  dailyKpiSnapshots,
  type User,
  type UpsertUser,
  type Scholarship,
  type InsertScholarship,
  type LandingPage,
  type InsertLandingPage,
  type UserScholarship,
  type InsertUserScholarship,
  type BusinessEvent,
  type InsertBusinessEvent,
  type DailyKpiSnapshot,
  type InsertDailyKpiSnapshot,
} from "@shared/schema";

export type { 
  User,
  UpsertUser,
  Scholarship,
  InsertScholarship,
  LandingPage,
  InsertLandingPage,
  UserScholarship,
  InsertUserScholarship,
  BusinessEvent,
  InsertBusinessEvent,
  DailyKpiSnapshot,
  InsertDailyKpiSnapshot,
};
import { randomUUID } from "crypto";
import { normalizeUser, normalizeScholarship, normalizeLandingPage } from "./middleware/unicode-normalize.js";
import { sql, eq, and, desc } from 'drizzle-orm';
import type { db as dbType } from './db.js';

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Scholarship operations
  getScholarships(filters?: {
    major?: string;
    state?: string;
    city?: string;
    level?: string;
    isActive?: boolean;
    minGpa?: number;
    excludeExpired?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Scholarship[]>;
  getScholarship(id: string): Promise<Scholarship | undefined>;
  createScholarship(scholarship: InsertScholarship): Promise<Scholarship>;
  updateScholarship(id: string, data: Partial<InsertScholarship>): Promise<Scholarship | undefined>;
  
  // Landing page operations
  getLandingPages(filters?: { isPublished?: boolean }): Promise<LandingPage[]>;
  getLandingPage(slug: string): Promise<LandingPage | undefined>;
  createLandingPage(page: InsertLandingPage): Promise<LandingPage>;
  updateLandingPage(id: string, data: Partial<InsertLandingPage>): Promise<LandingPage | undefined>;
  
  // User scholarship operations
  getUserScholarships(userId: string): Promise<UserScholarship[]>;
  saveScholarship(data: InsertUserScholarship): Promise<UserScholarship>;
  
  // Analytics
  getScholarshipStats(filters?: { major?: string; state?: string; city?: string }): Promise<{
    count: number;
    totalAmount: number;
    averageAmount: number;
  }>;
  
  // Business events telemetry
  logBusinessEvent(event: InsertBusinessEvent): Promise<BusinessEvent>;
  getBusinessEvents(filters?: {
    app?: string;
    eventName?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<BusinessEvent[]>;
  
  // KPI snapshots
  createKpiSnapshot(snapshot: InsertDailyKpiSnapshot): Promise<DailyKpiSnapshot>;
  getLatestKpiSnapshot(): Promise<DailyKpiSnapshot | undefined>;
  getKpiSnapshots(filters?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<DailyKpiSnapshot[]>;
  updateKpiSnapshot(id: string, data: Partial<InsertDailyKpiSnapshot>): Promise<DailyKpiSnapshot | undefined>;
}

// Utility function for normalizing slugs
function normalizeSlug(slug: string): string {
  return (slug || '').normalize('NFC').toLowerCase();
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private scholarships: Map<string, Scholarship> = new Map();
  private landingPages: Map<string, LandingPage> = new Map();
  private landingPagesBySlug: Map<string, LandingPage> = new Map();
  private userScholarships: Map<string, UserScholarship> = new Map();

  constructor() {
    // Initialize with some sample scholarships
    this.initializeSampleData();
  }

  private initializeSampleData() {
    const sampleScholarships: Scholarship[] = [
      {
        id: randomUUID(),
        title: "Google Computer Science Excellence Scholarship",
        description: "Supporting underrepresented students pursuing computer science degrees at four-year universities. Requires 3.5+ GPA, demonstrated leadership, and commitment to diversity in tech.",
        amount: 10000,
        deadline: new Date("2025-03-30"),
        level: "undergraduate",
        major: "computer science",
        state: "california",
        city: null,
        requirements: {
          gpa: 3.5,
          essay: true,
          leadership: true,
          financialNeed: false
        },
        tags: ["diversity", "tech", "leadership"],
        sourceUrl: "https://edu.google.com/scholarships/",
        sourceOrganization: "Google Education Foundation",
        isActive: true,
        isFeatured: true,
        isNoEssay: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        title: "California Tech Innovation Scholarship",
        description: "Merit-based scholarship for students enrolled in computer science, software engineering, or related STEM programs at California universities. Simple application process with no essay requirement.",
        amount: 5000,
        deadline: new Date("2025-03-15"),
        level: "all",
        major: "computer science",
        state: "california",
        city: null,
        requirements: {
          gpa: 3.0,
          essay: false,
          leadership: false,
          financialNeed: false
        },
        tags: ["no-essay", "merit", "stem"],
        sourceUrl: "https://catechfoundation.org/scholarships",
        sourceOrganization: "California Tech Foundation",
        isActive: true,
        isFeatured: false,
        isNoEssay: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        title: "San Francisco Tech Diversity Scholarship",
        description: "Supporting underrepresented minorities in computer science programs at Bay Area institutions. Priority given to first-generation college students and those with financial need.",
        amount: 2500,
        deadline: new Date("2025-01-18"),
        level: "undergraduate",
        major: "computer science",
        state: "california",
        city: "san francisco",
        requirements: {
          gpa: 2.8,
          essay: true,
          leadership: false,
          financialNeed: true
        },
        tags: ["diversity", "local", "financial-need"],
        sourceUrl: "https://sftechdiversity.org/scholarships",
        sourceOrganization: "SF Tech Diversity Coalition",
        isActive: true,
        isFeatured: false,
        isNoEssay: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ];

    sampleScholarships.forEach(scholarship => {
      this.scholarships.set(scholarship.id, scholarship);
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Normalize user data before processing
    const normalizedData = normalizeUser(userData);
    
    // Use mutex to prevent race conditions during concurrent user operations
    const { withUserLock } = await import('./middleware/concurrency');
    
    // If userData has an ID, use that for locking, otherwise use email
    const lockKey = normalizedData.id || normalizedData.email || 'unknown';
    
    return withUserLock(lockKey, async () => {
      const existingUser = normalizedData.id 
        ? this.users.get(normalizedData.id)
        : Array.from(this.users.values()).find(u => u.email === normalizedData.email);
      
      if (existingUser) {
        const updatedUser: User = { 
          ...existingUser, 
          ...normalizedData, 
          id: existingUser.id, // Preserve existing ID
          email: normalizedData.email ?? existingUser.email,
          firstName: normalizedData.firstName ?? existingUser.firstName,
          lastName: normalizedData.lastName ?? existingUser.lastName,
          profileImageUrl: normalizedData.profileImageUrl ?? existingUser.profileImageUrl,
          createdAt: existingUser.createdAt,
          updatedAt: new Date() 
        };
        this.users.set(existingUser.id, updatedUser);
        return updatedUser;
      }

      const id = normalizedData.id || randomUUID();
      const user: User = { 
        id,
        email: normalizedData.email ?? null,
        firstName: normalizedData.firstName ?? null,
        lastName: normalizedData.lastName ?? null,
        profileImageUrl: normalizedData.profileImageUrl ?? null,
        createdAt: new Date(), 
        updatedAt: new Date() 
      };
      this.users.set(id, user);
      return user;
    });
  }

  async getScholarships(filters?: {
    major?: string;
    state?: string;
    city?: string;
    level?: string;
    isActive?: boolean;
    minGpa?: number;
    excludeExpired?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Scholarship[]> {
    let results = Array.from(this.scholarships.values());

    // HARD FILTER: Exclude expired deadlines by default (FPR fix)
    const excludeExpired = filters?.excludeExpired !== false;
    if (excludeExpired) {
      const now = new Date();
      results = results.filter(s => {
        if (!s.deadline) return true;
        return new Date(s.deadline) >= now;
      });
    }

    // HARD FILTER: GPA requirement check
    if (filters?.minGpa !== undefined) {
      results = results.filter(s => {
        const requirements = s.requirements as { gpa?: number } | null;
        if (!requirements?.gpa) return true;
        return filters.minGpa! >= requirements.gpa;
      });
    }

    if (filters?.major) {
      // MED-001: Case-insensitive filtering with diacritics normalization
      const normalizedMajor = filters.major!.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
      results = results.filter(s => 
        s.major?.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').includes(normalizedMajor)
      );
    }
    if (filters?.state) {
      // MED-001: Case-insensitive filtering with diacritics normalization
      const normalizedState = filters.state!.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
      results = results.filter(s => 
        s.state?.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '') === normalizedState
      );
    }
    if (filters?.city) {
      // MED-001: Case-insensitive filtering with diacritics normalization
      const normalizedCity = filters.city!.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
      results = results.filter(s => 
        s.city?.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '') === normalizedCity
      );
    }
    if (filters?.level) {
      results = results.filter(s => s.level === filters.level || s.level === 'all');
    }
    if (filters?.isActive !== undefined) {
      results = results.filter(s => s.isActive === filters.isActive);
    }

    // Sort by featured first, then by deadline
    results.sort((a, b) => {
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

    if (filters?.offset) {
      results = results.slice(filters.offset);
    }
    if (filters?.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  async getScholarship(id: string): Promise<Scholarship | undefined> {
    return this.scholarships.get(id);
  }

  async createScholarship(scholarshipData: InsertScholarship): Promise<Scholarship> {
    // Normalize scholarship data before processing
    const normalizedData = normalizeScholarship(scholarshipData);
    
    const id = randomUUID();
    const scholarship: Scholarship = {
      id,
      title: normalizedData.title,
      description: normalizedData.description,
      amount: normalizedData.amount,
      deadline: normalizedData.deadline,
      level: normalizedData.level,
      major: normalizedData.major ?? null,
      state: normalizedData.state ?? null,
      city: normalizedData.city ?? null,
      requirements: scholarshipData.requirements ?? null,
      tags: scholarshipData.tags ?? null,
      sourceUrl: scholarshipData.sourceUrl ?? null,
      sourceOrganization: scholarshipData.sourceOrganization ?? null,
      isActive: scholarshipData.isActive ?? true,
      isFeatured: scholarshipData.isFeatured ?? false,
      isNoEssay: scholarshipData.isNoEssay ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.scholarships.set(id, scholarship);
    return scholarship;
  }

  async updateScholarship(id: string, data: Partial<InsertScholarship>): Promise<Scholarship | undefined> {
    const existing = this.scholarships.get(id);
    if (!existing) return undefined;

    // Normalize scholarship data before updating
    const normalizedData = normalizeScholarship(data);
    const updated = { ...existing, ...normalizedData, updatedAt: new Date() };
    this.scholarships.set(id, updated);
    return updated;
  }

  async getLandingPages(filters?: { isPublished?: boolean }): Promise<LandingPage[]> {
    let results = Array.from(this.landingPages.values());
    
    if (filters?.isPublished !== undefined) {
      results = results.filter(p => p.isPublished === filters.isPublished);
    }

    return results.sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime());
  }

  async getLandingPage(slug: string): Promise<LandingPage | undefined> {
    return this.landingPagesBySlug.get(normalizeSlug(slug));
  }

  async createLandingPage(pageData: InsertLandingPage): Promise<LandingPage> {
    // Normalize landing page data before processing
    const normalizedData = normalizeLandingPage(pageData);
    
    const id = randomUUID();
    const page: LandingPage = {
      id,
      slug: normalizedData.slug,
      title: normalizedData.title,
      metaDescription: pageData.metaDescription,
      template: pageData.template,
      templateData: pageData.templateData,
      content: pageData.content,
      scholarshipCount: pageData.scholarshipCount ?? 0,
      totalAmount: pageData.totalAmount ?? 0,
      isPublished: pageData.isPublished ?? false,
      lastGenerated: pageData.lastGenerated ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.landingPages.set(id, page);
    this.landingPagesBySlug.set(normalizeSlug(page.slug), page);
    return page;
  }

  async updateLandingPage(id: string, data: Partial<InsertLandingPage>): Promise<LandingPage | undefined> {
    const existing = this.landingPages.get(id);
    if (!existing) return undefined;

    // Normalize landing page data before updating
    const normalizedData = normalizeLandingPage(data);
    const updated = { ...existing, ...normalizedData, updatedAt: new Date() };
    this.landingPages.set(id, updated);
    return updated;
  }

  async getUserScholarships(userId: string): Promise<UserScholarship[]> {
    return Array.from(this.userScholarships.values()).filter(us => us.userId === userId);
  }

  async saveScholarship(data: InsertUserScholarship): Promise<UserScholarship> {
    const id = randomUUID();
    const userScholarship: UserScholarship = {
      ...data,
      id,
      createdAt: new Date(),
    };
    this.userScholarships.set(id, userScholarship);
    return userScholarship;
  }

  async getScholarshipStats(filters?: { 
    major?: string; 
    state?: string; 
    city?: string 
  }): Promise<{ count: number; totalAmount: number; averageAmount: number }> {
    const scholarships = await this.getScholarships({
      ...filters,
      isActive: true,
    });

    const count = scholarships.length;
    const totalAmount = scholarships.reduce((sum, s) => sum + s.amount, 0);
    const averageAmount = count > 0 ? Math.round(totalAmount / count) : 0;

    return { count, totalAmount, averageAmount };
  }
  
  private businessEvents: Map<string, BusinessEvent> = new Map();
  private kpiSnapshots: Map<string, DailyKpiSnapshot> = new Map();

  async logBusinessEvent(eventData: InsertBusinessEvent): Promise<BusinessEvent> {
    const id = randomUUID();
    const event: BusinessEvent = {
      env: 'development',
      properties: {},
      actorType: null,
      actorId: null,
      orgId: null,
      sessionId: null,
      ...eventData,
      id,
      ts: eventData.ts || new Date(),
      createdAt: new Date(),
    };
    this.businessEvents.set(id, event);
    return event;
  }

  async getBusinessEvents(filters?: {
    app?: string;
    eventName?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<BusinessEvent[]> {
    let results = Array.from(this.businessEvents.values());
    
    if (filters?.app) {
      results = results.filter(e => e.app === filters.app);
    }
    if (filters?.eventName) {
      results = results.filter(e => e.eventName === filters.eventName);
    }
    if (filters?.startDate) {
      results = results.filter(e => new Date(e.ts) >= filters.startDate!);
    }
    if (filters?.endDate) {
      results = results.filter(e => new Date(e.ts) <= filters.endDate!);
    }
    
    results.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    
    if (filters?.limit) {
      results = results.slice(0, filters.limit);
    }
    
    return results;
  }

  async createKpiSnapshot(snapshotData: InsertDailyKpiSnapshot): Promise<DailyKpiSnapshot> {
    const id = randomUUID();
    const snapshot: DailyKpiSnapshot = {
      status: 'generated',
      slackPosted: false,
      missingMetrics: [],
      dataIntegrityRisks: [],
      sourceHashes: {},
      b2cConversionRate: null,
      b2cArpu: null,
      b2cCtrHighLikelihood: null,
      b2cCtrCompetitive: null,
      b2cCtrLongShot: null,
      b2bActiveProviders: null,
      b2bRevenue: null,
      b2bTopDecileConcentration: null,
      sloUptimePercent: null,
      sloP95Latency: null,
      sloErrorRate: null,
      sloAuthFailureRate: null,
      seoPagesLive: null,
      seoIndexationRate: null,
      seoOrganicSessions: null,
      cacSeoLed: null,
      paybackPeriodDays: null,
      artifactsPath: null,
      ...snapshotData,
      id,
      createdAt: new Date(),
    };
    this.kpiSnapshots.set(id, snapshot);
    return snapshot;
  }

  async getLatestKpiSnapshot(): Promise<DailyKpiSnapshot | undefined> {
    const snapshots = Array.from(this.kpiSnapshots.values());
    if (snapshots.length === 0) return undefined;
    
    snapshots.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return snapshots[0];
  }

  async getKpiSnapshots(filters?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<DailyKpiSnapshot[]> {
    let results = Array.from(this.kpiSnapshots.values());
    
    if (filters?.startDate) {
      results = results.filter(s => new Date(s.date) >= filters.startDate!);
    }
    if (filters?.endDate) {
      results = results.filter(s => new Date(s.date) <= filters.endDate!);
    }
    
    results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    if (filters?.limit) {
      results = results.slice(0, filters.limit);
    }
    
    return results;
  }

  async updateKpiSnapshot(id: string, data: Partial<InsertDailyKpiSnapshot>): Promise<DailyKpiSnapshot | undefined> {
    const existing = this.kpiSnapshots.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...data };
    this.kpiSnapshots.set(id, updated);
    return updated;
  }
}

// DbStorage: Persistent storage using PostgreSQL with Drizzle ORM
// CEO DIRECTIVE: 24-48h migration for beta launch readiness
export class DbStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const { db } = await import('./db.js');
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const { db } = await import('./db.js');
    const normalizedData = normalizeUser(userData);
    
    // Use proper upsert: insert with onConflictDoUpdate for Replit Auth compatibility
    const [user] = await db
      .insert(users)
      .values(normalizedData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...normalizedData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Scholarship operations  
  async getScholarships(filters?: {
    major?: string;
    state?: string;
    city?: string;
    level?: string;
    isActive?: boolean;
    minGpa?: number;
    excludeExpired?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Scholarship[]> {
    const { db } = await import('./db.js');
    const { gte } = await import('drizzle-orm');
    
    const conditions = [];
    
    // HARD FILTER: Exclude expired deadlines by default (FPR fix)
    const excludeExpired = filters?.excludeExpired !== false;
    if (excludeExpired) {
      conditions.push(gte(scholarships.deadline, new Date()));
    }
    
    if (filters?.major) conditions.push(eq(scholarships.major, filters.major));
    if (filters?.state) conditions.push(eq(scholarships.state, filters.state));
    if (filters?.city) conditions.push(eq(scholarships.city, filters.city));
    if (filters?.level) conditions.push(eq(scholarships.level, filters.level));
    if (filters?.isActive !== undefined) conditions.push(eq(scholarships.isActive, filters.isActive));

    const baseQuery = db.select().from(scholarships);
    const whereQuery = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;
    const limitQuery = filters?.limit ? whereQuery.limit(filters.limit) : whereQuery;
    const finalQuery = filters?.offset ? limitQuery.offset(filters.offset) : limitQuery;
    
    let results = await finalQuery;
    
    // HARD FILTER: GPA requirement check (post-query filter for JSONB requirements)
    if (filters?.minGpa !== undefined) {
      results = results.filter(s => {
        const requirements = s.requirements as { gpa?: number } | null;
        if (!requirements?.gpa) return true;
        return filters.minGpa! >= requirements.gpa;
      });
    }
    
    return results;
  }

  async getScholarship(id: string): Promise<Scholarship | undefined> {
    const { db } = await import('./db.js');
    const [scholarship] = await db.select().from(scholarships).where(eq(scholarships.id, id)).limit(1);
    return scholarship;
  }

  async createScholarship(scholarshipData: InsertScholarship): Promise<Scholarship> {
    const { db } = await import('./db.js');
    const normalizedData = normalizeScholarship(scholarshipData);
    const [created] = await db.insert(scholarships).values(normalizedData).returning();
    return created;
  }

  async updateScholarship(id: string, data: Partial<InsertScholarship>): Promise<Scholarship | undefined> {
    const { db } = await import('./db.js');
    const normalizedData = normalizeScholarship(data);
    const [updated] = await db.update(scholarships)
      .set({ ...normalizedData, updatedAt: new Date() })
      .where(eq(scholarships.id, id))
      .returning();
    return updated;
  }

  // Landing page operations
  async getLandingPages(filters?: { isPublished?: boolean }): Promise<LandingPage[]> {
    const { db } = await import('./db.js');
    
    const baseQuery = db.select().from(landingPages);
    const whereQuery = filters?.isPublished !== undefined ? baseQuery.where(eq(landingPages.isPublished, filters.isPublished)) : baseQuery;
    
    return await whereQuery.orderBy(desc(landingPages.updatedAt));
  }

  async getLandingPage(slug: string): Promise<LandingPage | undefined> {
    const { db } = await import('./db.js');
    const normalizedSlug = normalizeSlug(slug);
    const [page] = await db.select().from(landingPages).where(eq(landingPages.slug, normalizedSlug)).limit(1);
    return page;
  }

  async createLandingPage(pageData: InsertLandingPage): Promise<LandingPage> {
    const { db } = await import('./db.js');
    const normalizedData = normalizeLandingPage(pageData);
    const [created] = await db.insert(landingPages).values(normalizedData).returning();
    return created;
  }

  async updateLandingPage(id: string, data: Partial<InsertLandingPage>): Promise<LandingPage | undefined> {
    const { db } = await import('./db.js');
    const normalizedData = normalizeLandingPage(data);
    const [updated] = await db.update(landingPages)
      .set({ ...normalizedData, updatedAt: new Date() })
      .where(eq(landingPages.id, id))
      .returning();
    return updated;
  }

  // User scholarship operations
  async getUserScholarships(userId: string): Promise<UserScholarship[]> {
    const { db } = await import('./db.js');
    return await db.select().from(userScholarships).where(eq(userScholarships.userId, userId));
  }

  async saveScholarship(data: InsertUserScholarship): Promise<UserScholarship> {
    const { db } = await import('./db.js');
    const [created] = await db.insert(userScholarships).values(data).returning();
    return created;
  }

  // Analytics
  async getScholarshipStats(filters?: { major?: string; state?: string; city?: string }): Promise<{
    count: number;
    totalAmount: number;
    averageAmount: number;
  }> {
    const results = await this.getScholarships({
      ...filters,
      isActive: true,
    });

    const count = results.length;
    const totalAmount = results.reduce((sum, s) => sum + s.amount, 0);
    const averageAmount = count > 0 ? Math.round(totalAmount / count) : 0;

    return { count, totalAmount, averageAmount };
  }

  // Business events telemetry
  async logBusinessEvent(eventData: InsertBusinessEvent): Promise<BusinessEvent> {
    const { db } = await import('./db.js');
    const [created] = await db.insert(businessEvents).values(eventData).returning();
    return created;
  }

  async getBusinessEvents(filters?: {
    app?: string;
    eventName?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<BusinessEvent[]> {
    const { db } = await import('./db.js');
    
    const conditions = [];
    if (filters?.app) conditions.push(eq(businessEvents.app, filters.app));
    if (filters?.eventName) conditions.push(eq(businessEvents.eventName, filters.eventName));
    if (filters?.startDate) conditions.push(sql`${businessEvents.ts} >= ${filters.startDate}`);
    if (filters?.endDate) conditions.push(sql`${businessEvents.ts} <= ${filters.endDate}`);

    const baseQuery = db.select().from(businessEvents);
    const whereQuery = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;
    const orderedQuery = whereQuery.orderBy(desc(businessEvents.ts));
    const finalQuery = filters?.limit ? orderedQuery.limit(filters.limit) : orderedQuery;
    
    return await finalQuery;
  }

  // KPI snapshots
  async createKpiSnapshot(snapshotData: InsertDailyKpiSnapshot): Promise<DailyKpiSnapshot> {
    const { db } = await import('./db.js');
    const [created] = await db.insert(dailyKpiSnapshots).values(snapshotData).returning();
    return created;
  }

  async getLatestKpiSnapshot(): Promise<DailyKpiSnapshot | undefined> {
    const { db } = await import('./db.js');
    const [snapshot] = await db.select()
      .from(dailyKpiSnapshots)
      .orderBy(desc(dailyKpiSnapshots.date))
      .limit(1);
    return snapshot;
  }

  async getKpiSnapshots(filters?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<DailyKpiSnapshot[]> {
    const { db } = await import('./db.js');
    
    const conditions = [];
    if (filters?.startDate) conditions.push(sql`${dailyKpiSnapshots.date} >= ${filters.startDate}`);
    if (filters?.endDate) conditions.push(sql`${dailyKpiSnapshots.date} <= ${filters.endDate}`);

    const baseQuery = db.select().from(dailyKpiSnapshots);
    const whereQuery = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;
    const orderedQuery = whereQuery.orderBy(desc(dailyKpiSnapshots.date));
    const finalQuery = filters?.limit ? orderedQuery.limit(filters.limit) : orderedQuery;
    
    return await finalQuery;
  }

  async updateKpiSnapshot(id: string, data: Partial<InsertDailyKpiSnapshot>): Promise<DailyKpiSnapshot | undefined> {
    const { db } = await import('./db.js');
    const [updated] = await db.update(dailyKpiSnapshots)
      .set(data)
      .where(eq(dailyKpiSnapshots.id, id))
      .returning();
    return updated;
  }
}

// FEATURE FLAG: Toggle between MemStorage and DbStorage
// CEO DIRECTIVE: Use DbStorage for private beta (persistent storage required)
const USE_DB_STORAGE = process.env.USE_DB_STORAGE !== 'false'; // Default to true for beta

export const storage: IStorage = USE_DB_STORAGE ? new DbStorage() : new MemStorage();
