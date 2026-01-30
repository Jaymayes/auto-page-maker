import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Search, ChevronDown } from "@/icons";
import { trackEvent } from "@/lib/analytics";
import logoUrl from "@assets/scholar-ai-logo.png";

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleStudentCTA = () => {
    trackEvent("click_student_pilot_cta", "cta", "header");
    window.location.href = "https://student-pilot-jamarrlmayes.replit.app/?utm_source=auto_page_maker&utm_medium=cta&utm_campaign=header_get_matches&utm_content=header";
  };

  const handleProviderCTA = () => {
    trackEvent("click_provider_register_cta", "cta", "header");
    window.location.href = "https://provider-register-jamarrlmayes.replit.app/?utm_source=auto_page_maker&utm_medium=cta&utm_campaign=provider_signup&utm_content=header";
  };

  const handleMenuClick = (item: string) => {
    trackEvent("click", "navigation", item);
    setIsMobileMenuOpen(false);
    // TODO: Navigate to appropriate page
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <a 
                href="/"
                className="flex items-center gap-2"
                onClick={() => trackEvent("click", "navigation", "logo")}
                data-testid="link-logo"
              >
                <img 
                  src={logoUrl} 
                  alt="Scholar AI Advisor Logo" 
                  className="h-12 w-12"
                />
                <span className="text-xl font-bold text-primary">
                  Scholar AI
                </span>
              </a>
            </div>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            <div className="relative group">
              <button 
                className="text-gray-700 hover:text-primary transition-colors flex items-center"
                onClick={() => handleMenuClick("browse_scholarships")}
                data-testid="button-browse-scholarships"
              >
                Browse Scholarships
                <ChevronDown className="ml-1 h-4 w-4" />
              </button>
              {/* TODO: Add dropdown menu */}
            </div>
            <a 
              href="#" 
              className="text-gray-700 hover:text-primary transition-colors"
              onClick={() => handleMenuClick("how_it_works")}
              data-testid="link-how-it-works"
            >
              How It Works
            </a>
            <a 
              href="#" 
              className="text-gray-700 hover:text-primary transition-colors"
              onClick={() => handleMenuClick("for_schools")}
              data-testid="link-for-schools"
            >
              For Schools
            </a>
          </nav>
          
          {/* Desktop CTA Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <Button 
              variant="outline" 
              onClick={handleProviderCTA}
              data-testid="button-list-scholarship"
              aria-label="List a Scholarship — Provider registration"
              className="min-h-[48px]"
            >
              List a Scholarship
            </Button>
            <Button 
              onClick={handleStudentCTA}
              data-testid="header-get-matches"
              aria-label="Get My Matches — Student pilot"
              className="min-h-[48px]"
            >
              Get My Matches
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-b border-gray-200">
            <a
              href="#"
              className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-primary hover:bg-gray-50 rounded-md transition-colors"
              onClick={() => handleMenuClick("browse_scholarships")}
              data-testid="link-mobile-browse-scholarships"
            >
              Browse Scholarships
            </a>
            <a
              href="#"
              className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-primary hover:bg-gray-50 rounded-md transition-colors"
              onClick={() => handleMenuClick("how_it_works")}
              data-testid="link-mobile-how-it-works"
            >
              How It Works
            </a>
            <a
              href="#"
              className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-primary hover:bg-gray-50 rounded-md transition-colors"
              onClick={() => handleMenuClick("for_schools")}
              data-testid="link-mobile-for-schools"
            >
              For Schools
            </a>
            <div className="border-t border-gray-200 pt-3 mt-3">
              <Button 
                variant="outline" 
                className="w-full mb-2 min-h-[48px]"
                onClick={handleProviderCTA}
                data-testid="button-mobile-list-scholarship"
                aria-label="List a Scholarship — Provider registration"
              >
                List a Scholarship
              </Button>
              <Button 
                className="w-full min-h-[48px]"
                onClick={handleStudentCTA}
                data-testid="header-mobile-get-matches"
                aria-label="Get My Matches — Student pilot"
              >
                Get My Matches
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
