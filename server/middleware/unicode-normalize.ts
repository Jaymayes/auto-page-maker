import { Request, Response, NextFunction } from 'express';

// Control characters to remove (keep tab, newline, carriage return)
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

// Zero-width characters
const ZERO_WIDTH_ALL = /[\u200B-\u200D\u2060\uFEFF]/g; // ZWSP, ZWNJ, ZWJ, WJ, BOM
const ZERO_WIDTH_SAFE_TO_STRIP = /[\u200B\u2060\uFEFF]/g; // Keep ZWJ/ZWNJ in free text

// Parse comma-separated list from environment
const parseList = (s?: string) => new Set((s || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean));

// Get identifier fields from environment or use defaults
const IDENTIFIER_FIELDS = () => parseList(
  process.env.UNICODE_IDENTIFIER_FIELDS || 
  'email,username,slug,id,path,file,origin,city,state,major,category,type,name,title'
);

/**
 * Normalize a string value based on field type
 * @param value - The value to normalize
 * @param fieldName - The field name to determine normalization policy
 * @param isIdentifier - Whether this is an identifier field
 */
function normalizeValue(value: any, fieldName: string, isIdentifier: boolean): string | null {
  if (typeof value !== 'string') {
    return value;
  }

  // Step 1: Normalize to NFC (Canonical Decomposition followed by Canonical Composition)
  let normalized = value.normalize('NFC');

  // Step 2: Standardize line endings to LF
  normalized = normalized.replace(/\r\n|\r/g, '\n');

  // Step 3: Remove control characters (except tab, newline, carriage return)
  normalized = normalized.replace(CONTROL_CHARS, '');

  // Step 4: Handle zero-width characters based on field type
  if (isIdentifier) {
    // For identifiers, remove all zero-width characters
    normalized = normalized.replace(ZERO_WIDTH_ALL, '');
    
    // Trim whitespace for identifiers
    normalized = normalized.trim();
    
    // Check if identifier is empty or only whitespace after normalization
    if (!normalized || normalized.length === 0) {
      return null; // Will trigger validation error
    }
  } else {
    // For free text, only remove safe-to-strip zero-width characters
    // Keep ZWJ/ZWNJ for proper rendering of certain languages
    normalized = normalized.replace(ZERO_WIDTH_SAFE_TO_STRIP, '');
  }

  return normalized;
}

/**
 * Recursively normalize an object's string properties
 * @param obj - Object to normalize
 * @param identifierFields - Set of field names considered identifiers
 * @param path - Current path for logging
 */
function normalizeObject(obj: any, identifierFields: Set<string>, path = ''): { normalized: any; changes: string[] } {
  if (!obj || typeof obj !== 'object') {
    return { normalized: obj, changes: [] };
  }

  if (Array.isArray(obj)) {
    const changes: string[] = [];
    const normalized = obj.map((item, index) => {
      const result = normalizeObject(item, identifierFields, `${path}[${index}]`);
      changes.push(...result.changes);
      return result.normalized;
    });
    return { normalized, changes };
  }

  const normalized: any = {};
  const changes: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fieldPath = path ? `${path}.${key}` : key;
    const isIdentifier = identifierFields.has(key.toLowerCase());

    if (typeof value === 'string') {
      const originalValue = value;
      const normalizedValue = normalizeValue(value, key, isIdentifier);
      
      if (normalizedValue === null) {
        // Field became empty after normalization - this is a validation error
        changes.push(`${fieldPath}: empty after normalization`);
        normalized[key] = normalizedValue;
      } else if (normalizedValue !== originalValue) {
        changes.push(`${fieldPath}: normalized`);
        normalized[key] = normalizedValue;
      } else {
        normalized[key] = value;
      }
    } else if (typeof value === 'object' && value !== null) {
      const result = normalizeObject(value, identifierFields, fieldPath);
      normalized[key] = result.normalized;
      changes.push(...result.changes);
    } else {
      normalized[key] = value;
    }
  }

  return { normalized, changes };
}

/**
 * Unicode normalization middleware
 * Normalizes all string inputs to NFC and applies security policies
 */
export const unicodeNormalize = (req: Request, res: Response, next: NextFunction) => {
  try {
    const identifierFields = IDENTIFIER_FIELDS();
    const allChanges: string[] = [];

    // Normalize request body
    if (req.body && typeof req.body === 'object') {
      const result = normalizeObject(req.body, identifierFields, 'body');
      req.body = result.normalized;
      allChanges.push(...result.changes);
    }

    // Normalize query parameters
    if (req.query && typeof req.query === 'object') {
      const normalized: any = {};
      for (const [key, value] of Object.entries(req.query)) {
        const isIdentifier = identifierFields.has(key.toLowerCase());
        if (typeof value === 'string') {
          const originalValue = value;
          const normalizedValue = normalizeValue(value, key, isIdentifier);
          if (normalizedValue !== originalValue) {
            allChanges.push(`query.${key}: normalized`);
          }
          normalized[key] = normalizedValue;
        } else if (Array.isArray(value)) {
          normalized[key] = value.map(v => 
            typeof v === 'string' ? normalizeValue(v, key, isIdentifier) : v
          );
        } else {
          normalized[key] = value;
        }
      }
      req.query = normalized;
    }

    // Normalize path parameters
    if (req.params && typeof req.params === 'object') {
      const normalized: any = {};
      for (const [key, value] of Object.entries(req.params)) {
        const isIdentifier = identifierFields.has(key.toLowerCase());
        if (typeof value === 'string') {
          const originalValue = value;
          const normalizedValue = normalizeValue(value, key, isIdentifier);
          if (normalizedValue !== originalValue) {
            allChanges.push(`params.${key}: normalized`);
          }
          normalized[key] = normalizedValue;
        } else {
          normalized[key] = value;
        }
      }
      req.params = normalized;
    }

    // Log normalization changes for monitoring
    if (allChanges.length > 0) {
      console.log(`[UNICODE] Normalized ${allChanges.length} fields: ${allChanges.join(', ')} from IP: ${req.ip}`);
    }

    // Check for empty identifiers after normalization
    const emptyIdentifiers = allChanges.filter(change => change.includes('empty after normalization'));
    if (emptyIdentifiers.length > 0) {
      console.warn(`[UNICODE] Rejected request with empty identifiers: ${emptyIdentifiers.join(', ')} from IP: ${req.ip}`);
      return res.status(400).json({
        error: 'Bad Request: Invalid characters in identifier fields',
        code: 'INVALID_IDENTIFIER_CHARACTERS',
        details: 'Identifier fields cannot contain only control or zero-width characters'
      });
    }

    next();
  } catch (error) {
    console.error('[UNICODE] Error in unicode normalization middleware:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      code: 'UNICODE_NORMALIZATION_ERROR'
    });
  }
};

/**
 * Utility function to normalize user data before database operations
 */
export function normalizeUser(user: any): any {
  if (!user || typeof user !== 'object') return user;

  const normalized = { ...user };
  
  if (normalized.email) {
    normalized.email = String(normalized.email).normalize('NFC').trim().toLowerCase();
  }
  
  if (normalized.username) {
    normalized.username = String(normalized.username).normalize('NFC').trim();
  }
  
  if (normalized.firstName) {
    normalized.firstName = String(normalized.firstName).normalize('NFC').trim();
  }
  
  if (normalized.lastName) {
    normalized.lastName = String(normalized.lastName).normalize('NFC').trim();
  }

  return normalized;
}

/**
 * Utility function to normalize scholarship data before database operations
 */
export function normalizeScholarship(scholarship: any): any {
  if (!scholarship || typeof scholarship !== 'object') return scholarship;

  const normalized = { ...scholarship };
  
  if (normalized.slug) {
    normalized.slug = String(normalized.slug).normalize('NFC').trim().toLowerCase();
  }
  
  if (normalized.title) {
    normalized.title = String(normalized.title).normalize('NFC').trim();
  }
  
  if (normalized.major) {
    normalized.major = String(normalized.major).normalize('NFC').trim().toLowerCase();
  }
  
  if (normalized.state) {
    normalized.state = String(normalized.state).normalize('NFC').trim().toLowerCase();
  }
  
  if (normalized.city) {
    normalized.city = String(normalized.city).normalize('NFC').trim().toLowerCase();
  }

  return normalized;
}

/**
 * Utility function to normalize landing page data before database operations
 */
export function normalizeLandingPage(page: any): any {
  if (!page || typeof page !== 'object') return page;

  const normalized = { ...page };
  
  if (normalized.slug) {
    normalized.slug = String(normalized.slug).normalize('NFC').trim().toLowerCase();
  }
  
  if (normalized.title) {
    normalized.title = String(normalized.title).normalize('NFC').trim();
  }

  return normalized;
}