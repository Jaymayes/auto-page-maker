const { chromium } = require('playwright');

(async () => {
  console.log('=== BROWSER VERIFICATION TEST ===');
  console.log('Launching headless browser...');
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
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
    
    // Wait for React to hydrate
    await page.waitForTimeout(2000);
    
    // Look for the Get Matches button
    console.log('Looking for CTA button...');
    
    // Try multiple selectors
    const selectors = [
      'button:has-text("Get My Matches")',
      'a:has-text("Get My Matches")',
      '[data-testid*="matches"]',
      'button:has-text("Get")',
      'a[href*="student-pilot"]'
    ];
    
    let buttonFound = false;
    let buttonText = '';
    
    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          buttonText = await element.textContent();
          console.log(`Button Found: "${buttonText}" (selector: ${selector})`);
          buttonFound = true;
          
          // Set up navigation promise before clicking
          const navigationPromise = page.waitForURL(/student-pilot|provider-register/, { timeout: 10000 }).catch(() => null);
          
          // Click the button
          console.log('Clicking button...');
          await element.click();
          
          // Wait for navigation
          await navigationPromise;
          await page.waitForTimeout(2000);
          
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (!buttonFound) {
      // Fallback: check if there's a JavaScript redirect in the source
      console.log('No clickable button found, checking page content...');
      const content = await page.content();
      const hasStudentPilotLink = content.includes('student-pilot');
      console.log(`Page contains student-pilot reference: ${hasStudentPilotLink}`);
    }
    
    const finalUrl = page.url();
    console.log(`Final URL: ${finalUrl}`);
    
    // Verify the result
    const hasStudentPilot = finalUrl.includes('student-pilot');
    const hasUtmSource = finalUrl.includes('utm_source=auto_page_maker');
    
    console.log('');
    console.log('=== VERIFICATION RESULTS ===');
    console.log(`Contains student-pilot: ${hasStudentPilot ? 'YES ✅' : 'NO ❌'}`);
    console.log(`Contains utm_source=auto_page_maker: ${hasUtmSource ? 'YES ✅' : 'NO ❌'}`);
    
    if (hasStudentPilot && hasUtmSource) {
      console.log('');
      console.log('🎉 BROWSER VERIFICATION COMPLETE: PHYSICAL CLICK CONFIRMED.');
    } else if (hasStudentPilot) {
      console.log('');
      console.log('⚠️ PARTIAL SUCCESS: Redirect worked but UTM may be missing');
    } else {
      console.log('');
      console.log('❌ VERIFICATION FAILED: Did not navigate to expected destination');
    }
    
  } catch (error) {
    console.error('Error during test:', error.message);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
})();
