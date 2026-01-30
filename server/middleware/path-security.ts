import { Request, Response, NextFunction } from 'express';
import path from 'path';

// Comprehensive list of directory traversal patterns
const TRAVERSAL_PATTERNS = [
  // Basic patterns
  /\.\.\//g,           // ../
  /\.\.\\/g,           // ..\
  /\.\.%2f/gi,         // ..%2f (encoded forward slash)
  /\.\.%5c/gi,         // ..%5c (encoded backslash)
  
  // URL encoded patterns
  /%2e%2e%2f/gi,       // %2e%2e%2f (fully encoded ../)
  /%2e%2e%5c/gi,       // %2e%2e%5c (fully encoded ..\)
  /%2e%2e\//gi,        // %2e%2e/ (partially encoded)
  /%2e%2e\\/gi,        // %2e%2e\ (partially encoded)
  
  // Double encoding
  /%252e%252e%252f/gi, // %252e%252e%252f (double encoded)
  
  // Alternative encodings
  /\u002e\u002e\u002f/g, // Unicode encoded ../
  /\.\u002e\u002f/g,     // Mixed encoding
];

// File extensions that should never be served
const BLOCKED_EXTENSIONS = [
  '.env', '.config', '.key', '.pem', '.p12', '.pfx',
  '.db', '.sqlite', '.log', '.pid', '.lock'
];

// Paths that should never be accessible
const BLOCKED_PATHS = [
  '/etc/', '/proc/', '/sys/', '/dev/', '/root/',
  '/home/', '/usr/', '/var/', '/tmp/', '/opt/',
  '/.env', '/.git/', '/node_modules/', '/server/',
  '/config/', '/logs/', '/backup/'
];

/**
 * Middleware to prevent directory traversal attacks
 * Checks for various encoding patterns and blocks malicious path attempts
 */
export const preventPathTraversal = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get the raw path and decode it safely
    const rawPath = req.path;
    let decodedPath: string;
    
    // Skip security checks for legitimate API paths and static resources
    if (rawPath.startsWith('/api/') || 
        rawPath.startsWith('/@') ||  // Vite development resources
        rawPath.startsWith('/src/') || 
        rawPath === '/healthz' ||
        rawPath === '/' ||
        rawPath.match(/\.(js|css|ico|png|jpg|svg|json|map)$/)) {
      return next();
    }
    
    try {
      decodedPath = decodeURIComponent(rawPath);
    } catch (error) {
      // Invalid URL encoding
      return res.status(400).json({ 
        error: 'Bad Request: Invalid URL encoding',
        code: 'INVALID_ENCODING'
      });
    }
    
    // Check for traversal patterns in both raw and decoded paths
    const pathsToCheck = [rawPath, decodedPath];
    
    for (const pathToCheck of pathsToCheck) {
      // Check against known traversal patterns
      if (TRAVERSAL_PATTERNS.some(pattern => pattern.test(pathToCheck))) {
        console.warn(`[SECURITY] Path traversal attempt detected: ${pathToCheck} from IP: ${req.ip}`);
        return res.status(403).json({ 
          error: 'Forbidden: Path traversal detected',
          code: 'PATH_TRAVERSAL_BLOCKED'
        });
      }
      
      // Check for blocked file extensions
      const extension = path.extname(pathToCheck).toLowerCase();
      if (BLOCKED_EXTENSIONS.includes(extension)) {
        console.warn(`[SECURITY] Blocked file extension access: ${pathToCheck} from IP: ${req.ip}`);
        return res.status(403).json({ 
          error: 'Forbidden: File type not allowed',
          code: 'BLOCKED_FILE_TYPE'
        });
      }
      
      // Check for blocked system paths
      if (BLOCKED_PATHS.some(blockedPath => pathToCheck.toLowerCase().startsWith(blockedPath))) {
        console.warn(`[SECURITY] System path access attempt: ${pathToCheck} from IP: ${req.ip}`);
        return res.status(403).json({ 
          error: 'Forbidden: System path access denied',
          code: 'SYSTEM_PATH_BLOCKED'
        });
      }
    }
    
    // Normalize the path and check for remaining traversal attempts  
    const normalizedPath = path.normalize(decodedPath);
    
    // Block if normalized path contains .. (indicating successful traversal)
    if (normalizedPath.includes('..')) {
      console.warn(`[SECURITY] Normalized path traversal: ${normalizedPath} from IP: ${req.ip}`);
      return res.status(403).json({ 
        error: 'Forbidden: Invalid path structure',
        code: 'INVALID_PATH_STRUCTURE'
      });
    }
    
    // Block if the normalized path tries to go outside the root directory
    if (normalizedPath.startsWith('../') || normalizedPath === '..') {
      console.warn(`[SECURITY] Path attempts to escape root: ${normalizedPath} from IP: ${req.ip}`);
      return res.status(403).json({ 
        error: 'Forbidden: Path escape attempt',
        code: 'PATH_ESCAPE_ATTEMPT'
      });
    }
    
    // Check for null byte injection
    if (decodedPath.includes('\0') || rawPath.includes('%00')) {
      console.warn(`[SECURITY] Null byte injection attempt: ${decodedPath} from IP: ${req.ip}`);
      return res.status(403).json({ 
        error: 'Forbidden: Null byte injection detected',
        code: 'NULL_BYTE_INJECTION'
      });
    }
    
    // Path is safe, continue to next middleware
    next();
    
  } catch (error) {
    console.error('[SECURITY] Error in path security middleware:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error',
      code: 'SECURITY_MIDDLEWARE_ERROR'
    });
  }
};

/**
 * Utility function to validate file paths for static serving
 * @param filePath - The file path to validate
 * @param allowedRoot - The root directory that files must be within
 * @returns boolean indicating if path is safe
 */
export const isPathSafe = (filePath: string, allowedRoot: string): boolean => {
  try {
    const absoluteRoot = path.resolve(allowedRoot);
    const absolutePath = path.resolve(absoluteRoot, filePath);
    
    // Ensure the resolved path is within the allowed root
    return absolutePath.startsWith(absoluteRoot + path.sep) || absolutePath === absoluteRoot;
  } catch (error) {
    return false;
  }
};

/**
 * Express static middleware wrapper with enhanced security
 * @param root - Root directory for static files
 * @param options - Express static options
 */
export const secureStatic = (root: string, options: any = {}) => {
  const secureOptions = {
    ...options,
    dotfiles: 'deny',     // Never serve dotfiles
    index: false,         // Disable directory indexing
    redirect: false,      // Disable redirects
    setHeaders: (res: Response, filePath: string) => {
      // Add security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      
      // Call original setHeaders if provided
      if (options.setHeaders) {
        options.setHeaders(res, filePath);
      }
    }
  };
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Additional path validation for static files
    if (!isPathSafe(req.path, root)) {
      return res.status(403).json({ 
        error: 'Forbidden: Path outside allowed directory',
        code: 'PATH_OUTSIDE_ROOT'
      });
    }
    
    // Continue with Express static middleware
    next();
  };
};