import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  // V2 Sprint-2: Privacy-by-Default fields
  dateOfBirth: timestamp("date_of_birth"),
  isMinor: boolean("is_minor").default(false),
  doNotSell: boolean("do_not_sell").default(false),
  privacyMode: text("privacy_mode").default('standard'), // standard, enhanced, minor
  isFerpaCovered: boolean("is_ferpa_covered").default(false),
  gpcHonored: boolean("gpc_honored").default(false),
  // V2 Sprint-2: Onboarding tracking
  onboardingStatus: text("onboarding_status").default('guest'), // guest, registered, verified
  implicitFitScore: integer("implicit_fit_score"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const scholarships = pgTable("scholarships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  amount: integer("amount").notNull(),
  deadline: timestamp("deadline").notNull(),
  level: text("level").notNull(), // undergraduate, graduate, high school
  major: text("major"), // computer science, engineering, etc.
  state: text("state"), // California, Texas, etc.
  city: text("city"),
  requirements: jsonb("requirements").default('{}'),
  tags: text("tags").array().default(sql`'{}'`),
  sourceUrl: text("source_url"),
  sourceOrganization: text("source_organization"),
  providerId: varchar("provider_id"), // Provider who created this scholarship (B2B)
  providerName: text("provider_name"), // Provider organization name
  isActive: boolean("is_active").default(true),
  isFeatured: boolean("is_featured").default(false),
  isNoEssay: boolean("is_no_essay").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Provider-facing queries: fetch scholarships by provider with active filter
  index("IDX_scholarships_provider").on(table.providerId, table.isActive, table.createdAt),
  // Student-facing list queries: level/major filter cohorts (sorted by featured then deadline)
  index("IDX_sch_active_level_major").on(table.isActive, table.level, table.major, table.isFeatured, table.deadline),
  // Geographic queries: state/city filters (sorted by featured then deadline)
  index("IDX_sch_active_state_city").on(table.isActive, table.state, table.city, table.isFeatured, table.deadline),
  // Stats aggregation queries: covers all filter combinations for stats endpoint
  index("IDX_sch_active_geo_stats").on(table.isActive, table.major, table.state, table.city),
]);

export const landingPages = pgTable("landing_pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: varchar("slug").notNull().unique(),
  title: text("title").notNull(),
  metaDescription: text("meta_description").notNull(),
  template: text("template").notNull(), // major-state, no-essay, local-city
  templateData: jsonb("template_data").notNull(),
  content: jsonb("content").notNull(),
  scholarshipCount: integer("scholarship_count").default(0),
  totalAmount: integer("total_amount").default(0),
  isPublished: boolean("is_published").default(false),
  lastGenerated: timestamp("last_generated"),
  
  // v2.5 Auto Page Maker enhancements
  canonicalUrl: text("canonical_url"),
  specHash: varchar("spec_hash", { length: 64 }), // SHA-256 of content spec for deterministic builds
  pageVersion: integer("page_version").default(1),
  eatSignals: jsonb("eat_signals").default('{}'), // Expertise, Authority, Trustworthiness
  p95Latency: integer("p95_latency"), // milliseconds (rolling 5min)
  viewCount: integer("view_count").default(0), // From page_viewed events
  leadCount: integer("lead_count").default(0), // From lead_captured events
  lastIndexed: timestamp("last_indexed"), // From page_indexed events
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userScholarships = pgTable("user_scholarships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  scholarshipId: varchar("scholarship_id").notNull(),
  status: text("status").notNull(), // saved, applied, dismissed
  createdAt: timestamp("created_at").defaultNow(),
});

// V2 Sprint-2: Providers table (B2B organizations)
export const providers = pgTable("providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: varchar("email").unique().notNull(),
  organizationType: text("organization_type").notNull(), // university, foundation, corporation, government
  contactName: varchar("contact_name"),
  contactPhone: varchar("contact_phone"),
  website: text("website"),
  logoUrl: text("logo_url"),
  isVerified: boolean("is_verified").default(false),
  isActive: boolean("is_active").default(true),
  isFerpaCovered: boolean("is_ferpa_covered").default(false),
  platformFeeRate: integer("platform_fee_rate").default(300), // basis points (300 = 3%)
  payoutAccountId: varchar("payout_account_id"), // Stripe Connect account
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_providers_email").on(table.email),
  index("IDX_providers_active").on(table.isActive),
]);

// V2 Sprint-2: Uploads table (document metadata)
export const uploads = pgTable("uploads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id").notNull(),
  ownerType: text("owner_type").notNull(), // user, provider
  filename: text("filename").notNull(),
  mimeType: varchar("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storageKey: text("storage_key"), // Object storage key
  isFerpaCovered: boolean("is_ferpa_covered").default(false),
  status: text("status").default('pending'), // pending, processing, scored, failed
  implicitFitScore: integer("implicit_fit_score"),
  nlpMetadata: jsonb("nlp_metadata").default('{}'),
  traceId: varchar("trace_id"),
  idempotencyKey: varchar("idempotency_key").unique(),
  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at"),
}, (table) => [
  index("IDX_uploads_owner").on(table.ownerId, table.ownerType),
  index("IDX_uploads_status").on(table.status),
  index("IDX_uploads_trace_id").on(table.traceId),
]);

// V2 Sprint-2: Ledgers table (double-entry bookkeeping)
export const ledgers = pgTable("ledgers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  traceId: varchar("trace_id").notNull(),
  entryType: text("entry_type").notNull(), // debit, credit
  accountType: text("account_type").notNull(), // revenue, expense, asset, liability, fee
  accountId: varchar("account_id").notNull(), // user_id, provider_id, platform
  amountCents: integer("amount_cents").notNull(),
  currency: varchar("currency", { length: 3 }).default('USD'),
  description: text("description"),
  referenceType: text("reference_type"), // scholarship, subscription, payout
  referenceId: varchar("reference_id"),
  idempotencyKey: varchar("idempotency_key").unique(),
  isReconciled: boolean("is_reconciled").default(false),
  reconciledAt: timestamp("reconciled_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_ledgers_trace_id").on(table.traceId),
  index("IDX_ledgers_account").on(table.accountType, table.accountId),
  index("IDX_ledgers_reconciled").on(table.isReconciled),
]);

// V2 Sprint-2: Audit events table
export const auditEvents = pgTable("audit_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  traceId: varchar("trace_id").notNull(),
  actorId: varchar("actor_id"),
  actorType: text("actor_type"), // user, provider, system, admin
  action: text("action").notNull(), // create, read, update, delete, login, export
  resourceType: text("resource_type").notNull(), // user, scholarship, upload, ledger
  resourceId: varchar("resource_id"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  changes: jsonb("changes").default('{}'),
  isFerpaAccess: boolean("is_ferpa_access").default(false),
  isPrivacySensitive: boolean("is_privacy_sensitive").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_audit_events_trace_id").on(table.traceId),
  index("IDX_audit_events_actor").on(table.actorId, table.actorType),
  index("IDX_audit_events_resource").on(table.resourceType, table.resourceId),
  index("IDX_audit_events_created_at").on(table.createdAt),
]);

// Business events telemetry table
export const businessEvents = pgTable(
  "business_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    requestId: varchar("request_id").notNull(),
    app: text("app").notNull(), // auto-page-maker, student-pilot, provider-register, etc.
    env: text("env").notNull().default('development'), // development, production
    eventName: text("event_name").notNull(), // page_published, student_signup, etc.
    ts: timestamp("ts").notNull().defaultNow(),
    actorType: text("actor_type"), // student, provider, system
    actorId: varchar("actor_id"),
    orgId: varchar("org_id"),
    sessionId: varchar("session_id"),
    properties: jsonb("properties").default('{}'), // Event-specific data
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("IDX_business_events_app").on(table.app),
    index("IDX_business_events_event_name").on(table.eventName),
    index("IDX_business_events_ts").on(table.ts),
    index("IDX_business_events_actor_id").on(table.actorId),
  ]
);

// Daily KPI snapshots for executive dashboard
export const dailyKpiSnapshots = pgTable(
  "daily_kpi_snapshots",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    date: timestamp("date").notNull(), // Snapshot date
    requestId: varchar("request_id").notNull(),
    dataTimestamp: timestamp("data_timestamp").notNull(), // When data was collected
    
    // B2C metrics
    b2cConversionRate: integer("b2c_conversion_rate"), // basis points (e.g., 350 = 3.50%)
    b2cArpu: integer("b2c_arpu"), // cents
    b2cCtrHighLikelihood: integer("b2c_ctr_high_likelihood"), // basis points
    b2cCtrCompetitive: integer("b2c_ctr_competitive"), // basis points
    b2cCtrLongShot: integer("b2c_ctr_long_shot"), // basis points
    
    // B2B metrics
    b2bActiveProviders: integer("b2b_active_providers"),
    b2bRevenue: integer("b2b_revenue"), // cents from 3% fee
    b2bTopDecileConcentration: integer("b2b_top_decile_concentration"), // basis points
    
    // SLO metrics
    sloUptimePercent: integer("slo_uptime_percent"), // basis points (e.g., 9990 = 99.90%)
    sloP95Latency: integer("slo_p95_latency"), // milliseconds
    sloErrorRate: integer("slo_error_rate"), // basis points
    sloAuthFailureRate: integer("slo_auth_failure_rate"), // basis points
    
    // SEO metrics
    seoPagesLive: integer("seo_pages_live"),
    seoIndexationRate: integer("seo_indexation_rate"), // basis points
    seoOrganicSessions: integer("seo_organic_sessions"),
    
    // CAC/Payback metrics
    cacSeoLed: integer("cac_seo_led"), // cents
    paybackPeriodDays: integer("payback_period_days"),
    
    // Data quality flags
    missingMetrics: text("missing_metrics").array().default(sql`'{}'`),
    dataIntegrityRisks: text("data_integrity_risks").array().default(sql`'{}'`),
    sourceHashes: jsonb("source_hashes").default('{}'), // Data provenance checksums
    
    status: text("status").notNull().default('generated'), // generated, posted, failed
    slackPosted: boolean("slack_posted").default(false),
    artifactsPath: text("artifacts_path"), // Path to MD and JSON files
    
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("IDX_daily_kpi_snapshots_date").on(table.date),
    index("IDX_daily_kpi_snapshots_status").on(table.status),
  ]
);

// Email webhook events for Gate A evidence and deliverability monitoring
export const emailWebhookEvents = pgTable(
  "email_webhook_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    messageId: varchar("message_id").notNull(), // Postmark MessageID
    requestId: varchar("request_id"), // Our internal request_id
    eventType: text("event_type").notNull(), // Delivery, Bounce, SpamComplaint, Open, Click
    recipient: varchar("recipient").notNull(),
    timestamp: timestamp("timestamp").notNull(),
    
    // Event-specific metadata
    bounceType: text("bounce_type"), // HardBounce, SoftBounce, Transient
    bounceReason: text("bounce_reason"),
    clickedLink: text("clicked_link"),
    
    // Postmark webhook payload (full event data)
    rawPayload: jsonb("raw_payload").notNull(),
    
    // Processing metadata
    processedAt: timestamp("processed_at").defaultNow(),
    webhookIp: varchar("webhook_ip"),
    
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    // Unique constraint for idempotency: one event per message+type
    uniqueIndex("UNQ_message_event").on(table.messageId, table.eventType),
    index("IDX_email_webhook_events_message_id").on(table.messageId),
    index("IDX_email_webhook_events_request_id").on(table.requestId),
    index("IDX_email_webhook_events_event_type").on(table.eventType),
    index("IDX_email_webhook_events_timestamp").on(table.timestamp),
  ]
);

// User schemas with proper type handling
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// For user operations that may include ID
export const upsertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
}).partial({ id: true });

export const insertScholarshipSchema = createInsertSchema(scholarships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLandingPageSchema = createInsertSchema(landingPages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserScholarshipSchema = createInsertSchema(userScholarships).omit({
  id: true,
  createdAt: true,
});

export const insertBusinessEventSchema = createInsertSchema(businessEvents).omit({
  id: true,
  createdAt: true,
});

export const insertDailyKpiSnapshotSchema = createInsertSchema(dailyKpiSnapshots).omit({
  id: true,
  createdAt: true,
});

export const insertEmailWebhookEventSchema = createInsertSchema(emailWebhookEvents).omit({
  id: true,
  processedAt: true,
  createdAt: true,
});

// V2 Sprint-2: New insert schemas
export const insertProviderSchema = createInsertSchema(providers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUploadSchema = createInsertSchema(uploads).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export const insertLedgerSchema = createInsertSchema(ledgers).omit({
  id: true,
  createdAt: true,
  reconciledAt: true,
});

export const insertAuditEventSchema = createInsertSchema(auditEvents).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type Scholarship = typeof scholarships.$inferSelect;
export type InsertScholarship = z.infer<typeof insertScholarshipSchema>;
export type LandingPage = typeof landingPages.$inferSelect;
export type InsertLandingPage = z.infer<typeof insertLandingPageSchema>;
export type UserScholarship = typeof userScholarships.$inferSelect;
export type InsertUserScholarship = z.infer<typeof insertUserScholarshipSchema>;
export type BusinessEvent = typeof businessEvents.$inferSelect;
export type InsertBusinessEvent = z.infer<typeof insertBusinessEventSchema>;
export type DailyKpiSnapshot = typeof dailyKpiSnapshots.$inferSelect;
export type InsertDailyKpiSnapshot = z.infer<typeof insertDailyKpiSnapshotSchema>;
export type EmailWebhookEvent = typeof emailWebhookEvents.$inferSelect;
export type InsertEmailWebhookEvent = z.infer<typeof insertEmailWebhookEventSchema>;

// V2 Sprint-2: New types
export type Provider = typeof providers.$inferSelect;
export type InsertProvider = z.infer<typeof insertProviderSchema>;
export type Upload = typeof uploads.$inferSelect;
export type InsertUpload = z.infer<typeof insertUploadSchema>;
export type Ledger = typeof ledgers.$inferSelect;
export type InsertLedger = z.infer<typeof insertLedgerSchema>;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type InsertAuditEvent = z.infer<typeof insertAuditEventSchema>;

export const scholarshipAssetRequestSchema = z.object({
  scholarshipId: z.string().uuid(),
  templateVersion: z.string().default('v1'),
  format: z.literal('pdf').default('pdf'),
  customizations: z.object({
    brandColor: z.string().optional(),
    logoUrl: z.string().url().optional(),
    contactEmail: z.string().email().optional(),
  }).optional(),
});

export type ScholarshipAssetRequest = z.infer<typeof scholarshipAssetRequestSchema>;
