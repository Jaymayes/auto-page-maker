import { Check, Users, TrendingUp } from "@/icons";
import { Shield } from "lucide-react";

interface EEATSignalsProps {
  scholarshipCount?: number;
  totalAmount?: number;
  lastUpdated?: string;
  category?: string;
}

/**
 * E-E-A-T Signals Component
 * Implements Google's Experience, Expertise, Authoritativeness, and Trustworthiness signals
 */
export function EEATSignals({ 
  scholarshipCount = 0, 
  totalAmount = 0,
  lastUpdated,
  category = "scholarships"
}: EEATSignalsProps) {
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return new Date().toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <div className="bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/10 rounded-xl p-6 mb-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Experience Signal: Real Data */}
        <div className="flex items-start space-x-3" data-testid="eeat-experience">
          <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {scholarshipCount}+
            </div>
            <div className="text-sm text-gray-600">
              Active Scholarships
            </div>
          </div>
        </div>

        {/* Expertise Signal: Total Award Amount */}
        <div className="flex items-start space-x-3" data-testid="eeat-expertise">
          <div className="flex-shrink-0 w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center">
            <Check className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(totalAmount)}
            </div>
            <div className="text-sm text-gray-600">
              Total Award Value
            </div>
          </div>
        </div>

        {/* Authoritativeness Signal: AI-Powered */}
        <div className="flex items-start space-x-3" data-testid="eeat-authority">
          <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">
              AI-Powered
            </div>
            <div className="text-sm text-gray-600">
              Smart Matching
            </div>
          </div>
        </div>

        {/* Trustworthiness Signal: Verified & Updated */}
        <div className="flex items-start space-x-3" data-testid="eeat-trust">
          <div className="flex-shrink-0 w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center">
            <Shield className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">
              Verified Data
            </div>
            <div className="text-xs text-gray-600">
              Updated {formatDate(lastUpdated)}
            </div>
          </div>
        </div>
      </div>

      {/* Additional Trust Indicators */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            <span>No hidden fees</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            <span>Real-time updates</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            <span>Verified sources</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            <span>Secure platform</span>
          </div>
        </div>
      </div>

      {/* Expert Byline (Authoritativeness) */}
      <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
        <p>
          <strong>Curated by ScholarMatch</strong> – Our AI-powered platform analyzes thousands of scholarship opportunities 
          daily to bring you the most relevant and up-to-date funding options. All data verified from official sources.
        </p>
      </div>
    </div>
  );
}
