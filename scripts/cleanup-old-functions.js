#!/usr/bin/env node

/**
 * Cleanup Script for Netlify Function Consolidation
 * 
 * This script safely removes old API function directories that have been consolidated
 * to reduce Netlify's function count and stay within limits.
 * 
 * CONSOLIDATED FUNCTIONS:
 * - attendance/* (4 functions) → attendance/route.ts with ?action parameter
 * - system/* (4 functions) → system/route.ts with ?action parameter  
 * - bootstrap/* (3 functions) → bootstrap/route.ts with ?action parameter
 * - extra-scores/attendance + sync-attendance → extra-scores/route.ts with ?action parameter
 * 
 * ESTIMATED SAVINGS: ~11 functions → 4 functions (7 function reduction)
 */

const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, '..', 'src', 'app', 'api', 'admin');

// Directories to remove (old individual functions)
const DIRS_TO_REMOVE = [
  'attendance/scan',
  'attendance/recent', 
  'attendance/history',
  'attendance/today-count',
  'system/disable',
  'system/enable',
  'system/home-buttons',
  'system/mode',
  'bootstrap/create-first-user',
  'bootstrap/reset-password',
  'extra-scores/attendance',
  'extra-scores/sync-attendance'
];

// Consolidated functions that should exist
const CONSOLIDATED_FUNCTIONS = [
  'attendance/route.ts',
  'system/route.ts',
  'bootstrap/route.ts',
  'extra-scores/route.ts'
];

function checkConsolidatedFunctions() {
  console.log('🔍 Checking consolidated functions exist...\n');
  
  let allExist = true;
  CONSOLIDATED_FUNCTIONS.forEach(func => {
    const filePath = path.join(API_DIR, func);
    const exists = fs.existsSync(filePath);
    console.log(`${exists ? '✅' : '❌'} ${func}`);
    if (!exists) allExist = false;
  });
  
  return allExist;
}

function removeOldDirectories(dryRun = true) {
  console.log(`\n${dryRun ? '🔍 DRY RUN:' : '🗑️  REMOVING:'} Old function directories...\n`);
  
  let removedCount = 0;
  let totalSavings = 0;
  
  DIRS_TO_REMOVE.forEach(dir => {
    const dirPath = path.join(API_DIR, dir);
    const exists = fs.existsSync(dirPath);
    
    if (exists) {
      if (!dryRun) {
        try {
          fs.rmSync(dirPath, { recursive: true, force: true });
          console.log(`✅ Removed: ${dir}/`);
        } catch (error) {
          console.log(`❌ Failed to remove ${dir}/: ${error.message}`);
          return;
        }
      } else {
        console.log(`🔍 Would remove: ${dir}/`);
      }
      removedCount++;
      totalSavings++;
    } else {
      console.log(`⚠️  Already gone: ${dir}/`);
    }
  });
  
  console.log(`\n📊 Summary:`);
  console.log(`   Functions ${dryRun ? 'to be removed' : 'removed'}: ${removedCount}`);
  console.log(`   Netlify function savings: ${totalSavings} functions`);
  console.log(`   New consolidated functions: ${CONSOLIDATED_FUNCTIONS.length} functions`);
  console.log(`   Net reduction: ${totalSavings - CONSOLIDATED_FUNCTIONS.length} functions`);
}

function showUsage() {
  console.log(`
🚀 Netlify Function Cleanup Script

Usage:
  node scripts/cleanup-old-functions.js [options]

Options:
  --dry-run    Show what would be removed (default)
  --execute    Actually remove the old directories
  --check      Only check if consolidated functions exist

Examples:
  node scripts/cleanup-old-functions.js              # Dry run
  node scripts/cleanup-old-functions.js --check      # Check consolidated functions
  node scripts/cleanup-old-functions.js --execute    # Actually remove old functions

⚠️  WARNING: --execute will permanently delete old function directories!
   Make sure your consolidated functions are working before running with --execute.
`);
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showUsage();
    return;
  }
  
  console.log('🎯 Netlify Function Consolidation Cleanup\n');
  
  if (args.includes('--check')) {
    const allExist = checkConsolidatedFunctions();
    process.exit(allExist ? 0 : 1);
    return;
  }
  
  const execute = args.includes('--execute');
  const dryRun = !execute;
  
  if (dryRun) {
    console.log('🔍 Running in DRY RUN mode. Use --execute to actually remove files.\n');
  } else {
    console.log('⚠️  EXECUTE mode: Will actually remove old directories!\n');
  }
  
  // First check consolidated functions exist
  const allExist = checkConsolidatedFunctions();
  
  if (!allExist && !dryRun) {
    console.log('\n❌ Some consolidated functions are missing!');
    console.log('   Please ensure all consolidated functions are created before running cleanup.');
    process.exit(1);
  }
  
  // Remove old directories
  removeOldDirectories(dryRun);
  
  if (dryRun) {
    console.log('\n💡 Run with --execute to actually remove the old functions.');
    console.log('   Test your consolidated functions first!');
  } else {
    console.log('\n✅ Cleanup completed! Your Netlify function count has been reduced.');
    console.log('   Deploy to see the reduced function usage in Netlify dashboard.');
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkConsolidatedFunctions, removeOldDirectories };
