import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState, lazy, Suspense } from "react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import ScholarshipCard from "@/components/scholarship-card";
const FiltersSidebar = lazy(() => import("@/components/filters-sidebar"));
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight, Search, Filter, X } from "@/icons";
import { trackEvent } from "@/lib/analytics";
import { SEOMeta, useCanonicalUrl, generateScholarshipKeywords } from "@/components/seo-meta";
import { EEATSignals } from "@/components/eeat-signals";

interface Scholarship {
  id: string;
  title: string;
  description: string;
  amount: number;
  deadline: string;
  level: string;
  major?: string;
  state?: string;
  city?: string;
  requirements: any;
  tags: string[];
  sourceUrl?: string;
  sourceOrganization?: string;
  isActive: boolean;
  isFeatured: boolean;
  isNoEssay: boolean;
  createdAt: string;
  updatedAt: string;
}

interface LandingPage {
  id: string;
  slug: string;
  title: string;
  metaDescription: string;
  content: {
    h1?: string;
    heroTitle: string;
    heroDescription: string;
    introText?: string;
    scholarshipSummaries: any[];
    categoryInsights: string;
    relatedCategories: Array<{
      title: string;
      description: string;
      slug: string;
    }>;
  };
  scholarshipCount: number;
  totalAmount: number;
  updatedAt?: string;
}

interface Filters {
  amount?: string;
  deadline?: string;
  level?: string;
  isNoEssay?: boolean;
}

export default function ScholarshipCategory() {
  const params = useParams();
  const [location, setLocation] = useLocation();
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({});
  const [sortBy, setSortBy] = useState("deadline");

  // Extract slug from URL - Wouter's :rest* pattern doesn't work, so parse manually
  // For URLs like /scholarships/no-essay-scholarships, extract "no-essay-scholarships"
  // Normalize slashes to hyphens to match database slugs (e.g., "computer-science/california" → "computer-science-california")
  const pathMatch = location.match(/^\/scholarships\/(.+)$/);
  const rawSlug = pathMatch ? pathMatch[1] : null;
  const slug = rawSlug ? `scholarships/${rawSlug.replace(/\//g, '-')}` : null;
  
  // Parse category/location from slug for filtering
  // Handle both single slugs (no-essay-scholarships) and nested paths (computer-science/texas)
  const slugSegments = rawSlug?.split('/') || [];
  
  // For nested paths like computer-science/texas, first segment is category, second is location
  // For single slugs, try to extract category from first part before first hyphen
  const derivedCategory = slug && !params.category 
    ? slugSegments[0] // Keep hyphenated for backend query compatibility
    : params.category;
    
  // Derive location from second segment if exists, fallback to params  
  const derivedLocation = slug && !params.location
    ? slugSegments[1] // Keep hyphenated for backend query
    : params.location;

  // Fetch landing page data (skip if no slug - e.g., /scholarships with no params)
  const { data: landingPage, isLoading: pageLoading } = useQuery<LandingPage>({
    queryKey: ["/api/landing-pages", slug],
    enabled: !!slug, // Only fetch if we have a valid slug
  });

  // Fetch scholarships - use derived values from slug parsing, fall back to params
  const { data: scholarships = [], isLoading: scholarshipsLoading } = useQuery<Scholarship[]>({
    queryKey: [
      "/api/scholarships",
      {
        ...filters,
        // Convert hyphenated slugs to space-separated for backend query (e.g., "computer-science" → "computer science")
        major: derivedCategory ? decodeURIComponent(derivedCategory).replace(/-/g, ' ').trim() : undefined,
        state: derivedLocation ? decodeURIComponent(derivedLocation).replace(/-/g, ' ').trim() : undefined,
      }
    ],
  });

  // Generate canonical URL and SEO data
  // Use rawSlug to avoid double "scholarships/" prefix
  const canonicalUrl = useCanonicalUrl(rawSlug ? `/scholarships/${rawSlug}` : '/scholarships');
  const seoKeywords = landingPage ? generateScholarshipKeywords(
    derivedCategory,
    derivedLocation,
    undefined,
    landingPage.slug.includes('no-essay') ? 'no-essay' : undefined
  ) : [];

  // Generate breadcrumbs - use derived values from slug
  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Scholarships", url: "/scholarships" },
    ...(derivedCategory ? [{ name: derivedCategory.replace(/-/g, " "), url: `/scholarships/${derivedCategory}` }] : []),
    ...(derivedLocation ? [{ name: derivedLocation.replace(/-/g, " "), url: `/scholarships/${derivedCategory}/${derivedLocation}` }] : []),
  ];

  const handleGetMatches = () => {
    trackEvent("get_matches", "cta", "get_matches");
    window.open(`https://student-pilot-jamarrlmayes.replit.app/?utm_source=auto_page_maker&utm_medium=cta&utm_campaign=seo_landing&utm_content=${encodeURIComponent(rawSlug || 'category')}`, "_blank", "noopener");
  };

  const handleBrowseAll = () => {
    trackEvent("browse_all", "cta", "browse_all");
    setLocation("/scholarships");
  };

  const handleFilterChange = (newFilters: Filters) => {
    setFilters(newFilters);
    trackEvent("filter_change", "scholarships", JSON.stringify(newFilters));
  };

  const handleSortChange = (newSort: string) => {
    setSortBy(newSort);
    trackEvent("sort_change", "scholarships", newSort);
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-8 w-96 mb-4" />
          <Skeleton className="h-12 w-full mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <Skeleton className="h-96" />
            <div className="lg:col-span-3 space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Only show 404 if we expected a landing page but didn't get one
  if (!landingPage && slug) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Page Not Found</h1>
          <p className="text-gray-600 mb-6">The scholarship category you're looking for doesn't exist.</p>
          {/* MED-007: Use router navigation instead of window.location */}
          <Button onClick={() => setLocation("/")}>
            Return Home
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  // Fallback content when no landing page (e.g., /scholarships with no params)
  // Use h1 from content, or fall back to the page title field
  const pageTitle = landingPage?.content.h1 || landingPage?.content.heroTitle || landingPage?.title?.split('|')[0].trim() || "Browse All Scholarships";
  const pageDescription = landingPage?.content.introText || landingPage?.content.heroDescription || "Discover thousands of scholarships tailored to your profile. Filter by major, location, deadline, and more.";
  const scholarshipCount = landingPage?.scholarshipCount || scholarships.length;
  const totalAmount = landingPage?.totalAmount || scholarships.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {landingPage && (
        <SEOMeta
          title={landingPage.title}
          description={landingPage.metaDescription}
          canonicalUrl={canonicalUrl}
          keywords={seoKeywords}
          breadcrumbs={breadcrumbs}
          scholarships={scholarships.slice(0, 10).map(s => ({
            name: s.title,
            description: s.description,
            category: s.major || 'General',
            amount: s.amount,
            deadline: s.deadline,
            provider: s.sourceOrganization,
            url: canonicalUrl
          }))}
          pageType="website"
        />
      )}
      <Header />
      
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav className="flex text-sm text-gray-500" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, index) => (
              <span key={index} className="flex items-center">
                {index > 0 && <ChevronRight className="mx-2 h-4 w-4 text-gray-400" />}
                {index === breadcrumbs.length - 1 ? (
                  <span className="text-gray-900 font-medium capitalize" data-testid={`text-breadcrumb-${index}`}>
                    {crumb.name}
                  </span>
                ) : (
                  <a 
                    href={crumb.url} 
                    className="hover:text-primary transition-colors capitalize"
                    data-testid={`link-breadcrumb-${index}`}
                  >
                    {crumb.name}
                  </a>
                )}
              </span>
            ))}
          </nav>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="mb-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4" data-testid="text-page-title">
              {pageTitle}
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-6" data-testid="text-page-description">
              {pageDescription}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                className="text-lg px-8 py-3 h-auto"
                onClick={handleGetMatches}
                data-testid="button-get-matches"
              >
                <Search className="mr-2 h-4 w-4" />
                Get My Matches
              </Button>
              <Button 
                variant="outline"
                className="text-lg px-8 py-3 h-auto"
                onClick={handleBrowseAll}
                data-testid="button-browse-all"
              >
                Browse All Scholarships
              </Button>
            </div>
          </div>
          
          {/* E-E-A-T Signals (Experience, Expertise, Authoritativeness, Trustworthiness) */}
          <EEATSignals
            scholarshipCount={scholarshipCount}
            totalAmount={totalAmount}
            lastUpdated={landingPage?.updatedAt}
            category={slug || undefined}
          />
          
          {/* Trust Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="text-center">
              <div className="text-2xl font-bold text-secondary" data-testid="text-stats-count">
                {scholarshipCount}
              </div>
              <div className="text-gray-600">Active Scholarships</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-secondary" data-testid="text-stats-amount">
                ${(totalAmount / 1000000).toFixed(1)}M
              </div>
              <div className="text-gray-600">Total Available</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-secondary" data-testid="text-stats-due-soon">
                {scholarships.filter(s => {
                  const daysUntil = Math.ceil((new Date(s.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return daysUntil <= 30;
                }).length}
              </div>
              <div className="text-gray-600">Due This Month</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Sidebar - Desktop */}
          <div className="hidden lg:block">
            <Suspense fallback={<Skeleton className="h-96 w-full" />}>
              <FiltersSidebar
                filters={filters}
                onFiltersChange={handleFilterChange}
                data-testid="filters-sidebar"
              />
            </Suspense>
          </div>

          {/* Mobile Filters Button */}
          <div className="lg:hidden mb-4">
            <Button
              variant="outline"
              onClick={() => setIsMobileFiltersOpen(true)}
              className="w-full"
              data-testid="button-mobile-filters"
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
          </div>

          {/* Mobile Filters Modal */}
          {isMobileFiltersOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setIsMobileFiltersOpen(false)} />
              <div className="fixed right-0 top-0 h-full w-80 bg-white p-6 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold">Filters</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsMobileFiltersOpen(false)}
                    data-testid="button-close-mobile-filters"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                  <FiltersSidebar
                    filters={filters}
                    onFiltersChange={(newFilters) => {
                      handleFilterChange(newFilters);
                      setIsMobileFiltersOpen(false);
                    }}
                  />
                </Suspense>
              </div>
            </div>
          )}

          {/* Scholarship List */}
          <div className="lg:col-span-3">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900" data-testid="text-results-count">
                {scholarshipsLoading ? (
                  <Skeleton className="h-6 w-32" />
                ) : (
                  `${scholarships.length} Scholarships Found`
                )}
              </h2>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Sort by:</span>
                <select 
                  className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  data-testid="select-sort"
                >
                  <option value="deadline">Deadline (Soonest)</option>
                  <option value="amount">Award Amount (Highest)</option>
                  <option value="relevance">Relevance</option>
                </select>
              </div>
            </div>

            {scholarshipsLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-64" />
                ))}
              </div>
            ) : scholarships.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <h3 className="text-lg font-semibold mb-2">No scholarships found</h3>
                  <p className="text-gray-600 mb-4">
                    Try adjusting your filters or browse all scholarships.
                  </p>
                  <Button onClick={() => setFilters({})}>
                    Clear Filters
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {scholarships.map((scholarship) => (
                  <ScholarshipCard 
                    key={scholarship.id} 
                    scholarship={scholarship}
                    data-testid={`card-scholarship-${scholarship.id}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Related Categories */}
        {landingPage?.content?.relatedCategories && landingPage.content.relatedCategories.length > 0 && (
          <div className="mt-12 bg-white rounded-xl p-8 shadow-sm border border-gray-100">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
              Explore Related Scholarships
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {landingPage?.content?.relatedCategories?.map((category, index) => (
                <a 
                  key={index}
                  href={`/${category.slug}`}
                  className="group p-4 rounded-lg border border-gray-200 hover:border-primary hover:shadow-md transition-all"
                  data-testid={`link-related-${index}`}
                  onClick={() => trackEvent("click", "related_category", category.title)}
                >
                  <h3 className="font-semibold text-gray-900 group-hover:text-primary mb-2">
                    {category.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">
                    {category.description}
                  </p>
                  <div className="text-primary text-sm font-medium">
                    View All <ChevronRight className="ml-1 h-4 w-4 inline" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Newsletter CTA */}
        <div className="mt-12 bg-gradient-to-r from-primary to-blue-600 rounded-xl p-8 text-white text-center">
          <h2 className="text-2xl font-semibold mb-4">Never Miss a Scholarship Deadline</h2>
          <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
            Get personalized scholarship matches delivered to your inbox. We'll notify you about new opportunities and upcoming deadlines.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-md mx-auto">
            <input 
              type="email" 
              placeholder="Enter your email" 
              className="flex-1 px-4 py-3 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-300 focus:outline-none"
              data-testid="input-email-newsletter"
            />
            <Button 
              className="bg-white text-primary hover:bg-gray-100 px-6 py-3 h-auto whitespace-nowrap"
              onClick={() => trackEvent("click", "newsletter", "subscribe")}
              data-testid="button-subscribe-newsletter"
            >
              Get Started Free
            </Button>
          </div>
          
          <p className="text-xs text-blue-200 mt-3">
            Free forever • No spam • Unsubscribe anytime
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
