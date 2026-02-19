/**
 * Performance Benchmarking Script for Results Page Rebuild
 * 
 * This script measures key performance metrics for both old and new implementations:
 * - Initial page load time
 * - Time to interactive (TTI)
 * - Memory usage with large datasets
 * - Scroll performance (FPS)
 * 
 * Usage:
 * 1. Start the development server: npm run dev
 * 2. Run this script: node .kiro/specs/results-page-rebuild/performance-benchmark.js
 * 3. Review the generated report in performance-report.json
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ITERATIONS = 3; // Number of test iterations for averaging

// Performance targets
const TARGETS = {
  pageLoadTime: 2000, // ms
  timeToInteractive: 3000, // ms
  memoryUsage: 100, // MB
  scrollFPS: 60
};

/**
 * Login to admin panel
 */
async function login(page) {
  await page.goto(`${BASE_URL}/admin/login`);
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', ADMIN_EMAIL);
  await page.type('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForNavigation();
}

/**
 * Measure page load time
 */
async function measurePageLoad(page, url) {
  const startTime = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const loadTime = Date.now() - startTime;
  return loadTime;
}

/**
 * Measure time to interactive
 */
async function measureTimeToInteractive(page, url) {
  await page.goto(url, { waitUntil: 'networkidle0' });
  
  const metrics = await page.evaluate(() => {
    const perfData = window.performance.timing;
    const tti = perfData.domInteractive - perfData.navigationStart;
    return tti;
  });
  
  return metrics;
}

/**
 * Measure memory usage
 */
async function measureMemoryUsage(page) {
  const metrics = await page.metrics();
  const memoryMB = metrics.JSHeapUsedSize / (1024 * 1024);
  return memoryMB;
}

/**
 * Measure scroll performance
 */
async function measureScrollPerformance(page) {
  // Inject FPS counter
  await page.evaluate(() => {
    window.fpsHistory = [];
    let lastTime = performance.now();
    let frames = 0;
    
    function measureFPS() {
      const currentTime = performance.now();
      frames++;
      
      if (currentTime >= lastTime + 1000) {
        const fps = Math.round((frames * 1000) / (currentTime - lastTime));
        window.fpsHistory.push(fps);
        frames = 0;
        lastTime = currentTime;
      }
      
      if (window.fpsHistory.length < 5) {
        requestAnimationFrame(measureFPS);
      }
    }
    
    requestAnimationFrame(measureFPS);
  });
  
  // Scroll through the page
  await page.evaluate(() => {
    return new Promise((resolve) => {
      let scrollTop = 0;
      const scrollHeight = document.documentElement.scrollHeight;
      const step = 100;
      
      const scroll = () => {
        scrollTop += step;
        window.scrollTo(0, scrollTop);
        
        if (scrollTop < scrollHeight - window.innerHeight) {
          setTimeout(scroll, 16); // ~60fps
        } else {
          setTimeout(resolve, 1000); // Wait for FPS measurement
        }
      };
      
      scroll();
    });
  });
  
  // Get FPS measurements
  const fpsData = await page.evaluate(() => window.fpsHistory);
  const avgFPS = fpsData.reduce((a, b) => a + b, 0) / fpsData.length;
  
  return {
    avgFPS: Math.round(avgFPS),
    minFPS: Math.min(...fpsData),
    maxFPS: Math.max(...fpsData)
  };
}

/**
 * Run benchmark for a specific implementation
 */
async function benchmarkImplementation(browser, implementationName, useNewImplementation) {
  console.log(`\n📊 Benchmarking ${implementationName}...`);
  
  const results = {
    implementation: implementationName,
    pageLoadTimes: [],
    timeToInteractive: [],
    memoryUsage: [],
    scrollPerformance: []
  };
  
  for (let i = 0; i < ITERATIONS; i++) {
    console.log(`  Iteration ${i + 1}/${ITERATIONS}...`);
    
    const page = await browser.newPage();
    
    // Set feature flag
    await page.evaluateOnNewDocument((useNew) => {
      localStorage.setItem('feature_new_results_page', useNew ? 'true' : 'false');
    }, useNewImplementation);
    
    // Login
    await login(page);
    
    // Measure page load time
    const pageLoadTime = await measurePageLoad(page, `${BASE_URL}/admin/results`);
    results.pageLoadTimes.push(pageLoadTime);
    console.log(`    Page load: ${pageLoadTime}ms`);
    
    // Measure time to interactive
    const tti = await measureTimeToInteractive(page, `${BASE_URL}/admin/results`);
    results.timeToInteractive.push(tti);
    console.log(`    TTI: ${tti}ms`);
    
    // Wait for data to load
    await page.waitForTimeout(2000);
    
    // Measure memory usage
    const memory = await measureMemoryUsage(page);
    results.memoryUsage.push(memory);
    console.log(`    Memory: ${memory.toFixed(2)}MB`);
    
    // Measure scroll performance (if table has data)
    try {
      const scrollPerf = await measureScrollPerformance(page);
      results.scrollPerformance.push(scrollPerf);
      console.log(`    Scroll FPS: ${scrollPerf.avgFPS} (min: ${scrollPerf.minFPS}, max: ${scrollPerf.maxFPS})`);
    } catch (error) {
      console.log(`    Scroll test skipped (no data)`);
    }
    
    await page.close();
  }
  
  return results;
}

/**
 * Calculate statistics
 */
function calculateStats(values) {
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const min = Math.min(...values);
  const max = Math.max(...values);
  
  return { avg, median, min, max };
}

/**
 * Generate comparison report
 */
function generateReport(oldResults, newResults) {
  const report = {
    timestamp: new Date().toISOString(),
    iterations: ITERATIONS,
    targets: TARGETS,
    results: {
      old: {
        pageLoad: calculateStats(oldResults.pageLoadTimes),
        tti: calculateStats(oldResults.timeToInteractive),
        memory: calculateStats(oldResults.memoryUsage),
        scrollFPS: oldResults.scrollPerformance.length > 0 
          ? calculateStats(oldResults.scrollPerformance.map(s => s.avgFPS))
          : null
      },
      new: {
        pageLoad: calculateStats(newResults.pageLoadTimes),
        tti: calculateStats(newResults.timeToInteractive),
        memory: calculateStats(newResults.memoryUsage),
        scrollFPS: newResults.scrollPerformance.length > 0
          ? calculateStats(newResults.scrollPerformance.map(s => s.avgFPS))
          : null
      }
    },
    improvements: {},
    targetsMet: {}
  };
  
  // Calculate improvements
  report.improvements.pageLoad = ((oldResults.pageLoadTimes[0] - newResults.pageLoadTimes[0]) / oldResults.pageLoadTimes[0] * 100).toFixed(1);
  report.improvements.tti = ((oldResults.timeToInteractive[0] - newResults.timeToInteractive[0]) / oldResults.timeToInteractive[0] * 100).toFixed(1);
  report.improvements.memory = ((oldResults.memoryUsage[0] - newResults.memoryUsage[0]) / oldResults.memoryUsage[0] * 100).toFixed(1);
  
  // Check if targets are met
  report.targetsMet.pageLoad = report.results.new.pageLoad.avg < TARGETS.pageLoadTime;
  report.targetsMet.tti = report.results.new.tti.avg < TARGETS.timeToInteractive;
  report.targetsMet.memory = report.results.new.memory.avg < TARGETS.memoryUsage;
  report.targetsMet.scrollFPS = report.results.new.scrollFPS ? report.results.new.scrollFPS.avg >= TARGETS.scrollFPS : null;
  
  return report;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting Performance Benchmark\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Iterations: ${ITERATIONS}\n`);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    // Benchmark old implementation
    const oldResults = await benchmarkImplementation(browser, 'Old Implementation', false);
    
    // Benchmark new implementation
    const newResults = await benchmarkImplementation(browser, 'New Implementation', true);
    
    // Generate report
    const report = generateReport(oldResults, newResults);
    
    // Save report
    const reportPath = path.join(__dirname, 'performance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 PERFORMANCE BENCHMARK SUMMARY');
    console.log('='.repeat(60));
    console.log(`\n📄 Full report saved to: ${reportPath}\n`);
    
    console.log('Metric                  Old         New         Improvement  Target Met');
    console.log('-'.repeat(75));
    console.log(`Page Load Time         ${report.results.old.pageLoad.avg.toFixed(0)}ms      ${report.results.new.pageLoad.avg.toFixed(0)}ms      ${report.improvements.pageLoad}%       ${report.targetsMet.pageLoad ? '✅' : '❌'}`);
    console.log(`Time to Interactive    ${report.results.old.tti.avg.toFixed(0)}ms      ${report.results.new.tti.avg.toFixed(0)}ms      ${report.improvements.tti}%       ${report.targetsMet.tti ? '✅' : '❌'}`);
    console.log(`Memory Usage           ${report.results.old.memory.avg.toFixed(1)}MB     ${report.results.new.memory.avg.toFixed(1)}MB     ${report.improvements.memory}%       ${report.targetsMet.memory ? '✅' : '❌'}`);
    
    if (report.results.new.scrollFPS) {
      console.log(`Scroll FPS             ${report.results.old.scrollFPS.avg}fps     ${report.results.new.scrollFPS.avg}fps     -            ${report.targetsMet.scrollFPS ? '✅' : '❌'}`);
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, benchmarkImplementation, generateReport };
