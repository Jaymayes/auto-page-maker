/**
 * Auto Page Maker - SEO Landing Page Generator
 * Phase 2: Generate 25-50 high-intent scholarship landing pages
 * 
 * Generates programmatic SEO content for scholarship categories:
 * - Major + State combinations (computer-science-texas, nursing-california)
 * - Specialized categories (no-essay, local-city, minority, women-in-stem)
 * - High-value keywords (full-ride, merit-based, need-based)
 * 
 * Quality Gates:
 * - Unique, non-duplicate content for each page
 * - 150-160 char meta descriptions
 * - Canonical URLs + proper schema.org markup
 * - Internal linking between related categories
 */

import { config } from '../../server/config/environment.js';
import { storage } from '../../server/storage.js';
import type { InsertLandingPage } from '@shared/schema';
import { calculateSpecHash, generateCanonicalUrl, generateEATSignals } from '../../server/lib/page-maker-utils.js';
import { emitBusinessEvent } from '../../server/lib/business-events.js';

// High-intent scholarship categories for maximum SEO impact
// Expanded to 40 majors for 2,000+ page target (40 majors × 50 states = 2,000 combos)
const HIGH_PRIORITY_MAJORS = [
  'computer-science',
  'nursing',
  'engineering',
  'business',
  'education',
  'psychology',
  'biology',
  'criminal-justice',
  'accounting',
  'communications',
  'marketing',
  'finance',
  'health-sciences',
  'social-work',
  'graphic-design',
  'mathematics',
  'chemistry',
  'physics',
  'english',
  'history',
  'political-science',
  'economics',
  'environmental-science',
  'kinesiology',
  'sociology',
  'pre-med',
  'pre-law',
  'information-technology',
  'data-science',
  'cybersecurity',
  'liberal-arts',
  'public-health',
  'physical-therapy',
  'occupational-therapy',
  'pharmacy',
  'dentistry',
  'architecture',
  'interior-design',
  'music',
  'theater'
];

// All 50 US states for complete geographic coverage
const HIGH_PRIORITY_STATES = [
  'alabama',
  'alaska',
  'arizona',
  'arkansas',
  'california',
  'colorado',
  'connecticut',
  'delaware',
  'florida',
  'georgia',
  'hawaii',
  'idaho',
  'illinois',
  'indiana',
  'iowa',
  'kansas',
  'kentucky',
  'louisiana',
  'maine',
  'maryland',
  'massachusetts',
  'michigan',
  'minnesota',
  'mississippi',
  'missouri',
  'montana',
  'nebraska',
  'nevada',
  'new-hampshire',
  'new-jersey',
  'new-mexico',
  'new-york',
  'north-carolina',
  'north-dakota',
  'ohio',
  'oklahoma',
  'oregon',
  'pennsylvania',
  'rhode-island',
  'south-carolina',
  'south-dakota',
  'tennessee',
  'texas',
  'utah',
  'vermont',
  'virginia',
  'washington',
  'west-virginia',
  'wisconsin',
  'wyoming'
];

const SPECIALIZED_CATEGORIES = [
  { slug: 'no-essay-scholarships', title: 'No Essay Scholarships', keywords: ['no essay', 'easy application', 'quick apply'] },
  { slug: 'minority-scholarships', title: 'Minority Scholarships', keywords: ['diversity', 'underrepresented', 'inclusion'] },
  { slug: 'women-in-stem-scholarships', title: 'Women in STEM Scholarships', keywords: ['women', 'STEM', 'technology', 'science'] },
  { slug: 'first-generation-scholarships', title: 'First Generation College Scholarships', keywords: ['first generation', 'first gen', 'college access'] },
  { slug: 'merit-based-scholarships', title: 'Merit-Based Scholarships', keywords: ['merit', 'academic achievement', 'GPA'] },
  { slug: 'need-based-scholarships', title: 'Need-Based Financial Aid', keywords: ['need-based', 'financial aid', 'low income'] },
  { slug: 'full-ride-scholarships', title: 'Full Ride Scholarships', keywords: ['full ride', 'full tuition', 'complete funding'] },
  { slug: 'graduate-school-scholarships', title: 'Graduate School Scholarships', keywords: ['graduate', 'masters', 'doctoral', 'PhD'] },
  { slug: 'community-college-scholarships', title: 'Community College Scholarships', keywords: ['community college', '2-year', 'associate degree'] },
  { slug: 'study-abroad-scholarships', title: 'Study Abroad Scholarships', keywords: ['study abroad', 'international', 'global'] }
];

interface LandingPageTemplate {
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  introText: string;
  filterQuery: {
    major?: string;
    state?: string;
    keywords?: string[];
  };
  relatedPages: string[];
}

export class AutoPageMaker {
  private generatedSlugs = new Set<string>();
  public templates: LandingPageTemplate[] = [];

  async generate(): Promise<void> {
    console.log('🚀 Auto Page Maker Starting - Generating High-Intent SEO Landing Pages');
    console.log('Target: 2,000+ pages for Production Scale (40 majors × 50 states)\n');

    // 1. Generate ALL Major + State combinations (10×10 = 100 pages) - EXECUTIVE REQUEST
    await this.generateAllMajorStateCombinations();

    // 2. Generate Specialized category pages (10 pages)
    await this.generateSpecializedPages();

    // 3. Generate State-only pages (10 pages)
    await this.generateStatePages();

    // 4. Generate Major-only pages (10 pages) 
    await this.generateMajorPages();

    console.log(`\n✅ Generated ${this.templates.length} unique landing page templates`);
    console.log('📊 Quality Checks:');
    console.log(`   - Unique slugs: ${this.generatedSlugs.size}`);
    console.log(`   - Meta descriptions: ${this.templates.filter(t => t.metaDescription.length >= 150 && t.metaDescription.length <= 160).length} within 150-160 chars`);
    console.log(`   - Internal links: ${this.templates.reduce((sum, t) => sum + t.relatedPages.length, 0)} total links`);

    await this.saveToDatabase();
  }

  private generateAllMajorStateCombinations(): void {
    console.log('📄 Generating ALL Major × State combinations (40×50 = 2,000 pages)...');
    
    let count = 0;
    // Generate EVERY combination of majors and states for maximum SEO coverage
    for (const major of HIGH_PRIORITY_MAJORS) {
      for (const state of HIGH_PRIORITY_STATES) {
        const majorTitle = this.formatTitle(major);
        const stateTitle = this.formatTitle(state);
        const slug = `scholarships/${major}-${state}`;

        if (this.generatedSlugs.has(slug)) continue;

        this.templates.push({
          slug,
          title: `${majorTitle} Scholarships in ${stateTitle} | ScholarMatch`,
          metaDescription: `Find and apply to ${majorTitle.toLowerCase()} scholarships in ${stateTitle}. Browse funding opportunities for ${majorTitle.toLowerCase()} students attending college in ${stateTitle}.`,
          h1: `${majorTitle} Scholarships in ${stateTitle}`,
          introText: `Discover scholarship opportunities for ${majorTitle.toLowerCase()} majors studying in ${stateTitle}. Our platform connects you with relevant funding sources tailored to your field of study and location. Start your scholarship search today and reduce your college costs.`,
          filterQuery: {
            major: major,
            state: state
          },
          relatedPages: [
            `/scholarships/${major}`,
            `/scholarships/${state}`,
            '/scholarships/merit-based-scholarships'
          ]
        });

        this.generatedSlugs.add(slug);
        count++;
      }
    }

    console.log(`   ✓ Generated ${count} major × state pages (100% coverage)`);
  }

  private generateSpecializedPages(): void {
    console.log('📄 Generating Specialized category pages...');

    for (const category of SPECIALIZED_CATEGORIES) {
      const slug = `scholarships/${category.slug}`;
      
      if (this.generatedSlugs.has(slug)) continue;

      this.templates.push({
        slug,
        title: `${category.title} | Find Your Perfect Scholarship`,
        metaDescription: `Browse ${category.title.toLowerCase()} designed to make college more affordable. Discover funding opportunities that match your unique background and goals. Apply now.`,
        h1: category.title,
        introText: `Find ${category.title.toLowerCase()} that match your profile. We've curated a comprehensive database of scholarships to help you fund your education. Filter by eligibility requirements and application deadlines to find the perfect fit.`,
        filterQuery: {
          keywords: category.keywords
        },
        relatedPages: [
          '/scholarships/computer-science',
          '/scholarships/texas',
          '/scholarships/full-ride-scholarships'
        ]
      });

      this.generatedSlugs.add(slug);
    }

    console.log(`   ✓ Generated ${SPECIALIZED_CATEGORIES.length} specialized category pages`);
  }

  private generateStatePages(): void {
    console.log('📄 Generating State-specific pages...');

    const topStates = HIGH_PRIORITY_STATES; // All 50 states

    for (const state of topStates) {
      const stateTitle = this.formatTitle(state);
      const slug = `scholarships/${state}`;

      if (this.generatedSlugs.has(slug)) continue;

      this.templates.push({
        slug,
        title: `College Scholarships in ${stateTitle} | ScholarMatch`,
        metaDescription: `Explore college scholarships for ${stateTitle} residents and students attending ${stateTitle} schools. Find local, state, and national funding opportunities to help pay for college.`,
        h1: `Scholarships for ${stateTitle} Students`,
        introText: `Discover scholarship opportunities available to students in ${stateTitle}. Whether you're a ${stateTitle} resident or planning to attend college in ${stateTitle}, find funding sources that can help make your education more affordable.`,
        filterQuery: {
          state: state
        },
        relatedPages: [
          `/scholarships/computer-science-${state}`,
          '/scholarships/merit-based-scholarships',
          '/scholarships/no-essay-scholarships'
        ]
      });

      this.generatedSlugs.add(slug);
    }

    console.log(`   ✓ Generated ${topStates.length} state-specific pages`);
  }

  private generateMajorPages(): void {
    console.log('📄 Generating Major-specific pages...');

    const topMajors = HIGH_PRIORITY_MAJORS; // All 40 majors

    for (const major of topMajors) {
      const majorTitle = this.formatTitle(major);
      const slug = `scholarships/${major}`;

      if (this.generatedSlugs.has(slug)) continue;

      this.templates.push({
        slug,
        title: `${majorTitle} Scholarships | ScholarMatch`,
        metaDescription: `Find ${majorTitle.toLowerCase()} scholarships and grants. Browse funding opportunities for ${majorTitle.toLowerCase()} students from top organizations and schools nationwide. Apply today.`,
        h1: `${majorTitle} Scholarships`,
        introText: `Browse scholarships specifically for ${majorTitle.toLowerCase()} majors. Our comprehensive database includes merit-based, need-based, and specialized scholarships to help you fund your ${majorTitle.toLowerCase()} degree.`,
        filterQuery: {
          major: major
        },
        relatedPages: [
          `/scholarships/${major}-texas`,
          `/scholarships/${major}-california`,
          '/scholarships/merit-based-scholarships'
        ]
      });

      this.generatedSlugs.add(slug);
    }

    console.log(`   ✓ Generated ${topMajors.length} major-specific pages`);
  }

  private async saveToDatabase(): Promise<void> {
    console.log('\n💾 Saving landing pages to database (v2.5 idempotent mode)...');

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    let updatedCount = 0;

    for (const template of this.templates) {
      try {
        // Check if page already exists
        const existing = await storage.getLandingPage(template.slug);

        // Determine template type based on slug pattern
        let templateType = 'major-state';
        if (template.slug.includes('scholarships/')) {
          const slugPart = template.slug.replace('scholarships/', '');
          if (slugPart.match(/^[a-z-]+-[a-z-]+$/)) {
            templateType = 'major-state';
          } else if (SPECIALIZED_CATEGORIES.some(c => c.slug === slugPart)) {
            templateType = 'specialized';
          } else if (HIGH_PRIORITY_STATES.some(s => slugPart === s)) {
            templateType = 'state-only';
          } else if (HIGH_PRIORITY_MAJORS.some(m => slugPart === m)) {
            templateType = 'major-only';
          }
        }

        // Get scholarship statistics for this page's filter criteria
        const stats = await storage.getScholarshipStats({
          major: template.filterQuery.major,
          state: template.filterQuery.state
        });

        // v2.5: Calculate deterministic spec hash
        const specHash = calculateSpecHash({
          slug: template.slug,
          title: template.title,
          metaDescription: template.metaDescription,
          template: templateType,
          templateData: {
            filterQuery: template.filterQuery,
            relatedPages: template.relatedPages
          },
          content: {
            h1: template.h1,
            introText: template.introText
          }
        });

        // v2.5: Generate canonical URL and E-E-A-T signals
        const canonicalUrl = generateCanonicalUrl(template.slug);
        const eatSignals = generateEATSignals(templateType, stats.count);

        // Map to database schema with v2.5 enhancements
        const landingPage: InsertLandingPage = {
          slug: template.slug,
          title: template.title,
          metaDescription: template.metaDescription,
          template: templateType,
          templateData: {
            filterQuery: template.filterQuery,
            relatedPages: template.relatedPages
          },
          content: {
            h1: template.h1,
            introText: template.introText
          },
          scholarshipCount: stats.count,
          totalAmount: stats.totalAmount,
          isPublished: true,
          lastGenerated: new Date(),
          
          // v2.5 fields
          canonicalUrl,
          specHash,
          pageVersion: existing ? (existing.pageVersion || 1) + 1 : 1,
          eatSignals,
          viewCount: existing?.viewCount || 0,
          leadCount: existing?.leadCount || 0
        };

        if (existing) {
          // Check if content changed (deterministic rebuild)
          if (existing.specHash === specHash) {
            // No content change - only update stats
            await storage.updateLandingPage(existing.id, {
              scholarshipCount: stats.count,
              totalAmount: stats.totalAmount,
              lastGenerated: new Date()
            });
            console.log(`   ⏭️  Unchanged: ${template.slug} (hash match, stats refreshed)`);
            skipCount++;
          } else {
            // Content changed - full update + increment version
            await storage.updateLandingPage(existing.id, landingPage);
            console.log(`   🔄 Updated: ${template.slug} v${landingPage.pageVersion} (${stats.count} scholarships, $${stats.totalAmount})`);
            updatedCount++;
            
            // Emit page_published event for substantial updates
            await emitBusinessEvent('page_published', {
              slug: template.slug,
              topic: this.extractTopic(template),
              geo: this.extractGeo(template),
              template: templateType,
              wordCount: this.countWords(template.introText),
              canonicalUrl,
              version: landingPage.pageVersion
            }, {
              actorType: 'system',
              actorId: null
            }).catch(err => console.error(`   ⚠️  Event emission failed for ${template.slug}:`, err));
          }
        } else {
          // Create new page
          const created = await storage.createLandingPage(landingPage);
          console.log(`   ✅ Created: ${template.slug} v1 (${stats.count} scholarships, $${stats.totalAmount})`);
          successCount++;
          
          // Emit page_published event
          await emitBusinessEvent('page_published', {
            slug: template.slug,
            topic: this.extractTopic(template),
            geo: this.extractGeo(template),
            template: templateType,
            wordCount: this.countWords(template.introText),
            canonicalUrl,
            version: 1
          }, {
            actorType: 'system',
            actorId: null
          }).catch(err => console.error(`   ⚠️  Event emission failed for ${template.slug}:`, err));
        }

      } catch (error) {
        console.error(`   ❌ Error saving ${template.slug}:`, error);
        errorCount++;
      }
    }

    console.log('\n📊 Database Save Summary (v2.5):');
    console.log(`   ✅ Created: ${successCount}`);
    console.log(`   🔄 Updated: ${updatedCount}`);
    console.log(`   ⏭️  Unchanged: ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📄 Total templates: ${this.templates.length}`);
  }

  private extractTopic(template: LandingPageTemplate): string {
    if (template.filterQuery.major) {
      return `${this.formatTitle(template.filterQuery.major)} scholarships`;
    }
    if (template.filterQuery.keywords) {
      return template.filterQuery.keywords[0];
    }
    return template.title.split('|')[0].trim();
  }

  private extractGeo(template: LandingPageTemplate): string {
    if (template.filterQuery.state) {
      return this.formatTitle(template.filterQuery.state);
    }
    return 'US';
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  private formatTitle(slug: string): string {
    return slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

// Main execution
async function main() {
  try {
    const maker = new AutoPageMaker();
    await maker.generate();
    console.log('\n🎉 Auto Page Maker Complete!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Auto Page Maker Failed:', error);
    process.exit(1);
  }
}

main();