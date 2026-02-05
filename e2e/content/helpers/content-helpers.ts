/**
 * A7 Content Generation Test Helpers
 *
 * Validation utilities for content generation endpoints,
 * sitemap verification, and rate limit handling.
 */

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Expected landing page content structure from contentGenerator.ts
 */
export interface LandingPageContent {
  heroTitle: string;
  heroDescription: string;
  metaDescription: string;
  scholarshipSummaries?: ScholarshipSummary[];
  categoryInsights?: string;
  relatedCategories?: RelatedCategory[];
}

export interface ScholarshipSummary {
  title: string;
  description: string;
  keyFeatures: string[];
  eligibilityHighlights: string[];
  deadlineInfo: string;
  tips: string[];
}

export interface RelatedCategory {
  title: string;
  description: string;
  slug: string;
}

export interface LandingPage {
  id: string;
  slug: string;
  title: string;
  content?: LandingPageContent;
  metaDescription?: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SitemapValidation {
  valid: boolean;
  urlCount: number;
  hasXmlDeclaration: boolean;
  hasUrlset: boolean;
  hasSitemapIndex: boolean;
  errors: string[];
  sampleUrls: string[];
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  policy?: string;
}

export interface SecurityHeaders {
  csp: string | null;
  xFrameOptions: string | null;
  xContentTypeOptions: string | null;
  strictTransportSecurity: string | null;
  referrerPolicy: string | null;
  permissionsPolicy: string | null;
}

// =============================================================================
// Content Validation
// =============================================================================

/**
 * Validates landing page content structure
 */
export function validateLandingPageContent(content: any): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!content) {
    errors.push('Content is null or undefined');
    return { valid: false, errors, warnings };
  }

  // Required fields
  if (typeof content.heroTitle !== 'string' || content.heroTitle.length === 0) {
    errors.push('heroTitle is missing or not a string');
  }

  if (typeof content.heroDescription !== 'string' || content.heroDescription.length === 0) {
    errors.push('heroDescription is missing or not a string');
  }

  if (typeof content.metaDescription !== 'string' || content.metaDescription.length === 0) {
    errors.push('metaDescription is missing or not a string');
  }

  // Optional fields validation
  if (content.scholarshipSummaries !== undefined) {
    if (!Array.isArray(content.scholarshipSummaries)) {
      errors.push('scholarshipSummaries must be an array');
    } else {
      content.scholarshipSummaries.forEach((summary: any, index: number) => {
        const summaryErrors = validateScholarshipSummary(summary);
        summaryErrors.forEach(err => errors.push(`scholarshipSummaries[${index}]: ${err}`));
      });
    }
  }

  if (content.relatedCategories !== undefined) {
    if (!Array.isArray(content.relatedCategories)) {
      errors.push('relatedCategories must be an array');
    } else {
      content.relatedCategories.forEach((cat: any, index: number) => {
        if (typeof cat.title !== 'string') {
          errors.push(`relatedCategories[${index}].title must be a string`);
        }
        if (typeof cat.slug !== 'string') {
          errors.push(`relatedCategories[${index}].slug must be a string`);
        }
      });
    }
  }

  // Warnings for optional missing fields
  if (!content.categoryInsights) {
    warnings.push('categoryInsights is missing (optional)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates scholarship summary structure
 */
export function validateScholarshipSummary(summary: any): string[] {
  const errors: string[] = [];

  if (typeof summary.title !== 'string') {
    errors.push('title must be a string');
  }

  if (typeof summary.description !== 'string') {
    errors.push('description must be a string');
  }

  if (!Array.isArray(summary.keyFeatures)) {
    errors.push('keyFeatures must be an array');
  }

  if (!Array.isArray(summary.eligibilityHighlights)) {
    errors.push('eligibilityHighlights must be an array');
  }

  if (typeof summary.deadlineInfo !== 'string') {
    errors.push('deadlineInfo must be a string');
  }

  if (!Array.isArray(summary.tips)) {
    errors.push('tips must be an array');
  }

  return errors;
}

// =============================================================================
// Sitemap Validation
// =============================================================================

/**
 * Validates sitemap XML structure
 */
export function validateSitemapXml(xml: string): SitemapValidation {
  const errors: string[] = [];
  const sampleUrls: string[] = [];

  // Check for XML declaration
  const hasXmlDeclaration = xml.trim().startsWith('<?xml');
  if (!hasXmlDeclaration) {
    errors.push('Missing XML declaration');
  }

  // Check for sitemap index vs urlset
  const hasSitemapIndex = xml.includes('<sitemapindex');
  const hasUrlset = xml.includes('<urlset');

  if (!hasUrlset && !hasSitemapIndex) {
    errors.push('Missing urlset or sitemapindex element');
  }

  // Count URLs
  let urlCount = 0;

  if (hasUrlset) {
    const urlMatches = xml.match(/<url>/g);
    urlCount = urlMatches ? urlMatches.length : 0;

    // Extract sample URLs (first 5)
    const locRegex = /<loc>([^<]+)<\/loc>/g;
    let match;
    let count = 0;
    while ((match = locRegex.exec(xml)) !== null && count < 5) {
      sampleUrls.push(match[1]);
      count++;
    }

    // Validate loc elements
    const locMatches = xml.match(/<loc>/g);
    if (locMatches && locMatches.length !== urlCount) {
      errors.push('Mismatch between url and loc counts');
    }
  }

  if (hasSitemapIndex) {
    const sitemapMatches = xml.match(/<sitemap>/g);
    urlCount = sitemapMatches ? sitemapMatches.length : 0;

    // Extract sitemap locations
    const locRegex = /<loc>([^<]+)<\/loc>/g;
    let match;
    let count = 0;
    while ((match = locRegex.exec(xml)) !== null && count < 5) {
      sampleUrls.push(match[1]);
      count++;
    }
  }

  return {
    valid: errors.length === 0,
    urlCount,
    hasXmlDeclaration,
    hasUrlset,
    hasSitemapIndex,
    errors,
    sampleUrls
  };
}

/**
 * Checks if sitemap URL is valid format
 */
export function isValidSitemapUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

// =============================================================================
// Rate Limit Handling
// =============================================================================

/**
 * Parses rate limit headers from response
 */
export function parseRateLimitHeaders(headers: Record<string, string>): RateLimitInfo | null {
  // Try standard X-Ratelimit headers
  const limit = headers['x-ratelimit-limit'];
  const remaining = headers['x-ratelimit-remaining'];
  const reset = headers['x-ratelimit-reset'];
  const policy = headers['ratelimit-policy'];

  if (!limit && !remaining && !reset) {
    // Try alternative header names
    const altLimit = headers['ratelimit-limit'];
    const altRemaining = headers['ratelimit-remaining'];
    const altReset = headers['ratelimit-reset'];

    if (altLimit || altRemaining || altReset) {
      return {
        limit: parseInt(altLimit || '0', 10),
        remaining: parseInt(altRemaining || '0', 10),
        reset: parseInt(altReset || '0', 10),
        policy: policy || undefined
      };
    }

    return null;
  }

  return {
    limit: parseInt(limit || '0', 10),
    remaining: parseInt(remaining || '0', 10),
    reset: parseInt(reset || '0', 10),
    policy: policy || undefined
  };
}

/**
 * Checks if rate limited based on headers
 */
export function isRateLimited(headers: Record<string, string>): boolean {
  const info = parseRateLimitHeaders(headers);
  return info !== null && info.remaining <= 0;
}

// =============================================================================
// Security Header Validation
// =============================================================================

/**
 * Extracts security headers from response
 */
export function extractSecurityHeaders(headers: Record<string, string>): SecurityHeaders {
  return {
    csp: headers['content-security-policy'] || null,
    xFrameOptions: headers['x-frame-options'] || null,
    xContentTypeOptions: headers['x-content-type-options'] || null,
    strictTransportSecurity: headers['strict-transport-security'] || null,
    referrerPolicy: headers['referrer-policy'] || null,
    permissionsPolicy: headers['permissions-policy'] || null
  };
}

/**
 * Validates required security headers are present
 */
export function validateSecurityHeaders(headers: SecurityHeaders): {
  valid: boolean;
  missing: string[];
  present: string[];
} {
  const missing: string[] = [];
  const present: string[] = [];

  // Required headers
  if (!headers.xFrameOptions) {
    missing.push('X-Frame-Options');
  } else {
    present.push(`X-Frame-Options: ${headers.xFrameOptions}`);
  }

  if (!headers.xContentTypeOptions) {
    missing.push('X-Content-Type-Options');
  } else {
    present.push(`X-Content-Type-Options: ${headers.xContentTypeOptions}`);
  }

  if (!headers.strictTransportSecurity) {
    missing.push('Strict-Transport-Security');
  } else {
    present.push(`HSTS: ${headers.strictTransportSecurity.substring(0, 50)}...`);
  }

  // CSP is important but complex
  if (!headers.csp) {
    missing.push('Content-Security-Policy');
  } else {
    present.push(`CSP: present (${headers.csp.length} chars)`);
  }

  return {
    valid: missing.length === 0,
    missing,
    present
  };
}

// =============================================================================
// XSS Detection
// =============================================================================

/**
 * Checks content for potential XSS vectors
 */
export function detectXssVectors(content: string): {
  safe: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check for script tags
  if (/<script\b[^>]*>/i.test(content)) {
    issues.push('Contains <script> tags');
  }

  // Check for event handlers
  const eventHandlers = [
    'onload', 'onerror', 'onclick', 'onmouseover', 'onfocus',
    'onblur', 'onsubmit', 'onchange', 'onkeydown', 'onkeyup'
  ];
  for (const handler of eventHandlers) {
    const regex = new RegExp(`\\s${handler}\\s*=`, 'i');
    if (regex.test(content)) {
      issues.push(`Contains ${handler} event handler`);
    }
  }

  // Check for javascript: protocol
  if (/javascript:/i.test(content)) {
    issues.push('Contains javascript: protocol');
  }

  // Check for data: protocol in sensitive contexts
  if (/src\s*=\s*["']?data:/i.test(content)) {
    issues.push('Contains data: URI in src attribute');
  }

  // Check for SVG with script
  if (/<svg[^>]*>.*<script/is.test(content)) {
    issues.push('Contains SVG with embedded script');
  }

  return {
    safe: issues.length === 0,
    issues
  };
}

// =============================================================================
// Test Constants
// =============================================================================

export const BASE_URL = 'https://www.scholaraiadvisor.com';

export const ENDPOINTS = {
  health: '/api/health',
  landingPages: '/api/landing-pages',
  sitemap: '/sitemap.xml',
  browse: '/browse',
  scholarships: '/api/scholarships'
};

export const EXPECTED_HEADERS = {
  xFrameOptions: 'DENY',
  xContentTypeOptions: 'nosniff'
};
