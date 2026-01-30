import { Link } from "wouter";
import { trackEvent } from "@/lib/analytics";
import logoUrl from "@assets/scholar-ai-logo.png";

const BRAND_NAME = "Scholar AI Advisor";
const COMPANY_LEGAL_NAME = "Referral Service LLC";
const MAIN_SITE_URL = "https://scholaraiadvisor.com";
const CONTACT_EMAIL = "support@referralsvc.com";
const CONTACT_PHONE = "602-796-0177";
const CONTACT_ADDRESS = "16031 N 171st Ln, Surprise, AZ 85388, USA";
const COPYRIGHT_LINE = "2025 Referral Service LLC. All rights reserved.";

export default function Footer() {
  const handleLinkClick = (category: string, label: string) => {
    trackEvent("click", category, label);
  };

  const handleStudentCTA = () => {
    trackEvent("click_student_pilot_cta", "cta", "footer");
    window.open("https://student-pilot-jamarrlmayes.replit.app/?utm_source=auto_page_maker&utm_medium=organic&utm_campaign=pilot_launch&utm_content=footer_student", "_blank", "noopener");
  };

  const handleProviderCTA = () => {
    trackEvent("click_provider_register_cta", "cta", "footer");
    window.open("https://provider-register-jamarrlmayes.replit.app/?utm_source=auto_page_maker&utm_medium=organic&utm_campaign=pilot_launch&utm_content=footer_provider", "_blank", "noopener");
  };

  return (
    <footer className="bg-white border-t border-gray-200" role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img 
                src={logoUrl} 
                alt="Scholar AI Advisor Logo" 
                className="h-10 w-10"
              />
              <a 
                href={MAIN_SITE_URL} 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-bold text-xl text-primary hover:underline"
                data-testid="text-footer-brand"
              >
                {BRAND_NAME}
              </a>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Helping students find and apply to scholarships with AI-powered matching and automated application tools.
            </p>
            <address className="text-gray-500 text-xs not-italic mb-4">
              <p className="font-semibold">{COMPANY_LEGAL_NAME}</p>
              <p>{CONTACT_ADDRESS}</p>
              <p className="mt-1">
                <a 
                  href={`mailto:${CONTACT_EMAIL}`} 
                  className="hover:text-primary transition-colors"
                  data-testid="link-email"
                >
                  {CONTACT_EMAIL}
                </a>
              </p>
              <p>
                <a 
                  href={`tel:${CONTACT_PHONE}`} 
                  className="hover:text-primary transition-colors"
                  data-testid="link-phone"
                >
                  {CONTACT_PHONE}
                </a>
              </p>
            </address>
            <div className="flex space-x-4">
              <a 
                href="#" 
                className="text-gray-400 hover:text-primary transition-colors"
                onClick={() => handleLinkClick("social", "twitter")}
                data-testid="link-twitter"
                aria-label="Follow us on Twitter"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M6.29 18.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0020 3.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.073 4.073 0 01.8 7.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 010 16.407a11.616 11.616 0 006.29 1.84"/>
                </svg>
              </a>
              <a 
                href="#" 
                className="text-gray-400 hover:text-primary transition-colors"
                onClick={() => handleLinkClick("social", "facebook")}
                data-testid="link-facebook"
                aria-label="Follow us on Facebook"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M20 10C20 4.477 15.523 0 10 0S0 4.477 0 10c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V10h2.54V7.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V10h2.773l-.443 2.89h-2.33v6.988C16.343 19.128 20 14.991 20 10z" clipRule="evenodd"/>
                </svg>
              </a>
              <a 
                href="#" 
                className="text-gray-400 hover:text-primary transition-colors"
                onClick={() => handleLinkClick("social", "linkedin")}
                data-testid="link-linkedin"
                aria-label="Follow us on LinkedIn"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.338 16.338H13.67V12.16c0-.995-.017-2.277-1.387-2.277-1.39 0-1.601 1.086-1.601 2.207v4.248H8.014v-8.59h2.559v1.174h.037c.356-.675 1.227-1.387 2.526-1.387 2.703 0 3.203 1.778 3.203 4.092v4.711zM5.005 6.575a1.548 1.548 0 11-.003-3.096 1.548 1.548 0 01.003 3.096zm-1.337 9.763H6.34v-8.59H3.667v8.59zM17.668 1H2.328C1.595 1 1 1.581 1 2.298v15.403C1 18.418 1.595 19 2.328 19h15.34c.734 0 1.332-.582 1.332-1.299V2.298C19 1.581 18.402 1 17.668 1z" clipRule="evenodd"/>
                </svg>
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">For Students</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button 
                  onClick={handleStudentCTA}
                  className="text-gray-600 hover:text-primary transition-colors text-left min-h-[48px] inline-flex items-center"
                  data-testid="link-get-matches"
                  aria-label="Get My Matches — Student pilot"
                >
                  Get My Matches
                </button>
              </li>
              <li>
                <Link 
                  href="/browse/majors" 
                  className="text-gray-600 hover:text-primary transition-colors"
                  onClick={() => handleLinkClick("browse", "by_major")}
                  data-testid="link-by-major"
                >
                  By Major
                </Link>
              </li>
              <li>
                <Link 
                  href="/browse/states" 
                  className="text-gray-600 hover:text-primary transition-colors"
                  onClick={() => handleLinkClick("browse", "by_state")}
                  data-testid="link-by-state"
                >
                  By State
                </Link>
              </li>
              <li>
                <Link 
                  href="/browse" 
                  className="text-gray-600 hover:text-primary transition-colors"
                  onClick={() => handleLinkClick("browse", "browse_all")}
                  data-testid="link-browse-all"
                >
                  Browse All
                </Link>
              </li>
              <li>
                <Link 
                  href="/scholarships/no-essay-scholarships" 
                  className="text-gray-600 hover:text-primary transition-colors"
                  onClick={() => handleLinkClick("browse", "no_essay")}
                  data-testid="link-no-essay"
                >
                  No Essay Required
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">For Providers</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button 
                  onClick={handleProviderCTA}
                  className="text-gray-600 hover:text-primary transition-colors text-left min-h-[48px] inline-flex items-center"
                  data-testid="link-list-scholarship"
                  aria-label="List a Scholarship — Provider registration"
                >
                  List a Scholarship
                </button>
              </li>
              <li>
                <Link 
                  href="/scholarships/computer-science" 
                  className="text-gray-600 hover:text-primary transition-colors"
                  onClick={() => handleLinkClick("category", "computer_science")}
                  data-testid="link-computer-science"
                >
                  Computer Science
                </Link>
              </li>
              <li>
                <Link 
                  href="/scholarships/engineering" 
                  className="text-gray-600 hover:text-primary transition-colors"
                  onClick={() => handleLinkClick("category", "engineering")}
                  data-testid="link-engineering"
                >
                  Engineering
                </Link>
              </li>
              <li>
                <Link 
                  href="/scholarships/business" 
                  className="text-gray-600 hover:text-primary transition-colors"
                  onClick={() => handleLinkClick("category", "business")}
                  data-testid="link-business"
                >
                  Business
                </Link>
              </li>
              <li>
                <Link 
                  href="/scholarships/nursing" 
                  className="text-gray-600 hover:text-primary transition-colors"
                  onClick={() => handleLinkClick("category", "nursing")}
                  data-testid="link-nursing"
                >
                  Nursing
                </Link>
              </li>
            </ul>
          </div>
          
          <nav aria-label="Legal and Support Links">
            <h4 className="font-semibold text-gray-900 mb-4">Legal &amp; Support</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a 
                  href="#" 
                  className="text-gray-600 hover:text-primary transition-colors"
                  onClick={() => handleLinkClick("support", "help_center")}
                  data-testid="link-help-center"
                >
                  Help Center
                </a>
              </li>
              <li>
                <a 
                  href={`mailto:${CONTACT_EMAIL}`} 
                  className="text-gray-600 hover:text-primary transition-colors"
                  onClick={() => handleLinkClick("support", "contact")}
                  data-testid="link-contact"
                >
                  Contact Us
                </a>
              </li>
              <li>
                <Link 
                  href="/privacy" 
                  className="text-gray-600 hover:text-primary transition-colors"
                  onClick={() => handleLinkClick("legal", "privacy")}
                  data-testid="link-privacy"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link 
                  href="/terms" 
                  className="text-gray-600 hover:text-primary transition-colors"
                  onClick={() => handleLinkClick("legal", "terms")}
                  data-testid="link-terms"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link 
                  href="/accessibility" 
                  className="text-gray-600 hover:text-primary transition-colors"
                  onClick={() => handleLinkClick("legal", "accessibility")}
                  data-testid="link-accessibility"
                >
                  Accessibility Statement
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        
        <div className="border-t border-gray-200 pt-8 mt-8">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <p className="text-sm text-gray-500" data-testid="text-copyright">
              &copy; {COPYRIGHT_LINE}
            </p>
            <p className="text-sm text-gray-500 mt-2 sm:mt-0 flex items-center" data-testid="text-promise">
              <svg className="mr-1 h-4 w-4 text-secondary" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              100% Free for Students
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
