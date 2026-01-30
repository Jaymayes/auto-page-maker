import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";

const BRAND_NAME = "Scholar AI Advisor";
const COMPANY_LEGAL_NAME = "Referral Service LLC";
const MAIN_SITE_URL = "https://scholaraiadvisor.com";
const APP_BASE_URL = "https://auto-page-maker-jamarrlmayes.replit.app";
const APP_NAME = "auto_page_maker";
const CONTACT_EMAIL = "support@referralsvc.com";
const CONTACT_PHONE = "602-796-0177";
const CONTACT_ADDRESS = "16031 N 171st Ln, Surprise, AZ 85388, USA";
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

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Helmet>
        <title>Terms of Service | {BRAND_NAME} – {APP_NAME}</title>
        <meta name="description" content={`Terms of Service for ${BRAND_NAME} by ${COMPANY_LEGAL_NAME}. Read our terms governing the use of our scholarship discovery platform.`} />
        <link rel="canonical" href={`${APP_BASE_URL}/terms`} />
        <meta property="og:title" content={`Terms of Service | ${BRAND_NAME}`} />
        <meta property="og:description" content={`Terms of Service for ${BRAND_NAME}. Read our terms and conditions.`} />
        <meta property="og:url" content={`${APP_BASE_URL}/terms`} />
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
              <FileText className="h-8 w-8 text-primary mr-3" aria-hidden="true" />
              <h1 className="text-3xl font-bold text-gray-900" data-testid="text-title">
                Terms of Service
              </h1>
            </header>

            <div className="prose prose-gray max-w-none">
              <p className="text-gray-600 mb-6">
                <strong>Effective Date:</strong> {EFFECTIVE_DATE}
              </p>

              <section className="mb-8" aria-labelledby="agreement">
                <h2 id="agreement" className="text-2xl font-semibold text-gray-900 mb-4">Agreement</h2>
                <p className="text-gray-700 mb-4">
                  These Terms govern your use of {BRAND_NAME} at{" "}
                  <a href={MAIN_SITE_URL} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                    {MAIN_SITE_URL}
                  </a>{" "}
                  and this app at{" "}
                  <a href={APP_BASE_URL} className="text-primary hover:underline">
                    {APP_BASE_URL}
                  </a>. By using the services, you agree to these Terms.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="eligibility">
                <h2 id="eligibility" className="text-2xl font-semibold text-gray-900 mb-4">Eligibility and Accounts</h2>
                <p className="text-gray-700 mb-4">
                  You are responsible for your credentials and keeping your account secure. You must be of legal age to form a binding contract or have appropriate consent.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="services">
                <h2 id="services" className="text-2xl font-semibold text-gray-900 mb-4">Services and AI Assistance</h2>
                <p className="text-gray-700 mb-4">
                  Our tools provide scholarship discovery, matching, content drafting, and workflow support. AI outputs may contain errors; review and verify before submitting applications. Do not use the services to cheat or commit academic misconduct.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="user-content">
                <h2 id="user-content" className="text-2xl font-semibold text-gray-900 mb-4">User Content and Licenses</h2>
                <p className="text-gray-700 mb-4">
                  You retain your content. You grant us a limited license to host/process your content solely to provide the services.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="providers">
                <h2 id="providers" className="text-2xl font-semibold text-gray-900 mb-4">Providers</h2>
                <p className="text-gray-700 mb-4">
                  Providers submitting scholarships represent they have rights to publish the content and consent to display it. Platform fees may apply.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="payments">
                <h2 id="payments" className="text-2xl font-semibold text-gray-900 mb-4">Payments</h2>
                <p className="text-gray-700 mb-4">
                  Prices, credits, and fees are shown at purchase. Taxes may apply. All sales are subject to our refund policy if provided in the app.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="prohibited">
                <h2 id="prohibited" className="text-2xl font-semibold text-gray-900 mb-4">Prohibited Uses</h2>
                <p className="text-gray-700 mb-4">
                  Abuse, reverse engineering, unauthorized scraping, security testing without permission, violating law, infringing IP, or harassing others.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="ip">
                <h2 id="ip" className="text-2xl font-semibold text-gray-900 mb-4">Intellectual Property</h2>
                <p className="text-gray-700 mb-4">
                  {BRAND_NAME} and its software, trademarks, and content are owned by {COMPANY_LEGAL_NAME} or licensors.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="disclaimers">
                <h2 id="disclaimers" className="text-2xl font-semibold text-gray-900 mb-4">Disclaimers</h2>
                <p className="text-gray-700 mb-4">
                  Services are provided "as is" and "as available." We disclaim warranties to the fullest extent permitted by law.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="liability">
                <h2 id="liability" className="text-2xl font-semibold text-gray-900 mb-4">Limitation of Liability</h2>
                <p className="text-gray-700 mb-4">
                  To the maximum extent permitted, we are not liable for indirect, incidental, consequential, or special damages. Our aggregate liability is limited to the amounts you paid in the 12 months prior to the claim.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="indemnity">
                <h2 id="indemnity" className="text-2xl font-semibold text-gray-900 mb-4">Indemnity</h2>
                <p className="text-gray-700 mb-4">
                  You agree to indemnify us for claims arising from your misuse of the services or violation of these Terms.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="termination">
                <h2 id="termination" className="text-2xl font-semibold text-gray-900 mb-4">Termination</h2>
                <p className="text-gray-700 mb-4">
                  We may suspend or terminate accounts for violations or risks to the platform. You may stop using the services at any time.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="governing-law">
                <h2 id="governing-law" className="text-2xl font-semibold text-gray-900 mb-4">Governing Law and Venue</h2>
                <p className="text-gray-700 mb-4">
                  Arizona law governs. Venue lies in Maricopa County, Arizona. If we offer arbitration terms, they will be presented separately.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="changes">
                <h2 id="changes" className="text-2xl font-semibold text-gray-900 mb-4">Changes</h2>
                <p className="text-gray-700 mb-4">
                  We may update these Terms and will post the new Effective Date.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="contact">
                <h2 id="contact" className="text-2xl font-semibold text-gray-900 mb-4">Contact</h2>
                <address className="text-gray-700 not-italic">
                  <p className="mb-2"><strong>{COMPANY_LEGAL_NAME}</strong></p>
                  <p className="mb-2">{CONTACT_ADDRESS}</p>
                  <p className="mb-2">
                    Email:{" "}
                    <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
                      {CONTACT_EMAIL}
                    </a>
                  </p>
                  <p>
                    Phone:{" "}
                    <a href={`tel:${CONTACT_PHONE}`} className="text-primary hover:underline">
                      {CONTACT_PHONE}
                    </a>
                  </p>
                </address>
              </section>
            </div>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
}
