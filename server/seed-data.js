/**
 * Minimal Data Seed for QA Validation
 * Creates the 10 required slugs for production testing
 */

import { storage } from './storage.js';

const REQUIRED_SLUGS = [
  {
    slug: 'art-scholarships-florida',
    title: 'Art Scholarships in Florida - Creative Funding Opportunities',
    metaDescription: 'Find art scholarships available to Florida students. Discover funding opportunities for creative arts, fine arts, and visual arts programs.',
    template: 'major-state',
    templateData: { major: 'art', state: 'florida' },
    content: {
      hero: {
        title: 'Art Scholarships in Florida',
        subtitle: 'Funding opportunities for creative students in the Sunshine State',
        description: 'Discover scholarships available to art students in Florida colleges and universities.'
      },
      stats: { count: 12, totalAmount: 85000, averageAmount: 7083 }
    }
  },
  {
    slug: 'business-scholarships-massachusetts',
    title: 'Business Scholarships in Massachusetts - MBA & Finance Funding',
    metaDescription: 'Massachusetts business scholarships for undergraduate and MBA programs. Find funding for finance, entrepreneurship, and business administration.',
    template: 'major-state',
    templateData: { major: 'business', state: 'massachusetts' },
    content: {
      hero: {
        title: 'Business Scholarships in Massachusetts',
        subtitle: 'Funding for future business leaders in the Bay State',
        description: 'Access scholarships for business, MBA, and finance programs in Massachusetts.'
      },
      stats: { count: 18, totalAmount: 240000, averageAmount: 13333 }
    }
  },
  {
    slug: 'chicago-local-scholarships',
    title: 'Chicago Local Scholarships - Community-Based Education Funding',
    metaDescription: 'Local Chicago scholarships for area students. Community foundation awards, city-specific funding, and neighborhood-based opportunities.',
    template: 'local-city',
    templateData: { city: 'chicago', state: 'illinois' },
    content: {
      hero: {
        title: 'Chicago Local Scholarships',
        subtitle: 'Community-based funding for Chicago area students',
        description: 'Find scholarships specifically for Chicago residents and area students.'
      },
      stats: { count: 25, totalAmount: 325000, averageAmount: 13000 }
    }
  },
  {
    slug: 'computer-science-scholarships-california',
    title: 'Computer Science Scholarships California - Tech Industry Funding',
    metaDescription: 'California computer science scholarships from tech companies and foundations. Funding for software engineering, AI, and technology programs.',
    template: 'major-state',
    templateData: { major: 'computer science', state: 'california' },
    content: {
      hero: {
        title: 'Computer Science Scholarships in California',
        subtitle: 'Tech industry funding for future software engineers',
        description: 'Discover computer science scholarships from California tech companies and foundations.'
      },
      stats: { count: 42, totalAmount: 850000, averageAmount: 20238 }
    }
  },
  {
    slug: 'engineering-scholarships-new-york',
    title: 'Engineering Scholarships New York - STEM Education Funding',
    metaDescription: 'New York engineering scholarships for mechanical, electrical, civil, and aerospace engineering students. STEM funding opportunities.',
    template: 'major-state',
    templateData: { major: 'engineering', state: 'new york' },
    content: {
      hero: {
        title: 'Engineering Scholarships in New York',
        subtitle: 'STEM funding for future engineers in the Empire State',
        description: 'Access engineering scholarships from New York institutions and organizations.'
      },
      stats: { count: 31, totalAmount: 465000, averageAmount: 15000 }
    }
  },
  {
    slug: 'liberal-arts-scholarships-washington',
    title: 'Liberal Arts Scholarships Washington - Humanities Funding',
    metaDescription: 'Washington state liberal arts scholarships for humanities, social sciences, and liberal studies programs. Academic excellence funding.',
    template: 'major-state',
    templateData: { major: 'liberal arts', state: 'washington' },
    content: {
      hero: {
        title: 'Liberal Arts Scholarships in Washington',
        subtitle: 'Humanities funding in the Pacific Northwest',
        description: 'Find liberal arts and humanities scholarships in Washington state.'
      },
      stats: { count: 16, totalAmount: 180000, averageAmount: 11250 }
    }
  },
  {
    slug: 'medicine-scholarships-georgia',
    title: 'Medicine Scholarships Georgia - Medical School Funding',
    metaDescription: 'Georgia medical scholarships for pre-med and medical school students. Healthcare profession funding and debt reduction programs.',
    template: 'major-state',
    templateData: { major: 'medicine', state: 'georgia' },
    content: {
      hero: {
        title: 'Medicine Scholarships in Georgia',
        subtitle: 'Medical education funding in the Peach State',
        description: 'Discover medical and healthcare scholarships available in Georgia.'
      },
      stats: { count: 22, totalAmount: 440000, averageAmount: 20000 }
    }
  },
  {
    slug: 'no-essay-scholarships-2025',
    title: 'No Essay Scholarships 2025 - Easy Application Awards',
    metaDescription: '2025 no essay scholarships with simple applications. Quick apply awards, GPA-based funding, and easy scholarship opportunities.',
    template: 'no-essay',
    templateData: { year: '2025', type: 'no-essay' },
    content: {
      hero: {
        title: 'No Essay Scholarships 2025',
        subtitle: 'Simple applications, real funding opportunities',
        description: 'Apply for scholarships that don\'t require essays - quick and easy funding.'
      },
      stats: { count: 67, totalAmount: 535000, averageAmount: 7985 }
    }
  },
  {
    slug: 'nursing-scholarships-texas',
    title: 'Nursing Scholarships Texas - Healthcare Education Funding',
    metaDescription: 'Texas nursing scholarships for BSN, RN, and advanced nursing programs. Healthcare workforce development funding.',
    template: 'major-state',
    templateData: { major: 'nursing', state: 'texas' },
    content: {
      hero: {
        title: 'Nursing Scholarships in Texas',
        subtitle: 'Healthcare education funding in the Lone Star State',
        description: 'Access nursing and healthcare scholarships available to Texas students.'
      },
      stats: { count: 28, totalAmount: 420000, averageAmount: 15000 }
    }
  },
  {
    slug: 'stem-scholarships-2025',
    title: 'STEM Scholarships 2025 - Science Technology Engineering Math',
    metaDescription: '2025 STEM scholarships for science, technology, engineering, and mathematics students. Innovation and research funding.',
    template: 'stem-category',
    templateData: { year: '2025', category: 'stem' },
    content: {
      hero: {
        title: 'STEM Scholarships 2025',
        subtitle: 'Science, technology, engineering & mathematics funding',
        description: 'Discover STEM scholarships supporting innovation and research in 2025.'
      },
      stats: { count: 89, totalAmount: 1250000, averageAmount: 14045 }
    }
  }
];

/**
 * Idempotent seed function - can be run multiple times safely
 */
export async function seedTestData() {
  console.log('🌱 Starting test data seed...');
  
  let created = 0;
  let existing = 0;
  
  for (const pageData of REQUIRED_SLUGS) {
    try {
      // Check if page already exists
      const existingPages = await storage.getLandingPages();
      const exists = existingPages.find(p => p.slug === pageData.slug);
      
      if (exists) {
        console.log(`   ✓ ${pageData.slug} (already exists)`);
        existing++;
        continue;
      }
      
      // Create new landing page
      const landingPage = await storage.createLandingPage({
        slug: pageData.slug,
        title: pageData.title,
        metaDescription: pageData.metaDescription,
        template: pageData.template,
        templateData: pageData.templateData,
        content: pageData.content,
        scholarshipCount: pageData.content.stats.count,
        totalAmount: pageData.content.stats.totalAmount,
        isPublished: true,
        lastGenerated: new Date()
      });
      
      console.log(`   + ${pageData.slug} (created)`);
      created++;
      
    } catch (error) {
      console.error(`   ❌ Failed to create ${pageData.slug}:`, error.message);
    }
  }
  
  console.log(`🌱 Seed complete: ${created} created, ${existing} existing`);
  
  return {
    created,
    existing,
    total: REQUIRED_SLUGS.length
  };
}

// Allow direct execution for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  seedTestData()
    .then(result => {
      console.log('Seed result:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}