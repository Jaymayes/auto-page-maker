import type { LandingPage } from "@shared/schema";

interface SitemapEntry {
  url: string;
  lastmod: string;
  changefreq: string;
  priority: string;
}

interface SitemapResult {
  type: 'single' | 'index';
  content: string;
  chunks?: Map<string, string>;
  totalUrls: number;
}

const MAX_URLS_PER_SITEMAP = 10000;
const MAX_SITEMAPS_PER_INDEX = 50;

export class SitemapGenerator {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    const isStaging = process.env.STAGING === 'true';
    const productionUrl = process.env.VITE_PRODUCTION_URL || 'https://auto-page-maker.replit.app';
    
    if (isStaging) {
      this.baseUrl = productionUrl;
      console.log('[Sitemap] STAGING MODE: Using production URL for all sitemap entries:', productionUrl);
    } else {
      this.baseUrl = baseUrl || process.env.APP_BASE_URL || process.env.BASE_URL || process.env.PUBLIC_ORIGIN || 'https://www.scholaraiadvisor.com';
    }
  }

  async generateSitemap(landingPages?: LandingPage[]): Promise<string> {
    const result = await this.generateSitemapWithChunking(landingPages);
    return result.content;
  }

  async generateSitemapWithChunking(landingPages?: LandingPage[]): Promise<SitemapResult> {
    const entries = await this.collectAllEntries(landingPages);
    
    console.log(`Sitemap: Total URLs collected: ${entries.length}`);
    
    if (entries.length <= MAX_URLS_PER_SITEMAP) {
      return {
        type: 'single',
        content: this.formatXmlSitemap(entries),
        totalUrls: entries.length
      };
    }
    
    const chunks = this.splitIntoChunks(entries);
    const chunkMap = new Map<string, string>();
    
    chunks.forEach((chunkEntries, index) => {
      const filename = `sitemap-${index + 1}.xml`;
      chunkMap.set(filename, this.formatXmlSitemap(chunkEntries));
    });
    
    const indexContent = this.generateSitemapIndex(chunks.length);
    
    console.log(`Sitemap: Generated index with ${chunks.length} chunks (${entries.length} total URLs)`);
    
    return {
      type: 'index',
      content: indexContent,
      chunks: chunkMap,
      totalUrls: entries.length
    };
  }

  private async collectAllEntries(landingPages?: LandingPage[]): Promise<SitemapEntry[]> {
    const today = new Date().toISOString().split('T')[0];
    const entries: SitemapEntry[] = [
      {
        url: this.baseUrl,
        lastmod: today,
        changefreq: "daily",
        priority: "1.0"
      },
      {
        url: `${this.baseUrl}/browse`,
        lastmod: today,
        changefreq: "weekly",
        priority: "0.9"
      },
      {
        url: `${this.baseUrl}/browse/states`,
        lastmod: today,
        changefreq: "weekly",
        priority: "0.9"
      },
      {
        url: `${this.baseUrl}/browse/majors`,
        lastmod: today,
        changefreq: "weekly",
        priority: "0.9"
      },
      {
        url: `${this.baseUrl}/pricing`,
        lastmod: today,
        changefreq: "monthly",
        priority: "0.7"
      }
    ];

    const { storage } = await import('../storage.js');

    if (!landingPages) {
      landingPages = await storage.getLandingPages({ isPublished: true });
    }

    try {
      const { ExpiryManager } = await import('./expiry-manager.js');
      const expiryManager = new ExpiryManager();
      const staleReport = await expiryManager.generateStaleUrlReport();
      
      const staleSlugs = new Set(
        staleReport.staleUrls
          .filter(url => url.startsWith('/'))
          .map(url => url.slice(1))
      );
      
      console.log(`Sitemap: Excluding ${staleSlugs.size} stale URLs from sitemap`);
      
      landingPages
        .filter(page => page.isPublished && !staleSlugs.has(page.slug))
        .forEach(page => {
          entries.push({
            url: `${this.baseUrl}/${page.slug}`,
            lastmod: page.updatedAt ? new Date(page.updatedAt).toISOString().split('T')[0] : today,
            changefreq: "weekly",
            priority: "0.8"
          });
        });
        
      console.log(`Sitemap: Generated with ${entries.length - 5} landing pages (${landingPages.length} total, ${staleSlugs.size} excluded)`);
    } catch (error) {
      console.error('Error filtering stale URLs from sitemap:', error);
      
      landingPages
        .filter(page => page.isPublished)
        .forEach(page => {
          entries.push({
            url: `${this.baseUrl}/${page.slug}`,
            lastmod: page.updatedAt ? new Date(page.updatedAt).toISOString().split('T')[0] : today,
            changefreq: "weekly",
            priority: "0.8"
          });
        });
    }

    try {
      const scholarships = await storage.getScholarships({
        isActive: true,
        limit: MAX_URLS_PER_SITEMAP * MAX_SITEMAPS_PER_INDEX
      });
      
      console.log(`Sitemap: Adding ${scholarships.length} scholarship detail pages`);
      
      scholarships.forEach(scholarship => {
        entries.push({
          url: `${this.baseUrl}/scholarship/${scholarship.id}`,
          lastmod: scholarship.updatedAt ? new Date(scholarship.updatedAt).toISOString().split('T')[0] : today,
          changefreq: "monthly",
          priority: "0.9"
        });
      });
    } catch (error) {
      console.error('Error adding scholarship detail pages to sitemap:', error);
    }

    const maxTotalUrls = MAX_URLS_PER_SITEMAP * MAX_SITEMAPS_PER_INDEX;
    if (entries.length > maxTotalUrls) {
      console.warn(`Sitemap: Truncating from ${entries.length} to ${maxTotalUrls} URLs (max sitemap index limit)`);
      return entries.slice(0, maxTotalUrls);
    }

    return entries;
  }

  private splitIntoChunks(entries: SitemapEntry[]): SitemapEntry[][] {
    const chunks: SitemapEntry[][] = [];
    
    for (let i = 0; i < entries.length; i += MAX_URLS_PER_SITEMAP) {
      chunks.push(entries.slice(i, i + MAX_URLS_PER_SITEMAP));
    }
    
    return chunks;
  }

  generateSitemapIndex(chunkCount: number): string {
    const today = new Date().toISOString().split('T')[0];
    
    const sitemapElements = Array.from({ length: chunkCount }, (_, i) => `
  <sitemap>
    <loc>${this.baseUrl}/sitemap-${i + 1}.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapElements}
</sitemapindex>`;
  }

  getSitemapChunkFilename(index: number): string {
    return `sitemap-${index}.xml`;
  }

  private formatXmlSitemap(entries: SitemapEntry[]): string {
    const urlElements = entries.map(entry => `
  <url>
    <loc>${entry.url}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlElements}
</urlset>`;
  }

  generateRobotsTxt(): string {
    return `User-agent: *
Allow: /

Sitemap: ${this.baseUrl}/sitemap.xml`;
  }

  generateStructuredData(
    pageTitle: string,
    description: string,
    scholarships: any[],
    url: string
  ): string {
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": pageTitle,
      "description": description,
      "url": url,
      "provider": {
        "@type": "Organization",
        "name": "ScholarMatch",
        "url": this.baseUrl
      },
      "about": {
        "@type": "EducationalOrganization",
        "name": "Scholarship Opportunities"
      },
      "offers": scholarships.slice(0, 5).map(scholarship => ({
        "@type": "Offer",
        "name": scholarship.title,
        "description": scholarship.description,
        "price": scholarship.amount,
        "priceCurrency": "USD",
        "availability": "InStock",
        "validThrough": scholarship.deadline,
        "offeredBy": {
          "@type": "Organization",
          "name": scholarship.sourceOrganization || "Scholarship Provider"
        }
      }))
    };

    return JSON.stringify(structuredData, null, 2);
  }

  generateBreadcrumbStructuredData(breadcrumbs: Array<{ name: string; url: string }>): string {
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": breadcrumbs.map((crumb, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "name": crumb.name,
        "item": crumb.url
      }))
    };

    return JSON.stringify(structuredData, null, 2);
  }
}
