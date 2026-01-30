import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Accessibility } from "lucide-react";

const BRAND_NAME = "Scholar AI Advisor";
const COMPANY_LEGAL_NAME = "Referral Service LLC";
const MAIN_SITE_URL = "https://scholaraiadvisor.com";
const APP_BASE_URL = "https://auto-page-maker-jamarrlmayes.replit.app";
const APP_NAME = "auto_page_maker";
const CONTACT_EMAIL = "support@referralsvc.com";
const CONTACT_PHONE = "602-796-0177";
const EFFECTIVE_DATE = "2025-12-01";

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": COMPANY_LEGAL_NAME,
  "alternateName": BRAND_NAME,
  "url": MAIN_SITE_URL,
  "email": CONTACT_EMAIL,
  "telephone": CONTACT_PHONE,
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "16031 N 171st Ln",
    "addressLocality": "Surprise",
    "addressRegion": "AZ",
    "postalCode": "85388",
    "addressCountry": "USA"
  },
  "sameAs": [MAIN_SITE_URL]
};

export default function AccessibilityStatement() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Helmet>
        <title>Accessibility Statement | {BRAND_NAME} – {APP_NAME}</title>
        <meta name="description" content={`Accessibility Statement for ${BRAND_NAME} by ${COMPANY_LEGAL_NAME}. Learn about our commitment to digital accessibility and WCAG 2.1 AA conformance.`} />
        <link rel="canonical" href={`${APP_BASE_URL}/accessibility`} />
        <meta property="og:title" content={`Accessibility Statement | ${BRAND_NAME}`} />
        <meta property="og:description" content={`Accessibility Statement for ${BRAND_NAME}. Our commitment to digital accessibility.`} />
        <meta property="og:url" content={`${APP_BASE_URL}/accessibility`} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">
          {JSON.stringify(organizationJsonLd)}
        </script>
      </Helmet>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary text-white px-4 py-2 rounded z-50">
        Skip to main content
      </a>
      <Header />
      <main id="main-content" className="flex-1" role="main">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Link href="/">
            <Button variant="ghost" className="mb-6" data-testid="button-back">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Back to Home
            </Button>
          </Link>

          <article className="bg-white rounded-lg shadow-sm p-8">
            <header className="flex items-center mb-6">
              <Accessibility className="h-8 w-8 text-primary mr-3" aria-hidden="true" />
              <h1 className="text-3xl font-bold text-gray-900" data-testid="text-title">
                Accessibility Statement
              </h1>
            </header>

            <div className="prose prose-gray max-w-none">
              <p className="text-gray-600 mb-6">
                <strong>Effective Date:</strong> {EFFECTIVE_DATE}
              </p>

              <section className="mb-8" aria-labelledby="commitment">
                <h2 id="commitment" className="text-2xl font-semibold text-gray-900 mb-4">Our Commitment</h2>
                <p className="text-gray-700 mb-4">
                  {COMPANY_LEGAL_NAME} is committed to digital accessibility for all users. Our goal is WCAG 2.1 AA conformance across{" "}
                  <a href={MAIN_SITE_URL} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                    {MAIN_SITE_URL}
                  </a>{" "}
                  and this app at{" "}
                  <a href={APP_BASE_URL} className="text-primary hover:underline">
                    {APP_BASE_URL}
                  </a>.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="measures">
                <h2 id="measures" className="text-2xl font-semibold text-gray-900 mb-4">Measures We Take</h2>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  <li>Semantic HTML for proper document structure</li>
                  <li>Keyboard navigation support throughout the application</li>
                  <li>Sufficient color contrast ratios (minimum 4.5:1)</li>
                  <li>Descriptive links and alternative text for images</li>
                  <li>Focus management and visible focus indicators</li>
                  <li>Captions and transcripts where applicable</li>
                  <li>Regular accessibility audits and testing</li>
                </ul>
              </section>

              <section className="mb-8" aria-labelledby="limitations">
                <h2 id="limitations" className="text-2xl font-semibold text-gray-900 mb-4">Known Limitations</h2>
                <p className="text-gray-700 mb-4">
                  If any part of the service is not fully accessible, we will work to remediate promptly. We continuously monitor and improve our accessibility features.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="feedback">
                <h2 id="feedback" className="text-2xl font-semibold text-gray-900 mb-4">Feedback and Requests</h2>
                <p className="text-gray-700 mb-4">
                  If you encounter accessibility barriers or need an accommodation, please contact us:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  <li>
                    Email:{" "}
                    <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
                      {CONTACT_EMAIL}
                    </a>
                  </li>
                  <li>
                    Phone:{" "}
                    <a href={`tel:${CONTACT_PHONE}`} className="text-primary hover:underline">
                      {CONTACT_PHONE}
                    </a>
                  </li>
                </ul>
                <p className="text-gray-700 mt-4">
                  Please include the page URL and a description of the issue when reporting accessibility concerns.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="assessment">
                <h2 id="assessment" className="text-2xl font-semibold text-gray-900 mb-4">Assessment</h2>
                <p className="text-gray-700 mb-4">
                  We use automated and manual testing to evaluate accessibility. Our team receives training on accessibility best practices to ensure ongoing compliance.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="improvement">
                <h2 id="improvement" className="text-2xl font-semibold text-gray-900 mb-4">Continuous Improvement</h2>
                <p className="text-gray-700 mb-4">
                  We review this statement regularly and update the Effective Date when changes occur. Our commitment to accessibility is an ongoing effort to ensure all users can access our services.
                </p>
              </section>
            </div>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
}
