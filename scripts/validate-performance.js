#!/usr/bin/env node

/**
 * Performance Validation Script
 * 
 * This script validates that optimized performance metrics meet all
 * required thresholds from the requirements.
 * 
 * Usage:
 *   node scripts/validate-performance.js [metrics-file]
 *   node scripts/validate-performance.js optimized-metrics.json
 */

const fs = require('fs');
const path = require('path');

// Performance thresholds from requirements
const THRESHOLDS = {
  pageLoadTime: { value: 2000, operator: '<', requirement: '6.1' },
  timeToInteractive: { value: 2000, operator: '<', requirement: '6.2' },
  scrollFPS: { value: 60, operator: '>=', requirement: '6.3' },
  bundleSizeReduction: { value: 30, operator: '>=', requirement: '6.4' },
  cumulativeLayoutShift: { value: 0.1, operator: '<', requirement: '6.5' },
  queryP95ResponseTime: { value: 500, operator: '<', requirement: '6.6' },
};

// Baseline metrics for comparison
const BASELINE = {
  pageLoadTime: 3500,
  timeToInteractive: 3200,
  bundleSize: { total: 2100000 },
  cumulativeLayoutShift: 0.25,
  scrollFPS: 45,
  queryMetrics: { p95ResponseTime: 650 },
};

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
 * Validate a single metric against threshold
 */
function validateMetric(name, value, threshold) {
  const { value: thresholdValue, operator, requirement } = threshold;
  let passed = false;

  switch (operator) {
    case '<':
      passed = value < thresholdValue;
      break;
    case '<=':
      passed = value <= thresholdValue;
      break;
    case '>':
      passed = value > thresholdValue;
      break;
    case '>=':
      passed = value >= thresholdValue;
      break;
    case '==':
      passed = value === thresholdValue;
      break;
    default:
      passed = false;
  }

  return {
    name,
    value,
    threshold: thresholdValue,
    operator,
    requirement,
    passed,
  };
}

/**
 * Calculate bundle size reduction percentage
 */
function calculateBundleSizeReduction(baseline, optimized) {
  if (!baseline || !optimized) return 0;
  return ((baseline - optimized) / baseline) * 100;
}

/**
 * Format value for display
 */
function formatValue(name, value) {
  if (name.includes('Time')) {
    return `${value}ms`;
  }
  if (name.includes('FPS')) {
    return `${value} FPS`;
  }
  if (name.includes('Shift')) {
    return value.toFixed(3);
  }
  if (name.includes('Reduction')) {
    return `${value.toFixed(1)}%`;
  }
  return value.toString();
}

/**
 * Validate all metrics
 */
function validateAllMetrics(metrics) {
  const results = [];

  // Page Load Time
  if (metrics.pageLoadTime !== undefined) {
    results.push(
      validateMetric(
        'Page Load Time',
        metrics.pageLoadTime,
        THRESHOLDS.pageLoadTime
      )
    );
  }

  // Time to Interactive
  if (metrics.timeToInteractive !== undefined) {
    results.push(
      validateMetric(
        'Time to Interactive',
        metrics.timeToInteractive,
        THRESHOLDS.timeToInteractive
      )
    );
  }

  // Scroll FPS
  if (metrics.scrollFPS !== undefined) {
    results.push(
      validateMetric(
        'Scroll FPS',
        metrics.scrollFPS,
        THRESHOLDS.scrollFPS
      )
    );
  }

  // Bundle Size Reduction
  if (metrics.bundleSize?.total !== undefined) {
    const reduction = calculateBundleSizeReduction(
      BASELINE.bundleSize.total,
      metrics.bundleSize.total
    );
    results.push(
      validateMetric(
        'Bundle Size Reduction',
        reduction,
        THRESHOLDS.bundleSizeReduction
      )
    );
  }

  // Cumulative Layout Shift
  if (metrics.cumulativeLayoutShift !== undefined) {
    results.push(
      validateMetric(
        'Cumulative Layout Shift',
        metrics.cumulativeLayoutShift,
        THRESHOLDS.cumulativeLayoutShift
      )
    );
  }

  // Query P95 Response Time
  if (metrics.queryMetrics?.p95ResponseTime !== undefined) {
    results.push(
      validateMetric(
        'Query P95 Response Time',
        metrics.queryMetrics.p95ResponseTime,
        THRESHOLDS.queryP95ResponseTime
      )
    );
  }

  return results;
}

/**
 * Generate validation report
 */
function generateReport(results) {
  let report = '\n';
  report += '═══════════════════════════════════════════════════════════\n';
  report += '          PERFORMANCE VALIDATION REPORT\n';
  report += '═══════════════════════════════════════════════════════════\n\n';

  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const allPassed = passed === total;

  report += `Status: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}\n`;
  report += `Results: ${passed}/${total} tests passed\n\n`;

  report += 'DETAILED RESULTS:\n';
  report += '─────────────────────────────────────────────────────────\n\n';

  results.forEach((result) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const icon = result.passed ? '✓' : '✗';
    
    report += `[${icon}] ${status} - ${result.name}\n`;
    report += `    Requirement: ${result.requirement}\n`;
    report += `    Value: ${formatValue(result.name, result.value)}\n`;
    report += `    Threshold: ${result.operator} ${formatValue(result.name, result.threshold)}\n`;
    
    if (!result.passed) {
      const diff = result.operator.includes('<') 
        ? result.value - result.threshold
        : result.threshold - result.value;
      report += `    ⚠️  Exceeds threshold by: ${formatValue(result.name, Math.abs(diff))}\n`;
    }
    
    report += '\n';
  });

  report += '═══════════════════════════════════════════════════════════\n';

  if (allPassed) {
    report += '\n🎉 SUCCESS! All performance targets have been met.\n';
    report += '\nThe application meets all requirements:\n';
    report += '  ✓ Page load time < 2 seconds\n';
    report += '  ✓ Time to Interactive < 2 seconds\n';
    report += '  ✓ Scroll FPS ≥ 60\n';
    report += '  ✓ Bundle size reduction ≥ 30%\n';
    report += '  ✓ Cumulative Layout Shift < 0.1\n';
    report += '  ✓ Query P95 response time < 500ms\n';
  } else {
    report += '\n⚠️  WARNING! Some performance targets were not met.\n';
    report += '\nPlease review the failed tests above and apply additional\n';
    report += 'optimizations to meet all requirements.\n';
  }

  report += '\n═══════════════════════════════════════════════════════════\n\n';

  return { report, allPassed };
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  
  // Default to optimized metrics file
  const metricsFile = args[0] || '.kiro/specs/performance-optimization-and-backend-fixes/optimized-metrics.json';

  console.log('\n🔍 Validating performance metrics...\n');
  console.log(`Loading metrics from: ${metricsFile}\n`);

  const metrics = loadMetrics(metricsFile);

  if (!metrics) {
    console.error('\n❌ Error: Failed to load metrics file.\n');
    console.error('Usage: node scripts/validate-performance.js [metrics-file]\n');
    process.exit(1);
  }

  const results = validateAllMetrics(metrics);

  if (results.length === 0) {
    console.error('\n❌ Error: No metrics found to validate.\n');
    console.error('Ensure the metrics file contains the required fields.\n');
    process.exit(1);
  }

  const { report, allPassed } = generateReport(results);

  console.log(report);

  // Exit with appropriate code
  process.exit(allPassed ? 0 : 1);
}

main();
