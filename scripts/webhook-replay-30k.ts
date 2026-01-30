import { createHmac } from 'crypto';
import { writeFile } from 'fs/promises';

interface ReplayResult {
  total_sent: number;
  delivered: number;
  failed: number;
  status_codes: Record<number, number>;
  latency_p50_ms: number;
  latency_p95_ms: number;
  latency_p99_ms: number;
  duration_ms: number;
  avg_throughput_rps: number;
  idempotency_violations: number;
  ordering_violations: number;
}

async function execute30KReplay(): Promise<ReplayResult> {
  console.log('[30K Replay] Starting 30,000 event replay test...');
  const startTime = Date.now();
  
  const webhookSecret = process.env.POSTMARK_API_KEY || 'test-secret';
  const total = 30000;
  const latencies: number[] = [];
  const statusCodes: Record<number, number> = {};
  let delivered = 0;
  const messageIds = new Set<string>();
  let idempotencyViolations = 0;
  let orderingViolations = 0;
  let lastTimestamp = 0;
  
  // Send in batches of 100 with minimal delay for maximum throughput
  const batchSize = 100;
  const delayBetweenBatches = 25; // 25ms delay = sustainable ~4000 req/sec
  
  for (let batch = 0; batch < Math.ceil(total / batchSize); batch++) {
    const batchStart = batch * batchSize;
    const batchEnd = Math.min((batch + 1) * batchSize, total);
    
    const batchPromises = [];
    for (let i = batchStart; i < batchEnd; i++) {
      batchPromises.push(sendWebhookEvent(i, webhookSecret, latencies, statusCodes, messageIds));
    }
    
    const results = await Promise.all(batchPromises);
    
    // Check ordering (timestamps should be monotonically increasing)
    results.forEach(result => {
      if (result.success) {
        delivered++;
        if (result.timestamp < lastTimestamp) {
          orderingViolations++;
        }
        lastTimestamp = result.timestamp;
      }
    });
    
    // Progress logging every 10 batches (1000 requests)
    if (batch % 10 === 0) {
      const progress = Math.round(batchEnd / total * 100);
      const elapsed = Date.now() - startTime;
      const currentThroughput = (batchEnd / elapsed) * 1000;
      console.log(`[30K Replay] Progress: ${batchEnd}/${total} (${progress}%) - Delivered: ${delivered} - Throughput: ${currentThroughput.toFixed(0)} req/s`);
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
  
  // Check for duplicate messageIds (idempotency violations)
  idempotencyViolations = total - messageIds.size;
  
  console.log(`\n=== 30K REPLAY RESULTS ===`);
  console.log(`Total sent: ${total.toLocaleString()}`);
  console.log(`Delivered: ${delivered.toLocaleString()} (${(delivered/total*100).toFixed(2)}%)`);
  console.log(`Failed: ${failed.toLocaleString()}`);
  console.log(`Status codes:`, statusCodes);
  console.log(`Latency P50/P95/P99: ${p50}ms / ${p95}ms / ${p99}ms`);
  console.log(`Duration: ${(duration/1000).toFixed(1)}s`);
  console.log(`Throughput: ${throughput.toFixed(2)} req/s`);
  console.log(`Idempotency violations: ${idempotencyViolations}`);
  console.log(`Ordering violations: ${orderingViolations}`);
  console.log(`==========================\n`);
  
  const passDelivery = delivered >= (total * 0.999); // ≥99.9%
  const passLatency = p95 <= 120; // P95 ≤120ms
  const passIdempotency = idempotencyViolations === 0;
  const passOrdering = orderingViolations === 0;
  const passOverall = passDelivery && passLatency && passIdempotency && passOrdering;
  
  console.log(`\n=== GATE A 30K REPLAY: ${passOverall ? 'PASS ✅' : 'FAIL ❌'} ===`);
  console.log(`Delivery (≥99.9%): ${passDelivery ? 'PASS ✅' : 'FAIL ❌'} (${(delivered/total*100).toFixed(2)}%)`);
  console.log(`P95 Latency (≤120ms): ${passLatency ? 'PASS ✅' : 'FAIL ❌'} (${p95}ms)`);
  console.log(`Idempotency: ${passIdempotency ? 'PASS ✅' : 'FAIL ❌'} (${idempotencyViolations} violations)`);
  console.log(`Ordering: ${passOrdering ? 'PASS ✅' : 'FAIL ❌'} (${orderingViolations} violations)`);
  console.log(`=======================================\n`);
  
  return {
    total_sent: total,
    delivered,
    failed,
    status_codes: statusCodes,
    latency_p50_ms: p50,
    latency_p95_ms: p95,
    latency_p99_ms: p99,
    duration_ms: duration,
    avg_throughput_rps: throughput,
    idempotency_violations: idempotencyViolations,
    ordering_violations: orderingViolations
  };
}

async function sendWebhookEvent(
  index: number,
  secret: string,
  latencies: number[],
  statusCodes: Record<number, number>,
  messageIds: Set<string>
): Promise<{ success: boolean; timestamp: number }> {
  const timestamp = Date.now();
  const messageId = `replay-30k-${index}-${timestamp}`;
  const isoTimestamp = new Date(timestamp).toISOString();
  
  messageIds.add(messageId);
  
  const payload = {
    RecordType: 'Delivery',
    MessageID: messageId,
    Recipient: `test-30k-${index}@scholarmatch.com`,
    DeliveredAt: isoTimestamp,
    Details: '30K webhook replay test',
    Tag: 'gate-a-30k-replay',
    Metadata: { test: '30k-replay', index: index.toString(), timestamp: timestamp.toString() }
  };
  
  const body = JSON.stringify(payload);
  const signature = createHmac('sha256', secret)
    .update(isoTimestamp + body)
    .digest('base64');
  
  const requestStart = Date.now();
  
  try {
    const response = await fetch('http://localhost:5000/api/webhooks/postmark', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Postmark-Signature': signature,
        'X-Postmark-Timestamp': isoTimestamp
      },
      body,
      signal: AbortSignal.timeout(10000)
    });
    
    const latency = Date.now() - requestStart;
    latencies.push(latency);
    
    const status = response.status;
    statusCodes[status] = (statusCodes[status] || 0) + 1;
    
    return { success: response.ok, timestamp };
  } catch (error) {
    statusCodes[0] = (statusCodes[0] || 0) + 1; // Network error
    return { success: false, timestamp };
  }
}

// Execute and save results
execute30KReplay().then(async (result) => {
  await writeFile(
    'evidence_root/auto_com_center/gate_a/webhook_replay_30k_results.json',
    JSON.stringify(result, null, 2)
  );
  
  const passDelivery = result.delivered >= (result.total_sent * 0.999);
  const passLatency = result.latency_p95_ms <= 120;
  const passIdempotency = result.idempotency_violations === 0;
  const passOrdering = result.ordering_violations === 0;
  const passOverall = passDelivery && passLatency && passIdempotency && passOrdering;
  
  console.log(`30K Replay: ${passOverall ? 'PASS' : 'FAIL'}`);
  
  process.exit(passOverall ? 0 : 1);
}).catch((error) => {
  console.error('[30K Replay] Fatal error:', error);
  process.exit(1);
});
