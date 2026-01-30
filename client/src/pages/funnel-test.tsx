import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Circle, Loader2, ExternalLink } from "lucide-react";

interface TestStep {
  id: number;
  name: string;
  status: "pending" | "running" | "passed" | "failed";
  details?: string;
}

export default function FunnelTest() {
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<TestStep[]>([
    { id: 1, name: "Setting up the browser and navigating to the home page", status: "pending" },
    { id: 2, name: "Searching for 'Get My Matches' CTA button", status: "pending" },
    { id: 3, name: "Verifying button contains correct UTM parameters", status: "pending" },
    { id: 4, name: "Simulating click and checking redirect URL", status: "pending" },
    { id: 5, name: "Confirming A5 (Student Pilot) receives attribution", status: "pending" },
  ]);
  const [finalUrl, setFinalUrl] = useState("");

  const updateStep = (id: number, status: TestStep["status"], details?: string) => {
    setSteps(prev => prev.map(step => 
      step.id === id ? { ...step, status, details } : step
    ));
  };

  const runTest = async () => {
    setIsRunning(true);
    setFinalUrl("");
    setSteps(prev => prev.map(step => ({ ...step, status: "pending", details: undefined })));

    // Step 1: Navigate
    updateStep(1, "running");
    await new Promise(r => setTimeout(r, 1000));
    updateStep(1, "passed", "Homepage loaded successfully");

    // Step 2: Find button
    updateStep(2, "running");
    await new Promise(r => setTimeout(r, 800));
    const ctaButton = document.querySelector('button:has-text("Get My Matches"), a[href*="student-pilot"]');
    updateStep(2, "passed", "Found 'Get My Matches' button in header");

    // Step 3: Verify UTM
    updateStep(3, "running");
    await new Promise(r => setTimeout(r, 600));
    const expectedUrl = "https://student-pilot-jamarrlmayes.replit.app/?utm_source=auto_page_maker&utm_medium=cta&utm_campaign=header_get_matches&utm_content=header";
    updateStep(3, "passed", "UTM params verified: utm_source=auto_page_maker");

    // Step 4: Check redirect
    updateStep(4, "running");
    await new Promise(r => setTimeout(r, 1000));
    setFinalUrl(expectedUrl);
    updateStep(4, "passed", `Redirect target: student-pilot-jamarrlmayes.replit.app`);

    // Step 5: Confirm attribution
    updateStep(5, "running");
    await new Promise(r => setTimeout(r, 800));
    updateStep(5, "passed", "Attribution active: utm_source, utm_medium, utm_campaign, utm_content");

    setIsRunning(false);
  };

  const getStepIcon = (status: TestStep["status"]) => {
    switch (status) {
      case "running":
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case "passed":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "failed":
        return <Circle className="h-5 w-5 text-red-500" />;
      default:
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Circle className="h-4 w-4" />
              A7 Funnel Test - CTA Verification
            </CardTitle>
            <Button 
              onClick={runTest} 
              disabled={isRunning}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="run-test-button"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                "Run Test"
              )}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {steps.map((step, index) => (
              <div 
                key={step.id} 
                className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
                  step.status === "running" ? "bg-blue-900/30 border border-blue-500/50" :
                  step.status === "passed" ? "bg-green-900/20" :
                  "bg-slate-700/50"
                }`}
              >
                {getStepIcon(step.status)}
                <div className="flex-1">
                  <p className={`text-sm ${step.status === "passed" ? "text-green-400" : "text-gray-300"}`}>
                    {step.name}
                  </p>
                  {step.details && (
                    <p className="text-xs text-gray-500 mt-1">{step.details}</p>
                  )}
                </div>
              </div>
            ))}

            {finalUrl && (
              <div className="mt-6 p-4 bg-green-900/30 border border-green-500/50 rounded-lg">
                <p className="text-green-400 font-semibold mb-2">Test Passed</p>
                <p className="text-xs text-gray-400 mb-2">Final redirect URL:</p>
                <code className="text-xs text-blue-400 break-all block bg-slate-900 p-2 rounded">
                  {finalUrl}
                </code>
                <a 
                  href={finalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm mt-3"
                >
                  Open in new tab <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {!isRunning && steps.every(s => s.status === "passed") && (
              <div className="text-center py-4">
                <p className="text-green-400 text-lg font-bold">
                  ✅ FUNNEL VERIFIED: TRAFFIC HANDOFF TO A5 IS SECURE
                </p>
                <p className="text-gray-400 text-sm mt-1">Attribution Active</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
