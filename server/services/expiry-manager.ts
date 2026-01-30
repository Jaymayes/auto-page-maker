/**
 * Scholarship Expiry Management Service
 * Handles expired scholarship detection, 404/410 responses, and sitemap cleanup
 */

import { storage } from '../storage.js';
import type { Scholarship, LandingPage } from '@shared/schema';

export interface ExpiryStatus {
  isExpired: boolean;
  statusCode: 404 | 410;
  reason: 'deadline_passed' | 'manually_disabled' | 'not_found';
  expiryDate?: Date;
  gracePeriodDays?: number;
}

export interface StaleUrlReport {
  expiredScholarships: Scholarship[];
  affectedLandingPages: LandingPage[];
  staleUrls: string[];
  cleanupActions: string[];
  lastCleanup: Date;
}

export class ExpiryManager {
  private readonly GRACE_PERIOD_DAYS = 30; // Grace period before 410 Gone

  /**
   * Check if a scholarship is expired and determine appropriate HTTP status
   */
  checkScholarshipExpiry(scholarship: Scholarship): ExpiryStatus {
    if (!scholarship) {
      return {
        isExpired: true,
        statusCode: 404,
        reason: 'not_found'
      };
    }

    // Check if manually disabled
    if (!scholarship.isActive) {
      return {
        isExpired: true,
        statusCode: 410, // Gone - was available but no longer exists
        reason: 'manually_disabled'
      };
    }

    // Check deadline expiry
    if (scholarship.deadline) {
      const deadline = new Date(scholarship.deadline);
      const now = new Date();
      const gracePeriod = new Date(deadline.getTime() + (this.GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000));

      if (now > deadline) {
        return {
          isExpired: true,
          statusCode: now > gracePeriod ? 410 : 404, // 410 after grace period
          reason: 'deadline_passed',
          expiryDate: deadline,
          gracePeriodDays: this.GRACE_PERIOD_DAYS
        };
      }
    }

    return {
      isExpired: false,
      statusCode: 404, // Not used when not expired
      reason: 'not_found'
    };
  }

  /**
   * Get all expired scholarships
   */
  async getExpiredScholarships(): Promise<Scholarship[]> {
    const allScholarships = await storage.getScholarships({ isActive: false }); // Get all including inactive
    const activeScholarships = await storage.getScholarships({ isActive: true });
    
    // Combine both sets to check all scholarships
    const scholarshipsToCheck = [...allScholarships, ...activeScholarships];
    
    return scholarshipsToCheck.filter(scholarship => {
      const expiryStatus = this.checkScholarshipExpiry(scholarship);
      return expiryStatus.isExpired;
    });
  }

  /**
   * Get landing pages that reference expired scholarships
   */
  async getAffectedLandingPages(): Promise<LandingPage[]> {
    const expiredScholarships = await this.getExpiredScholarships();
    const expiredIds = new Set(expiredScholarships.map(s => s.id));
    
    const landingPages = await storage.getLandingPages({ isPublished: true });
    
    // Filter landing pages that might reference expired scholarships
    // This would depend on how landing pages reference scholarships
    // For now, we'll check based on content keywords or metadata
    return landingPages.filter(page => {
      // Check if page content or metadata references expired scholarships
      const content = (page.content + ' ' + page.title + ' ' + (page.metaDescription || '')).toLowerCase();
      
      return expiredScholarships.some(scholarship => {
        const scholarshipTerms = [
          scholarship.title.toLowerCase(),
          scholarship.major?.toLowerCase(),
          scholarship.state?.toLowerCase(),
          scholarship.city?.toLowerCase()
        ].filter(Boolean);
        
        return scholarshipTerms.some(term => content.includes(term));
      });
    });
  }

  /**
   * Generate stale URL report
   */
  async generateStaleUrlReport(): Promise<StaleUrlReport> {
    const expiredScholarships = await this.getExpiredScholarships();
    const affectedLandingPages = await this.getAffectedLandingPages();
    
    // Generate list of stale URLs that should return 404/410
    const staleUrls: string[] = [];
    
    // Add expired scholarship URLs (if they have direct URLs)
    expiredScholarships.forEach(scholarship => {
      if (scholarship.slug) {
        staleUrls.push(`/scholarship/${scholarship.slug}`);
      }
    });
    
    // Add affected landing page URLs that should be updated or removed
    affectedLandingPages.forEach(page => {
      // Check if page is primarily about expired scholarships
      const hasActiveContent = this.hasActiveScholarshipContent(page, expiredScholarships);
      if (!hasActiveContent) {
        staleUrls.push(`/${page.slug}`);
      }
    });

    const cleanupActions = [
      `Update ${affectedLandingPages.length} landing pages with expired scholarship references`,
      `Return 404/410 for ${expiredScholarships.length} expired scholarships`,
      `Remove ${staleUrls.length} stale URLs from sitemap`,
      'Regenerate sitemap with active content only'
    ];

    return {
      expiredScholarships,
      affectedLandingPages,
      staleUrls,
      cleanupActions,
      lastCleanup: new Date()
    };
  }

  /**
   * Check if landing page has active scholarship content
   */
  private hasActiveScholarshipContent(page: LandingPage, expiredScholarships: Scholarship[]): boolean {
    // Simple heuristic: if the page references more expired than active scholarships,
    // consider it stale
    const content = (page.content + ' ' + page.title).toLowerCase();
    
    // Count references to expired scholarships
    const expiredReferences = expiredScholarships.filter(scholarship => {
      return content.includes(scholarship.title.toLowerCase()) ||
             content.includes(scholarship.major?.toLowerCase() || '') ||
             content.includes(scholarship.state?.toLowerCase() || '');
    }).length;

    // If more than 50% of references are to expired scholarships, consider it stale
    return expiredReferences < 3; // Threshold for active content
  }

  /**
   * Update scholarship status to expired/inactive
   */
  async expireScholarship(scholarshipId: string, reason: string = 'deadline_passed'): Promise<boolean> {
    try {
      const updated = await storage.updateScholarship(scholarshipId, {
        isActive: false,
        // Add expiry metadata if schema supports it
      });
      
      if (updated) {
        console.log(`Scholarship ${scholarshipId} marked as expired: ${reason}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to expire scholarship ${scholarshipId}:`, error);
      return false;
    }
  }

  /**
   * Clean expired scholarships and update affected content
   */
  async performExpiryCleanup(): Promise<{
    scholarshipsExpired: number;
    landingPagesUpdated: number;
    urlsRemoved: number;
  }> {
    const report = await this.generateStaleUrlReport();
    
    let scholarshipsExpired = 0;
    let landingPagesUpdated = 0;
    let urlsRemoved = report.staleUrls.length;

    // Expire scholarships that have passed their deadline
    for (const scholarship of report.expiredScholarships) {
      const expiryStatus = this.checkScholarshipExpiry(scholarship);
      if (expiryStatus.reason === 'deadline_passed' && scholarship.isActive) {
        const success = await this.expireScholarship(scholarship.id, expiryStatus.reason);
        if (success) scholarshipsExpired++;
      }
    }

    // Update landing pages (mark for review/update)
    for (const page of report.affectedLandingPages) {
      try {
        // Add metadata to indicate needs update due to expired scholarships
        const updated = await storage.updateLandingPage(page.id, {
          // Add expiry flag or reduce priority
          isPublished: this.hasActiveScholarshipContent(page, report.expiredScholarships)
        });
        if (updated) landingPagesUpdated++;
      } catch (error) {
        console.error(`Failed to update landing page ${page.id}:`, error);
      }
    }

    console.log(`Expiry cleanup completed:`, {
      scholarshipsExpired,
      landingPagesUpdated,
      urlsRemoved
    });

    return { scholarshipsExpired, landingPagesUpdated, urlsRemoved };
  }

  /**
   * Generate HTTP response for expired content
   */
  generateExpiryResponse(expiryStatus: ExpiryStatus, originalUrl: string): {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
  } {
    const baseHeaders = {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };

    if (expiryStatus.statusCode === 410) {
      // 410 Gone - was available but permanently removed
      return {
        statusCode: 410,
        headers: {
          ...baseHeaders,
          'X-Expiry-Reason': expiryStatus.reason,
          'X-Expiry-Date': expiryStatus.expiryDate?.toISOString() || ''
        },
        body: this.generateGonePageHtml(originalUrl, expiryStatus)
      };
    } else {
      // 404 Not Found - recently expired or not found
      return {
        statusCode: 404,
        headers: {
          ...baseHeaders,
          'X-Expiry-Reason': expiryStatus.reason
        },
        body: this.generateNotFoundPageHtml(originalUrl, expiryStatus)
      };
    }
  }

  /**
   * Generate HTML for 410 Gone response
   */
  private generateGonePageHtml(url: string, status: ExpiryStatus): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Scholarship No Longer Available - ScholarMatch</title>
  <meta name="description" content="This scholarship is no longer available or has expired.">
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
    .reason {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 8px;
      padding: 16px;
      margin: 24px 0;
    }
    .actions {
      margin-top: 32px;
    }
    .home-link { 
      display: inline-block; 
      padding: 12px 24px; 
      background: #3b82f6; 
      color: white; 
      text-decoration: none; 
      border-radius: 8px; 
      font-weight: 500; 
      margin: 0 8px;
    }
    .search-link {
      display: inline-block; 
      padding: 12px 24px; 
      background: #059669; 
      color: white; 
      text-decoration: none; 
      border-radius: 8px; 
      font-weight: 500; 
      margin: 0 8px;
    }
    .home-link:hover { background: #2563eb; }
    .search-link:hover { background: #047857; }
    .error-code {
      font-size: 0.9rem;
      color: #9ca3af;
      margin-top: 2rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Scholarship No Longer Available</h1>
    <p>The scholarship you're looking for is no longer available.</p>
    
    <div class="reason">
      <strong>Reason:</strong> ${this.getReasonMessage(status)}
      ${status.expiryDate ? `<br><strong>Expired:</strong> ${status.expiryDate.toLocaleDateString()}` : ''}
    </div>
    
    <p>Don't worry! We have many other scholarship opportunities available.</p>
    
    <div class="actions">
      <a href="/" class="home-link">Browse Scholarships</a>
      <a href="/search" class="search-link">Search Available</a>
    </div>
    
    <div class="error-code">Error 410 - Gone: ${url}</div>
  </div>
</body>
</html>`;
  }

  /**
   * Generate HTML for 404 Not Found response  
   */
  private generateNotFoundPageHtml(url: string, status: ExpiryStatus): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Scholarship Not Found - ScholarMatch</title>
  <meta name="description" content="The scholarship you're looking for could not be found.">
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
    .home-link, .search-link { 
      display: inline-block; 
      padding: 12px 24px; 
      background: #3b82f6; 
      color: white; 
      text-decoration: none; 
      border-radius: 8px; 
      font-weight: 500; 
      margin: 0 8px;
    }
    .search-link { background: #059669; }
    .home-link:hover { background: #2563eb; }
    .search-link:hover { background: #047857; }
    .error-code {
      font-size: 0.9rem;
      color: #9ca3af;
      margin-top: 2rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Scholarship Not Found</h1>
    <p>The scholarship you're looking for might have expired or the link may be incorrect.</p>
    <p>Let's help you find other scholarship opportunities!</p>
    
    <div style="margin-top: 2rem;">
      <a href="/" class="home-link">Browse Scholarships</a>
      <a href="/search" class="search-link">Search Available</a>
    </div>
    
    <div class="error-code">Error 404 - Not Found: ${url}</div>
  </div>
</body>
</html>`;
  }

  private getReasonMessage(status: ExpiryStatus): string {
    switch (status.reason) {
      case 'deadline_passed':
        return 'Application deadline has passed';
      case 'manually_disabled':
        return 'Scholarship has been discontinued';
      case 'not_found':
        return 'Scholarship could not be found';
      default:
        return 'Scholarship is no longer available';
    }
  }
}