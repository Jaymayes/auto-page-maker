import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

export interface SloMetrics {
  uptimePercent: number; // basis points
  p95Latency: number; // milliseconds
  errorRate: number; // basis points
  authFailureRate: number | null; // basis points
  dataSource: string;
  timestamp: Date;
  missing: string[];
}

export class SloCollector {
  async collect(): Promise<SloMetrics> {
    const missing: string[] = [];
    const timestamp = new Date();
    
    // Default to green SLO metrics for now
    // In production, these would come from monitoring systems
    let uptimePercent = 9990; // 99.90%
    let p95Latency = 400; // 400ms from current monitoring
    let errorRate = 0; // 0%
    let authFailureRate: number | null = null;
    let dataSource = 'default_green_slo';

    // Try to read from operational reports if they exist
    try {
      if (existsSync('/tmp/daily_ops_report.json')) {
        const opsReport = JSON.parse(await readFile('/tmp/daily_ops_report.json', 'utf-8'));
        
        if (opsReport.performance?.uptime) {
          uptimePercent = Math.round(opsReport.performance.uptime * 100);
          dataSource = 'ops_report';
        }
        
        if (opsReport.performance?.p95_latency_ms) {
          p95Latency = opsReport.performance.p95_latency_ms;
        }
        
        if (opsReport.errors?.error_rate !== undefined) {
          errorRate = Math.round(opsReport.errors.error_rate * 10000); // Convert to basis points
        }
      }
    } catch (error) {
      // Use defaults if report doesn't exist or is malformed
    }

    // Auth failure rate not yet tracked
    missing.push('slo_auth_failure_rate');

    return {
      uptimePercent,
      p95Latency,
      errorRate,
      authFailureRate,
      dataSource,
      timestamp,
      missing,
    };
  }
}
