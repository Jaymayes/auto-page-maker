import { storage } from '../storage';
import { ContentGenerator } from '../services/contentGenerator';
import { SitemapGenerator } from '../services/sitemapGenerator';
import { sanitizeInput } from '../middleware/security';
import type { Task, Result } from './agent-bridge';
import { nanoid } from 'nanoid';

const contentGenerator = new ContentGenerator();
const sitemapGenerator = new SitemapGenerator();

// Action handler interface
export interface ActionHandler {
  (payload: any, traceId: string): Promise<any>;
}

// Map of action handlers
export const actionHandlers: Record<string, ActionHandler> = {
  'scholarmatch.search': handleSearch,
  'scholarmatch.match': handleMatch,
  'scholarmatch.generate_page': handleGeneratePage,
  'scholarmatch.analyze_essay': handleAnalyzeEssay,
  'scholarmatch.generate_sitemap': handleGenerateSitemap,
  'scholarmatch.track_interaction': handleTrackInteraction
};

// Search scholarships
async function handleSearch(payload: any, traceId: string): Promise<any> {
  const { query, filters = {}, pagination = {} } = payload;
  
  // Sanitize inputs
  const sanitizedFilters = {
    major: filters.major ? sanitizeInput(filters.major) : undefined,
    state: filters.state ? sanitizeInput(filters.state) : undefined,
    city: filters.city ? sanitizeInput(filters.city) : undefined,
    level: filters.level ? sanitizeInput(filters.level) : undefined,
    isActive: filters.isActive !== undefined ? Boolean(filters.isActive) : true,
    limit: Math.min(pagination.size || 10, 100), // Cap at 100
    offset: Math.max(pagination.page ? (pagination.page - 1) * (pagination.size || 10) : 0, 0)
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
    page: pagination.page || 1,
    took_ms: tookMs,
    filters_applied: sanitizedFilters
  };
}

// Match scholarships to student profile
async function handleMatch(payload: any, traceId: string): Promise<any> {
  const { student_profile, scholarship_list } = payload;
  
  // If no scholarship list provided, get all active scholarships
  let scholarships;
  if (scholarship_list && Array.isArray(scholarship_list)) {
    scholarships = scholarship_list;
  } else {
    scholarships = await storage.getScholarships({ isActive: true, limit: 50 });
  }

  // Simple matching algorithm based on student profile
  const matches = scholarships.map((scholarship: any) => {
    let score = 0;
    let reasoning: string[] = [];

    // Major matching
    if (student_profile.major && scholarship.major) {
      if (student_profile.major.toLowerCase().includes(scholarship.major.toLowerCase()) ||
          scholarship.major.toLowerCase().includes(student_profile.major.toLowerCase())) {
        score += 40;
        reasoning.push(`Major alignment: ${scholarship.major}`);
      }
    }

    // Location matching
    if (student_profile.state && scholarship.state) {
      if (student_profile.state.toLowerCase() === scholarship.state.toLowerCase()) {
        score += 20;
        reasoning.push(`State match: ${scholarship.state}`);
      }
    }

    if (student_profile.city && scholarship.city) {
      if (student_profile.city.toLowerCase() === scholarship.city.toLowerCase()) {
        score += 15;
        reasoning.push(`City match: ${scholarship.city}`);
      }
    }

    // Academic level matching
    if (student_profile.level && scholarship.level) {
      if (student_profile.level.toLowerCase() === scholarship.level.toLowerCase()) {
        score += 15;
        reasoning.push(`Academic level: ${scholarship.level}`);
      }
    }

    // GPA requirements
    if (scholarship.requirements?.gpa && student_profile.gpa) {
      if (student_profile.gpa >= scholarship.requirements.gpa) {
        score += 10;
        reasoning.push(`GPA requirement met: ${scholarship.requirements.gpa}`);
      } else {
        score -= 20;
        reasoning.push(`GPA requirement not met: needs ${scholarship.requirements.gpa}, has ${student_profile.gpa}`);
      }
    }

    return {
      scholarship,
      match_score: Math.max(score, 0),
      reasoning,
      recommendation: score >= 30 ? 'high' : score >= 15 ? 'medium' : 'low'
    };
  });

  // Sort by match score and return top matches
  const sortedMatches = matches
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 20);

  return {
    matches: sortedMatches,
    student_profile,
    total_evaluated: scholarships.length,
    high_matches: sortedMatches.filter(m => m.recommendation === 'high').length,
    medium_matches: sortedMatches.filter(m => m.recommendation === 'medium').length
  };
}

// Generate landing page
async function handleGeneratePage(payload: any, traceId: string): Promise<any> {
  const { template, templateData, title, slug, seo = {} } = payload;
  
  if (!template || !templateData) {
    throw new Error('Template and templateData are required');
  }

  const startTime = Date.now();
  
  // Get relevant scholarships for content generation
  const scholarships = await storage.getScholarships({
    major: templateData.major,
    state: templateData.state,
    city: templateData.city,
    isActive: true,
    limit: 50
  });

  // Generate content using the content generator
  const content = await contentGenerator.generateLandingPageContent(template, templateData, scholarships);
  
  // Create landing page object
  const landingPage = {
    slug: slug || `${template}-${Date.now()}`,
    title: title || 'Generated Landing Page',
    metaDescription: seo.description || content.metaDescription,
    template,
    templateData,
    content,
    scholarshipCount: scholarships.length,
    totalAmount: scholarships.reduce((sum, s) => sum + s.amount, 0),
    isPublished: false,
    lastGenerated: new Date()
  };

  // Store the landing page
  const created = await storage.createLandingPage(landingPage);
  const tookMs = Date.now() - startTime;

  return {
    landing_page: created,
    url: `/scholarships/${created.slug}`,
    generation_time_ms: tookMs,
    content_sections: Object.keys(content).length
  };
}

// Analyze essay (placeholder - would integrate with AI service)
async function handleAnalyzeEssay(payload: any, traceId: string): Promise<any> {
  const { essay_text, criteria = [] } = payload;
  
  if (!essay_text) {
    throw new Error('Essay text is required');
  }

  // Placeholder analysis - in real implementation would use AI
  const wordCount = essay_text.split(/\s+/).length;
  const sentenceCount = essay_text.split(/[.!?]+/).length;
  const avgWordsPerSentence = Math.round(wordCount / sentenceCount);

  return {
    analysis: {
      word_count: wordCount,
      sentence_count: sentenceCount,
      avg_words_per_sentence: avgWordsPerSentence,
      readability_score: Math.min(Math.max(Math.round(100 - (avgWordsPerSentence * 2)), 0), 100),
      tone: wordCount > 500 ? 'formal' : 'casual',
      suggestions: [
        wordCount < 250 ? 'Consider expanding your essay with more specific examples' : null,
        avgWordsPerSentence > 25 ? 'Try breaking up some longer sentences for better readability' : null,
        !essay_text.includes('scholarship') ? 'Consider mentioning why this specific scholarship matters to you' : null
      ].filter(Boolean)
    },
    criteria_scores: criteria.map((criterion: string) => ({
      criterion,
      score: Math.round(Math.random() * 40 + 60), // Placeholder scoring
      feedback: `Good coverage of ${criterion} in your essay`
    })),
    overall_score: Math.round(Math.random() * 20 + 75) // Placeholder overall score
  };
}

// Generate sitemap
async function handleGenerateSitemap(payload: any, traceId: string): Promise<any> {
  const startTime = Date.now();
  
  // Get all published landing pages
  const landingPages = await storage.getLandingPages({ isPublished: true });
  
  // Generate sitemap
  const sitemap = await sitemapGenerator.generateSitemap(landingPages);
  const tookMs = Date.now() - startTime;

  return {
    sitemap_xml: sitemap,
    pages_included: landingPages.length,
    generation_time_ms: tookMs,
    last_updated: new Date().toISOString()
  };
}

// Track user interaction
async function handleTrackInteraction(payload: any, traceId: string): Promise<any> {
  const { user_id, scholarship_id, action, metadata = {} } = payload;
  
  if (!scholarship_id || !action) {
    throw new Error('Scholarship ID and action are required');
  }

  // Valid actions for user interactions
  const validActions = ['save', 'apply', 'dismiss', 'view', 'share'];
  if (!validActions.includes(action)) {
    throw new Error(`Invalid action: ${action}. Must be one of: ${validActions.join(', ')}`);
  }

  let result;
  
  if (action === 'save' && user_id) {
    // Create user-scholarship relationship
    result = await storage.saveScholarship({
      userId: user_id,
      scholarshipId: scholarship_id,
      status: 'saved'
    });
  } else if (action === 'apply' && user_id) {
    // Update or create user-scholarship relationship
    result = await storage.saveScholarship({
      userId: user_id,
      scholarshipId: scholarship_id,
      status: 'applied'
    });
  } else {
    // For other actions (view, share, etc.), just log the interaction
    result = {
      tracked: true,
      action,
      scholarship_id,
      user_id,
      timestamp: new Date().toISOString(),
      metadata
    };
  }

  return {
    interaction: result,
    action,
    scholarship_id,
    user_id,
    trace_id: traceId
  };
}

// Process a task and return result
export async function processTask(task: Task): Promise<Result> {
  const startTime = Date.now();
  
  try {
    // Find action handler
    const handler = actionHandlers[task.action];
    if (!handler) {
      return {
        task_id: task.task_id,
        status: 'failed',
        error: {
          code: 'UNKNOWN_ACTION',
          message: `Unknown action: ${task.action}`,
          details: { available_actions: Object.keys(actionHandlers) }
        },
        trace_id: task.trace_id
      };
    }

    // Execute handler
    const result = await handler(task.payload, task.trace_id);
    const processingTime = Date.now() - startTime;

    return {
      task_id: task.task_id,
      status: 'succeeded',
      result: {
        ...result,
        processing_time_ms: processingTime,
        agent_id: 'scholarmatch-monolith'
      },
      trace_id: task.trace_id
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    return {
      task_id: task.task_id,
      status: 'failed',
      error: {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: { processing_time_ms: processingTime }
      },
      trace_id: task.trace_id
    };
  }
}