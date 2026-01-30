import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, GraduationCap, MapPin, DollarSign, Clock, Star, TrendingUp, Users, Award } from "@/icons";
import { trackEvent } from "@/lib/analytics";
import { formatTotalAmount } from "@/utils/format";
import { SEOMeta, useCanonicalUrl } from "@/components/seo-meta";

interface ScholarshipStats {
  count: number;
  totalAmount: number;
  averageAmount: number;
}

export default function Landing() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading: statsLoading } = useQuery<ScholarshipStats>({
    queryKey: ["/api/scholarships/stats"],
  });

  const canonicalUrl = useCanonicalUrl('/');

  const handleStudentCTA = () => {
    trackEvent("click_student_pilot_cta", "cta", "hero");
    // Redirect to A5 (student_pilot) for the matching experience with UTM tracking
    window.location.href = "https://student-pilot-jamarrlmayes.replit.app/?utm_source=auto_page_maker&utm_medium=cta&utm_campaign=hero_get_matches&utm_content=landing_page";
  };

  const handleBrowseScholarships = () => {
    trackEvent("click", "cta", "browse_scholarships");
    setLocation("/scholarships");
  };

  const handleProviderLink = () => {
    trackEvent("click_provider_register_cta", "cta", "hero");
    // Redirect to A6 (provider_register) for provider onboarding
    window.location.href = "https://provider-register-jamarrlmayes.replit.app/?utm_source=auto_page_maker&utm_medium=cta&utm_campaign=provider_signup&utm_content=landing_page";
  };

  const handleCategoryClick = (category: string) => {
    trackEvent("click", "category", category);
    setLocation(`/scholarships?category=${encodeURIComponent(category)}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SEOMeta
        title="Find Your Perfect Scholarship Match | Scholar AI"
        description="Discover thousands of scholarships tailored to your profile. AI-powered matching connects you with opportunities you qualify for. Browse over 1,200 active scholarships worth $6.7M."
        canonicalUrl={canonicalUrl}
        ogTitle="Find Your Perfect Scholarship Match | Scholar AI"
        ogDescription="Discover thousands of scholarships tailored to your profile. AI-powered matching connects you with opportunities you qualify for."
        keywords={[
          'scholarships',
          'financial aid',
          'college funding',
          'student grants',
          'scholarship search',
          'AI scholarship matching',
          'scholarship finder',
          'college scholarships',
          'university scholarships',
          'scholarship opportunities'
        ]}
        pageType="website"
      />
      <Header />
      
      <main>
        {/* Hero Section */}
        <section className="bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="text-center">
              <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
                Find Your Perfect
                <span className="text-primary"> Scholarship Match</span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-4xl mx-auto">
                Discover thousands of scholarships tailored to your profile. 
                AI-powered matching connects you with opportunities you qualify for.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-4">
                <Button 
                  size="lg" 
                  className="text-lg px-8 py-4 h-auto min-h-[48px]"
                  onClick={handleStudentCTA}
                  data-testid="hero-get-matches"
                  aria-label="Get My Matches — Student pilot"
                >
                  <Search className="mr-2 h-5 w-5" />
                  Get My Matches
                </Button>
                <Button 
                  variant="outline" 
                  size="lg"
                  className="text-lg px-8 py-4 h-auto min-h-[48px]"
                  onClick={handleBrowseScholarships}
                  data-testid="button-browse-scholarships"
                >
                  Browse All Scholarships
                </Button>
              </div>

              {/* Provider tertiary link */}
              <div className="text-center mb-8">
                <button
                  onClick={handleProviderLink}
                  className="text-sm text-gray-600 hover:text-primary transition-colors underline-offset-4 hover:underline min-h-[48px] inline-flex items-center"
                  data-testid="link-provider-register"
                  aria-label="List a Scholarship — Provider registration"
                >
                  Are you a scholarship provider? List your scholarship
                </button>
              </div>

              {/* Trust Indicators */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                <Card className="border-gray-200 hover:border-primary/50 transition-colors">
                  <CardContent className="pt-6 text-center">
                    {statsLoading ? (
                      <Skeleton className="h-8 w-16 mx-auto mb-2" />
                    ) : (
                      <div className="text-3xl font-bold text-secondary mb-2" data-testid="text-scholarship-count">
                        {stats?.count || 0}
                      </div>
                    )}
                    <div className="text-gray-600">Active Scholarships</div>
                  </CardContent>
                </Card>
                
                <Card className="border-gray-200 hover:border-primary/50 transition-colors">
                  <CardContent className="pt-6 text-center">
                    {statsLoading ? (
                      <Skeleton className="h-8 w-20 mx-auto mb-2" />
                    ) : (
                      <div className="text-3xl font-bold text-secondary mb-2" data-testid="text-total-amount">
                        {formatTotalAmount(stats?.totalAmount || 0)}
                      </div>
                    )}
                    <div className="text-gray-600">Total Available</div>
                  </CardContent>
                </Card>
                
                <Card className="border-gray-200 hover:border-primary/50 transition-colors">
                  <CardContent className="pt-6 text-center">
                    {statsLoading ? (
                      <Skeleton className="h-8 w-16 mx-auto mb-2" />
                    ) : (
                      <div className="text-3xl font-bold text-secondary mb-2" data-testid="text-avg-amount">
                        ${Math.round((stats?.averageAmount || 0) / 1000)}K
                      </div>
                    )}
                    <div className="text-gray-600">Average Award</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Popular Categories */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Popular Scholarship Categories
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Explore scholarships by field of study, location, and special criteria
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: "Computer Science Scholarships",
                  description: "STEM scholarships for future tech leaders",
                  icon: GraduationCap,
                  count: "120+ scholarships",
                  amount: "$2.8M available",
                  category: "computer-science"
                },
                {
                  title: "California Scholarships", 
                  description: "Local opportunities for CA residents",
                  icon: MapPin,
                  count: "85+ scholarships",
                  amount: "$1.9M available",
                  category: "california"
                },
                {
                  title: "No-Essay Scholarships 2025",
                  description: "Quick apply opportunities with no essay required",
                  icon: Clock,
                  count: "200+ scholarships",
                  amount: "$4.2M available",
                  category: "no-essay"
                },
                {
                  title: "High-Value Scholarships",
                  description: "$10,000+ awards for exceptional students",
                  icon: DollarSign,
                  count: "45+ scholarships",
                  amount: "$1.5M available",
                  category: "high-value"
                },
                {
                  title: "Local City Scholarships",
                  description: "Community-based scholarship opportunities",
                  icon: Users,
                  count: "150+ scholarships",
                  amount: "$800K available",
                  category: "local"
                },
                {
                  title: "Merit-Based Scholarships",
                  description: "Awards recognizing academic excellence",
                  icon: Award,
                  count: "95+ scholarships",
                  amount: "$2.1M available",
                  category: "merit"
                }
              ].map((category, index) => (
                <Card 
                  key={index}
                  className="cursor-pointer hover:shadow-lg transition-shadow border-gray-200 hover:border-primary/50"
                  onClick={() => handleCategoryClick(category.category)}
                  data-testid={`card-category-${category.category}`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      <div className="p-2 bg-primary/10 rounded-lg mr-3">
                        <category.icon className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {category.title}
                      </h3>
                    </div>
                    
                    <p className="text-gray-600 mb-4">
                      {category.description}
                    </p>
                    
                    <div className="flex justify-between text-sm text-gray-500 mb-4">
                      <span>{category.count}</span>
                      <span className="font-medium text-secondary">{category.amount}</span>
                    </div>
                    
                    <div className="text-primary font-medium text-sm flex items-center">
                      Explore Category
                      <TrendingUp className="ml-1 h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Why Choose ScholarMatch?
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Our AI-powered platform makes finding and applying for scholarships easier than ever
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="p-4 bg-primary/10 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Search className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Smart Matching</h3>
                <p className="text-gray-600">
                  Our AI analyzes your profile and finds scholarships you're most likely to win
                </p>
              </div>
              
              <div className="text-center">
                <div className="p-4 bg-secondary/10 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Clock className="h-8 w-8 text-secondary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Real-Time Updates</h3>
                <p className="text-gray-600">
                  Get notified about new opportunities and upcoming deadlines automatically
                </p>
              </div>
              
              <div className="text-center">
                <div className="p-4 bg-accent/10 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Star className="h-8 w-8 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-2">100% Free</h3>
                <p className="text-gray-600">
                  Always free for students. No ads, no selling your data, just results
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Newsletter CTA */}
        <section className="py-16 bg-gradient-to-r from-primary to-blue-600">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Never Miss a Scholarship Deadline
            </h2>
            <p className="text-xl mb-8 text-blue-100">
              Get personalized scholarship matches delivered to your inbox. 
              We'll notify you about new opportunities and upcoming deadlines.
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
                onClick={() => {
                  trackEvent("click", "newsletter", "subscribe");
                  window.location.href = "/api/login";
                }}
                data-testid="button-subscribe-newsletter"
              >
                Get Started Free
              </Button>
            </div>
            
            <p className="text-xs text-blue-200 mt-3">
              Free forever • No spam • Unsubscribe anytime
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
