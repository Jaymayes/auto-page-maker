/**
 * auto_com_center k6 Cloud Canary Test
 * 
 * Target: 250 RPS sustained for 30 minutes
 * Acceptance Criteria:
 * - P95 latency ≤250ms
 * - Error rate ≤0.5%
 * - Delivery success ≥99%
 * 
 * Run Command:
 * k6 cloud load-tests/canary/auto_com_center_250rps_30min.js
 * 
 * Budget Approved: $1,500 for 72 hours k6 Cloud testing
 * CEO Directive: Execute NOW (Nov 14, 2025)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const deliverySuccess = new Rate('delivery_success');
const latencyTrend = new Trend('notification_latency');
const deliveryFailures = new Counter('delivery_failures');

// Test configuration
export const options = {
  // k6 Cloud project settings
  ext: {
    loadimpact: {
      projectID: 3676604, // Replace with actual k6 Cloud project ID
      name: 'auto_com_center Canary - 250 RPS x 30min',
      note: 'Gate 1 acceptance test - CEO directive Nov 14, 2025'
    }
  },

  // Load profile: 250 RPS sustained for 30 minutes
  scenarios: {
    canary_load: {
      executor: 'constant-arrival-rate',
      rate: 250,           // 250 RPS
      timeUnit: '1s',
      duration: '30m',     // 30 minutes
      preAllocatedVUs: 300,
      maxVUs: 500
    }
  },

  // Thresholds (SLO targets)
  thresholds: {
    'http_req_duration{type:notification}': ['p(95)<250'], // P95 ≤250ms
    'errors': ['rate<0.005'],                               // Error rate <0.5%
    'delivery_success': ['rate>0.99'],                      // Delivery success ≥99%
    'http_req_failed': ['rate<0.005']                       // HTTP failures <0.5%
  }
};

// Environment configuration
const BASE_URL = __ENV.AUTO_COM_CENTER_URL || 'https://auto-com-center-jamarrlmayes.replit.app';
const AUTH_TOKEN = __ENV.SERVICE_AUTH_TOKEN || '';  // M2M token from scholar_auth

// Test data generator
function generateNotificationPayload() {
  const notificationTypes = [
    'application_received',
    'application_approved',
    'application_rejected',
    'scholarship_match',
    'deadline_reminder'
  ];
  
  return {
    type: notificationTypes[Math.floor(Math.random() * notificationTypes.length)],
    recipient: {
      email: `student${Math.floor(Math.random() * 10000)}@example.com`,
      name: `Test Student ${Math.floor(Math.random() * 10000)}`
    },
    data: {
      scholarshipTitle: 'Engineering Excellence Scholarship',
      amount: 5000,
      deadline: '2025-12-31',
      applicationId: `app_${Math.floor(Math.random() * 100000)}`
    },
    metadata: {
      correlationId: `canary_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
      source: 'k6_cloud_canary',
      timestamp: new Date().toISOString()
    }
  };
}

// Main test function
export default function() {
  const payload = generateNotificationPayload();
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'X-Correlation-ID': payload.metadata.correlationId
    },
    tags: {
      type: 'notification',
      notification_type: payload.type
    }
  };

  // Send notification request
  const startTime = Date.now();
  const response = http.post(
    `${BASE_URL}/api/notifications/send`,
    JSON.stringify(payload),
    params
  );
  const duration = Date.now() - startTime;

  // Track latency
  latencyTrend.add(duration, { type: 'notification' });

  // Validate response
  const success = check(response, {
    'status is 200 or 202': (r) => r.status === 200 || r.status === 202,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has delivery ID': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.deliveryId !== undefined;
      } catch (e) {
        return false;
      }
    },
    'no server errors': (r) => r.status < 500
  });

  // Track errors
  errorRate.add(!success);

  // Track delivery status (if response includes it)
  if (response.status === 200 || response.status === 202) {
    try {
      const body = JSON.parse(response.body);
      const delivered = body.status === 'delivered' || body.status === 'queued';
      deliverySuccess.add(delivered);
      
      if (!delivered) {
        deliveryFailures.add(1, {
          type: payload.type,
          error: body.error || 'unknown'
        });
      }
    } catch (e) {
      deliverySuccess.add(false);
      deliveryFailures.add(1, { error: 'parse_error' });
    }
  } else {
    deliverySuccess.add(false);
    deliveryFailures.add(1, { 
      error: `http_${response.status}`,
      type: payload.type
    });
  }

  // Small sleep to prevent hammering (250 RPS = ~4ms between requests per VU)
  sleep(0.1);
}

// Setup function (runs once at start)
export function setup() {
  console.log('=== auto_com_center Canary Test Setup ===');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Auth Token Present: ${AUTH_TOKEN ? 'Yes' : 'No (WARNING!)'}`);
  console.log(`Target: 250 RPS for 30 minutes`);
  console.log(`Acceptance: P95 ≤250ms, Error rate ≤0.5%, Delivery ≥99%`);
  console.log('==========================================');
  
  // Warm-up request to validate connectivity
  const warmup = http.get(`${BASE_URL}/health`);
  if (warmup.status !== 200) {
    console.error(`WARNING: Health check failed with status ${warmup.status}`);
  }
  
  return { startTime: Date.now() };
}

// Teardown function (runs once at end)
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000 / 60;
  console.log('=== auto_com_center Canary Test Complete ===');
  console.log(`Duration: ${duration.toFixed(2)} minutes`);
  console.log(`Review full results in k6 Cloud dashboard`);
  console.log('============================================');
}
