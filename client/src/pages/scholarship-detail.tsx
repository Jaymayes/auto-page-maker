import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, DollarSign, GraduationCap, MapPin, FileText, ArrowLeft, Bookmark, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { SEOMeta, useCanonicalUrl } from "@/components/seo-meta";

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
  url?: string;
  isActive: boolean;
  isFeatured: boolean;
  isNoEssay: boolean;
}

export default function ScholarshipDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const canonicalUrl = useCanonicalUrl(`/scholarship/${params.id || ''}`);

  const { data: scholarship, isLoading } = useQuery<Scholarship>({
    queryKey: ["/api/scholarships", params.id],
    enabled: !!params.id,
  });

  const handleBack = () => {
    setLocation("/scholarships");
  };

  const handleSave = () => {
    // TODO: Implement save functionality with authentication
    toast({
      title: "Sign in required",
      description: "Please sign in to save scholarships to your profile",
    });
  };

  const handleApply = () => {
    if (scholarship?.url) {
      // If scholarship has external URL, use it
      window.open(scholarship.url, "_blank");
    } else {
      // Route to student_pilot with UTM parameters for tracking
      const studentPilotUrl = `https://student-pilot-jamarrlmayes.replit.app/?utm_source=auto_page_maker&utm_medium=apply_button&utm_campaign=scholarship_discovery&utm_content=detail_page&scholarship_id=${scholarship?.id}`;
      window.open(studentPilotUrl, "_blank", "noopener");
      toast({
        title: "Connecting to ScholarMatch",
        description: "We'll help you apply for this scholarship",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-12 w-full mb-4" />
          <Skeleton className="h-6 w-3/4 mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!scholarship) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Scholarship Not Found</h2>
            <p className="text-gray-600 mb-6">The scholarship you're looking for doesn't exist or has been removed.</p>
            <Button onClick={handleBack} data-testid="button-back-to-scholarships">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Scholarships
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const scholarshipKeywords = [
    'scholarship',
    'financial aid',
    scholarship?.title || '',
    scholarship?.major || '',
    scholarship?.state || '',
    scholarship?.city || '',
    scholarship?.level || '',
    scholarship?.isNoEssay ? 'no essay scholarship' : '',
  ].filter(Boolean);

  const seoTitle = scholarship 
    ? `${scholarship.title} - $${scholarship.amount.toLocaleString()} Scholarship | Scholar AI`
    : 'Scholarship Details | Scholar AI';
  
  const seoDescription = scholarship
    ? `Apply for the ${scholarship.title} scholarship worth $${scholarship.amount.toLocaleString()}. ${scholarship.description.substring(0, 150)}...`
    : 'Discover scholarship opportunities with Scholar AI';

  return (
    <div className="min-h-screen bg-gray-50">
      <SEOMeta
        title={seoTitle}
        description={seoDescription}
        canonicalUrl={canonicalUrl}
        ogTitle={scholarship ? `${scholarship.title} - $${scholarship.amount.toLocaleString()} Scholarship` : 'Scholarship Details'}
        ogDescription={scholarship ? `Apply for the ${scholarship.title} scholarship worth $${scholarship.amount.toLocaleString()}` : 'Discover scholarship opportunities'}
        keywords={scholarshipKeywords}
        scholarships={scholarship ? [{
          name: scholarship.title,
          description: scholarship.description,
          category: scholarship.major || scholarship.level,
          amount: scholarship.amount,
          deadline: scholarship.deadline,
          url: canonicalUrl
        }] : undefined}
        pageType="article"
      />
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="mb-6"
          data-testid="button-back"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Scholarships
        </Button>

        <Card>
          <CardContent className="p-8">
            <div className="mb-6">
              {scholarship.isFeatured && (
                <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
                  Featured
                </span>
              )}
              {scholarship.isNoEssay && (
                <span className="inline-block bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full mb-3 ml-2">
                  No Essay Required
                </span>
              )}
              <h1 className="text-3xl font-bold text-gray-900 mb-2" data-testid="text-scholarship-title">
                {scholarship.title}
              </h1>
              <p className="text-xl font-semibold text-blue-600 mb-4" data-testid="text-scholarship-amount">
                ${scholarship.amount.toLocaleString()}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="flex items-center text-gray-600">
                <Calendar className="mr-2 h-5 w-5" />
                <span data-testid="text-deadline">
                  Deadline: {format(new Date(scholarship.deadline), "MMMM d, yyyy")}
                </span>
              </div>
              <div className="flex items-center text-gray-600">
                <GraduationCap className="mr-2 h-5 w-5" />
                <span data-testid="text-level">
                  {scholarship.level.charAt(0).toUpperCase() + scholarship.level.slice(1)}
                </span>
              </div>
              {scholarship.major && (
                <div className="flex items-center text-gray-600">
                  <FileText className="mr-2 h-5 w-5" />
                  <span data-testid="text-major">{scholarship.major}</span>
                </div>
              )}
              {(scholarship.city || scholarship.state) && (
                <div className="flex items-center text-gray-600">
                  <MapPin className="mr-2 h-5 w-5" />
                  <span data-testid="text-location">
                    {scholarship.city && scholarship.state
                      ? `${scholarship.city}, ${scholarship.state}`
                      : scholarship.city || scholarship.state}
                  </span>
                </div>
              )}
            </div>

            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Description</h2>
              <p className="text-gray-700 whitespace-pre-line" data-testid="text-description">
                {scholarship.description}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleApply}
                className="flex-1"
                size="lg"
                data-testid="button-apply"
              >
                <ExternalLink className="mr-2 h-5 w-5" />
                Apply Now
              </Button>
              <Button
                onClick={handleSave}
                variant="outline"
                className="flex-1"
                size="lg"
                data-testid="button-save"
              >
                <Bookmark className="mr-2 h-5 w-5" />
                Save for Later
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
