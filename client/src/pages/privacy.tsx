import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";

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

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Helmet>
        <title>Privacy Policy | {BRAND_NAME} – {APP_NAME}</title>
        <meta name="description" content={`Privacy Policy for ${BRAND_NAME} by ${COMPANY_LEGAL_NAME}. Learn how we collect, use, and protect your personal information.`} />
        <link rel="canonical" href={`${APP_BASE_URL}/privacy`} />
        <meta property="og:title" content={`Privacy Policy | ${BRAND_NAME}`} />
        <meta property="og:description" content={`Privacy Policy for ${BRAND_NAME}. Learn how we protect your personal information.`} />
        <meta property="og:url" content={`${APP_BASE_URL}/privacy`} />
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
              <Shield className="h-8 w-8 text-primary mr-3" aria-hidden="true" />
              <h1 className="text-3xl font-bold text-gray-900" data-testid="text-title">
                Privacy Policy
              </h1>
            </header>

            <div className="prose prose-gray max-w-none">
              <p className="text-gray-600 mb-6">
                <strong>Effective Date:</strong> {EFFECTIVE_DATE}
              </p>

              <section className="mb-8" aria-labelledby="who-we-are">
                <h2 id="who-we-are" className="text-2xl font-semibold text-gray-900 mb-4">Who We Are</h2>
                <p className="text-gray-700 mb-4">
                  {BRAND_NAME} is provided by {COMPANY_LEGAL_NAME} ("we," "us," "our") operating at{" "}
                  <a href={MAIN_SITE_URL} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                    {MAIN_SITE_URL}
                  </a>{" "}
                  and this app at{" "}
                  <a href={APP_BASE_URL} className="text-primary hover:underline">
                    {APP_BASE_URL}
                  </a>.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="what-we-do">
                <h2 id="what-we-do" className="text-2xl font-semibold text-gray-900 mb-4">What We Do</h2>
                <p className="text-gray-700 mb-4">
                  We help students and providers discover, manage, and apply for scholarships using AI-enabled tools.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="information-collected">
                <h2 id="information-collected" className="text-2xl font-semibold text-gray-900 mb-4">Information We Collect</h2>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  <li><strong>Account and profile data</strong> that users provide (name, email, school/academic info needed for scholarship matching).</li>
                  <li><strong>Usage and device data</strong> (log files, cookies, analytics).</li>
                  <li><strong>Payment and transaction data</strong> when credits or services are purchased; payments are processed by third-party processors.</li>
                  <li><strong>Provider data</strong> submitted to list or manage scholarships.</li>
                </ul>
              </section>

              <section className="mb-8" aria-labelledby="how-we-use">
                <h2 id="how-we-use" className="text-2xl font-semibold text-gray-900 mb-4">How We Use Data</h2>
                <p className="text-gray-700 mb-4">
                  To deliver and improve services, personalize recommendations, provide customer support, process transactions, detect/prevent fraud/abuse, maintain security, and comply with law.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="legal-bases">
                <h2 id="legal-bases" className="text-2xl font-semibold text-gray-900 mb-4">Legal Bases/Consent</h2>
                <p className="text-gray-700 mb-4">
                  We rely on user consent and legitimate interests; users may withdraw consent where applicable.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="cookies">
                <h2 id="cookies" className="text-2xl font-semibold text-gray-900 mb-4">Cookies/Tracking</h2>
                <p className="text-gray-700 mb-4">
                  We use essential cookies and analytics. Users can control cookies via browser settings.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="data-sharing">
                <h2 id="data-sharing" className="text-2xl font-semibold text-gray-900 mb-4">Data Sharing</h2>
                <p className="text-gray-700 mb-4">
                  Service providers (hosting, analytics, payments, email/SMS), compliance with legal requests, mergers/acquisitions. We do not sell personal information.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="ferpa-coppa">
                <h2 id="ferpa-coppa" className="text-2xl font-semibold text-gray-900 mb-4">FERPA/COPPA and Student Privacy</h2>
                <p className="text-gray-700 mb-4">
                  We design for student privacy. We do not knowingly collect personal information from children under 13. Education records are handled in accordance with applicable law and only with appropriate authorization.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="data-retention">
                <h2 id="data-retention" className="text-2xl font-semibold text-gray-900 mb-4">Data Retention</h2>
                <p className="text-gray-700 mb-4">
                  Kept only as long as necessary for the purposes above and to meet legal obligations.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="security">
                <h2 id="security" className="text-2xl font-semibold text-gray-900 mb-4">Security</h2>
                <p className="text-gray-700 mb-4">
                  Administrative, technical, and physical safeguards; no system is 100% secure.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="international">
                <h2 id="international" className="text-2xl font-semibold text-gray-900 mb-4">International Transfers</h2>
                <p className="text-gray-700 mb-4">
                  Where data crosses borders, we use appropriate safeguards as required by law.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="your-rights">
                <h2 id="your-rights" className="text-2xl font-semibold text-gray-900 mb-4">Your Rights</h2>
                <p className="text-gray-700 mb-4">
                  Access, correction, deletion, portability, restriction/objection (as applicable). Contact us at{" "}
                  <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
                    {CONTACT_EMAIL}
                  </a>.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="communications">
                <h2 id="communications" className="text-2xl font-semibold text-gray-900 mb-4">Communications</h2>
                <p className="text-gray-700 mb-4">
                  Users can opt out of non-essential emails/SMS; transactional messages may still occur.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="third-party">
                <h2 id="third-party" className="text-2xl font-semibold text-gray-900 mb-4">Third-Party Links</h2>
                <p className="text-gray-700 mb-4">
                  We are not responsible for third-party sites' privacy practices.
                </p>
              </section>

              <section className="mb-8" aria-labelledby="changes">
                <h2 id="changes" className="text-2xl font-semibold text-gray-900 mb-4">Changes</h2>
                <p className="text-gray-700 mb-4">
                  We will update this policy as needed and post the new Effective Date.
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
