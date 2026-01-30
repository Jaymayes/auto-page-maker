/**
 * Production Server Launcher
 * Forces production mode and tests SEO routing
 */

// Force production environment
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '5000';

console.log('🏭 [PRODUCTION] Starting production server...');
console.log(`🏭 [PRODUCTION] NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`🏭 [PRODUCTION] PORT: ${process.env.PORT}`);

// Import and run the server after setting environment
import('./index.js').catch(error => {
  console.error('Failed to start production server:', error);
  process.exit(1);
});