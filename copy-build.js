#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const items = fs.readdirSync(src);
  for (const item of items) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    
    if (fs.statSync(srcPath).isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy built files from dist/public to server/public
const srcDir = path.join(__dirname, 'dist/public');
const destDir = path.join(__dirname, 'server/public');

if (fs.existsSync(srcDir)) {
  console.log('Copying built files to server/public...');
  copyRecursive(srcDir, destDir);
  console.log('Build files copied successfully!');
} else {
  console.warn('Build directory not found:', srcDir);
}