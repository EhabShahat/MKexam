#!/usr/bin/env node

/**
 * Performance Comparison Script
 * 
 * This script compares performance metrics between baseline and optimized builds.
 * It can be used to validate that optimizations meet the required thresholds.
 * 
 * Usage:
 *   node scripts/compare-performance.js --baseline baseline.json --optimized optimized.json
 *   node scripts/compare-performance.js --measure baseline
 *   node scripts/compare-performance.js --measure optimized
 */

const fs = require('fs');
const path = require('path');

// Performance thresholds from requirements
const THRESHOLDS = {
  pageLoadTime: 2000, // 2 seconds
  timeToInteractive: 2000, // 2 seconds
  scrollFPS: 60, // 60 FPS
  bundleSizeReduction: 0.3, // 30% reduction
  cumulativeLayoutShift: 0.1, // CLS score
  queryResponseTime: 500, // 500ms for p95
};

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    baseline: null,
    optimized: null,
    measure: null,
    output: null,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--baseline' && args[i + 1]) {
      options.baseline = args[i + 1];
      i++;
    } else if (args[i] === '--optimized' && args[i + 1]) {
      options.optimized = args[i + 1];
      i++;
    } else if (args[i] === '--measure' && args[i + 1]) {
      options.measure = args[i + 1];
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      options.output = args[i + 1];
      i++;
    }
  }

  return options;
}

/**
 * Load metrics from file
 */
function loadMetrics(filePath) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading metrics from ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Calculate improvement percentage
 */
function calculateImprovement(baseline, optimized) {
  if (!baseline || baseline === 0) return 0;
  return ((baseline - optimized) / baseline) * 100;
}

/**
 * Compare two metric sets
 */
function compareMetrics(baseline, optimized) {
  const comparison = {
    improvements: {},
    thresholdResults: [],
    meetsAllThresholds: true,
  };

  // Page Load Time
  if (baseline.pageLoadTime && optimized.pageLoadTime) {
    const improvement = calculateImprovement(baseline.pageLoadTime, optimized.pageLoadTime);
    comparison.improvements.pageLoadTime = {
      baseline: baseline.pageLoadTime,
      optimized: optimized.pageLoadTime,
      improvement: improvement,
      improvementMs: baseline.pageLoadTime - optimized.pageLoadTime,
    };

    const passed = optimized.pageLoadTime < THRESHOLDS.pageLoadTime;
    comparison.thresholdResults.push({
      metric: 'Page Load Time',
      value: optimized.pageLoadTime,
      threshold: THRESHOLDS.pageLoadTime,
      passed,
    });
    if (!passed) comparison.meetsAllThresholds = false;
  }

  // Time to Interactive
  if (baseline.timeToInteractive && optimized.timeToInteractive) {
    const improvement = calculateImprovement(baseline.timeToInteractive, optimized.timeToInteractive);
    comparison.improvements.timeToInteractive = {
      baseline: baseline.timeToInteractive,
      optimized: optimized.timeToInteractive,
      improvement: improvement,
      improvementMs: baseline.timeToInteractive - optimized.timeToInteractive,
    };

    const passed = optimized.timeToInteractive < THRESHOLDS.timeToInteractive;
    comparison.thresholdResults.push({
      metric: 'Time to Interactive',
      value: optimized.timeToInteractive,
      threshold: THRESHOLDS.timeToInteractive,
      passed,
    });
    if (!passed) comparison.meetsAllThresholds = false;
  }

  // Bundle Size
  if (baseline.bundleSize && optimized.bundleSize) {
    const baselineTotal = baseline.bundleSize.total;
    const optimizedTotal = optimized.bundleSize.total;
    const improvement = calculateImprovement(baselineTotal, optimizedTotal);
    
    comparison.improvements.bundleSize = {
      baseline: baselineTotal,
      optimized: optimizedTotal,
      improvement: improvement,
      improvementBytes: baselineTotal - optimizedTotal,
    };

    const passed = improvement >= (THRESHOLDS.bundleSizeReduction * 100);
    comparison.thresholdResults.push({
      metric: 'Bundle Size Reduction',
      value: improvement,
      threshold: THRESHOLDS.bundleSizeReduction * 100,
      passed,
    });
    if (!passed) comparison.meetsAllThresholds = false;
  }

  // Cumulative Layout Shift
  if (baseline.cumulativeLayoutShift !== undefined && optimized.cumulativeLayoutShift !== undefined) {
    const improvement = calculateImprovement(baseline.cumulativeLayoutShift, optimized.cumulativeLayoutShift);
    comparison.improvements.cumulativeLayoutShift = {
      baseline: baseline.cumulativeLayoutShift,
      optimized: optimized.cumulativeLayoutShift,
      improvement: improvement,
    };

    const passed = optimized.cumulativeLayoutShift < THRESHOLDS.cumulativeLayoutShift;
    comparison.thresholdResults.push({
      metric: 'Cumulative Layout Shift',
      value: optimized.cumulativeLayoutShift,
      threshold: THRESHOLDS.cumulativeLayoutShift,
      passed,
    });
    if (!passed) comparison.meetsAllThresholds = false;
  }

  // Scroll FPS
  if (baseline.scrollFPS && optimized.scrollFPS) {
    const improvement = ((optimized.scrollFPS - baseline.scrollFPS) / baseline.scrollFPS) * 100;
    comparison.improvements.scrollFPS = {
      baseline: baseline.scrollFPS,
      optimized: optimized.scrollFPS,
      improvement: improvement,
    };

    const passed = optimized.scrollFPS >= THRESHOLDS.scrollFPS;
    comparison.thresholdResults.push({
      metric: 'Scroll FPS',
      value: optimized.scrollFPS,
      threshold: THRESHOLDS.scrollFPS,
      passed,
    });
    if (!passed) comparison.meetsAllThresholds = false;
  }

  // Query Response Time
  if (baseline.queryMetrics?.p95ResponseTime && optimized.queryMetrics?.p95ResponseTime) {
    const improvement = calculateImprovement(
      baseline.queryMetrics.p95ResponseTime,
      optimized.queryMetrics.p95ResponseTime
    );
    comparison.improvements.queryResponseTime = {
      baseline: baseline.queryMetrics.p95ResponseTime,
      optimized: optimized.queryMetrics.p95ResponseTime,
      improvement: improvement,
      improvementMs: baseline.queryMetrics.p95ResponseTime - optimized.queryMetrics.p95ResponseTime,
    };

    const passed = optimized.queryMetrics.p95ResponseTime < THRESHOLDS.queryResponseTime;
    comparison.thresholdResults.push({
      metric: 'Query P95 Response Time',
      value: optimized.queryMetrics.p95ResponseTime,
      threshold: THRESHOLDS.queryResponseTime,
      passed,
    });
    if (!passed) comparison.meetsAllThresholds = false;
  }

  return comparison;
}

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Generate comparison report
 */
function generateReport(comparison) {
  let report = '\n';
  report += '═══════════════════════════════════════════════════════════\n';
  report += '           PERFORMANCE COMPARISON REPORT\n';
  report += '═══════════════════════════════════════════════════════════\n\n';

  report += 'IMPROVEMENTS:\n';
  report += '─────────────────────────────────────────────────────────\n';

  Object.entries(comparison.improvements).forEach(([metric, data]) => {
    const sign = data.improvement > 0 ? '+' : '';
    report += `\n${metric}:\n`;
    
    if (metric === 'bundleSize') {
      report += `  Baseline:    ${formatBytes(data.baseline)}\n`;
      report += `  Optimized:   ${formatBytes(data.optimized)}\n`;
      report += `  Improvement: ${sign}${data.improvement.toFixed(1)}% (${formatBytes(data.improvementBytes)})\n`;
    } else if (metric === 'cumulativeLayoutShift') {
      report += `  Baseline:    ${data.baseline.toFixed(3)}\n`;
      report += `  Optimized:   ${data.optimized.toFixed(3)}\n`;
      report += `  Improvement: ${sign}${data.improvement.toFixed(1)}%\n`;
    } else if (metric === 'scrollFPS') {
      report += `  Baseline:    ${data.baseline.toFixed(1)} FPS\n`;
      report += `  Optimized:   ${data.optimized.toFixed(1)} FPS\n`;
      report += `  Improvement: ${sign}${data.improvement.toFixed(1)}%\n`;
    } else {
      report += `  Baseline:    ${data.baseline.toFixed(0)}ms\n`;
      report += `  Optimized:   ${data.optimized.toFixed(0)}ms\n`;
      report += `  Improvement: ${sign}${data.improvement.toFixed(1)}% (${sign}${data.improvementMs.toFixed(0)}ms)\n`;
    }
  });

  report += '\n\nTHRESHOLD VALIDATION:\n';
  report += '─────────────────────────────────────────────────────────\n\n';

  comparison.thresholdResults.forEach((result) => {
    const status = result.passed ? '✓' : '✗';
    const statusText = result.passed ? 'PASS' : 'FAIL';
    
    let valueStr;
    if (result.metric === 'Cumulative Layout Shift') {
      valueStr = result.value.toFixed(3);
    } else if (result.metric === 'Bundle Size Reduction') {
      valueStr = `${result.value.toFixed(1)}%`;
    } else if (result.metric === 'Scroll FPS') {
      valueStr = `${result.value.toFixed(1)} FPS`;
    } else {
      valueStr = `${result.value.toFixed(0)}ms`;
    }

    let thresholdStr;
    if (result.metric === 'Cumulative Layout Shift') {
      thresholdStr = result.threshold.toFixed(1);
    } else if (result.metric === 'Bundle Size Reduction') {
      thresholdStr = `${result.threshold.toFixed(0)}%`;
    } else if (result.metric === 'Scroll FPS') {
      thresholdStr = `${result.threshold} FPS`;
    } else {
      thresholdStr = `${result.threshold}ms`;
    }

    report += `[${status}] ${statusText} - ${result.metric}\n`;
    report += `    Value: ${valueStr} | Threshold: ${thresholdStr}\n\n`;
  });

  report += '═══════════════════════════════════════════════════════════\n';
  
  if (comparison.meetsAllThresholds) {
    report += '✓ ALL PERFORMANCE THRESHOLDS MET\n';
  } else {
    report += '✗ SOME PERFORMANCE THRESHOLDS NOT MET\n';
  }
  
  report += '═══════════════════════════════════════════════════════════\n\n';

  return report;
}

/**
 * Main function
 */
function main() {
  const options = parseArgs();

  if (options.measure) {
    console.log(`\nMeasure mode: ${options.measure}`);
    console.log('To measure performance, use the browser-based measurement tools.');
    console.log('Run the application and use the PerformanceMonitor component.');
    console.log('\nExample metrics file structure:');
    console.log(JSON.stringify({
      pageLoadTime: 1500,
      timeToInteractive: 1800,
      firstContentfulPaint: 900,
      cumulativeLayoutShift: 0.05,
      scrollFPS: 60,
      bundleSize: { initial: 500000, total: 1200000 },
      queryMetrics: {
        averageResponseTime: 150,
        p95ResponseTime: 350,
        slowQueries: []
      }
    }, null, 2));
    return;
  }

  if (!options.baseline || !options.optimized) {
    console.error('\nError: Both --baseline and --optimized arguments are required for comparison.');
    console.error('\nUsage:');
    console.error('  node scripts/compare-performance.js --baseline baseline.json --optimized optimized.json');
    console.error('  node scripts/compare-performance.js --measure baseline');
    process.exit(1);
  }

  const baseline = loadMetrics(options.baseline);
  const optimized = loadMetrics(options.optimized);

  if (!baseline || !optimized) {
    console.error('\nError: Failed to load metrics files.');
    process.exit(1);
  }

  const comparison = compareMetrics(baseline, optimized);
  const report = generateReport(comparison);

  console.log(report);

  // Save report if output specified
  if (options.output) {
    const outputPath = path.resolve(process.cwd(), options.output);
    fs.writeFileSync(outputPath, report);
    console.log(`Report saved to: ${outputPath}\n`);
  }

  // Exit with error code if thresholds not met
  process.exit(comparison.meetsAllThresholds ? 0 : 1);
}

main();
