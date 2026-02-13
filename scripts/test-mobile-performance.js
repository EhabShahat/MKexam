#!/usr/bin/env node

/**
 * Mobile Performance Testing Script
 * 
 * This script automates mobile performance testing using Puppeteer
 * to emulate mobile devices and measure key performance metrics.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Mobile device configurations
const DEVICES = {
  'iPhone 12': puppeteer.devices['iPhone 12'],
  'iPhone 12 Pro': puppeteer.devices['iPhone 12 Pro'],
  'Pixel 5': puppeteer.devices['Pixel 5'],
  'Galaxy S9+': puppeteer.devices['Galaxy S9+'],
};

// Test URLs
const TEST_URLS = [
  { name: 'Admin Dashboard', url: '/admin' },
  { name: 'Student List', url: '/admin/students' },
  { name: 'Exam Results', url: '/admin/results' },
  { name: 'Exam List', url: '/admin/exams' },
];

// Performance thresholds
const THRESHOLDS = {
  firstContentfulPaint: 1500, // ms
  timeToInteractive: 2500, // ms
  cumulativeLayoutShift: 0.1,
  totalBlockingTime: 300, // ms
  scrollFPS: 55, // Allow 5 FPS margin
};

/**
 * Measure page performance metrics
 */
async function measurePagePerformance(page, url) {
  const metrics = {
    url,
    timestamp: new Date().toISOString(),
  };

  try {
    // Navigate to page
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Get Web Vitals
    const webVitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals = {};
        
        // Get FCP
        const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
        if (fcpEntry) {
          vitals.firstContentfulPaint = fcpEntry.startTime;
        }

        // Get CLS
        let cls = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              cls += entry.value;
            }
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
        
        setTimeout(() => {
          vitals.cumulativeLayoutShift = cls;
          observer.disconnect();
          resolve(vitals);
        }, 2000);
      });
    });

    metrics.firstContentfulPaint = webVitals.firstContentfulPaint;
    metrics.cumulativeLayoutShift = webVitals.cumulativeLayoutShift;

    // Get TTI approximation using long tasks
    const longTasks = await page.evaluate(() => {
      return new Promise((resolve) => {
        const tasks = [];
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            tasks.push({
              duration: entry.duration,
              startTime: entry.startTime,
            });
          }
        });
        observer.observe({ type: 'longtask', buffered: true });
        
        setTimeout(() => {
          observer.disconnect();
          resolve(tasks);
        }, 3000);
      });
    });

    const totalBlockingTime = longTasks.reduce((sum, task) => {
      return sum + Math.max(0, task.duration - 50);
    }, 0);

    metrics.totalBlockingTime = totalBlockingTime;
    metrics.timeToInteractive = longTasks.length > 0 
      ? longTasks[longTasks.length - 1].startTime + longTasks[longTasks.length - 1].duration
      : webVitals.firstContentfulPaint;

    // Get browser metrics
    const browserMetrics = await page.metrics();
    metrics.jsHeapUsedSize = browserMetrics.JSHeapUsedSize;
    metrics.jsHeapTotalSize = browserMetrics.JSHeapTotalSize;
    metrics.documents = browserMetrics.Documents;
    metrics.frames = browserMetrics.Frames;
    metrics.jsEventListeners = browserMetrics.JSEventListeners;

    return metrics;
  } catch (error) {
    console.error(`Error measuring ${url}:`, error.message);
    metrics.error = error.message;
    return metrics;
  }
}

/**
 * Test scroll performance
 */
async function testScrollPerformance(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for content to load
    await page.waitForTimeout(1000);

    // Start performance recording
    await page.tracing.start({ screenshots: false, categories: ['devtools.timeline'] });

    // Perform scroll
    await page.evaluate(() => {
      return new Promise((resolve) => {
        let scrollTop = 0;
        const scrollHeight = document.documentElement.scrollHeight;
        const viewportHeight = window.innerHeight;
        const scrollStep = viewportHeight / 2;
        
        const scroll = () => {
          scrollTop += scrollStep;
          window.scrollTo(0, scrollTop);
          
          if (scrollTop < scrollHeight - viewportHeight) {
            requestAnimationFrame(scroll);
          } else {
            setTimeout(resolve, 500);
          }
        };
        
        requestAnimationFrame(scroll);
      });
    });

    // Stop tracing
    const tracing = await page.tracing.stop();

    // Analyze frames
    const trace = JSON.parse(tracing.toString());
    const frames = trace.traceEvents.filter(e => e.name === 'FrameCommitted');
    
    // Calculate FPS
    if (frames.length > 1) {
      const duration = (frames[frames.length - 1].ts - frames[0].ts) / 1000000; // Convert to seconds
      const fps = frames.length / duration;
      return { fps, frameCount: frames.length, duration };
    }

    return { fps: 0, frameCount: 0, duration: 0 };
  } catch (error) {
    console.error(`Error testing scroll performance:`, error.message);
    return { error: error.message };
  }
}

/**
 * Test virtualization
 */
async function testVirtualization(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForTimeout(1000);

    const virtualizationMetrics = await page.evaluate(() => {
      // Count rendered items
      const listContainer = document.querySelector('[data-virtualized="true"]') 
        || document.querySelector('[role="list"]')
        || document.querySelector('table tbody');
      
      if (!listContainer) {
        return { error: 'No virtualized list found' };
      }

      const renderedItems = listContainer.children.length;
      const totalHeight = listContainer.scrollHeight;
      const viewportHeight = window.innerHeight;

      return {
        renderedItems,
        totalHeight,
        viewportHeight,
        isVirtualized: renderedItems < 100, // Assume virtualized if < 100 items rendered
      };
    });

    return virtualizationMetrics;
  } catch (error) {
    console.error(`Error testing virtualization:`, error.message);
    return { error: error.message };
  }
}

/**
 * Test image lazy loading
 */
async function testImageLazyLoading(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Count images immediately
    const initialImages = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return {
        total: images.length,
        loaded: images.filter(img => img.complete && img.naturalHeight > 0).length,
        loading: images.filter(img => img.loading === 'lazy').length,
      };
    });

    // Wait a bit
    await page.waitForTimeout(1000);

    // Scroll to bottom
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    await page.waitForTimeout(2000);

    // Count images after scroll
    const finalImages = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return {
        total: images.length,
        loaded: images.filter(img => img.complete && img.naturalHeight > 0).length,
      };
    });

    return {
      initialLoaded: initialImages.loaded,
      finalLoaded: finalImages.loaded,
      totalImages: finalImages.total,
      lazyLoadingWorking: finalImages.loaded > initialImages.loaded,
    };
  } catch (error) {
    console.error(`Error testing image lazy loading:`, error.message);
    return { error: error.message };
  }
}

/**
 * Run all tests for a device
 */
async function runTestsForDevice(deviceName, device, baseUrl) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing on: ${deviceName}`);
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results = {
    device: deviceName,
    timestamp: new Date().toISOString(),
    tests: [],
  };

  try {
    const page = await browser.newPage();
    await page.emulate(device);

    // Test each URL
    for (const testUrl of TEST_URLS) {
      console.log(`\nTesting: ${testUrl.name}`);
      const url = `${baseUrl}${testUrl.url}`;

      const testResult = {
        name: testUrl.name,
        url: testUrl.url,
      };

      // Measure performance
      console.log('  - Measuring performance...');
      const perfMetrics = await measurePagePerformance(page, url);
      testResult.performance = perfMetrics;

      // Test scroll performance (only for list pages)
      if (testUrl.url.includes('students') || testUrl.url.includes('results') || testUrl.url.includes('exams')) {
        console.log('  - Testing scroll performance...');
        const scrollMetrics = await testScrollPerformance(page, url);
        testResult.scroll = scrollMetrics;

        // Test virtualization
        console.log('  - Testing virtualization...');
        const virtualizationMetrics = await testVirtualization(page, url);
        testResult.virtualization = virtualizationMetrics;
      }

      // Test image lazy loading (only for pages with images)
      if (testUrl.url.includes('results') || testUrl.url.includes('students')) {
        console.log('  - Testing image lazy loading...');
        const imageMetrics = await testImageLazyLoading(page, url);
        testResult.images = imageMetrics;
      }

      results.tests.push(testResult);
    }
  } catch (error) {
    console.error(`Error running tests for ${deviceName}:`, error);
    results.error = error.message;
  } finally {
    await browser.close();
  }

  return results;
}

/**
 * Validate results against thresholds
 */
function validateResults(results) {
  const validation = {
    device: results.device,
    passed: true,
    failures: [],
  };

  for (const test of results.tests) {
    const perf = test.performance;

    if (perf.firstContentfulPaint > THRESHOLDS.firstContentfulPaint) {
      validation.passed = false;
      validation.failures.push({
        test: test.name,
        metric: 'First Contentful Paint',
        value: perf.firstContentfulPaint,
        threshold: THRESHOLDS.firstContentfulPaint,
      });
    }

    if (perf.timeToInteractive > THRESHOLDS.timeToInteractive) {
      validation.passed = false;
      validation.failures.push({
        test: test.name,
        metric: 'Time to Interactive',
        value: perf.timeToInteractive,
        threshold: THRESHOLDS.timeToInteractive,
      });
    }

    if (perf.cumulativeLayoutShift > THRESHOLDS.cumulativeLayoutShift) {
      validation.passed = false;
      validation.failures.push({
        test: test.name,
        metric: 'Cumulative Layout Shift',
        value: perf.cumulativeLayoutShift,
        threshold: THRESHOLDS.cumulativeLayoutShift,
      });
    }

    if (test.scroll && test.scroll.fps < THRESHOLDS.scrollFPS) {
      validation.passed = false;
      validation.failures.push({
        test: test.name,
        metric: 'Scroll FPS',
        value: test.scroll.fps,
        threshold: THRESHOLDS.scrollFPS,
      });
    }
  }

  return validation;
}

/**
 * Generate report
 */
function generateReport(allResults, validations) {
  let report = '# Mobile Performance Test Report\n\n';
  report += `**Date**: ${new Date().toISOString()}\n\n`;
  report += '## Summary\n\n';

  const passedDevices = validations.filter(v => v.passed).length;
  const totalDevices = validations.length;

  report += `**Overall Result**: ${passedDevices}/${totalDevices} devices passed\n\n`;

  // Device results
  for (const validation of validations) {
    report += `### ${validation.device}: ${validation.passed ? '✅ PASS' : '❌ FAIL'}\n\n`;

    if (!validation.passed) {
      report += '**Failures**:\n\n';
      for (const failure of validation.failures) {
        report += `- ${failure.test} - ${failure.metric}: ${failure.value.toFixed(2)} (threshold: ${failure.threshold})\n`;
      }
      report += '\n';
    }
  }

  // Detailed metrics
  report += '## Detailed Metrics\n\n';

  for (const result of allResults) {
    report += `### ${result.device}\n\n`;

    for (const test of result.tests) {
      report += `#### ${test.name}\n\n`;

      if (test.performance) {
        report += '**Performance**:\n';
        report += `- First Contentful Paint: ${test.performance.firstContentfulPaint?.toFixed(2) || 'N/A'} ms\n`;
        report += `- Time to Interactive: ${test.performance.timeToInteractive?.toFixed(2) || 'N/A'} ms\n`;
        report += `- Cumulative Layout Shift: ${test.performance.cumulativeLayoutShift?.toFixed(3) || 'N/A'}\n`;
        report += `- Total Blocking Time: ${test.performance.totalBlockingTime?.toFixed(2) || 'N/A'} ms\n`;
        report += `- JS Heap Used: ${((test.performance.jsHeapUsedSize || 0) / 1024 / 1024).toFixed(2)} MB\n\n`;
      }

      if (test.scroll) {
        report += '**Scroll Performance**:\n';
        report += `- FPS: ${test.scroll.fps?.toFixed(2) || 'N/A'}\n`;
        report += `- Frame Count: ${test.scroll.frameCount || 'N/A'}\n`;
        report += `- Duration: ${test.scroll.duration?.toFixed(2) || 'N/A'} s\n\n`;
      }

      if (test.virtualization) {
        report += '**Virtualization**:\n';
        report += `- Rendered Items: ${test.virtualization.renderedItems || 'N/A'}\n`;
        report += `- Is Virtualized: ${test.virtualization.isVirtualized ? 'Yes' : 'No'}\n\n`;
      }

      if (test.images) {
        report += '**Image Lazy Loading**:\n';
        report += `- Initial Loaded: ${test.images.initialLoaded || 'N/A'}\n`;
        report += `- Final Loaded: ${test.images.finalLoaded || 'N/A'}\n`;
        report += `- Total Images: ${test.images.totalImages || 'N/A'}\n`;
        report += `- Lazy Loading Working: ${test.images.lazyLoadingWorking ? 'Yes' : 'No'}\n\n`;
      }
    }
  }

  return report;
}

/**
 * Main function
 */
async function main() {
  const baseUrl = process.env.TEST_URL || 'http://localhost:3000';
  const outputDir = path.join(__dirname, '..', '.kiro', 'specs', 'performance-optimization-and-backend-fixes');

  console.log('Mobile Performance Testing');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Testing ${Object.keys(DEVICES).length} devices...`);

  const allResults = [];
  const validations = [];

  // Test each device
  for (const [deviceName, device] of Object.entries(DEVICES)) {
    const results = await runTestsForDevice(deviceName, device, baseUrl);
    allResults.push(results);

    const validation = validateResults(results);
    validations.push(validation);

    // Save individual device results
    const deviceFile = path.join(outputDir, `mobile-test-${deviceName.replace(/\s+/g, '-').toLowerCase()}.json`);
    fs.writeFileSync(deviceFile, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to: ${deviceFile}`);
  }

  // Generate and save report
  const report = generateReport(allResults, validations);
  const reportFile = path.join(outputDir, 'MOBILE_TEST_REPORT.md');
  fs.writeFileSync(reportFile, report);
  console.log(`\nReport saved to: ${reportFile}`);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));

  for (const validation of validations) {
    console.log(`${validation.device}: ${validation.passed ? '✅ PASS' : '❌ FAIL'}`);
    if (!validation.passed) {
      console.log(`  Failures: ${validation.failures.length}`);
    }
  }

  const allPassed = validations.every(v => v.passed);
  console.log('\n' + '='.repeat(60));
  console.log(`Overall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  console.log('='.repeat(60));

  process.exit(allPassed ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runTestsForDevice, validateResults, generateReport };
