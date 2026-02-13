#!/usr/bin/env node

/**
 * Baseline Performance Measurement Script
 * 
 * This script provides instructions and utilities for measuring baseline
 * performance metrics before optimizations are applied.
 * 
 * Usage:
 *   node scripts/measure-baseline.js
 */

const fs = require('fs');
const path = require('path');

console.log('\n═══════════════════════════════════════════════════════════');
console.log('        BASELINE PERFORMANCE MEASUREMENT GUIDE');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('This script will guide you through measuring baseline performance metrics.\n');

console.log('STEP 1: Build and Start the Application');
console.log('─────────────────────────────────────────────────────────\n');
console.log('Run the following commands in a separate terminal:\n');
console.log('  npm run build');
console.log('  npm run start\n');

console.log('STEP 2: Open Browser DevTools');
console.log('─────────────────────────────────────────────────────────\n');
console.log('1. Open the application in your browser (http://localhost:3000)');
console.log('2. Open DevTools (F12 or Cmd+Option+I)');
console.log('3. Go to the Console tab\n');

console.log('STEP 3: Collect Performance Metrics');
console.log('─────────────────────────────────────────────────────────\n');
console.log('Copy and paste the following code into the browser console:\n');

const browserScript = `
// Performance Measurement Script
(async function measurePerformance() {
  console.log('Collecting performance metrics...');
  
  // Get navigation timing
  const perfEntries = performance.getEntriesByType('navigation');
  const navTiming = perfEntries[0];
  
  // Calculate metrics
  const pageLoadTime = navTiming.loadEventEnd - navTiming.fetchStart;
  const timeToInteractive = navTiming.domInteractive - navTiming.fetchStart;
  const firstContentfulPaint = performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0;
  
  // Get CLS
  let clsScore = 0;
  const clsEntries = performance.getEntriesByType('layout-shift');
  clsEntries.forEach((entry) => {
    if (!entry.hadRecentInput) {
      clsScore += entry.value;
    }
  });
  
  // Measure bundle size
  const resources = performance.getEntriesByType('resource');
  let initialSize = 0;
  let totalSize = 0;
  
  resources.forEach((resource) => {
    const size = resource.transferSize || resource.encodedBodySize || 0;
    totalSize += size;
    
    if (
      resource.name.includes('.js') ||
      resource.name.includes('.css') ||
      resource.initiatorType === 'script' ||
      resource.initiatorType === 'link'
    ) {
      initialSize += size;
    }
  });
  
  // Measure scroll FPS (requires scrolling)
  console.log('Scroll the page for 2 seconds to measure FPS...');
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  let frameCount = 0;
  let lastTime = performance.now();
  const duration = 1000;
  
  const measureFPS = () => {
    return new Promise((resolve) => {
      const measureFrame = () => {
        frameCount++;
        const currentTime = performance.now();
        
        if (currentTime - lastTime >= duration) {
          const fps = (frameCount / (currentTime - lastTime)) * 1000;
          resolve(fps);
        } else {
          requestAnimationFrame(measureFrame);
        }
      };
      
      requestAnimationFrame(measureFrame);
    });
  };
  
  const scrollFPS = await measureFPS();
  
  // Compile metrics
  const metrics = {
    pageLoadTime: Math.round(pageLoadTime),
    timeToInteractive: Math.round(timeToInteractive),
    firstContentfulPaint: Math.round(firstContentfulPaint),
    cumulativeLayoutShift: parseFloat(clsScore.toFixed(3)),
    scrollFPS: Math.round(scrollFPS),
    bundleSize: {
      initial: initialSize,
      total: totalSize
    },
    queryMetrics: {
      averageResponseTime: 0,
      p95ResponseTime: 0,
      slowQueries: []
    }
  };
  
  console.log('\\n═══════════════════════════════════════════════════════════');
  console.log('              BASELINE PERFORMANCE METRICS');
  console.log('═══════════════════════════════════════════════════════════\\n');
  console.log('Copy the following JSON to baseline-metrics.json:\\n');
  console.log(JSON.stringify(metrics, null, 2));
  console.log('\\n═══════════════════════════════════════════════════════════\\n');
  
  return metrics;
})();
`;

console.log(browserScript);

console.log('\nSTEP 4: Save Baseline Metrics');
console.log('─────────────────────────────────────────────────────────\n');
console.log('1. Copy the JSON output from the console');
console.log('2. Save it to: .kiro/specs/performance-optimization-and-backend-fixes/baseline-metrics.json\n');

console.log('STEP 5: Measure Query Performance (Optional)');
console.log('─────────────────────────────────────────────────────────\n');
console.log('To measure database query performance:');
console.log('1. Navigate to admin pages (login, exams, results)');
console.log('2. Check Network tab for API response times');
console.log('3. Record the slowest queries and their durations');
console.log('4. Update queryMetrics in baseline-metrics.json\n');

console.log('STEP 6: Run Lighthouse (Optional)');
console.log('─────────────────────────────────────────────────────────\n');
console.log('For comprehensive metrics, run Lighthouse CI:\n');
console.log('  npm run perf:lighthouse\n');

console.log('═══════════════════════════════════════════════════════════\n');

// Create template file
const templatePath = path.join(
  process.cwd(),
  '.kiro/specs/performance-optimization-and-backend-fixes/baseline-metrics.template.json'
);

const template = {
  pageLoadTime: 0,
  timeToInteractive: 0,
  firstContentfulPaint: 0,
  cumulativeLayoutShift: 0,
  scrollFPS: 0,
  bundleSize: {
    initial: 0,
    total: 0
  },
  queryMetrics: {
    averageResponseTime: 0,
    p95ResponseTime: 0,
    slowQueries: []
  },
  _notes: {
    pageLoadTime: 'Time from navigation start to load event (ms)',
    timeToInteractive: 'Time until page is fully interactive (ms)',
    firstContentfulPaint: 'Time to first content render (ms)',
    cumulativeLayoutShift: 'Layout shift score (lower is better)',
    scrollFPS: 'Frames per second during scrolling',
    bundleSize: 'JavaScript and CSS bundle sizes in bytes',
    queryMetrics: 'Database query performance metrics'
  }
};

try {
  fs.writeFileSync(templatePath, JSON.stringify(template, null, 2));
  console.log(`Template file created: ${templatePath}\n`);
} catch (error) {
  console.error('Error creating template file:', error.message);
}
