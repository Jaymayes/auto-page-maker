const { chromium } = require('playwright');

(async () => {
  console.log("🔵 1. Launching Headless Browser...");
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();

  console.log("🔵 2. Navigating to https://scholaraiadvisor.com ...");
  await page.goto('https://scholaraiadvisor.com', { waitUntil: 'networkidle' });

  // Take a screenshot before clicking (Evidence)
  await page.screenshot({ path: 'before_click.png' });
  console.log("📸 Screenshot saved: before_click.png");

  // Find the button (Look for the CTA link or button)
  const selectors = ['button:has-text("Get My Matches")', 'a[href*="student-pilot"]'];
  console.log("🔵 3. Searching for CTA button...");
  
  let found = false;
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        const text = await element.textContent();
        console.log("✅ FOUND BUTTON: " + text);
        
        console.log("🔵 4. CLICKING BUTTON NOW...");
        const navigationPromise = page.waitForURL(/student-pilot/, { timeout: 10000 });
        await element.click();
        await navigationPromise;
        
        const finalUrl = page.url();
        console.log("🏁 5. NAVIGATION COMPLETE.");
        console.log("👉 FINAL URL: " + finalUrl);

        // Take a screenshot after clicking
        await page.screenshot({ path: 'after_click.png' });
        console.log("📸 Screenshot saved: after_click.png");

        if (finalUrl.includes("student-pilot") && finalUrl.includes("utm_source")) {
          console.log("✅ SUCCESS: Redirected correctly with tracking.");
        } else {
          console.error("❌ FAILURE: URL did not match expected pattern.");
        }
        found = true;
        break;
      }
    } catch (error) {
      // Continue
    }
  }

  if (!found) {
    console.error("❌ ERROR: Button not found");
  }

  await browser.close();
  console.log("🔵 Browser closed.");
})();
