import { storage } from '../storage';

/**
 * Route validation service for SPA fallback control
 * Determines if a route should serve the SPA or return 404 for SEO protection
 */
export class RouteValidator {
  private static validStaticRoutes = new Set([
    '/',
    '/get-started',
    '/get-matches',
    '/pricing',
    '/register',
    '/privacy',
    '/terms',
    '/scholarships',
    '/admin/audit-logs'
  ]);

  /**
   * Check if a path is a valid route that should serve the SPA
   */
  static async isValidRoute(path: string): Promise<boolean> {
    // Remove trailing slash for consistency
    const normalizedPath = path === '/' ? '/' : path.replace(/\/$/, '');
    
    // Check static routes
    if (this.validStaticRoutes.has(normalizedPath)) {
      return true;
    }
    
    // Skip API routes, static assets, and system paths
    if (this.isSystemPath(normalizedPath)) {
      return false;
    }
    
    // Check if it's a landing page slug (remove leading slash)
    const slug = normalizedPath.slice(1);
    if (slug && !slug.includes('/')) {
      try {
        const landingPages = await storage.getLandingPages({ isPublished: true });
        const page = landingPages.find(page => page.slug === slug);
        
        if (page) {
          // Check if landing page contains expired scholarships
          const { ExpiryManager } = await import('../services/expiry-manager.js');
          const expiryManager = new ExpiryManager();
          const staleReport = await expiryManager.generateStaleUrlReport();
          
          // If this page is in the stale URLs list, it should return 404/410
          const isStale = staleReport.staleUrls.includes(`/${slug}`);
          return !isStale; // Return false if stale (should get 404)
        }
        
        return false; // Page not found
      } catch (error) {
        // If database error, err on the side of serving 404
        console.error('Error checking landing page slug:', error);
        return false;
      }
    }
    
    // Check scholarship detail routes /scholarship/:id
    if (this.isScholarshipDetailRoute(normalizedPath)) {
      return true;
    }
    
    // Check legacy scholarship category routes
    if (this.isScholarshipCategoryRoute(normalizedPath)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if path is a system path that should not serve SPA
   */
  private static isSystemPath(path: string): boolean {
    return (
      path.startsWith('/api/') ||
      path.startsWith('/agent/') ||
      path.startsWith('/_') ||
      path === '/healthz' || // Production readiness endpoint
      path.includes('.') || // Static assets typically have extensions
      path === '/favicon.ico' ||
      path === '/robots.txt' ||
      path === '/sitemap.xml'
    );
  }
  
  /**
   * Check if path matches scholarship detail route /scholarship/:id
   */
  private static isScholarshipDetailRoute(path: string): boolean {
    // Match /scholarship/{uuid} pattern
    const scholarshipDetailPattern = /^\/scholarship\/[a-f0-9-]{36}$/i;
    return scholarshipDetailPattern.test(path);
  }
  
  /**
   * Check if path matches legacy scholarship category routes
   */
  private static isScholarshipCategoryRoute(path: string): boolean {
    // Match /scholarships/{category} or /scholarships/{category}/{location} pattern
    const scholarshipPattern = /^\/scholarships\/[^\/]+(\/[^\/]+)?$/;
    return scholarshipPattern.test(path);
  }
}

/**
 * SEO-friendly 404/410 response with expiry handling and content negotiation
 */
export async function sendSeoFriendlyExpiredResponse(res: any, path: string): Promise<void> {
  // Check if client wants JSON response
  const wantsJson = res.req?.headers?.accept?.includes('application/json');
  
  if (wantsJson) {
    return res.status(404)
      .set({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow'
      })
      .json({
        error: 'Not Found',
        status: 404,
        path: path
      });
  }
  
  try {
    // Check if this is an expired scholarship or landing page
    const { ExpiryManager } = await import('../services/expiry-manager.js');
    const expiryManager = new ExpiryManager();
    
    // For landing page slugs, check expiry status
    const slug = path.slice(1); // Remove leading slash
    if (slug) {
      const landingPages = await storage.getLandingPages();
      const page = landingPages.find(p => p.slug === slug);
      
      if (page) {
        // Check if page references expired scholarships
        const staleReport = await expiryManager.generateStaleUrlReport();
        const isStale = staleReport.staleUrls.includes(path);
        
        if (isStale) {
          // Generate appropriate 404/410 response based on content age
          const createdDate = new Date(page.createdAt);
          const daysSinceCreated = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
          
          const expiryStatus = {
            isExpired: true,
            statusCode: daysSinceCreated > 30 ? 410 : 404, // 410 after 30 days
            reason: 'deadline_passed' as const,
            expiryDate: createdDate
          };
          
          const response = expiryManager.generateExpiryResponse(expiryStatus, path);
          
          return res.status(response.statusCode)
            .set(response.headers)
            .send(response.body);
        }
      }
    }
  } catch (error) {
    console.error('Error in expiry response handling:', error);
  }
  
  // Fallback to regular 404
  sendSeoFriendly404(res, path);
}

/**
 * SEO-friendly 404 response
 */
export function sendSeoFriendly404(res: any, path: string): void {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Page Not Found - ScholarMatch</title>
  <meta name="description" content="The requested page could not be found.">
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      margin: 0; 
      padding: 40px 20px; 
      background: #f8fafc; 
      color: #334155;
      line-height: 1.6;
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      text-align: center; 
    }
    h1 { 
      font-size: 2rem; 
      margin-bottom: 1rem; 
      color: #1e293b; 
    }
    p { 
      font-size: 1.1rem; 
      margin-bottom: 2rem; 
      color: #64748b; 
    }
    .home-link { 
      display: inline-block; 
      padding: 12px 24px; 
      background: #3b82f6; 
      color: white; 
      text-decoration: none; 
      border-radius: 8px; 
      font-weight: 500; 
    }
    .home-link:hover { 
      background: #2563eb; 
    }
    .error-code {
      font-size: 0.9rem;
      color: #9ca3af;
      margin-top: 2rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Page Not Found</h1>
    <p>The page you're looking for doesn't exist or has been moved.</p>
    <a href="/" class="home-link">Return to Homepage</a>
    <div class="error-code">Error 404 - Path: ${path}</div>
  </div>
</body>
</html>`;

  res.status(404)
    .set({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    })
    .send(html);
}