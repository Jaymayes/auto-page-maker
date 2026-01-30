const { chromium } = require('playwright');

(async () => {
  console.log('=== BROWSER VERIFICATION TEST ===');
  console.log('Launching headless browser...');
  
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('Navigating to https://scholaraiadvisor.com ...');
    await page.goto('https://scholaraiadvisor.com', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    console.log('Page loaded successfully');
    
    await page.waitForTimeout(2000);
    console.log('Looking for CTA button...');
    
    const selectors = [
      'button:has-text("Get My Matches")',
      'a:has-text("Get My Matches")',
      'button:has-text("Get")',
      'a[href*="student-pilot"]'
    ];
    
    let buttonFound = false;
    
    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const buttonText = await element.textContent();
          console.log('Button Found: "' + buttonText + '" (selector: ' + selector + ')');
          buttonFound = true;
          
          const navigationPromise = page.waitForURL(/student-pilot|provider-register/, { timeout: 10000 }).catch(() => null);
          console.log('Clicking button...');
          await element.click();
          await navigationPromise;
          await page.waitForTimeout(2000);
          break;
        }
      } catch (e) {}
    }
    
    if (!buttonFound) {
      console.log('No clickable button found, checking page content...');
      const content = await page.content();
      console.log('Page contains student-pilot reference: ' + content.includes('student-pilot'));
    }
    
    const finalUrl = page.url();
    console.log('Final URL: ' + finalUrl);
    
    const hasStudentPilot = finalUrl.includes('student-pilot');
    const hasUtmSource = finalUrl.includes('utm_source=auto_page_maker');
    
    console.log('');
    console.log('=== VERIFICATION RESULTS ===');
    console.log('Contains student-pilot: ' + (hasStudentPilot ? 'YES' : 'NO'));
    console.log('Contains utm_source=auto_page_maker: ' + (hasUtmSource ? 'YES' : 'NO'));
    
    if (hasStudentPilot && hasUtmSource) {
      console.log('');
      console.log('BROWSER VERIFICATION COMPLETE: PHYSICAL CLICK CONFIRMED.');
    } else if (hasStudentPilot) {
      console.log('');
      console.log('PARTIAL SUCCESS: Redirect worked but UTM may be missing');
    } else {
      console.log('');
      console.log('VERIFICATION FAILED: Did not navigate to expected destination');
    }
    
  } catch (error) {
    console.error('Error during test:', error.message);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
})();
