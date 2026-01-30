# auto_com_center Gate 1 Hardening Implementation

**Prepared**: 2025-11-14 01:05:00 MST (T+5)  
**Ready for Application**: Upon workspace access  
**CEO Directive**: Env-driven templates, strict CORS, S2S auth, ESP/SMS prep, bounce monitoring  

---

## 1. Environment-Driven Template URLs

### server/services/emailTemplates.ts
```typescript
// Replace hardcoded URLs with environment variables

interface TemplateContext {
  studentPortalUrl: string;
  providerPortalUrl: string;
  scholarshipDetailUrl: (scholarshipId: string) => string;
  applicationUrl: (applicationId: string) => string;
  unsubscribeUrl: (userId: string) => string;
}

// Load from environment
const TEMPLATE_CONTEXT: TemplateContext = {
  studentPortalUrl: process.env.STUDENT_PILOT_BASE_URL || 'https://student-pilot-jamarrlmayes.replit.app',
  providerPortalUrl: process.env.PROVIDER_REGISTER_BASE_URL || 'https://provider-register-jamarrlmayes.replit.app',
  scholarshipDetailUrl: (scholarshipId: string) => 
    `${process.env.STUDENT_PILOT_BASE_URL}/scholarships/${scholarshipId}`,
  applicationUrl: (applicationId: string) => 
    `${process.env.STUDENT_PILOT_BASE_URL}/applications/${applicationId}`,
  unsubscribeUrl: (userId: string) => 
    `${process.env.AUTO_COM_CENTER_URL}/unsubscribe/${userId}`
};

// Validate required env vars on startup
export function validateTemplateConfig() {
  const required = [
    'STUDENT_PILOT_BASE_URL',
    'PROVIDER_REGISTER_BASE_URL',
    'AUTO_COM_CENTER_URL'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required template env vars: ${missing.join(', ')}`);
  }
}

// Email templates with dynamic URLs
export const emailTemplates = {
  applicationReceived: (data: ApplicationReceivedData) => ({
    subject: 'Application Received - {{scholarshipTitle}}',
    html: `
      <h2>Your Application Has Been Received</h2>
      <p>Dear {{studentName}},</p>
      <p>We've received your application for <strong>{{scholarshipTitle}}</strong>.</p>
      <p>
        <a href="${TEMPLATE_CONTEXT.applicationUrl('{{applicationId}}')}">
          View your application
        </a>
      </p>
      <p>Good luck!</p>
      <hr>
      <p><a href="${TEMPLATE_CONTEXT.unsubscribeUrl('{{userId}}')}">Unsubscribe</a></p>
    `
  }),
  
  scholarshipMatch: (data: ScholarshipMatchData) => ({
    subject: 'New Scholarship Match - {{scholarshipTitle}}',
    html: `
      <h2>We Found a Match!</h2>
      <p>Dear {{studentName}},</p>
      <p>Based on your profile, you're a great match for:</p>
      <h3>{{scholarshipTitle}}</h3>
      <p>Amount: ${{amount}}</p>
      <p>Deadline: {{deadline}}</p>
      <p>
        <a href="${TEMPLATE_CONTEXT.scholarshipDetailUrl('{{scholarshipId}}')}">
          View scholarship details
        </a>
      </p>
      <hr>
      <p><a href="${TEMPLATE_CONTEXT.unsubscribeUrl('{{userId}}')}">Unsubscribe</a></p>
    `
  }),
  
  deadlineReminder: (data: DeadlineReminderData) => ({
    subject: 'Deadline Approaching - {{scholarshipTitle}}',
    html: `
      <h2>Application Deadline in {{daysRemaining}} Days</h2>
      <p>Dear {{studentName}},</p>
      <p>The deadline for <strong>{{scholarshipTitle}}</strong> is approaching:</p>
      <p>Deadline: {{deadline}}</p>
      <p>
        <a href="${TEMPLATE_CONTEXT.applicationUrl('{{applicationId}}')}">
          Complete your application
        </a>
      </p>
      <hr>
      <p><a href="${TEMPLATE_CONTEXT.unsubscribeUrl('{{userId}}')}">Unsubscribe</a></p>
    `
  })
};
```

### Add to server/index.ts (startup validation)
```typescript
import { validateTemplateConfig } from './services/emailTemplates';

// Before starting server
validateTemplateConfig();
console.log('✓ Template configuration validated');
```

---

## 2. Strict CORS Allowlist

### server/middleware/cors.ts
```typescript
import cors from 'cors';

// CEO Requirement: Exact-origin match for student_pilot and provider_register only
const ALLOWED_ORIGINS = [
  process.env.STUDENT_PILOT_BASE_URL,
  process.env.PROVIDER_REGISTER_BASE_URL,
  // Staging (if applicable)
  process.env.STUDENT_PILOT_STAGING_URL,
  process.env.PROVIDER_REGISTER_STAGING_URL
].filter(Boolean); // Remove undefined values

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., server-to-server, curl)
    if (!origin) {
      return callback(null, true);
    }
    
    // Exact match only
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked: ${origin} not in allowlist`, {
        allowlist: ALLOWED_ORIGINS,
        blocked: origin
      });
      callback(new Error(`CORS policy: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID']
});

// Startup validation
export function validateCorsConfig() {
  if (ALLOWED_ORIGINS.length === 0) {
    throw new Error('CORS: No allowed origins configured. Set STUDENT_PILOT_BASE_URL and PROVIDER_REGISTER_BASE_URL');
  }
  
  // Check for wildcards (should never happen with env vars, but validate anyway)
  const hasWildcard = ALLOWED_ORIGINS.some(o => o.includes('*'));
  if (hasWildcard) {
    throw new Error('CORS: Wildcard origins not allowed. Use exact origins only.');
  }
  
  console.log('CORS allowlist configured:', ALLOWED_ORIGINS);
}
```

### Apply to server/index.ts
```typescript
import { corsMiddleware, validateCorsConfig } from './middleware/cors';

// Validate CORS config on startup
validateCorsConfig();

// Apply CORS middleware
app.use(corsMiddleware);
```

---

## 3. Service-to-Service Auth Scaffolding

### server/middleware/s2sAuth.ts
```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';

const AUTH_API_BASE_URL = process.env.AUTH_API_BASE_URL || 'https://scholar-auth-jamarrlmayes.replit.app';

// JWKS client for verifying service tokens
const jwksClient = new JwksClient({
  jwksUri: `${AUTH_API_BASE_URL}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 600000, // 10 minutes
  rateLimit: true
});

// Verify service-to-service JWT
export async function validateServiceToken(req: Request, res: Response, next: NextFunction) {
  const correlationId = req.headers['x-correlation-id'] as string || `s2s_${Date.now()}`;
  
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'MISSING_TOKEN',
        message: 'Service-to-service calls require JWT authentication'
      });
    }

    const token = authHeader.substring(7);
    
    // Decode header to get kid
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.header.kid) {
      return res.status(401).json({ 
        error: 'INVALID_TOKEN_HEADER',
        message: 'JWT header missing key ID'
      });
    }

    // Get signing key
    const key = await jwksClient.getSigningKey(decoded.header.kid);
    const signingKey = key.getPublicKey();

    // Verify token
    const verified = jwt.verify(token, signingKey, {
      algorithms: ['RS256'],
      issuer: AUTH_API_BASE_URL,
      audience: 'https://scholarmatch.com'
    }) as ServiceJWT;

    // Validate service claims (client_credentials grant)
    if (!verified.client_id || !verified.scope) {
      return res.status(401).json({ 
        error: 'INVALID_SERVICE_TOKEN',
        message: 'Token missing required service claims'
      });
    }

    // Attach service info to request
    req.service = {
      clientId: verified.client_id,
      scopes: verified.scope.split(' ')
    };
    
    console.log('S2S auth validated:', {
      correlationId,
      clientId: verified.client_id,
      scopes: verified.scope
    });
    
    next();
  } catch (error) {
    console.error('S2S auth error:', { correlationId, error: error.message });
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'TOKEN_EXPIRED',
        message: 'Service token has expired'
      });
    } else {
      return res.status(401).json({ 
        error: 'INVALID_SERVICE_TOKEN',
        message: error.message
      });
    }
  }
}

// Check if service has required scope
export function requireScope(...requiredScopes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.service) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const hasScopes = requiredScopes.every(s => req.service.scopes.includes(s));
    if (!hasScopes) {
      console.warn('Insufficient scopes:', {
        required: requiredScopes,
        actual: req.service.scopes,
        clientId: req.service.clientId
      });
      
      return res.status(403).json({ 
        error: 'FORBIDDEN',
        message: 'Insufficient permissions',
        required: requiredScopes
      });
    }

    next();
  };
}

interface ServiceJWT {
  client_id: string;
  scope: string;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
}

declare global {
  namespace Express {
    interface Request {
      service?: {
        clientId: string;
        scopes: string[];
      };
    }
  }
}
```

### Apply to protected routes
```typescript
import { validateServiceToken, requireScope } from './middleware/s2sAuth';

// Protect notification endpoints
app.post('/api/notifications/send', 
  validateServiceToken, 
  requireScope('communications.send'),
  async (req, res) => {
    // Handle notification
  }
);
```

---

## 4. SendGrid & Twilio Integration

### server/services/sendgrid.ts
```typescript
import sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'notifications@scholarmatch.com';
const SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME || 'ScholarMatch';

// Initialize SendGrid
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  console.log('✓ SendGrid initialized');
} else {
  console.warn('⚠ SendGrid API key not configured');
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  if (!SENDGRID_API_KEY) {
    throw new Error('SendGrid not configured');
  }

  const msg = {
    to: params.to,
    from: {
      email: SENDGRID_FROM_EMAIL,
      name: SENDGRID_FROM_NAME
    },
    subject: params.subject,
    html: params.html,
    text: params.text || stripHtml(params.html)
  };

  try {
    const response = await sgMail.send(msg);
    return {
      success: true,
      messageId: response[0].headers['x-message-id']
    };
  } catch (error) {
    console.error('SendGrid error:', error.response?.body || error.message);
    throw new Error(`Email send failed: ${error.message}`);
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}
```

### server/services/twilio.ts
```typescript
import twilio from 'twilio';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

let twilioClient: ReturnType<typeof twilio> | null = null;

if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  console.log('✓ Twilio initialized');
} else {
  console.warn('⚠ Twilio not configured');
}

export async function sendSMS(params: {
  to: string;
  body: string;
}) {
  if (!twilioClient || !TWILIO_PHONE_NUMBER) {
    throw new Error('Twilio not configured');
  }

  try {
    const message = await twilioClient.messages.create({
      to: params.to,
      from: TWILIO_PHONE_NUMBER,
      body: params.body
    });

    return {
      success: true,
      messageId: message.sid,
      status: message.status
    };
  } catch (error) {
    console.error('Twilio error:', error.message);
    throw new Error(`SMS send failed: ${error.message}`);
  }
}
```

---

## 5. Bounce & Complaint Monitoring

### server/routes/webhooks.ts
```typescript
import { Router } from 'express';
import { db } from '../db';
import { emailEvents } from '../db/schema';

const router = Router();

// SendGrid Event Webhook
router.post('/webhooks/sendgrid', async (req, res) => {
  const events = req.body;
  
  if (!Array.isArray(events)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  for (const event of events) {
    // Track bounces, complaints, and delivery failures
    if (['bounce', 'dropped', 'spam_report', 'blocked'].includes(event.event)) {
      await db.insert(emailEvents).values({
        eventType: event.event,
        email: event.email,
        timestamp: new Date(event.timestamp * 1000),
        reason: event.reason || event.type,
        messageId: event.sg_message_id,
        metadata: event
      });

      console.warn('Email delivery issue:', {
        event: event.event,
        email: event.email,
        reason: event.reason
      });
    }
  }

  res.status(200).json({ received: events.length });
});

// Twilio Status Callback
router.post('/webhooks/twilio', async (req, res) => {
  const { MessageSid, MessageStatus, To, ErrorCode } = req.body;

  if (['failed', 'undelivered'].includes(MessageStatus)) {
    console.warn('SMS delivery failed:', {
      sid: MessageSid,
      status: MessageStatus,
      to: To,
      errorCode: ErrorCode
    });

    // Track in database (optional)
    // await db.insert(smsEvents).values({...});
  }

  res.status(200).send('OK');
});

export default router;
```

### Database Schema Addition (shared/schema.ts)
```typescript
export const emailEvents = pgTable('email_events', {
  id: serial('id').primaryKey(),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  timestamp: timestamp('timestamp').notNull(),
  reason: text('reason'),
  messageId: varchar('message_id', { length: 255 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow()
});
```

---

## 6. Required Environment Variables

Add to `.env` and Replit Secrets:

```bash
# Auto Com Center Configuration
AUTO_COM_CENTER_URL=https://auto-com-center-jamarrlmayes.replit.app

# Frontend URLs (for email templates)
STUDENT_PILOT_BASE_URL=https://student-pilot-jamarrlmayes.replit.app
PROVIDER_REGISTER_BASE_URL=https://provider-register-jamarrlmayes.replit.app

# Auth Service (for S2S token validation)
AUTH_API_BASE_URL=https://scholar-auth-jamarrlmayes.replit.app

# SendGrid
SENDGRID_API_KEY=<your_sendgrid_api_key>
SENDGRID_FROM_EMAIL=notifications@scholarmatch.com
SENDGRID_FROM_NAME=ScholarMatch

# Twilio (optional)
TWILIO_ACCOUNT_SID=<your_twilio_account_sid>
TWILIO_AUTH_TOKEN=<your_twilio_auth_token>
TWILIO_PHONE_NUMBER=<your_twilio_phone_number>
```

---

## 7. Application Changes Summary

**Files to Create**:
- `server/services/emailTemplates.ts` - Env-driven email templates
- `server/middleware/s2sAuth.ts` - Service-to-service JWT validation
- `server/services/sendgrid.ts` - SendGrid integration
- `server/services/twilio.ts` - Twilio integration
- `server/routes/webhooks.ts` - Bounce/complaint monitoring

**Files to Modify**:
- `server/index.ts` - Add startup validations and S2S auth
- `server/middleware/cors.ts` - Update to strict allowlist
- `shared/schema.ts` - Add emailEvents table
- `.env` - Add required environment variables

**Database Migration**:
```bash
npm run db:push
```

**Testing**:
```bash
# Test CORS
curl -H "Origin: https://student-pilot-jamarrlmayes.replit.app" \
  https://auto-com-center-jamarrlmayes.replit.app/health

# Test S2S auth (requires valid service token)
curl -H "Authorization: Bearer <service_token>" \
  https://auto-com-center-jamarrlmayes.replit.app/api/notifications/send
```

---

**Prepared By**: Agent3 (Program Integrator)  
**Ready for Application**: Upon auto_com_center workspace access  
**Estimated Implementation Time**: 45-60 minutes
