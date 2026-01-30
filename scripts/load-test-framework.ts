/**
 * Load Testing Framework for T+6-12h Phase
 * Validates latency, reliability, and resource headroom under realistic load
 */

import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

interface LoadTestProfile {
  name: string;
  duration: number; // seconds
  connections: number;
  rate: number; // requests per second
  requests?: { method: string; path: string; weight: number }[];
}

interface TestResult {
  profile: string;
  latency: { p50: number; p95: number; p99: number };
  requests: { total: number; sent: number };
  errors: number;
  errorRate: number;
  throughput: { total: number; average: number };
  pass: boolean;
  issues: string[];
}

class LoadTestFramework {
  private baseUrl = 'https://71bf4fef-9927-4910-996e-af6c8442857d-00-1vbw0f99a1xbj.spock.replit.dev';
  private results: TestResult[] = [];

  // SLO Gates from CEO directive
  private readonly SLO_READ_P95 = 120; // ms
  private readonly SLO_WRITE_P95 = 250; // ms
  private readonly SLO_ERROR_RATE = 0.5; // percent

  async runProfile(profile: LoadTestProfile): Promise<TestResult> {
    console.log(`\n🔄 Running profile: ${profile.name}`);
    console.log(`   Duration: ${profile.duration}s, Connections: ${profile.connections}, Rate: ${profile.rate} RPS`);

    const result: TestResult = {
      profile: profile.name,
      latency: { p50: 0, p95: 0, p99: 0 },
      requests: { total: 0, sent: 0 },
      errors: 0,
      errorRate: 0,
      throughput: { total: 0, average: 0 },
      pass: false,
      issues: []
    };

    try {
      // Build autocannon command
      const endpoint = profile.requests?.[0]?.path || '/api/scholarships/stats';
      const cmd = `npx autocannon -c ${profile.connections} -d ${profile.duration} -r ${profile.rate} --json ${this.baseUrl}${endpoint}`;
      
      const { stdout } = await execAsync(cmd);
      const data = JSON.parse(stdout);

      // Extract metrics
      result.latency = {
        p50: data.latency.p50 || 0,
        p95: data.latency.p95 || 0,
        p99: data.latency.p99 || 0
      };
      result.requests = {
        total: data.requests.total || 0,
        sent: data.requests.sent || 0
      };
      result.errors = data.errors || 0;
      result.errorRate = result.requests.total > 0 
        ? (result.errors / result.requests.total) * 100 
        : 0;
      result.throughput = {
        total: data.throughput.total || 0,
        average: data.throughput.average || 0
      };

      // Validate against SLOs
      const isRead = endpoint.includes('GET') || endpoint.includes('/api/scholarships');
      const sloLatency = isRead ? this.SLO_READ_P95 : this.SLO_WRITE_P95;

      if (result.latency.p95 > sloLatency) {
        result.issues.push(`P95 latency ${result.latency.p95}ms exceeds ${sloLatency}ms SLO`);
      }
      if (result.errorRate > this.SLO_ERROR_RATE) {
        result.issues.push(`Error rate ${result.errorRate.toFixed(2)}% exceeds ${this.SLO_ERROR_RATE}% SLO`);
      }

      result.pass = result.issues.length === 0;

      console.log(`   ✓ P50: ${result.latency.p50}ms, P95: ${result.latency.p95}ms, P99: ${result.latency.p99}ms`);
      console.log(`   ✓ Requests: ${result.requests.total}, Errors: ${result.errors} (${result.errorRate.toFixed(2)}%)`);
      console.log(`   ${result.pass ? '✅ PASS' : '❌ FAIL'}: ${result.issues.length > 0 ? result.issues.join(', ') : 'All SLOs met'}`);

    } catch (error) {
      result.issues.push(`Test execution failed: ${error}`);
      console.error(`   ❌ Error running test:`, error);
    }

    this.results.push(result);
    return result;
  }

  async checkResourceUtilization(): Promise<{ memory: number; cpu: number }> {
    try {
      const response = await fetch(`${this.baseUrl}/healthz`);
      const data = await response.json();
      return {
        memory: data.checks?.memory?.heapUsedPercent || 0,
        cpu: 0 // Not directly available, would need process monitoring
      };
    } catch (error) {
      console.error('Failed to check resources:', error);
      return { memory: 0, cpu: 0 };
    }
  }

  generateReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 LOAD TEST REPORT - T+6-12h Phase');
    console.log('='.repeat(60));

    let totalPass = 0;
    let totalFail = 0;

    for (const result of this.results) {
      console.log(`\n${result.pass ? '✅' : '❌'} ${result.profile}`);
      console.log(`   Latency: P50=${result.latency.p50}ms, P95=${result.latency.p95}ms, P99=${result.latency.p99}ms`);
      console.log(`   Error Rate: ${result.errorRate.toFixed(2)}% (${result.errors}/${result.requests.total})`);
      console.log(`   Throughput: ${result.throughput.average.toFixed(0)} req/sec avg`);
      
      if (result.issues.length > 0) {
        console.log(`   Issues: ${result.issues.join('; ')}`);
        totalFail++;
      } else {
        totalPass++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Summary: ${totalPass} passed, ${totalFail} failed`);
    console.log(`Overall: ${totalFail === 0 ? '✅ GO' : '❌ NO-GO'} for Private Beta`);
    console.log('='.repeat(60));
  }
}

// Define test profiles per CEO directive
const profiles: LoadTestProfile[] = [
  {
    name: 'Baseline - 5 RPS',
    duration: 30,
    connections: 5,
    rate: 5,
    requests: [{ method: 'GET', path: '/api/scholarships/stats', weight: 1 }]
  },
  {
    name: 'Normal Load - 10 RPS',
    duration: 60,
    connections: 10,
    rate: 10,
    requests: [{ method: 'GET', path: '/api/scholarships/stats', weight: 1 }]
  },
  {
    name: 'Peak Load - 25 RPS',
    duration: 60,
    connections: 20,
    rate: 25,
    requests: [{ method: 'GET', path: '/api/scholarships/stats', weight: 1 }]
  },
  {
    name: 'Stress/Burst - 50 RPS',
    duration: 30,
    connections: 40,
    rate: 50,
    requests: [{ method: 'GET', path: '/api/scholarships/stats', weight: 1 }]
  }
];

// Main execution
async function main() {
  const framework = new LoadTestFramework();

  console.log('🚀 T+6-12h Load Testing Framework Starting...');
  console.log('Target SLOs: P95 <120ms (reads), <250ms (writes), Error <0.5%\n');

  for (const profile of profiles) {
    await framework.runProfile(profile);
    
    // Check resources after each test
    const resources = await framework.checkResourceUtilization();
    console.log(`   📊 Resources: Memory ${resources.memory}%, CPU ${resources.cpu}%\n`);
    
    // Brief pause between tests
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  framework.generateReport();
  
  // Exit with appropriate code
  const allPassed = framework['results'].every(r => r.pass);
  process.exit(allPassed ? 0 : 1);
}

main();
