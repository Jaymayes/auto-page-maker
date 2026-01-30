import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, GraduationCap, MapPin, Clock, Star, ExternalLink, Bookmark, Send, AlertTriangle } from "@/icons";
import { trackEvent } from "@/lib/analytics";
import { useToast } from "@/hooks/use-toast";
import { differenceInCalendarDays, endOfDay } from "date-fns";

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

interface ScholarshipCardProps {
  scholarship: Scholarship;
  'data-testid'?: string;
}

export default function ScholarshipCard({ scholarship, 'data-testid': testId }: ScholarshipCardProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Calculate days until deadline with proper end-of-day handling
  const daysUntilDeadline = (() => {
    try {
      const deadlineEOD = endOfDay(new Date(scholarship.deadline));
      const now = new Date();
      return differenceInCalendarDays(deadlineEOD, now);
    } catch (e) {
      // MED-004: Proper error logging in development
      if (import.meta.env.DEV) {
        console.warn('Deadline parse failed', { id: scholarship.id, deadline: scholarship.deadline, error: e });
      }
      // Fallback to simple calculation
      return Math.ceil((new Date(scholarship.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    }
  })();
  const isUrgent = daysUntilDeadline <= 7;
  const isDueSoon = daysUntilDeadline <= 30;

  const handleApplyClick = () => {
    // TODO: Implement apply functionality with authentication
    if (scholarship.url) {
      window.open(scholarship.url, "_blank");
      trackEvent("apply", "scholarship", scholarship.id, scholarship.amount);
    } else {
      toast({
        title: "View Details",
        description: "Click 'View Details' to see how to apply for this scholarship",
      });
    }
  };

  const handleSaveClick = () => {
    // TODO: Implement save functionality with authentication
    toast({
      title: "Sign in required",
      description: "Please sign in to save scholarships to your profile",
    });
  };

  const handleGetMatches = () => {
    trackEvent("get_matches", "scholarship", scholarship.id);
    // Route to student_pilot with UTM parameters for tracking
    const studentPilotUrl = `https://student-pilot-jamarrlmayes.replit.app/?utm_source=auto_page_maker&utm_medium=get_matches_button&utm_campaign=scholarship_discovery&utm_content=card_view&scholarship_id=${scholarship.id}`;
    window.open(studentPilotUrl, "_blank", "noopener");
  };

  const handleViewDetails = () => {
    trackEvent("view_details", "scholarship", scholarship.id);
    setLocation(`/scholarship/${scholarship.id}`);
  };

  const formatDeadlineText = () => {
    if (daysUntilDeadline <= 0) return "Deadline passed";
    if (daysUntilDeadline === 1) return "Due Tomorrow";
    if (daysUntilDeadline <= 7) return `Due in ${daysUntilDeadline} days`;
    return `Due ${new Date(scholarship.deadline).toLocaleDateString()}`;
  };

  const getDeadlineColor = () => {
    if (daysUntilDeadline <= 1) return "text-red-600 font-semibold";
    if (daysUntilDeadline <= 7) return "text-orange-600 font-medium";
    return "text-gray-600";
  };

  return (
    <Card 
      className={`shadow-sm border transition-all hover:shadow-md ${
        scholarship.isFeatured 
          ? "border-l-4 border-l-secondary border-t border-r border-b border-gray-100" 
          : "border-gray-100"
      }`}
      data-testid={testId}
    >
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-3">
          <div className="flex gap-2">
            {scholarship.isFeatured && (
              <Badge className="bg-secondary text-white" data-testid="badge-featured">
                <Star className="mr-1 h-3 w-3" />
                Featured
              </Badge>
            )}
            {scholarship.isNoEssay && (
              <Badge variant="secondary" data-testid="badge-no-essay">
                No Essay Required
              </Badge>
            )}
            {scholarship.city && (
              <Badge variant="outline" data-testid="badge-local">
                Local Opportunity
              </Badge>
            )}
          </div>
          <span className={`text-sm flex items-center ${getDeadlineColor()}`} data-testid="text-deadline">
            {isUrgent && <AlertTriangle className="mr-1 h-4 w-4" />}
            {!isUrgent && <Clock className="mr-1 h-4 w-4" />}
            {formatDeadlineText()}
          </span>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-2" data-testid="text-title">
          <a 
            href="#" 
            className="hover:text-primary transition-colors"
            onClick={handleViewDetails}
          >
            {scholarship.title}
          </a>
        </h3>
        
        <div className="flex flex-wrap gap-4 mb-3 text-sm text-gray-600">
          <span className="flex items-center" data-testid="text-amount">
            <DollarSign className="mr-1 h-4 w-4 text-secondary" />
            ${scholarship.amount.toLocaleString()}
          </span>
          <span className="flex items-center" data-testid="text-level">
            <GraduationCap className="mr-1 h-4 w-4 text-gray-400" />
            {scholarship.level === "all" ? "All Levels" : scholarship.level.charAt(0).toUpperCase() + scholarship.level.slice(1)}
          </span>
          {(scholarship.state || scholarship.city) && (
            <span className="flex items-center" data-testid="text-location">
              <MapPin className="mr-1 h-4 w-4 text-gray-400" />
              {scholarship.city ? `${scholarship.city}, ${scholarship.state || ""}` : `${scholarship.state} Residents`}
            </span>
          )}
        </div>
        
        <p className="text-gray-700 mb-4 line-clamp-3" data-testid="text-description">
          {scholarship.description}
        </p>
        
        {/* Provenance Information */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 flex items-center" data-testid="text-source">
              <ExternalLink className="mr-1 h-3 w-3" />
              Source: {scholarship.sourceOrganization || "Scholarship Provider"}
            </span>
            <span className="text-gray-500" data-testid="text-last-updated">
              Last updated: {new Date(scholarship.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          {isUrgent ? (
            <Button 
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              onClick={handleApplyClick}
              data-testid="button-urgent-apply"
            >
              <Send className="mr-2 h-4 w-4" />
              Apply Now (Due Soon!)
            </Button>
          ) : scholarship.isFeatured ? (
            <Button 
              className="flex-1"
              onClick={handleApplyClick}
              data-testid="button-apply"
            >
              <Send className="mr-2 h-4 w-4" />
              Apply on Platform
            </Button>
          ) : (
            <Button 
              className="flex-1"
              onClick={handleGetMatches}
              data-testid="button-get-matches"
            >
              <Star className="mr-2 h-4 w-4" />
              Get Matches
            </Button>
          )}
          
          <Button 
            variant={scholarship.isFeatured ? "outline" : "secondary"}
            className="flex-1"
            onClick={scholarship.isFeatured ? handleSaveClick : handleViewDetails}
            data-testid={scholarship.isFeatured ? "button-save" : "button-view-details"}
          >
            {scholarship.isFeatured ? (
              <>
                <Bookmark className={`mr-2 h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
                {isSaved ? "Saved" : "Save for Later"}
              </>
            ) : (
              <>
                <ExternalLink className="mr-2 h-4 w-4" />
                View Details
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
