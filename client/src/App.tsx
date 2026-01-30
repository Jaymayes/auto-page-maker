import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, lazy, Suspense } from "react";
import { initGA } from "./lib/analytics";
import { useAnalytics } from "./hooks/use-analytics";
import { Skeleton } from "@/components/ui/skeleton";

const NotFound = lazy(() => import("@/pages/not-found"));
const Landing = lazy(() => import("@/pages/landing"));
const ScholarshipCategory = lazy(() => import("@/pages/scholarship-category"));
const ScholarshipDetail = lazy(() => import("@/pages/scholarship-detail"));
const ScholarshipsHub = lazy(() => import("@/pages/scholarships-hub"));
const Privacy = lazy(() => import("@/pages/privacy"));
const Terms = lazy(() => import("@/pages/terms"));
const Accessibility = lazy(() => import("@/pages/accessibility"));
const Pricing = lazy(() => import("@/pages/pricing"));
const Register = lazy(() => import("@/pages/register"));
const AdminAuditLogs = lazy(() => import("@/pages/admin-audit-logs"));
const FunnelTest = lazy(() => import("@/pages/funnel-test"));

function Router() {
  // Track page views when routes change
  useAnalytics();
  
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="space-y-4 w-full max-w-7xl px-4">
          <Skeleton className="h-12 w-3/4 mx-auto" />
          <Skeleton className="h-8 w-1/2 mx-auto" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    }>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/register" component={Register} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        <Route path="/accessibility" component={Accessibility} />
        <Route path="/admin/audit-logs" component={AdminAuditLogs} />
        <Route path="/funnel-test" component={FunnelTest} />
        <Route path="/browse/:type" component={ScholarshipsHub} />
        <Route path="/browse" component={ScholarshipsHub} />
        <Route path="/scholarship/:id" component={ScholarshipDetail} />
        <Route path="/scholarships/:rest*" component={ScholarshipCategory} />
        <Route path="/scholarships" component={ScholarshipCategory} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  // Initialize Google Analytics when app loads
  useEffect(() => {
    // LOW-001: Prevent GA warning spam
    const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
    if (!GA_ID && !(window as any).GA_WARNED) {
      console.warn('GA disabled: missing VITE_GA_MEASUREMENT_ID');
      (window as any).GA_WARNED = true;
    } else if (GA_ID) {
      initGA();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
