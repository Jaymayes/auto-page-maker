import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, GraduationCap, ChevronRight } from "@/icons";
import { SEOMeta, useCanonicalUrl } from "@/components/seo-meta";

interface CategoryCount {
  name: string;
  slug: string;
  count: number;
  totalAmount: number;
}

interface HubData {
  states: CategoryCount[];
  majors: CategoryCount[];
}

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
  "Wisconsin", "Wyoming"
];

const POPULAR_MAJORS = [
  "Nursing", "Engineering", "Computer Science", "Business", "Education", "Psychology",
  "Biology", "Communications", "Criminal Justice", "Art", "Music", "History",
  "Political Science", "Mathematics", "Chemistry", "Physics", "Accounting", "Marketing",
  "Finance", "Healthcare", "Social Work", "Agriculture", "Architecture", "Journalism"
];

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

function formatAmount(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount}`;
}

export default function ScholarshipsHub() {
  const params = useParams<{ type?: string }>();
  const hubType = params.type || 'all';
  
  const { data: stats, isLoading } = useQuery<{ count: number; totalAmount: number }>({
    queryKey: ["/api/scholarships/stats"],
  });

  const canonicalUrl = useCanonicalUrl(hubType === 'all' ? '/browse' : `/browse/${hubType}`);

  const pageTitle = hubType === 'states' 
    ? 'Scholarships by State | Find Local Funding Opportunities'
    : hubType === 'majors'
    ? 'Scholarships by Major | Field of Study Funding Guide'
    : 'Browse All Scholarships | States & Majors Directory';

  const pageDescription = hubType === 'states'
    ? 'Explore scholarships available in every US state. Find local funding opportunities, state grants, and regional scholarship programs near you.'
    : hubType === 'majors'
    ? 'Discover scholarships for every field of study. Browse funding opportunities by major including STEM, healthcare, business, arts, and more.'
    : 'Browse our complete scholarship directory by state or major. Find the perfect funding opportunities for your education journey.';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-12 w-96 mb-4" />
          <Skeleton className="h-6 w-full max-w-2xl mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(12)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SEOMeta
        title={pageTitle}
        description={pageDescription}
        canonicalUrl={canonicalUrl}
        ogTitle={pageTitle}
        ogDescription={pageDescription}
      />
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <nav className="flex items-center text-sm text-gray-500 mb-6" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-primary" data-testid="link-home">Home</Link>
          <ChevronRight className="h-4 w-4 mx-2" />
          <Link href="/browse" className="hover:text-primary" data-testid="link-browse">Browse</Link>
          {hubType !== 'all' && (
            <>
              <ChevronRight className="h-4 w-4 mx-2" />
              <span className="text-gray-900 capitalize">{hubType}</span>
            </>
          )}
        </nav>

        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4" data-testid="text-hub-title">
            {hubType === 'states' && 'Scholarships by State'}
            {hubType === 'majors' && 'Scholarships by Major'}
            {hubType === 'all' && 'Browse Scholarships'}
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl">
            {hubType === 'states' && 'Find scholarships specific to your state. Many organizations offer funding exclusively to students in certain regions.'}
            {hubType === 'majors' && 'Discover scholarships tailored to your field of study. Many scholarships are designed for students pursuing specific majors.'}
            {hubType === 'all' && `Explore our database of ${stats?.count?.toLocaleString() || '1,000+'} scholarships worth over ${formatAmount(stats?.totalAmount || 0)}. Browse by state or major to find the perfect opportunities.`}
          </p>
        </div>

        {(hubType === 'all' || hubType === 'states') && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <MapPin className="h-6 w-6 text-primary" />
                Scholarships by State
              </h2>
              {hubType === 'all' && (
                <Link href="/browse/states" className="text-primary hover:underline text-sm font-medium" data-testid="link-view-all-states">
                  View All States →
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {US_STATES.slice(0, hubType === 'all' ? 10 : undefined).map((state) => (
                <Link 
                  key={state} 
                  href={`/scholarships/${slugify(state)}`}
                  data-testid={`link-state-${slugify(state)}`}
                >
                  <Card className="hover:shadow-md hover:border-primary transition-all cursor-pointer h-full">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <span className="font-medium text-gray-900 text-sm">{state}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {(hubType === 'all' || hubType === 'majors') && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <GraduationCap className="h-6 w-6 text-primary" />
                Scholarships by Major
              </h2>
              {hubType === 'all' && (
                <Link href="/browse/majors" className="text-primary hover:underline text-sm font-medium" data-testid="link-view-all-majors">
                  View All Majors →
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {POPULAR_MAJORS.slice(0, hubType === 'all' ? 10 : undefined).map((major) => (
                <Link 
                  key={major} 
                  href={`/scholarships/${slugify(major)}`}
                  data-testid={`link-major-${slugify(major)}`}
                >
                  <Card className="hover:shadow-md hover:border-primary transition-all cursor-pointer h-full">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <span className="font-medium text-gray-900 text-sm">{major}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Can't find what you're looking for?
          </h2>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            Get personalized scholarship matches based on your unique profile. Our AI-powered matching system finds opportunities you qualify for.
          </p>
          <a
            href="https://student-pilot-jamarrlmayes.replit.app/?utm_source=auto_page_maker&utm_medium=cta&utm_campaign=hub_page&utm_content=browse"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
            data-testid="button-get-matches"
          >
            Get Personalized Matches
          </a>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}
