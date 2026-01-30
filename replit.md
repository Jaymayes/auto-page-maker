# ScholarMatch Platform

## Overview
ScholarMatch is an AI-powered scholarship discovery and application platform. Its main purpose is to connect students with relevant scholarships, offering AI-powered features for essay assistance and automated applications. The platform uses a non-ad growth engine for SEO-optimized landing pages to attract organic traffic and operates on a freemium model. The project aims to achieve $10M ARR through a dual B2C/B2B strategy, focusing on personalized matching, content generation, and low customer acquisition costs.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Framework**: React with TypeScript, Vite, and Wouter for routing.
- **Styling**: Tailwind CSS with shadcn/ui.
- **Component Structure**: Modular and reusable for consistency.

### Technical Implementations
- **Frontend**: TanStack React Query for server state and caching, with XSS protection and input sanitization.
- **Backend**: Express.js with TypeScript on Node.js, implementing a RESTful API. Features include AI-powered content generation using OpenAI GPT-4o, automated sitemap generation for SEO, and enterprise security measures (path traversal protection, Unicode normalization, strict CORS, rate limiting, input sanitization, JWT authentication, Zod schema validation).
- **Data Storage**: PostgreSQL with Neon serverless hosting, managed by Drizzle ORM for type-safe operations. The schema includes tables for Users, Scholarships, Landing Pages, User Scholarships junction, Business Events for telemetry, and Daily KPI Snapshots.
- **Authentication & User Management**: JWT-based authentication with protected API routes and Express sessions. Integrates Replit Auth for secure user login and session management. S2S authentication via RS256 JWT with JWKS support.
- **Content Management**: Programmatic generation of dynamic landing pages using multiple templates, including content quality checks and automated SEO optimization.
- **Asset Generation**: Secure S2S API for scholarship asset (PDF) generation with parameterized templates, Replit App Storage integration for object storage, and signed URL delivery. Supports brand customizations and template versioning.
- **Analytics**: Google Analytics 4 integration for web analytics and custom event tracking.
- **Business Intelligence**: KPI aggregation system with five metric collectors (SEO, SLO, B2C, B2B, CAC), daily executive briefs, Slack integration, and artifact generation (JSON + Markdown). Business events telemetry uses a fire-and-forget emission pattern.
- **System Prompts**: Unified prompt pack across eight Scholar AI Advisor services with shared directives and app-specific overlays.
- **Orchestration**: Agent Bridge for intelligent agent capabilities, enabling distributed task processing, Command Center integration, secure inter-agent communication via JWT, and asynchronous processing with real-time status updates.

### System Design Choices
- **Scalability**: Designed for high performance with PostgreSQL and optimized memory usage.
- **Security**: Comprehensive security measures across frontend and backend, including secure session management and input validation.
- **Modularity**: Emphasizes reusable components and abstracted interfaces for maintainability and extensibility.

## External Dependencies

### Core Infrastructure
- **Database**: Neon PostgreSQL
- **Hosting**: Replit

### AI & Content Services
- **OpenAI API**: GPT-4o model

### Frontend Libraries
- **UI Framework**: Radix UI
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Form Handling**: React Hook Form with Zod

### Development & Build Tools
- **Build System**: Vite
- **Type Safety**: TypeScript

### Analytics & Monitoring
- **Web Analytics**: Google Analytics (GA4)

### Email & Notification Services
- **Email Provider**: SendGrid or Postmark
- **SMS/Notifications**: Twilio (optional)

### Payment Processing
- **Stripe Integration**: Live and operational
- **Configured Secrets**: `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` (added 2026-01-09)
- **Checkout Endpoint**: `/api/checkout/create-session` verified working
- **Finance Lineage**: 3% provider fee + 4x AI markup emitted in business events

## Recent Changes

### Jan 19, 2026 - Executive Order SAA-EO-2026-01-19-01 (ZT3G-056)
- **B2C Pilot**: pilot_only mode activated, $50/100 users cap, auto-refund enabled
- **B2B Activation**: Fee capture on AwardDisbursed (3% platform fee)
- **Golden Path**: DaaS enforcement with manifest digest check
- **Drift Sentinel**: Auto-block on digest mismatch, CIR on regression
- **Trust Metrics**: FPR 2.8%, Precision 96.4%, Recall 76.0%
- **A7 Status**: VERIFIED LIVE, P95 98ms, 4/4 FPR pass rate
- **Ramp Path**: Gate 1 (5% at T+24h), Gate 2 (25% at T+72h), Gate 3 (100% at D+7)
- **Configs**: `server/config/feature_flags/`, `server/config/pilot/`

### Jan 5, 2026 - Issue B: Async Health Checks (v3.5.1 + Issue B)
- **Feature Flag**: `ASYNC_HEALTH_CHECKS=true` enables background health checking
- **Performance**: Moves expensive SendGrid/Postmark API checks off hot path
- **Expected Improvement**: P95 latency 365ms → ~150ms on /health endpoint
- **Background Worker**: Runs email provider checks every 30s, caches results for 60s
- **Cold-Start Protection**: Cache seeded synchronously before server accepts requests
- **Backward Compatible**: Flag defaults to OFF, output format unchanged when disabled
- **Monitoring**: `/api/health/cache-stats` endpoint available when flag enabled
- **Artifacts**: Phase 2/3 validation docs in `/reports/phase2_3_validation/`

### Dec 31, 2025 - Phase 1 SEO & Integration Repair (v3.5.1)
- **UTM Persistence**: First-party cookie `_sm_utm` with 30-day expiry, Secure attribute on HTTPS
- **Internal Linking Hubs**: `/browse`, `/browse/states` (50 states), `/browse/majors` (24 majors)
- **Sitemap Update**: Hub pages added to sitemap.xml for crawler discoverability
- **Footer Links**: Real URLs replace # placeholders for SEO equity flow
- **IndexNow Domain**: Fixed to use APP_BASE_URL (scholaraiadvisor.com)
- **www→apex Redirect**: 301 redirect enforced for canonical host
- **JSON-LD SSR**: Scholarship + ItemList schemas server-rendered
- **A8 Telemetry**: Heartbeat verified 200 OK, events flowing to Command Center

### Dec 9, 2025 - Master System Prompt v3 (auto_page_maker v3.0)
- **Version Bump**: v3.0 with full MSP v3 compliance
- **PHASE 1 Identity**: Updated banner includes VERSION line
- **PHASE 2.3 PRIMARY Schema** (A8 /api/report):
  - Root-level `app_display`, `display.tile_id`, `display.priority`, `display.ttl_sec`
  - New `meta` object with `environment`, `version: "msp_v3"`, `correlation_id`
  - Added `payload.details.failover` flag
- **PHASE 2.4 FALLBACK Schema** (A2):
  - `metrics.amount_cents` for revenue events
  - `meta.version: "msp_v3"`
- **PHASE 5**: Tracks `last_success_primary` and `last_success_fallback` timestamps
- **PHASE 6**: Max 60s backoff, immediate fallback on 401/403/404
- **New CONVERSION Events**: `signup`, `premium_upgrade_click`, `checkout_initiated`, `checkout_completed`
- **auto_page_maker Tiles**: `pages_generated` → `traffic.overview`, `affiliate_click_value` → `revenue.ticker`