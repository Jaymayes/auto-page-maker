import crypto from 'crypto';
import type { InsertLandingPage } from '@shared/schema';

export interface PageSpec {
  slug: string;
  title: string;
  metaDescription: string;
  template: string;
  templateData: any;
  content: any;
}

export function calculateSpecHash(spec: PageSpec): string {
  // Create canonical representation with full content values
  // Sort keys to ensure deterministic ordering
  const canonical = JSON.stringify({
    slug: spec.slug,
    title: spec.title,
    metaDescription: spec.metaDescription,
    template: spec.template,
    templateData: sortObjectKeys(spec.templateData),
    content: sortObjectKeys(spec.content)
  });
  
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function sortObjectKeys(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  
  return Object.keys(obj)
    .sort()
    .reduce((sorted: any, key) => {
      sorted[key] = sortObjectKeys(obj[key]);
      return sorted;
    }, {});
}

export function generateCanonicalUrl(slug: string, baseUrl?: string): string {
  const base = baseUrl || process.env.APP_BASE_URL || process.env.BASE_URL || process.env.PUBLIC_ORIGIN || 'https://www.scholaraiadvisor.com';
  return `${base}/${slug}`;
}

export function generateEATSignals(template: string, scholarshipCount: number): object {
  const expertise = scholarshipCount > 100 ? 'high' : scholarshipCount > 20 ? 'medium' : 'low';
  
  const authority = {
    level: 'platform',
    source: 'ScholarMatch',
    verified: true
  };
  
  const trustworthiness = {
    dataFreshness: 'daily',
    sourceQuality: 'verified',
    updatedRegularly: true
  };
  
  return {
    expertise: { level: expertise, scholarshipCount },
    authority,
    trustworthiness
  };
}

export function enhanceWithStructuredData(
  page: Partial<InsertLandingPage>,
  scholarships: any[]
): string {
  const canonicalUrl = page.canonicalUrl || generateCanonicalUrl(page.slug!);
  
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": page.title,
    "description": page.metaDescription,
    "url": canonicalUrl,
    "about": {
      "@type": "EducationalOccupationalProgram",
      "name": "Scholarship Opportunities"
    },
    "provider": {
      "@type": "Organization",
      "name": "Scholar AI Advisor",
      "url": process.env.APP_BASE_URL || process.env.BASE_URL || "https://www.scholaraiadvisor.com"
    },
    "hasPart": scholarships.slice(0, 10).map(s => ({
      "@type": "FinancialProduct",
      "name": s.title,
      "description": s.description,
      "amount": {
        "@type": "MonetaryAmount",
        "currency": "USD",
        "value": s.amount
      },
      "validThrough": s.deadline
    })),
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": generateBreadcrumbs(page.slug!)
    }
  };
  
  return JSON.stringify(structuredData, null, 2);
}

function generateBreadcrumbs(slug: string): any[] {
  const parts = slug.split('/').filter(Boolean);
  const baseUrl = process.env.APP_BASE_URL || process.env.BASE_URL || "https://www.scholaraiadvisor.com";
  const crumbs = [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": baseUrl
    }
  ];
  
  let path = '';
  parts.forEach((part, index) => {
    path += `/${part}`;
    crumbs.push({
      "@type": "ListItem",
      "position": index + 2,
      "name": formatTitle(part),
      "item": `${baseUrl}${path}`
    });
  });
  
  return crumbs;
}

function formatTitle(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
