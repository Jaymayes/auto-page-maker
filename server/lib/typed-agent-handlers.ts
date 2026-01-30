import { z } from 'zod';
import { storage } from '../storage';
import type { ContentGenerator } from '../services/contentGenerator';
import type { SitemapGenerator } from '../services/sitemapGenerator';
import { sanitizeInput } from '../middleware/security';
import { nanoid } from 'nanoid';
import { features } from '../config/environment';

// Strongly typed payload schemas for each action
export const TaskSchemas = {
  'scholarmatch.search': z.object({
    query: z.string().min(1, 'Search query required').optional(),
    filters: z.object({
      major: z.string().optional(),
      state: z.string().optional(),
      city: z.string().optional(),
      level: z.enum(['undergraduate', 'graduate', 'high school', 'all']).optional(),
      isActive: z.boolean().optional(),
    }).optional(),
    pagination: z.object({
      page: z.number().int().min(1).default(1),
      size: z.number().int().min(1).max(100).default(10),
    }).optional(),
  }),
  
  'scholarmatch.match': z.object({
    student_profile: z.object({
      major: z.string().min(1, 'Major required'),
      gpa: z.number().min(0).max(4.0).optional(),
      state: z.string().optional(),
      city: z.string().optional(),
      level: z.enum(['undergraduate', 'graduate', 'high school']),
      interests: z.array(z.string()).optional(),
      financial_need: z.boolean().optional(),
    }),
    preferences: z.object({
      max_results: z.number().int().min(1).max(50).default(10),
      min_amount: z.number().int().min(0).optional(),
      no_essay_only: z.boolean().default(false),
    }).optional(),
  }),
  
  'scholarmatch.generate_page': z.object({
    template: z.enum(['major-state', 'no-essay', 'local-city'], 
      { required_error: 'Template must be: major-state, no-essay, or local-city' }),
    templateData: z.record(z.any()).refine(
      (data) => JSON.stringify(data).length <= 10000,
      'Template data too large (max 10KB)'
    ),
    title: z.string().min(1, 'Title required').max(200),
    slug: z.string().regex(
      /^[a-z0-9-]{3,64}$/,
      'Slug must be 3-64 characters, lowercase letters, numbers, and hyphens only'
    ).optional(),
  }),
  
  'scholarmatch.analyze_essay': z.object({
    essay_text: z.string().min(50, 'Essay must be at least 50 characters').max(50000, 'Essay too long (max 50KB)'),
    criteria: z.object({
      grammar: z.boolean().default(true),
      structure: z.boolean().default(true),
      content: z.boolean().default(true),
      clarity: z.boolean().default(true),
    }).optional(),
    target_scholarship: z.string().optional(),
  }),
  
  'scholarmatch.generate_sitemap': z.object({
    base_url: z.string().url('Base URL must be valid'),
    include_landing_pages: z.boolean().default(true),
    include_scholarships: z.boolean().default(true),
    max_entries: z.number().int().min(1).max(50000).default(10000),
  }),
  
  'scholarmatch.track_interaction': z.object({
    user_id: z.string().optional(),
    session_id: z.string().min(1, 'Session ID required'),
    event_type: z.enum(['search', 'view', 'save', 'apply', 'match', 'generate']),
    event_data: z.record(z.any()).optional(),
    page_url: z.string().url().optional(),
    referrer: z.string().optional(),
  }),
} as const;

// Infer types from schemas
export type TaskPayloads = {
  [K in keyof typeof TaskSchemas]: z.infer<typeof TaskSchemas[K]>
};

// Typed handler interface
export interface TypedActionHandler<T extends keyof TaskPayloads> {
  (payload: TaskPayloads[T], traceId: string): Promise<any>;
}

// Service instances - lazy loaded to avoid import errors
let contentGenerator: ContentGenerator | null = null;
let sitemapGenerator: SitemapGenerator | null = null;

async function getContentGenerator(): Promise<ContentGenerator> {
  if (!contentGenerator) {
    const { ContentGenerator } = await import('../services/contentGenerator');
    contentGenerator = new ContentGenerator();
  }
  return contentGenerator;
}

async function getSitemapGenerator(): Promise<SitemapGenerator> {
  if (!sitemapGenerator) {
    const { SitemapGenerator } = await import('../services/sitemapGenerator');
    sitemapGenerator = new SitemapGenerator();
  }
  return sitemapGenerator;
}

// Typed handlers implementation
const handleSearch: TypedActionHandler<'scholarmatch.search'> = async (payload, traceId) => {
  const { query, filters = {}, pagination = { page: 1, size: 10 } } = payload;
  
  // Sanitize string inputs
  const sanitizedFilters = {
    major: filters.major ? sanitizeInput(filters.major) : undefined,
    state: filters.state ? sanitizeInput(filters.state) : undefined,
    city: filters.city ? sanitizeInput(filters.city) : undefined,
    level: filters.level,
    isActive: filters.isActive !== undefined ? filters.isActive : true,
    limit: pagination.size,
    offset: (pagination.page - 1) * pagination.size,
  };

  // Remove undefined values
  Object.keys(sanitizedFilters).forEach(key => {
    if (sanitizedFilters[key as keyof typeof sanitizedFilters] === undefined) {
      delete sanitizedFilters[key as keyof typeof sanitizedFilters];
    }
  });

  const startTime = Date.now();
  const scholarships = await storage.getScholarships(sanitizedFilters);
  const stats = await storage.getScholarshipStats(sanitizedFilters);
  const tookMs = Date.now() - startTime;

  return {
    items: scholarships,
    total: stats.count,
    page: pagination.page,
    size: pagination.size,
    took_ms: tookMs,
    trace_id: traceId,
  };
};

const handleMatch: TypedActionHandler<'scholarmatch.match'> = async (payload, traceId) => {
  const { student_profile, preferences } = payload;
  const prefs = preferences ?? { max_results: 10 };
  
  // Build matching filters from student profile
  const filters = {
    major: student_profile.major,
    state: student_profile.state,
    city: student_profile.city,
    level: student_profile.level,
    isActive: true,
    limit: prefs.max_results,
  };

  // Apply preferences with proper typing
  const extendedFilters = {
    ...filters,
    ...('no_essay_only' in prefs && prefs.no_essay_only && { isNoEssay: true })
  };

  const startTime = Date.now();
  const scholarships = await storage.getScholarships(extendedFilters);
  
  // Simple scoring based on profile match
  const scored = scholarships.map(scholarship => {
    let score = 0;
    if (scholarship.major === student_profile.major) score += 3;
    if (scholarship.state === student_profile.state) score += 2;
    if (scholarship.city === student_profile.city) score += 1;
    if ('min_amount' in prefs && prefs.min_amount && scholarship.amount >= prefs.min_amount) score += 1;
    
    return { ...scholarship, match_score: score };
  }).sort((a, b) => b.match_score - a.match_score);

  return {
    matches: scored,
    total_found: scored.length,
    student_profile,
    took_ms: Date.now() - startTime,
    trace_id: traceId,
  };
};

const handleGeneratePage: TypedActionHandler<'scholarmatch.generate_page'> = async (payload, traceId) => {
  if (!features.contentGeneration) {
    const error = new Error('Content generation disabled - OPENAI_API_KEY not configured');
    (error as any).status = 503;
    (error as any).code = 'CONTENT_GENERATION_DISABLED';
    throw error;
  }

  const { template, templateData, title, slug } = payload;
  
  const generatedSlug = slug || title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 64);

  const startTime = Date.now();
  const generator = await getContentGenerator();
  const content = await generator.generateLandingPageContent(template, templateData, []);
  
  return {
    page: {
      slug: generatedSlug,
      title,
      template,
      templateData,
      content,
      generated_at: new Date().toISOString(),
    },
    took_ms: Date.now() - startTime,
    trace_id: traceId,
  };
};

const handleAnalyzeEssay: TypedActionHandler<'scholarmatch.analyze_essay'> = async (payload, traceId) => {
  if (!features.contentGeneration) {
    const error = new Error('Essay analysis disabled - OPENAI_API_KEY not configured');
    (error as any).status = 503;
    (error as any).code = 'ESSAY_ANALYSIS_DISABLED';
    throw error;
  }

  const { essay_text, criteria, target_scholarship } = payload;
  const crit = criteria ?? {};
  
  const startTime = Date.now();
  
  // Real OpenAI-powered essay analysis with coaching-only policy
  const generator = await getContentGenerator();
  const analysis = await generator.analyzeEssay(
    essay_text,
    {
      grammar: (crit as any).grammar,
      structure: (crit as any).structure,
      content: (crit as any).content,
      clarity: (crit as any).clarity,
    },
    target_scholarship
  );

  return {
    analysis,
    target_scholarship,
    took_ms: Date.now() - startTime,
    trace_id: traceId,
  };
};

const handleGenerateSitemap: TypedActionHandler<'scholarmatch.generate_sitemap'> = async (payload, traceId) => {
  const { base_url, include_landing_pages, include_scholarships, max_entries } = payload;
  
  const startTime = Date.now();
  const generator = await getSitemapGenerator();
  const pages = await storage.getLandingPages({ isPublished: include_landing_pages });
  const sitemap = await generator.generateSitemap(pages);

  return {
    sitemap,
    entry_count: sitemap.split('<url>').length - 1,
    generated_at: new Date().toISOString(),
    took_ms: Date.now() - startTime,
    trace_id: traceId,
  };
};

const handleTrackInteraction: TypedActionHandler<'scholarmatch.track_interaction'> = async (payload, traceId) => {
  const { user_id, session_id, event_type, event_data, page_url, referrer } = payload;
  
  // Store interaction (would typically go to analytics service)
  const interaction = {
    id: nanoid(),
    user_id,
    session_id,
    event_type,
    event_data,
    page_url,
    referrer,
    timestamp: new Date().toISOString(),
    trace_id: traceId,
  };

  // Mock storage - would integrate with analytics service
  console.log('[ANALYTICS]', JSON.stringify(interaction));

  return {
    interaction_id: interaction.id,
    recorded_at: interaction.timestamp,
    trace_id: traceId,
  };
};

// Typed handler registry
export const typedActionHandlers = {
  'scholarmatch.search': handleSearch,
  'scholarmatch.match': handleMatch,
  'scholarmatch.generate_page': handleGeneratePage,
  'scholarmatch.analyze_essay': handleAnalyzeEssay,
  'scholarmatch.generate_sitemap': handleGenerateSitemap,
  'scholarmatch.track_interaction': handleTrackInteraction,
} as const;

// Validation and dispatch function
export async function validateAndDispatch(
  action: string, 
  payload: unknown, 
  traceId: string
): Promise<any> {
  if (!typedActionHandlers[action as keyof typeof typedActionHandlers]) {
    const error = new Error(`Unknown action: ${action}`);
    (error as any).status = 400;
    (error as any).code = 'UNKNOWN_ACTION';
    throw error;
  }

  const schema = TaskSchemas[action as keyof typeof TaskSchemas];
  if (!schema) {
    const error = new Error(`No schema defined for action: ${action}`);
    (error as any).status = 500;
    (error as any).code = 'SCHEMA_NOT_FOUND';
    throw error;
  }

  // Validate payload
  const validatedPayload = schema.parse(payload);
  
  // Dispatch to typed handler
  const handler = typedActionHandlers[action as keyof typeof typedActionHandlers];
  return await handler(validatedPayload as any, traceId);
}