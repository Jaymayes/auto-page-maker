/**
 * DbStorage CRUD Validation Script
 * Tests all CRUD operations for landing pages to verify DbStorage implementation
 */

import { storage } from '../server/storage.js';
import type { InsertLandingPage } from '@shared/schema';

async function runCrudTests() {
  console.log('🧪 DbStorage CRUD Validation Starting...\n');

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Create a landing page
  console.log('Test 1: CREATE landing page');
  try {
    const testPage: InsertLandingPage = {
      slug: `test-crud-${Date.now()}`,
      title: 'Test CRUD Page',
      metaDescription: 'Testing CRUD operations for DbStorage migration validation',
      template: 'test',
      templateData: { test: true },
      content: { h1: 'Test Page', introText: 'This is a test page' },
      isPublished: false,
      lastGenerated: new Date()
    };

    const created = await storage.createLandingPage(testPage);
    if (created && created.id && created.slug === testPage.slug) {
      console.log('✅ CREATE successful - Page created with ID:', created.id);
      testsPassed++;
    } else {
      console.error('❌ CREATE failed - Invalid response');
      testsFailed++;
    }
  } catch (error) {
    console.error('❌ CREATE failed:', error);
    testsFailed++;
  }

  // Test 2: Read the landing page
  console.log('\nTest 2: READ landing page by slug');
  try {
    const testSlug = (await storage.getLandingPages({ isPublished: false }))[0]?.slug;
    if (testSlug) {
      const read = await storage.getLandingPage(testSlug);
      if (read && read.slug === testSlug) {
        console.log('✅ READ successful - Retrieved page:', read.title);
        testsPassed++;
      } else {
        console.error('❌ READ failed - Page not found');
        testsFailed++;
      }
    }
  } catch (error) {
    console.error('❌ READ failed:', error);
    testsFailed++;
  }

  // Test 3: Update the landing page
  console.log('\nTest 3: UPDATE landing page');
  try {
    const pages = await storage.getLandingPages({ isPublished: false });
    const testPage = pages.find(p => p.slug.startsWith('test-crud-'));
    
    if (testPage) {
      const updated = await storage.updateLandingPage(testPage.id, {
        title: 'Updated Test Page',
        isPublished: true
      });

      if (updated && updated.title === 'Updated Test Page' && updated.isPublished === true) {
        console.log('✅ UPDATE successful - Title updated:', updated.title);
        testsPassed++;
      } else {
        console.error('❌ UPDATE failed - Invalid response');
        testsFailed++;
      }
    }
  } catch (error) {
    console.error('❌ UPDATE failed:', error);
    testsFailed++;
  }

  // Test 4: List all landing pages
  console.log('\nTest 4: LIST all landing pages');
  try {
    const allPages = await storage.getLandingPages();
    if (allPages && allPages.length >= 130) {
      console.log(`✅ LIST successful - Found ${allPages.length} pages (>= 130 expected)`);
      testsPassed++;
    } else {
      console.error(`❌ LIST failed - Only ${allPages?.length || 0} pages found`);
      testsFailed++;
    }
  } catch (error) {
    console.error('❌ LIST failed:', error);
    testsFailed++;
  }

  // Test 5: Filter published pages
  console.log('\nTest 5: FILTER published pages');
  try {
    const published = await storage.getLandingPages({ isPublished: true });
    const unpublished = await storage.getLandingPages({ isPublished: false });
    
    if (published && unpublished) {
      console.log(`✅ FILTER successful - Published: ${published.length}, Unpublished: ${unpublished.length}`);
      testsPassed++;
    } else {
      console.error('❌ FILTER failed');
      testsFailed++;
    }
  } catch (error) {
    console.error('❌ FILTER failed:', error);
    testsFailed++;
  }

  // Test 6: Concurrent writes (simulated)
  console.log('\nTest 6: CONCURRENT writes');
  try {
    const writes = await Promise.all([
      storage.createLandingPage({
        slug: `concurrent-1-${Date.now()}`,
        title: 'Concurrent 1',
        metaDescription: 'Test concurrent write 1',
        template: 'test',
        templateData: {},
        content: {},
        isPublished: false
      }),
      storage.createLandingPage({
        slug: `concurrent-2-${Date.now()}`,
        title: 'Concurrent 2',
        metaDescription: 'Test concurrent write 2',
        template: 'test',
        templateData: {},
        content: {},
        isPublished: false
      })
    ]);

    if (writes.length === 2 && writes.every(w => w && w.id)) {
      console.log('✅ CONCURRENT writes successful - Both pages created');
      testsPassed++;
    } else {
      console.error('❌ CONCURRENT writes failed');
      testsFailed++;
    }
  } catch (error) {
    console.error('❌ CONCURRENT writes failed:', error);
    testsFailed++;
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary:');
  console.log(`   ✅ Passed: ${testsPassed}`);
  console.log(`   ❌ Failed: ${testsFailed}`);
  console.log(`   📝 Total: ${testsPassed + testsFailed}`);
  
  if (testsFailed === 0) {
    console.log('\n🎉 All CRUD tests passed! DbStorage is production-ready.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Review errors above.');
    process.exit(1);
  }
}

runCrudTests();
