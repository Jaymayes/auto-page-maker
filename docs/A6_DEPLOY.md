# A6 Provider Register - Deployment Checklist

**App:** provider_register (A6)  
**Target:** P95 ≤150ms on webhook handling  
**Owner:** DevOps

---

## 1. Required Secrets

| Secret | Description | Example |
|--------|-------------|---------|
| `STRIPE_SECRET_KEY` | Stripe API key (live or test) | `sk_live_...` or `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret | `whsec_...` |
| `A8_URL` | Command Center events endpoint | `https://auto-com-center-jamarrlmayes.replit.app/api/events` |
| `A8_KEY` | S2S API key for telemetry | (from A8 admin) |
| `CORS_ORIGIN` | Allowed origins | `https://scholaraiadvisor.com,https://student-pilot-jamarrlmayes.replit.app` |

---

## 2. Stripe Webhook Configuration

### Route: `/stripe/webhook` or `/api/webhooks/stripe`

**Requirements:**
- Use raw body parsing (not JSON) for signature verification
- Return 200 immediately on receipt
- Verify signature with `STRIPE_WEBHOOK_SECRET`
- Emit `PaymentSuccess` to A8 after verification

### Example Implementation (Express)

```typescript
import express from 'express';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// IMPORTANT: Raw body required for Stripe signature verification
app.post('/stripe/webhook', 
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    
    try {
      const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      
      // Handle the event
      switch (event.type) {
        case 'checkout.session.completed':
        case 'payment_intent.succeeded':
          // Emit to A8
          await emitToA8('PaymentSuccess', {
            payment_id: event.data.object.id,
            amount_cents: event.data.object.amount,
            currency: event.data.object.currency,
            mode: process.env.STRIPE_MODE || 'test'
          });
          break;
      }
      
      res.status(200).json({ received: true });
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);
```

---

## 3. Health Endpoints

### `/health`
```typescript
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'provider_register',
    version: process.env.APP_VERSION || 'v1.0.0',
    uptime: process.uptime()
  });
});
```

### `/ready`
```typescript
app.get('/ready', async (req, res) => {
  // Check all dependencies
  const checks = {
    database: await checkDatabase(),
    stripe: await checkStripeConnection(),
    a8: await checkA8Connection()
  };
  
  const allHealthy = Object.values(checks).every(c => c === 'healthy');
  
  res.status(allHealthy ? 200 : 503).json({
    ready: allHealthy,
    checks
  });
});
```

---

## 4. Telemetry Emitter

### v3.5.1 Headers Required

```typescript
async function emitToA8(eventType: string, context: Record<string, any>): Promise<void> {
  const eventId = `${eventType}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  
  const response = await fetch(process.env.A8_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-scholar-protocol': 'v3.5.1',
      'x-app-label': 'provider_register',
      'x-event-id': eventId,
      ...(process.env.A8_KEY && { 'Authorization': `Bearer ${process.env.A8_KEY}` })
    },
    body: JSON.stringify({
      event_type: eventType,
      source_app_id: 'provider_register',
      app_base_url: 'https://provider-register-jamarrlmayes.replit.app',
      ts: Date.now(),
      context
    })
  });
  
  if (!response.ok) {
    console.error(`[A8] Failed to emit ${eventType}:`, await response.text());
  }
}
```

---

## 5. Business Events to Emit

| Event | Trigger | Context Fields |
|-------|---------|---------------|
| `ProviderOnboarded` | Stripe Connect success | `provider_id`, `plan`, `utm_*` |
| `ListingCreated` | First listing | `listing_id`, `provider_id`, `category` |
| `PaymentSuccess` | Webhook receipt | `payment_id`, `amount_cents`, `currency`, `mode` |

---

## 6. CORS Configuration

```typescript
const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim());

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

// Ensure OPTIONS returns 204
app.options('*', cors());
```

---

## 7. Deployment Checklist

### Staging
- [ ] All secrets configured
- [ ] `/health` returns 200
- [ ] `/ready` returns 200
- [ ] Stripe webhook test event succeeds
- [ ] A8 receives test event (check `/api/events/recent`)

### Production
- [ ] `STRIPE_SECRET_KEY` is `sk_live_*`
- [ ] `STRIPE_WEBHOOK_SECRET` matches live webhook
- [ ] CORS allows production domains
- [ ] P95 latency ≤150ms on webhook route
- [ ] Monitoring/alerting configured

---

## 8. Verification Commands

```bash
# Health check
curl https://provider-register-jamarrlmayes.replit.app/health

# Ready check
curl https://provider-register-jamarrlmayes.replit.app/ready

# Stripe webhook test (from Stripe CLI)
stripe trigger payment_intent.succeeded

# Verify A8 received event
curl -s "https://auto-com-center-jamarrlmayes.replit.app/api/events/recent?limit=10" | \
  jq '[.events[] | select(.source_app_id == "provider_register")]'
```

---

## 9. Rollback

If deployment fails:
1. Revert to previous version
2. Disable webhook in Stripe dashboard
3. Check A8 for error events
4. Review logs for root cause
