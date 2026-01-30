import { createHmac } from 'crypto';
import { writeFile } from 'fs/promises';

interface DiagnosticResult {
  total_sent: number;
  status_codes: Record<number, number>;
  delivered: number;
  failed: number;
  latency_p50_ms: number;
  latency_p95_ms: number;
  latency_p99_ms: number;
  duration_ms: number;
  avg_throughput_rps: number;
}

async function executeDiagnosticReplay(): Promise<DiagnosticResult> {
  console.log('[Diagnostic] Starting 1,000 event replay test with enhanced logging...');
  const startTime = Date.now();
  
  const webhookSecret = process.env.POSTMARK_API_KEY || 'test-secret';
  const total = 1000;
  const latencies: number[] = [];
  const statusCodes: Record<number, number> = {};
  let delivered = 0;
  
  // Send in batches of 50 with minimal delay
  const batchSize = 50;
  const delayBetweenBatches = 50;
  
  for (let batch = 0; batch < Math.ceil(total / batchSize); batch++) {
    const batchStart = batch * batchSize;
    const batchEnd = Math.min((batch + 1) * batchSize, total);
    
    const batchPromises = [];
    for (let i = batchStart; i < batchEnd; i++) {
      batchPromises.push(sendWebhookEvent(i, webhookSecret, latencies, statusCodes));
    }
    
    const results = await Promise.all(batchPromises);
    delivered += results.filter(r => r).length;
    
    if (batch % 5 === 0) {
      console.log(`[Diagnostic] Progress: ${batchEnd}/${total} (${Math.round(batchEnd/total*100)}%) - Delivered: ${delivered}`);
    }
    
    if (batch < Math.ceil(total / batchSize) - 1) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
  
  const duration = Date.now() - startTime;
  
  // Calculate latency percentiles
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  
  const failed = total - delivered;
  const throughput = (delivered / duration) * 1000;
  
  console.log(`\n=== DIAGNOSTIC RESULTS ===`);
  console.log(`Total sent: ${total}`);
  console.log(`Delivered: ${delivered} (${(delivered/total*100).toFixed(2)}%)`);
  console.log(`Failed: ${failed}`);
  console.log(`Status codes:`, statusCodes);
  console.log(`Latency P50: ${p50}ms, P95: ${p95}ms, P99: ${p99}ms`);
  console.log(`Duration: ${duration}ms`);
  console.log(`Throughput: ${throughput.toFixed(2)} req/s`);
  console.log(`==========================\n`);
  
  return {
    total_sent: total,
    status_codes: statusCodes,
    delivered,
    failed,
    latency_p50_ms: p50,
    latency_p95_ms: p95,
    latency_p99_ms: p99,
    duration_ms: duration,
    avg_throughput_rps: throughput
  };
}

async function sendWebhookEvent(
  index: number,
  secret: string,
  latencies: number[],
  statusCodes: Record<number, number>
): Promise<boolean> {
  const messageId = `diagnostic-${index}-${Date.now()}`;
  const timestamp = new Date().toISOString();
  
  const payload = {
    RecordType: 'Delivery',
    MessageID: messageId,
    Recipient: `test-${index}@scholarmatch.com`,
    DeliveredAt: timestamp,
    Details: 'Diagnostic webhook event',
    Tag: 'gate-a-diagnostic',
    Metadata: { test: 'diagnostic', index: index.toString() }
  };
  
  const body = JSON.stringify(payload);
  const signature = createHmac('sha256', secret)
    .update(timestamp + body)
    .digest('base64');
  
  const requestStart = Date.now();
  
  try {
    const response = await fetch('http://localhost:5000/api/webhooks/postmark', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Postmark-Signature': signature,
        'X-Postmark-Timestamp': timestamp
      },
      body,
      signal: AbortSignal.timeout(5000)
    });
    
    const latency = Date.now() - requestStart;
    latencies.push(latency);
    
    const status = response.status;
    statusCodes[status] = (statusCodes[status] || 0) + 1;
    
    return response.ok;
  } catch (error) {
    statusCodes[0] = (statusCodes[0] || 0) + 1; // Network error
    return false;
  }
}

// Execute diagnostic and save results
executeDiagnosticReplay().then(async (result) => {
  await writeFile(
    'evidence_root/auto_com_center/gate_a/diagnostic_1k_results.json',
    JSON.stringify(result, null, 2)
  );
  
  const pass = result.delivered >= (result.total_sent * 0.99);
  console.log(`Diagnostic test: ${pass ? 'PASS' : 'FAIL'} (${result.delivered}/${result.total_sent})`);
  
  process.exit(pass ? 0 : 1);
}).catch((error) => {
  console.error('[Diagnostic] Fatal error:', error);
  process.exit(1);
});
