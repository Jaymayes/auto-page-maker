/**
 * Crawlability Testing Service
 * Tests generated pages for search engine accessibility and indexability
 */

import { storage } from '../storage.js';
import type { LandingPage } from '@shared/schema';

export interface CrawlabilityTest {
  url: string;
  slug: string;
  status: 'pass' | 'fail' | 'warning';
  checks: {
    httpStatus: { status: 'pass' | 'fail'; code?: number; message: string };
    htmlStructure: { status: 'pass' | 'fail'; message: string };
    metaTags: { status: 'pass' | 'fail'; message: string; tags: string[] };
    headingStructure: { status: 'pass' | 'fail'; message: string };
    internalLinks: { status: 'pass' | 'fail' | 'warning'; message: string; count: number };
    robotsMeta: { status: 'pass' | 'fail' | 'warning'; message: string };
    canonicalTag: { status: 'pass' | 'fail' | 'warning'; message: string; canonical?: string };
    structuredData: { status: 'pass' | 'fail' | 'warning'; message: string };
    pageSpeed: { status: 'pass' | 'fail' | 'warning'; message: string; ttfb?: number };
  };
  seoScore: number;
  recommendations: string[];
  timestamp: number;
}

export interface CrawlabilityReport {
  totalPages: number;
  passedPages: number;
  failedPages: number;
  warningPages: number;
  averageSeoScore: number;
  tests: CrawlabilityTest[];
  summary: {
    commonIssues: string[];
    topRecommendations: string[];
  };
  generatedAt: number;
}

export class CrawlabilityTester {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:5000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Test crawlability for all landing pages
   */
  async testAllLandingPages(): Promise<CrawlabilityReport> {
    const landingPages = await storage.getLandingPages({ isPublished: true });
    const tests: CrawlabilityTest[] = [];

    console.log(`Testing crawlability for ${landingPages.length} landing pages...`);

    for (const page of landingPages) {
      try {
        const test = await this.testPage(page);
        tests.push(test);
        console.log(`✓ Tested ${page.slug}: ${test.seoScore}/100`);
      } catch (error) {
        console.error(`✗ Failed to test ${page.slug}:`, error);
        tests.push({
          url: `${this.baseUrl}/${page.slug}`,
          slug: page.slug,
          status: 'fail',
          checks: this.createFailedChecks('Test execution failed'),
          seoScore: 0,
          recommendations: ['Fix test execution errors'],
          timestamp: Date.now()
        });
      }
    }

    return this.generateReport(tests);
  }

  /**
   * Test crawlability for a specific landing page
   */
  async testPage(page: LandingPage): Promise<CrawlabilityTest> {
    const url = `${this.baseUrl}/${page.slug}`;
    const startTime = Date.now();

    // Fetch the page
    const response = await fetch(url);
    const html = await response.text();
    const ttfb = Date.now() - startTime;

    // Parse HTML for analysis
    const checks = {
      httpStatus: this.checkHttpStatus(response),
      htmlStructure: this.checkHtmlStructure(html),
      metaTags: this.checkMetaTags(html, page),
      headingStructure: this.checkHeadingStructure(html),
      internalLinks: this.checkInternalLinks(html),
      robotsMeta: this.checkRobotsMeta(html),
      canonicalTag: this.checkCanonicalTag(html, url),
      structuredData: this.checkStructuredData(html),
      pageSpeed: this.checkPageSpeed(ttfb)
    };

    // Calculate SEO score
    const seoScore = this.calculateSeoScore(checks);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(checks);

    // Determine overall status
    const failedChecks = Object.values(checks).filter(check => check.status === 'fail').length;
    const warningChecks = Object.values(checks).filter(check => check.status === 'warning').length;
    
    let status: 'pass' | 'fail' | 'warning';
    if (failedChecks > 0) {
      status = 'fail';
    } else if (warningChecks > 0) {
      status = 'warning';
    } else {
      status = 'pass';
    }

    return {
      url,
      slug: page.slug,
      status,
      checks,
      seoScore,
      recommendations,
      timestamp: Date.now()
    };
  }

  private checkHttpStatus(response: Response) {
    if (response.status === 200) {
      return { status: 'pass' as const, code: response.status, message: 'Page loads successfully' };
    } else {
      return { status: 'fail' as const, code: response.status, message: `HTTP ${response.status} error` };
    }
  }

  private checkHtmlStructure(html: string) {
    const hasDoctype = html.includes('<!DOCTYPE html>');
    const hasHtmlTag = /<html[^>]*>/i.test(html);
    const hasHeadTag = /<head[^>]*>/i.test(html);
    const hasBodyTag = /<body[^>]*>/i.test(html);

    if (hasDoctype && hasHtmlTag && hasHeadTag && hasBodyTag) {
      return { status: 'pass' as const, message: 'Valid HTML5 structure' };
    } else {
      return { status: 'fail' as const, message: 'Invalid HTML structure' };
    }
  }

  private checkMetaTags(html: string, page: LandingPage) {
    const foundTags: string[] = [];
    let message = '';

    // Check for title tag
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch && titleMatch[1].trim()) {
      foundTags.push('title');
    }

    // Check for meta description
    const descMatch = html.match(/<meta[^>]+name=['"]description['"][^>]+content=['"]([^'"]*)['"]/i);
    if (descMatch && descMatch[1].trim()) {
      foundTags.push('description');
    }

    // Check for viewport meta
    if (html.includes('name="viewport"')) {
      foundTags.push('viewport');
    }

    // Check for Open Graph tags
    if (html.includes('property="og:')) {
      foundTags.push('og-tags');
    }

    const requiredTags = ['title', 'description', 'viewport'];
    const missingTags = requiredTags.filter(tag => !foundTags.includes(tag));

    if (missingTags.length === 0) {
      return { status: 'pass' as const, message: 'All required meta tags present', tags: foundTags };
    } else {
      return { status: 'fail' as const, message: `Missing: ${missingTags.join(', ')}`, tags: foundTags };
    }
  }

  private checkHeadingStructure(html: string) {
    const h1Match = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
    const h2Matches = html.match(/<h2[^>]*>/gi) || [];
    
    if (h1Match && h1Match[1].trim()) {
      return { 
        status: 'pass' as const, 
        message: `Proper heading structure (H1: "${h1Match[1].trim()}", ${h2Matches.length} H2s)` 
      };
    } else {
      return { status: 'fail' as const, message: 'Missing or empty H1 tag' };
    }
  }

  private checkInternalLinks(html: string) {
    // Count internal links (href starting with / or containing the domain)
    const linkMatches = html.match(/href=['"][^'"]*['"]/gi) || [];
    const internalLinks = linkMatches.filter(link => 
      link.includes('href="/"') || 
      link.includes('href="/') ||
      link.includes('href="http://localhost:5000') ||
      link.includes('href="https://') && link.includes('.replit.')
    );

    if (internalLinks.length >= 3) {
      return { status: 'pass' as const, message: `Good internal linking (${internalLinks.length} links)`, count: internalLinks.length };
    } else {
      return { status: 'warning' as const, message: `Few internal links (${internalLinks.length})`, count: internalLinks.length };
    }
  }

  private checkRobotsMeta(html: string) {
    const robotsMatch = html.match(/<meta[^>]+name=['"]robots['"][^>]+content=['"]([^'"]*)['"]/i);
    
    if (!robotsMatch) {
      return { status: 'pass' as const, message: 'No robots meta tag (allows indexing)' };
    }
    
    const robotsContent = robotsMatch[1].toLowerCase();
    if (robotsContent.includes('noindex')) {
      return { status: 'warning' as const, message: 'Page set to noindex' };
    } else {
      return { status: 'pass' as const, message: 'Robots meta allows indexing' };
    }
  }

  private checkCanonicalTag(html: string, expectedUrl: string) {
    const canonicalMatch = html.match(/<link[^>]+rel=['"]canonical['"][^>]+href=['"]([^'"]*)['"]/i);
    
    if (canonicalMatch) {
      const canonical = canonicalMatch[1];
      return { 
        status: 'pass' as const, 
        message: 'Canonical tag present', 
        canonical 
      };
    } else {
      return { status: 'warning' as const, message: 'Missing canonical tag' };
    }
  }

  private checkStructuredData(html: string) {
    const hasJsonLd = html.includes('application/ld+json');
    const hasMicrodata = html.includes('itemscope') || html.includes('itemtype');
    
    if (hasJsonLd || hasMicrodata) {
      return { status: 'pass' as const, message: 'Structured data present' };
    } else {
      return { status: 'warning' as const, message: 'No structured data found' };
    }
  }

  private checkPageSpeed(ttfb: number) {
    if (ttfb < 500) {
      return { status: 'pass' as const, message: `Fast TTFB (${ttfb}ms)`, ttfb };
    } else if (ttfb < 1000) {
      return { status: 'warning' as const, message: `Moderate TTFB (${ttfb}ms)`, ttfb };
    } else {
      return { status: 'fail' as const, message: `Slow TTFB (${ttfb}ms)`, ttfb };
    }
  }

  private calculateSeoScore(checks: CrawlabilityTest['checks']): number {
    const weights = {
      httpStatus: 25,
      htmlStructure: 15,
      metaTags: 20,
      headingStructure: 15,
      internalLinks: 5,
      robotsMeta: 5,
      canonicalTag: 5,
      structuredData: 5,
      pageSpeed: 5
    };

    let score = 0;
    let totalWeight = 0;

    for (const [checkName, check] of Object.entries(checks)) {
      const weight = weights[checkName as keyof typeof weights] || 0;
      totalWeight += weight;
      
      if (check.status === 'pass') {
        score += weight;
      } else if (check.status === 'warning') {
        score += weight * 0.5;
      }
      // 'fail' adds 0 points
    }

    return Math.round((score / totalWeight) * 100);
  }

  private generateRecommendations(checks: CrawlabilityTest['checks']): string[] {
    const recommendations: string[] = [];

    if (checks.httpStatus.status === 'fail') {
      recommendations.push('Fix HTTP status code errors');
    }
    if (checks.metaTags.status === 'fail') {
      recommendations.push('Add missing meta tags (title, description)');
    }
    if (checks.headingStructure.status === 'fail') {
      recommendations.push('Add proper H1 heading');
    }
    if (checks.internalLinks.status === 'warning') {
      recommendations.push('Improve internal linking');
    }
    if (checks.canonicalTag.status === 'warning') {
      recommendations.push('Add canonical URL tag');
    }
    if (checks.structuredData.status === 'warning') {
      recommendations.push('Add structured data markup');
    }
    if (checks.pageSpeed.status !== 'pass') {
      recommendations.push('Optimize page load speed');
    }

    return recommendations;
  }

  private generateReport(tests: CrawlabilityTest[]): CrawlabilityReport {
    const passedPages = tests.filter(t => t.status === 'pass').length;
    const failedPages = tests.filter(t => t.status === 'fail').length;
    const warningPages = tests.filter(t => t.status === 'warning').length;
    
    const averageSeoScore = tests.reduce((sum, test) => sum + test.seoScore, 0) / tests.length;

    // Collect common issues
    const allRecommendations = tests.flatMap(t => t.recommendations);
    const recommendationCounts = allRecommendations.reduce((counts, rec) => {
      counts[rec] = (counts[rec] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const commonIssues = Object.entries(recommendationCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([issue, count]) => `${issue} (${count} pages)`);

    const topRecommendations = Object.keys(recommendationCounts)
      .slice(0, 3);

    return {
      totalPages: tests.length,
      passedPages,
      failedPages,
      warningPages,
      averageSeoScore: Math.round(averageSeoScore),
      tests,
      summary: {
        commonIssues,
        topRecommendations
      },
      generatedAt: Date.now()
    };
  }

  private createFailedChecks(reason: string): CrawlabilityTest['checks'] {
    const failedCheck = { status: 'fail' as const, message: reason };
    return {
      httpStatus: { ...failedCheck, code: 0 },
      htmlStructure: failedCheck,
      metaTags: { ...failedCheck, tags: [] },
      headingStructure: failedCheck,
      internalLinks: { ...failedCheck, count: 0 },
      robotsMeta: failedCheck,
      canonicalTag: failedCheck,
      structuredData: failedCheck,
      pageSpeed: { ...failedCheck, ttfb: 0 }
    };
  }
}