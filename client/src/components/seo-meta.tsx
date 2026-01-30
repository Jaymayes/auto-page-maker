import { Helmet } from "react-helmet-async";

interface ScholarshipStructuredData {
  name: string;
  description: string;
  category: string;
  amount?: number;
  deadline?: string;
  provider?: string;
  url: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

interface SEOMetaProps {
  title: string;
  description: string;
  canonicalUrl: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  keywords?: string[];
  scholarships?: ScholarshipStructuredData[];
  breadcrumbs?: Array<{
    name: string;
    url: string;
  }>;
  faqs?: FAQItem[];
  pageType?: 'website' | 'article' | 'profile';
}

/**
 * Comprehensive SEO metadata component with structured data
 */
export function SEOMeta({
  title,
  description,
  canonicalUrl,
  ogTitle,
  ogDescription,
  ogImage = "/images/og-default.jpg",
  keywords = [],
  scholarships = [],
  breadcrumbs = [],
  faqs = [],
  pageType = 'website'
}: SEOMetaProps) {
  // SEO: Truncate meta description to 160 chars (Google's recommended max)
  const truncatedDescription = description.length > 160 
    ? description.substring(0, 157) + '...'
    : description;
  
  // STAGING MODE: Override canonical URL to point to production (prevent index duplication)
  // In staging, canonical tags should reference production URLs to avoid accidental crawling/indexing
  const isStaging = import.meta.env.VITE_STAGING === 'true';
  const productionBaseUrl = import.meta.env.VITE_PRODUCTION_URL || 'https://auto-page-maker.replit.app';
  
  // If staging, replace staging origin with production origin in canonical URL
  let finalCanonicalUrl = canonicalUrl;
  if (isStaging) {
    const stagingUrl = new URL(canonicalUrl);
    const prodUrl = new URL(productionBaseUrl);
    finalCanonicalUrl = canonicalUrl.replace(stagingUrl.origin, prodUrl.origin);
  }
  
  // Extract site origin for Organization and WebSite schemas (must be homepage, not page URL)
  // In staging, Organization/WebSite should also point to production
  const siteOrigin = isStaging ? new URL(productionBaseUrl).origin : new URL(canonicalUrl).origin;
  
  const structuredData: {
    "@context": string;
    "@graph": Array<Record<string, unknown>>;
  } = {
    "@context": "https://schema.org",
    "@graph": [
      // Organization (must use site origin, not page URL)
      {
        "@type": "Organization",
        "@id": "#organization",
        "name": "ScholarMatch",
        "url": siteOrigin,
        "logo": {
          "@type": "ImageObject",
          "url": `${siteOrigin}/images/logo.png`
        },
        "description": "AI-powered scholarship discovery platform helping students find perfect funding matches."
      },
      // Website (must use site origin, not page URL)
      {
        "@type": "WebSite",
        "@id": "#website",
        "url": siteOrigin,
        "name": "ScholarMatch - Find Your Perfect Scholarship",
        "description": description,
        "publisher": {
          "@id": "#organization"
        },
        "potentialAction": {
          "@type": "SearchAction",
          "target": {
            "@type": "EntryPoint",
            "urlTemplate": `${siteOrigin}/scholarships?q={search_term_string}`
          },
          "query-input": "required name=search_term_string"
        }
      },
      // WebPage
      {
        "@type": "WebPage",
        "@id": finalCanonicalUrl,
        "url": finalCanonicalUrl,
        "name": title,
        "description": description,
        "isPartOf": {
          "@id": "#website"
        },
        "about": {
          "@id": "#organization"
        },
        "datePublished": new Date().toISOString(),
        "dateModified": new Date().toISOString()
      }
    ]
  };

  // Add breadcrumb structured data if provided
  if (breadcrumbs.length > 0) {
    structuredData["@graph"].push({
      "@type": "BreadcrumbList",
      "itemListElement": breadcrumbs.map((crumb, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "name": crumb.name,
        "item": crumb.url
      }))
    });
  }

  // Add scholarship structured data if provided (using Schema.org Scholarship/Grant type for rich snippets)
  if (scholarships.length > 0) {
    // For single scholarship (detail page), add as standalone Grant entity
    if (scholarships.length === 1) {
      const scholarship = scholarships[0];
      structuredData["@graph"].push({
        "@type": "EducationalOccupationalCredential",
        "@id": scholarship.url,
        "name": scholarship.name,
        "description": scholarship.description,
        "url": scholarship.url,
        "credentialCategory": "scholarship",
        ...(scholarship.category && {
          "educationalLevel": scholarship.category
        }),
        ...(scholarship.amount && {
          "offers": {
            "@type": "Offer",
            "price": scholarship.amount,
            "priceCurrency": "USD",
            "availability": "https://schema.org/InStock",
            "validThrough": scholarship.deadline || undefined
          }
        }),
        ...(scholarship.deadline && {
          "validFor": scholarship.deadline
        }),
        ...(scholarship.provider && {
          "recognizedBy": {
            "@type": "Organization",
            "name": scholarship.provider
          }
        }),
        "provider": {
          "@id": "#organization"
        }
      });
    } else {
      // For multiple scholarships (list page), use ItemList
      const scholarshipList = {
        "@type": "ItemList",
        "name": `${title} - Scholarship Opportunities`,
        "description": `List of ${scholarships.length} scholarship opportunities`,
        "numberOfItems": scholarships.length,
        "itemListElement": scholarships.map((scholarship, index) => ({
          "@type": "ListItem",
          "position": index + 1,
          "item": {
            "@type": "EducationalOccupationalCredential",
            "@id": scholarship.url,
            "name": scholarship.name,
            "description": scholarship.description,
            "credentialCategory": "scholarship",
            "url": scholarship.url,
            ...(scholarship.amount && {
              "offers": {
                "@type": "Offer",
                "price": scholarship.amount,
                "priceCurrency": "USD"
              }
            }),
            ...(scholarship.deadline && {
              "validFor": scholarship.deadline
            }),
            ...(scholarship.provider && {
              "recognizedBy": {
                "@type": "Organization",
                "name": scholarship.provider
              }
            })
          }
        }))
      };
      
      structuredData["@graph"].push(scholarshipList);
    }
  }

  // Add FAQ structured data if provided (for rich snippets)
  if (faqs.length > 0) {
    structuredData["@graph"].push({
      "@type": "FAQPage",
      "mainEntity": faqs.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    });
  }

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={truncatedDescription} />
      
      {keywords.length > 0 && (
        <meta name="keywords" content={keywords.join(", ")} />
      )}
      
      {/* Canonical URL */}
      <link rel="canonical" href={finalCanonicalUrl} />
      
      {/* Open Graph Tags */}
      <meta property="og:type" content={pageType} />
      <meta property="og:title" content={ogTitle || title} />
      <meta property="og:description" content={ogDescription || description} />
      <meta property="og:url" content={finalCanonicalUrl} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="ScholarMatch" />
      
      {/* Twitter Card Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={ogTitle || title} />
      <meta name="twitter:description" content={ogDescription || description} />
      <meta name="twitter:image" content={ogImage} />
      
      {/* Additional Meta Tags for SEO */}
      <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
      <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
      
      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(structuredData, null, 2)}
      </script>
    </Helmet>
  );
}

/**
 * Hook for generating canonical URLs
 */
export function useCanonicalUrl(path: string): string {
  const baseUrl = import.meta.env.VITE_CANONICAL_BASE_URL || 
                  (typeof window !== 'undefined' ? window.location.origin : 'https://scholarshipmatch.com');
  
  // Normalize path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${baseUrl}${normalizedPath}`;
}

/**
 * Generate SEO-optimized keywords for scholarship pages
 */
export function generateScholarshipKeywords(
  major?: string,
  state?: string,
  city?: string,
  template?: string
): string[] {
  const keywords = ['scholarships', 'financial aid', 'college funding', 'student grants'];
  
  if (major) {
    keywords.push(`${major} scholarships`, `${major} funding`, `${major} grants`);
  }
  
  if (state) {
    keywords.push(`${state} scholarships`, `scholarships in ${state}`, `${state} financial aid`);
  }
  
  if (city) {
    keywords.push(`${city} scholarships`, `local scholarships ${city}`, `${city} student funding`);
  }
  
  if (template === 'no-essay') {
    keywords.push('no essay scholarships', 'easy scholarships', 'quick apply scholarships');
  }
  
  return keywords;
}