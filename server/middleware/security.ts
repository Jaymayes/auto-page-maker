import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';

// SEC-001: XSS mitigation through HTML sanitization
export function sanitizeInput(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard'
  });
}

// VAL-003: Strict slug validation
export const slugSchema = z.string()
  .regex(/^[a-z0-9-]{3,64}$/, 'Slug must be 3-64 characters, lowercase letters, numbers, and hyphens only')
  .transform(s => s.toLowerCase());

// VAL-001: Pagination validation
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0)
});

// VAL-002: Required string validation
export const requiredStringSchema = z.string().trim().min(1, 'This field is required');

// SEC-002: Template data validation and sanitization
export const templateDataSchema = z.record(z.any()).refine(
  (data) => {
    const str = JSON.stringify(data);
    return str.length <= 10000; // 10KB limit
  },
  'Template data too large'
).transform(data => {
  // Sanitize all string values in template data
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
});

// Content size validation
export function validateContentSize(content: string, maxSize: number = 50000): void {
  if (content.length > maxSize) {
    const error = new Error('Content too large');
    (error as any).status = 413;
    (error as any).code = 'PAYLOAD_TOO_LARGE';
    throw error;
  }
}

// GA Measurement ID validation
export const gaMeasurementIdSchema = z.string().regex(
  /^G-[A-Z0-9]{10}$/,
  'Invalid Google Analytics Measurement ID format'
);