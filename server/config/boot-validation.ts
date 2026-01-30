/**
 * CEO DIRECTIVE (Nov 13): Boot-time Environment Validation
 * Gate 0 Requirement: Fail-fast on missing required environment variables
 * 
 * This module validates all required environment variables at application startup
 * and exits immediately with actionable error messages if any are missing.
 */

interface ValidationError {
  variable: string;
  reason: string;
  severity: 'fatal' | 'warning';
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Validate required environment variables for auto_com_center
 */
export function validateEnvironment(): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const env = process.env.NODE_ENV || 'development';

  // Helper to check required variables
  const requireVar = (name: string, reason: string) => {
    if (!process.env[name]) {
      errors.push({ variable: name, reason, severity: 'fatal' });
    }
  };

  // Helper to warn about optional but recommended variables
  const warnVar = (name: string, reason: string) => {
    if (!process.env[name]) {
      warnings.push({ variable: name, reason, severity: 'warning' });
    }
  };

  // === PRODUCTION REQUIREMENTS ===
  if (env === 'production') {
    // Gate 0: Service Identity
    requireVar('APP_BASE_URL', 'Required for service identity and CORS verification');
    requireVar('SERVICE_NAME', 'Required for structured logging and monitoring');

    // Gate 0: CORS Configuration (Frontend Origins)
    requireVar('FRONTEND_ORIGINS', 'Required for CORS allowlist - comma-separated frontend URLs');

    // Gate 0: Database
    if (!process.env.DATABASE_URL && !process.env.USE_SAMPLE_DATA) {
      errors.push({
        variable: 'DATABASE_URL',
        reason: 'Required in production unless USE_SAMPLE_DATA=true (not recommended)',
        severity: 'fatal'
      });
    }

    // Gate 0: Service Discovery (Inter-service Communication)
    requireVar('AUTH_API_BASE_URL', 'Required for authentication service integration');
    requireVar('SCHOLARSHIP_API_BASE_URL', 'Required for scholarship data integration');
    requireVar('STUDENT_PILOT_BASE_URL', 'Required for student frontend redirects and links');
    requireVar('PROVIDER_REGISTER_BASE_URL', 'Required for provider frontend redirects and links');

    // Gate 1: Email Provider (at least one required)
    const hasEmailProvider = process.env.POSTMARK_API_KEY || process.env.SENDGRID_API_KEY;
    if (!hasEmailProvider) {
      errors.push({
        variable: 'POSTMARK_API_KEY or SENDGRID_API_KEY',
        reason: 'At least one email provider required for notification delivery',
        severity: 'fatal'
      });
    }

    // Gate 1: Agent Bridge (mandatory for service-to-service communication)
    if (!process.env.COMMAND_CENTER_URL && !process.env.AUTO_COM_CENTER_BASE_URL) {
      errors.push({
        variable: 'COMMAND_CENTER_URL or AUTO_COM_CENTER_BASE_URL',
        reason: 'Required for Agent Bridge service-to-service communication in production',
        severity: 'fatal'
      });
    }

    // Optional but recommended for full functionality
    warnVar('SAGE_API_BASE_URL', 'Recommendation service integration');
    warnVar('AGENT_API_BASE_URL', 'Automated task service integration');
    warnVar('AUTO_PAGE_MAKER_BASE_URL', 'Content generation service integration');
    warnVar('SHARED_SECRET', 'Agent Bridge inter-service authentication');
    warnVar('JWT_SECRET', 'Token-based authentication');
    warnVar('CSP_CONNECT_SRC', 'Content Security Policy connect-src directive');
  }

  // === DEVELOPMENT WARNINGS ===
  if (env === 'development') {
    if (!process.env.FRONTEND_ORIGINS && !process.env.CORS_ALLOWLIST) {
      warnings.push({
        variable: 'FRONTEND_ORIGINS or CORS_ALLOWLIST',
        reason: 'Recommended to test CORS configuration in development',
        severity: 'warning'
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Print validation results and exit if fatal errors found
 */
export function enforceEnvironmentValidation(): void {
  const result = validateEnvironment();
  const env = process.env.NODE_ENV || 'development';
  
  // Only fail-fast in true production (when explicitly deployed, not dev/preview)
  const isReplitDeployment = !!process.env.REPL_ID;
  const shouldFailFast = env === 'production' && !isReplitDeployment;

  if (result.warnings.length > 0) {
    console.warn('\n⚠️  [BOOT VALIDATION] Environment warnings:');
    result.warnings.forEach(warning => {
      console.warn(`   ❌ ${warning.variable}: ${warning.reason}`);
    });
    console.warn('');
  }

  if (!result.valid) {
    console.error('\n🚨 [BOOT VALIDATION] Missing required environment variables\n');
    console.error(`Environment: ${env}`);
    console.error(`Deployment Context: ${isReplitDeployment ? 'Replit Development/Preview' : 'Production'}`);
    console.error(`Missing ${result.errors.length} required variable(s):\n`);
    
    result.errors.forEach((error, index) => {
      console.error(`${index + 1}. ${error.variable}`);
      console.error(`   Reason: ${error.reason}\n`);
    });

    console.error('ACTION REQUIRED:');
    console.error('1. Set the missing environment variables in Replit Secrets (Tools > Secrets)');
    console.error('2. See evidence_root/env_and_auth_standards_2025-11-13.md for complete requirements');
    console.error('3. For email provider: Use the SendGrid integration in Replit\n');
    
    if (shouldFailFast) {
      console.error('Exiting to prevent misconfigured production deployment...\n');
      process.exit(1);
    } else {
      console.warn('⚠️  Continuing with degraded functionality for development/preview...\n');
      console.warn('⚠️  Set required variables before publishing to production!\n');
    }
    return;
  }

  console.log('✅ [BOOT VALIDATION] Environment validation passed');
  if (result.warnings.length === 0) {
    console.log('✅ [BOOT VALIDATION] All recommended variables configured\n');
  }
}

/**
 * Get current environment configuration summary (for /api/config endpoint)
 */
export function getEnvironmentSummary() {
  const result = validateEnvironment();
  
  return {
    environment: process.env.NODE_ENV || 'development',
    valid: result.valid,
    configured: {
      service_identity: !!process.env.APP_BASE_URL,
      cors: !!process.env.FRONTEND_ORIGINS || !!process.env.CORS_ALLOWLIST,
      database: !!process.env.DATABASE_URL,
      auth_service: !!process.env.AUTH_API_BASE_URL,
      api_service: !!process.env.SCHOLARSHIP_API_BASE_URL,
      frontends: {
        student: !!process.env.STUDENT_PILOT_BASE_URL,
        provider: !!process.env.PROVIDER_REGISTER_BASE_URL
      },
      email: {
        postmark: !!process.env.POSTMARK_API_KEY,
        sendgrid: !!process.env.SENDGRID_API_KEY
      },
      optional_services: {
        sage: !!process.env.SAGE_API_BASE_URL,
        agent: !!process.env.AGENT_API_BASE_URL,
        page_maker: !!process.env.AUTO_PAGE_MAKER_BASE_URL,
        command_center: !!process.env.COMMAND_CENTER_URL
      }
    },
    errors: result.errors,
    warnings: result.warnings
  };
}
