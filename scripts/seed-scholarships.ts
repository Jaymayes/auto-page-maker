/**
 * Scholarship Data Seeder for Load Testing
 * Populates database with realistic scholarship data
 */

import { storage } from '../server/storage.js';
import type { InsertScholarship } from '@shared/schema';

const MAJORS = ['computer-science', 'nursing', 'engineering', 'business', 'education'];
const STATES = ['texas', 'california', 'florida', 'new-york', 'pennsylvania'];
const LEVELS = ['undergraduate', 'graduate', 'high-school'];

async function seedScholarships() {
  console.log('🌱 Seeding scholarship data for load testing...\n');

  const scholarships: InsertScholarship[] = [];

  // Generate 50 diverse scholarships
  for (let i = 0; i < 50; i++) {
    const major = MAJORS[i % MAJORS.length];
    const state = STATES[Math.floor(i / MAJORS.length) % STATES.length];
    const level = LEVELS[i % LEVELS.length];
    
    scholarships.push({
      title: `${major.replace('-', ' ').toUpperCase()} Scholarship ${i + 1}`,
      description: `A scholarship for ${level} students pursuing ${major} in ${state}. Supports academic excellence and career development.`,
      amount: 1000 + (i * 100),
      deadline: new Date(Date.now() + (30 + i) * 24 * 60 * 60 * 1000), // 30+ days from now
      level,
      major,
      state,
      city: i % 3 === 0 ? 'Houston' : undefined,
      requirements: { gpa: 3.0 + (i % 10) * 0.1, essay: i % 2 === 0 },
      tags: [major, state, level],
      sourceUrl: `https://example.com/scholarship-${i + 1}`,
      sourceOrganization: `Organization ${i + 1}`,
      isActive: true,
      isFeatured: i % 10 === 0,
      isNoEssay: i % 5 === 0
    });
  }

  let created = 0;
  for (const scholarship of scholarships) {
    try {
      await storage.createScholarship(scholarship);
      created++;
    } catch (error) {
      console.error(`Failed to create scholarship:`, error);
    }
  }

  console.log(`✅ Seeded ${created} scholarships successfully`);
  
  // Verify stats endpoint works
  const stats = await storage.getScholarshipStats({});
  console.log(`\n📊 Scholarship Stats:`);
  console.log(`   Total: ${stats.count}`);
  console.log(`   Total Amount: $${stats.totalAmount.toLocaleString()}`);
  console.log(`   Average Amount: $${stats.averageAmount.toLocaleString()}`);
}

seedScholarships()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
