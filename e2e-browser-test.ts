import { chromium } from '@playwright/test';

const BASE_URL = 'https://scholaraiadvisor.com';

async function runTests() {
  console.log('==========================================');
  console.log('BROWSER-BASED E2E TEST REPORT');
  console.log('==========================================');
  console.log(`TARGET: ${BASE_URL}`);
  console.log(`TIMESTAMP: ${new Date().toISOString()}`);
  console.log('--------------------------------------------------\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors: string[] = [];
  const brokenLinks: {url: string, status: number}[] = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    // Homepage
    console.log('PHASE 1: HOMEPAGE LOAD');
    console.log('-----------------------');
    const start = Date.now();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`Loaded in ${Date.now() - start}ms`);
    console.log(`Title: ${await page.title()}`);
    await page.screenshot({ path: '/tmp/home.png' });
    console.log('Screenshot: /tmp/home.png\n');

    // Link audit
    console.log('PHASE 2: BROKEN LINK AUDIT');
    console.log('---------------------------');
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href]'))
        .map(a => ({ text: (a.innerText || '').trim().substring(0, 30), href: a.href }))
        .filter(l => l.href && !l.href.startsWith('javascript:') && !l.href.startsWith('mailto:'));
    });
    
    const unique = [...new Map(links.map(l => [l.href, l])).values()];
    console.log(`Found ${unique.length} unique links\n`);
    
    for (const link of unique.slice(0, 10)) {
      try {
        const resp = await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 10000 });
        const status = resp?.status() || 0;
        const h1 = await page.$eval('h1', el => (el as HTMLElement).innerText.substring(0, 25)).catch(() => '-');
        console.log(`${link.href.substring(0, 50)} | ${status} | ${h1}`);
        if (status >= 400) brokenLinks.push({ url: link.href, status });
      } catch (e: any) {
        console.log(`${link.href.substring(0, 50)} | ERR | ${e.message?.substring(0, 15)}`);
      }
    }

    // Auth flow
    console.log('\nPHASE 3: AUTH PATH VALIDATION');
    console.log('------------------------------');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    
    const authLink = await page.$('a[href*="login"], a[href*="sign"], button:has-text("Sign")');
    if (authLink) {
      const href = await authLink.getAttribute('href');
      console.log(`Auth CTA found: ${href}`);
      await authLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.screenshot({ path: '/tmp/auth.png' });
      console.log(`Final URL: ${page.url()}`);
    } else {
      console.log('Testing /api/login directly...');
      await page.goto(`${BASE_URL}/api/login`);
      console.log(`Redirect: ${page.url()}`);
    }

    // Summary
    console.log('\n==========================================');
    console.log('SUMMARY');
    console.log('==========================================');
    console.log(`Console errors: ${errors.length}`);
    console.log(`Broken links: ${brokenLinks.length}`);
    console.log(`\nVERDICT: ${brokenLinks.length === 0 ? '✅ READY FOR TRAFFIC' : '⚠️ ISSUES FOUND'}`);

  } catch (e: any) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
}

runTests();
