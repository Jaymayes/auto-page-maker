import { randomUUID } from 'crypto';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import type { IStorage, InsertDailyKpiSnapshot, DailyKpiSnapshot } from '../storage.js';
import { collectAllMetrics, type AllMetrics } from './kpi-collectors/index.js';
import { SlackNotifier } from './slack-notifier.js';
import crypto from 'crypto';

export interface KpiBriefResult {
  snapshot: DailyKpiSnapshot;
  jsonPath: string;
  markdownPath: string;
  hasDataIntegrityRisks: boolean;
  hasMissingMetrics: boolean;
  slackNotified: boolean;
  slackError?: string;
}

export class ExecutiveKpiBriefService {
  private readonly ARTIFACTS_DIR = '/tmp/ops/executive';
  private readonly slackNotifier: SlackNotifier;
  private storage: IStorage | null = null;

  constructor(storageInstance?: IStorage, slackNotifier?: SlackNotifier) {
    this.storage = storageInstance || null;
    this.slackNotifier = slackNotifier || new SlackNotifier();
  }

  private async getStorage(): Promise<IStorage> {
    if (this.storage) {
      return this.storage;
    }
    const { storage } = await import('../storage.js');
    this.storage = storage;
    return storage;
  }

  async generateDailyBrief(): Promise<KpiBriefResult> {
    const requestId = randomUUID();
    const timestamp = new Date();
    
    // Collect metrics from all domains
    const metrics = await collectAllMetrics();

    // Validate and aggregate
    const { kpiData, missingMetrics, dataIntegrityRisks } = this.aggregateAndValidate(metrics);

    // Calculate data source hashes for provenance
    const sourceHashes = this.calculateSourceHashes(metrics);

    // Create snapshot in database
    const snapshotData: InsertDailyKpiSnapshot = {
      date: timestamp,
      requestId,
      dataTimestamp: timestamp,
      ...kpiData,
      missingMetrics,
      dataIntegrityRisks,
      sourceHashes,
      status: 'generated',
      slackPosted: false,
      artifactsPath: this.ARTIFACTS_DIR,
    };

    const storage = await this.getStorage();
    const snapshot = await storage.createKpiSnapshot(snapshotData);

    // Ensure artifacts directory exists
    await this.ensureArtifactsDir();

    // Generate artifacts
    const dateStr = timestamp.toISOString().split('T')[0];
    const jsonPath = `${this.ARTIFACTS_DIR}/kpi_daily_${dateStr}.json`;
    const markdownPath = `${this.ARTIFACTS_DIR}/kpi_daily_brief_${dateStr}.md`;

    await this.generateJsonArtifact(snapshot, metrics, jsonPath);
    await this.generateMarkdownArtifact(snapshot, metrics, markdownPath);

    // Also write to standard locations for easy access
    await writeFile(`${this.ARTIFACTS_DIR}/kpi_daily.json`, await readFile(jsonPath, 'utf-8'));
    await writeFile(`${this.ARTIFACTS_DIR}/kpi_daily_brief.md`, await readFile(markdownPath, 'utf-8'));

    // Send Slack notification
    let slackNotified = false;
    let slackError: string | undefined;

    if (this.slackNotifier.isConfigured()) {
      const slackResult = await this.slackNotifier.sendKpiDailyBrief(markdownPath, {
        requestId: snapshot.requestId,
        date: snapshot.date,
        missingMetrics: snapshot.missingMetrics,
        dataIntegrityRisks: snapshot.dataIntegrityRisks,
        seoPagesLive: snapshot.seoPagesLive,
        sloUptimePercent: snapshot.sloUptimePercent,
      });

      slackNotified = slackResult.success;
      slackError = slackResult.error;

      // Update snapshot with Slack status
      if (slackNotified) {
        const storage = await this.getStorage();
        await storage.updateKpiSnapshot(snapshot.id, { slackPosted: true });
      }
    }

    return {
      snapshot,
      jsonPath,
      markdownPath,
      hasDataIntegrityRisks: dataIntegrityRisks.length > 0,
      hasMissingMetrics: missingMetrics.length > 0,
      slackNotified,
      slackError,
    };
  }

  private aggregateAndValidate(metrics: AllMetrics) {
    const missingMetrics: string[] = [];
    const dataIntegrityRisks: string[] = [];

    // Collect all missing metrics from collectors
    missingMetrics.push(...metrics.seo.missing);
    missingMetrics.push(...metrics.slo.missing);
    missingMetrics.push(...metrics.b2c.missing);
    missingMetrics.push(...metrics.b2b.missing);
    missingMetrics.push(...metrics.cac.missing);

    // Validate SLO metrics - warn if below targets
    if (metrics.slo.uptimePercent < 9990) { // < 99.90%
      dataIntegrityRisks.push(`SLO uptime below target: ${(metrics.slo.uptimePercent / 100).toFixed(2)}%`);
    }
    if (metrics.slo.p95Latency > 200) { // > 200ms
      dataIntegrityRisks.push(`SLO P95 latency above target: ${metrics.slo.p95Latency}ms`);
    }
    if (metrics.slo.errorRate > 10) { // > 0.1%
      dataIntegrityRisks.push(`SLO error rate above target: ${(metrics.slo.errorRate / 100).toFixed(2)}%`);
    }

    // Build KPI data object with -1 sentinels for missing data
    const kpiData = {
      // B2C metrics
      b2cConversionRate: metrics.b2c.conversionRate ?? null,
      b2cArpu: metrics.b2c.arpu ?? null,
      b2cCtrHighLikelihood: metrics.b2c.ctrHighLikelihood ?? null,
      b2cCtrCompetitive: metrics.b2c.ctrCompetitive ?? null,
      b2cCtrLongShot: metrics.b2c.ctrLongShot ?? null,

      // B2B metrics
      b2bActiveProviders: metrics.b2b.activeProviders ?? null,
      b2bRevenue: metrics.b2b.revenue ?? null,
      b2bTopDecileConcentration: metrics.b2b.topDecileConcentration ?? null,

      // SLO metrics
      sloUptimePercent: metrics.slo.uptimePercent,
      sloP95Latency: metrics.slo.p95Latency,
      sloErrorRate: metrics.slo.errorRate,
      sloAuthFailureRate: metrics.slo.authFailureRate ?? null,

      // SEO metrics
      seoPagesLive: metrics.seo.pagesLive,
      seoIndexationRate: metrics.seo.indexationRate ?? null,
      seoOrganicSessions: metrics.seo.organicSessions ?? null,

      // CAC/Payback metrics
      cacSeoLed: metrics.cac.seoLed ?? null,
      paybackPeriodDays: metrics.cac.paybackPeriodDays ?? null,
    };

    return { kpiData, missingMetrics, dataIntegrityRisks };
  }

  private calculateSourceHashes(metrics: AllMetrics): Record<string, string> {
    return {
      seo: this.hashObject({ source: metrics.seo.dataSource, timestamp: metrics.seo.timestamp }),
      slo: this.hashObject({ source: metrics.slo.dataSource, timestamp: metrics.slo.timestamp }),
      b2c: this.hashObject({ source: metrics.b2c.dataSource, timestamp: metrics.b2c.timestamp }),
      b2b: this.hashObject({ source: metrics.b2b.dataSource, timestamp: metrics.b2b.timestamp }),
      cac: this.hashObject({ source: metrics.cac.dataSource, timestamp: metrics.cac.timestamp }),
    };
  }

  private hashObject(obj: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex').slice(0, 16);
  }

  private async ensureArtifactsDir(): Promise<void> {
    if (!existsSync(this.ARTIFACTS_DIR)) {
      await mkdir(this.ARTIFACTS_DIR, { recursive: true });
    }
  }

  private async generateJsonArtifact(
    snapshot: DailyKpiSnapshot,
    metrics: AllMetrics,
    filepath: string
  ): Promise<void> {
    const artifact = {
      requestId: snapshot.requestId,
      dataTimestamp: snapshot.dataTimestamp.toISOString(),
      date: snapshot.date.toISOString(),
      
      b2c: {
        conversionRate: this.formatBasisPoints(snapshot.b2cConversionRate),
        arpu: this.formatCents(snapshot.b2cArpu),
        ctr: {
          highLikelihood: this.formatBasisPoints(snapshot.b2cCtrHighLikelihood),
          competitive: this.formatBasisPoints(snapshot.b2cCtrCompetitive),
          longShot: this.formatBasisPoints(snapshot.b2cCtrLongShot),
        },
      },
      
      b2b: {
        activeProviders: snapshot.b2bActiveProviders ?? 'no_data',
        revenue: this.formatCents(snapshot.b2bRevenue),
        topDecileConcentration: this.formatBasisPoints(snapshot.b2bTopDecileConcentration),
      },
      
      slo: {
        uptimePercent: this.formatBasisPoints(snapshot.sloUptimePercent),
        p95Latency: snapshot.sloP95Latency !== null ? `${snapshot.sloP95Latency}ms` : 'no_data',
        errorRate: this.formatBasisPoints(snapshot.sloErrorRate),
        authFailureRate: this.formatBasisPoints(snapshot.sloAuthFailureRate),
      },
      
      seo: {
        pagesLive: snapshot.seoPagesLive ?? 'no_data',
        indexationRate: this.formatBasisPoints(snapshot.seoIndexationRate),
        organicSessions: snapshot.seoOrganicSessions ?? 'no_data',
      },
      
      cac: {
        seoLed: this.formatCents(snapshot.cacSeoLed),
        paybackPeriodDays: snapshot.paybackPeriodDays !== null ? `${snapshot.paybackPeriodDays} days` : 'no_data',
      },
      
      dataQuality: {
        missingMetrics: snapshot.missingMetrics,
        dataIntegrityRisks: snapshot.dataIntegrityRisks,
        sourceHashes: snapshot.sourceHashes,
      },
      
      metadata: {
        status: snapshot.status,
        slackPosted: snapshot.slackPosted,
        createdAt: snapshot.createdAt?.toISOString(),
      },
    };

    await writeFile(filepath, JSON.stringify(artifact, null, 2));
  }

  private async generateMarkdownArtifact(
    snapshot: DailyKpiSnapshot,
    metrics: AllMetrics,
    filepath: string
  ): Promise<void> {
    const date = snapshot.date.toISOString().split('T')[0];
    const missingMetrics = snapshot.missingMetrics || [];
    const dataIntegrityRisks = snapshot.dataIntegrityRisks || [];
    const sourceHashes = (snapshot.sourceHashes as Record<string, string>) || {};
    const hasMissingData = missingMetrics.length > 0;
    const hasRisks = dataIntegrityRisks.length > 0;

    const md = `# Executive KPI Daily Brief
**Date:** ${date}  
**Request ID:** ${snapshot.requestId}  
**Generated:** ${snapshot.dataTimestamp.toISOString()}

---

## 📊 Key Performance Indicators

### B2C Metrics (Student Platform)
| Metric | Value | Status |
|--------|-------|--------|
| **Free→Paid Conversion** | ${this.formatBasisPoints(snapshot.b2cConversionRate)} | ${snapshot.b2cConversionRate ? '✅' : '⏳ Not tracked'} |
| **ARPU (Credits)** | ${this.formatCents(snapshot.b2cArpu)} | ${snapshot.b2cArpu ? '✅' : '⏳ Not tracked'} |
| **CTR - High Likelihood** | ${this.formatBasisPoints(snapshot.b2cCtrHighLikelihood)} | ${snapshot.b2cCtrHighLikelihood ? '✅' : '⏳ Not tracked'} |
| **CTR - Competitive** | ${this.formatBasisPoints(snapshot.b2cCtrCompetitive)} | ${snapshot.b2cCtrCompetitive ? '✅' : '⏳ Not tracked'} |
| **CTR - Long Shot** | ${this.formatBasisPoints(snapshot.b2cCtrLongShot)} | ${snapshot.b2cCtrLongShot ? '✅' : '⏳ Not tracked'} |

### B2B Metrics (Provider Marketplace)
| Metric | Value | Status |
|--------|-------|--------|
| **Active Providers** | ${snapshot.b2bActiveProviders ?? 'Not tracked'} | ${snapshot.b2bActiveProviders ? '✅' : '⏳ Not tracked'} |
| **Revenue (3% Fee)** | ${this.formatCents(snapshot.b2bRevenue)} | ${snapshot.b2bRevenue ? '✅' : '⏳ Not tracked'} |
| **Top-Decile Concentration** | ${this.formatBasisPoints(snapshot.b2bTopDecileConcentration)} | ${snapshot.b2bTopDecileConcentration ? '✅' : '⏳ Not tracked'} |

### SLO Metrics (Platform Reliability)
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| **Uptime** | ${this.formatBasisPoints(snapshot.sloUptimePercent)} | ≥99.90% | ${snapshot.sloUptimePercent && snapshot.sloUptimePercent >= 9990 ? '✅ Green' : '⚠️ Below target'} |
| **P95 Latency** | ${snapshot.sloP95Latency}ms | ≤200ms | ${snapshot.sloP95Latency && snapshot.sloP95Latency <= 200 ? '✅ Green' : '⚠️ Above target'} |
| **Error Rate** | ${this.formatBasisPoints(snapshot.sloErrorRate)} | ≤0.10% | ${snapshot.sloErrorRate !== null && snapshot.sloErrorRate <= 10 ? '✅ Green' : '⚠️ Above target'} |
| **Auth Failure Rate** | ${this.formatBasisPoints(snapshot.sloAuthFailureRate)} | Low | ${snapshot.sloAuthFailureRate ? '✅' : '⏳ Not tracked'} |

### SEO Metrics (Organic Growth)
| Metric | Value | Status |
|--------|-------|--------|
| **Pages Live** | ${snapshot.seoPagesLive ?? 0} | ✅ Active |
| **Indexation Rate** | ${this.formatBasisPoints(snapshot.seoIndexationRate)} | ${snapshot.seoIndexationRate ? '✅' : '⏳ Pending GSC data'} |
| **Organic Sessions** | ${snapshot.seoOrganicSessions ?? 'Not tracked'} | ${snapshot.seoOrganicSessions ? '✅' : '⏳ Pending GA4 data'} |

### CAC/Payback Metrics (Unit Economics)
| Metric | Value | Status |
|--------|-------|--------|
| **SEO-Led CAC** | ${this.formatCents(snapshot.cacSeoLed)} | ${snapshot.cacSeoLed ? '✅' : '⏳ Not tracked'} |
| **Payback Period** | ${snapshot.paybackPeriodDays ? `${snapshot.paybackPeriodDays} days` : 'Not tracked'} | ${snapshot.paybackPeriodDays ? '✅' : '⏳ Not tracked'} |

---

${hasMissingData ? `## ⚠️ Missing Data

The following metrics are not yet tracked:

${missingMetrics.map((m: string) => `- \`${m}\``).join('\n')}

**Action Required:** Implement event telemetry for these metrics via the \`businessEvents\` table.

---
` : ''}

${hasRisks ? `## 🚨 Data Integrity Risks

${dataIntegrityRisks.map((r: string) => `- ⚠️ ${r}`).join('\n')}

---
` : ''}

## 📈 Trend Analysis

_Trend analysis will be available after 7 days of data collection._

---

## 🎯 Recommendations

${hasMissingData ? '1. **Data Completeness:** Prioritize implementing business event tracking for B2C conversion, B2B provider activity, and CAC metrics.\n' : ''}
${hasRisks ? '2. **SLO Health:** Address performance issues flagged above to maintain green SLO targets.\n' : ''}
${snapshot.seoPagesLive && snapshot.seoPagesLive > 2000 ? '3. **SEO Scale:** Monitor indexation rate closely; consider throttling if <30% at 48h mark.\n' : ''}
${!hasMissingData && !hasRisks ? '✅ All systems green. Continue monitoring daily metrics.\n' : ''}

---

## 🔍 Data Provenance

| Domain | Data Source | Hash |
|--------|-------------|------|
| SEO | ${metrics.seo.dataSource} | \`${sourceHashes.seo || 'N/A'}\` |
| SLO | ${metrics.slo.dataSource} | \`${sourceHashes.slo || 'N/A'}\` |
| B2C | ${metrics.b2c.dataSource} | \`${sourceHashes.b2c || 'N/A'}\` |
| B2B | ${metrics.b2b.dataSource} | \`${sourceHashes.b2b || 'N/A'}\` |
| CAC | ${metrics.cac.dataSource} | \`${sourceHashes.cac || 'N/A'}\` |

---

**Generated at:** ${snapshot.dataTimestamp.toISOString()}  
**Request ID:** ${snapshot.requestId}
`;

    await writeFile(filepath, md);
  }

  private formatBasisPoints(value: number | null): string {
    if (value === null) return 'No data';
    return `${(value / 100).toFixed(2)}%`;
  }

  private formatCents(value: number | null): string {
    if (value === null) return 'No data';
    return `$${(value / 100).toFixed(2)}`;
  }
}

import { readFile } from 'fs/promises';
