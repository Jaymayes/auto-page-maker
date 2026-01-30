import { SeoCollector, type SeoMetrics } from './seo-collector.js';
import { SloCollector, type SloMetrics } from './slo-collector.js';
import { B2cCollector, type B2cMetrics } from './b2c-collector.js';
import { B2bCollector, type B2bMetrics } from './b2b-collector.js';
import { CacCollector, type CacMetrics } from './cac-collector.js';

export { SeoCollector, SloCollector, B2cCollector, B2bCollector, CacCollector };
export type { SeoMetrics, SloMetrics, B2cMetrics, B2bMetrics, CacMetrics };

export interface AllMetrics {
  seo: SeoMetrics;
  slo: SloMetrics;
  b2c: B2cMetrics;
  b2b: B2bMetrics;
  cac: CacMetrics;
}

export async function collectAllMetrics(): Promise<AllMetrics> {
  const seoCollector = new SeoCollector();
  const sloCollector = new SloCollector();
  const b2cCollector = new B2cCollector();
  const b2bCollector = new B2bCollector();
  const cacCollector = new CacCollector();

  const [seo, slo, b2c, b2b, cac] = await Promise.all([
    seoCollector.collect(),
    sloCollector.collect(),
    b2cCollector.collect(),
    b2bCollector.collect(),
    cacCollector.collect(),
  ]);

  return { seo, slo, b2c, b2b, cac };
}
