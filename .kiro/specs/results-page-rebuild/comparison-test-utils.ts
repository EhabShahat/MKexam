/**
 * Comparison Testing Utilities for Results Page Rebuild
 * 
 * This module provides utilities for automated comparison testing between
 * old and new Results Page implementations.
 * 
 * @module comparison-test-utils
 */

/**
 * Score calculation result structure
 */
interface CalculationResult {
  examComponent: {
    mode: 'best' | 'avg';
    score: number;
    examsIncluded: number;
    examsTotal: number;
    examsPassed: number;
    details: Array<{
      examId: string;
      examTitle: string;
      score: number | null;
      passed: boolean;
      passThreshold: number;
    }>;
  };
  extraComponent: {
    score: number;
    totalWeight: number;
    details: Array<{
      fieldKey: string;
      fieldLabel: string;
      rawValue: any;
      normalizedScore: number;
      weight: number;
      weightedContribution: number;
    }>;
  };
  finalScore: number;
  passed: boolean;
  failedDueToExam: boolean;
  passThreshold: number;
}

/**
 * Comparison result for a single test case
 */
interface ComparisonResult {
  testId: string;
  testName: string;
  passed: boolean;
  oldValue: any;
  newValue: any;
  difference?: any;
  message?: string;
}

/**
 * Compare two numbers with tolerance for floating point precision
 */
export function compareNumbers(
  a: number | null,
  b: number | null,
  tolerance: number = 0.01
): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return Math.abs(a - b) < tolerance;
}

/**
 * Compare two score calculation results
 */
export function compareCalculations(
  oldCalc: CalculationResult,
  newCalc: CalculationResult,
  tolerance: number = 0.01
): ComparisonResult[] {
  const results: ComparisonResult[] = [];

  // Compare exam component
  results.push({
    testId: '5.1',
    testName: 'Exam Component Score',
    passed: compareNumbers(oldCalc.examComponent.score, newCalc.examComponent.score, tolerance),
    oldValue: oldCalc.examComponent.score,
    newValue: newCalc.examComponent.score,
    difference: Math.abs(oldCalc.examComponent.score - newCalc.examComponent.score),
  });

  results.push({
    testId: '5.2',
    testName: 'Exam Component Mode',
    passed: oldCalc.examComponent.mode === newCalc.examComponent.mode,
    oldValue: oldCalc.examComponent.mode,
    newValue: newCalc.examComponent.mode,
  });

  // Compare extra component
  results.push({
    testId: '5.4',
    testName: 'Extra Component Score',
    passed: compareNumbers(oldCalc.extraComponent.score, newCalc.extraComponent.score, tolerance),
    oldValue: oldCalc.extraComponent.score,
    newValue: newCalc.extraComponent.score,
    difference: Math.abs(oldCalc.extraComponent.score - newCalc.extraComponent.score),
  });

  // Compare final score
  results.push({
    testId: '5.6',
    testName: 'Final Score',
    passed: compareNumbers(oldCalc.finalScore, newCalc.finalScore, tolerance),
    oldValue: oldCalc.finalScore,
    newValue: newCalc.finalScore,
    difference: Math.abs(oldCalc.finalScore - newCalc.finalScore),
  });

  // Compare pass/fail
  results.push({
    testId: '5.7',
    testName: 'Pass/Fail Determination',
    passed: oldCalc.passed === newCalc.passed,
    oldValue: oldCalc.passed,
    newValue: newCalc.passed,
  });

  results.push({
    testId: '5.8',
    testName: 'Failed Due to Exam',
    passed: oldCalc.failedDueToExam === newCalc.failedDueToExam,
    oldValue: oldCalc.failedDueToExam,
    newValue: newCalc.failedDueToExam,
  });

  return results;
}

/**
 * Compare two arrays of data (e.g., attempts, summaries)
 */
export function compareArrays<T>(
  oldArray: T[],
  newArray: T[],
  keyExtractor: (item: T) => string,
  comparator: (a: T, b: T) => boolean
): ComparisonResult {
  const oldMap = new Map(oldArray.map(item => [keyExtractor(item), item]));
  const newMap = new Map(newArray.map(item => [keyExtractor(item), item]));

  const missingInNew: string[] = [];
  const missingInOld: string[] = [];
  const different: string[] = [];

  // Check for items in old but not in new
  for (const [key, oldItem] of oldMap) {
    const newItem = newMap.get(key);
    if (!newItem) {
      missingInNew.push(key);
    } else if (!comparator(oldItem, newItem)) {
      different.push(key);
    }
  }

  // Check for items in new but not in old
  for (const key of newMap.keys()) {
    if (!oldMap.has(key)) {
      missingInOld.push(key);
    }
  }

  const passed = missingInNew.length === 0 && missingInOld.length === 0 && different.length === 0;

  return {
    testId: 'array-comparison',
    testName: 'Array Data Comparison',
    passed,
    oldValue: oldArray.length,
    newValue: newArray.length,
    difference: {
      missingInNew,
      missingInOld,
      different,
    },
    message: passed
      ? 'Arrays match perfectly'
      : `Found ${missingInNew.length} missing in new, ${missingInOld.length} missing in old, ${different.length} different`,
  };
}

/**
 * Compare CSV export files
 */
export function compareCSVFiles(
  oldCSV: string,
  newCSV: string
): ComparisonResult {
  const oldLines = oldCSV.trim().split('\n');
  const newLines = newCSV.trim().split('\n');

  if (oldLines.length !== newLines.length) {
    return {
      testId: '8.4',
      testName: 'CSV Row Count',
      passed: false,
      oldValue: oldLines.length,
      newValue: newLines.length,
      message: `Row count mismatch: old has ${oldLines.length}, new has ${newLines.length}`,
    };
  }

  const differences: Array<{ line: number; old: string; new: string }> = [];

  for (let i = 0; i < oldLines.length; i++) {
    if (oldLines[i] !== newLines[i]) {
      differences.push({
        line: i + 1,
        old: oldLines[i],
        new: newLines[i],
      });
    }
  }

  return {
    testId: '8.4',
    testName: 'CSV Content Comparison',
    passed: differences.length === 0,
    oldValue: oldLines.length,
    newValue: newLines.length,
    difference: differences,
    message: differences.length === 0
      ? 'CSV files match perfectly'
      : `Found ${differences.length} different lines`,
  };
}

/**
 * Generate comparison report
 */
export function generateComparisonReport(
  results: ComparisonResult[]
): string {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  let report = '# Comparison Test Report\n\n';
  report += `**Summary**: ${passed}/${total} tests passed (${failed} failed)\n\n`;

  if (failed > 0) {
    report += '## Failed Tests\n\n';
    results
      .filter(r => !r.passed)
      .forEach(r => {
        report += `### ${r.testId}: ${r.testName}\n`;
        report += `- **Old Value**: ${JSON.stringify(r.oldValue)}\n`;
        report += `- **New Value**: ${JSON.stringify(r.newValue)}\n`;
        if (r.difference !== undefined) {
          report += `- **Difference**: ${JSON.stringify(r.difference)}\n`;
        }
        if (r.message) {
          report += `- **Message**: ${r.message}\n`;
        }
        report += '\n';
      });
  }

  report += '## All Test Results\n\n';
  report += '| Test ID | Test Name | Status | Old Value | New Value |\n';
  report += '|---------|-----------|--------|-----------|----------|\n';
  results.forEach(r => {
    const status = r.passed ? '✅ Pass' : '❌ Fail';
    const oldVal = typeof r.oldValue === 'object' ? 'Object' : String(r.oldValue);
    const newVal = typeof r.newValue === 'object' ? 'Object' : String(r.newValue);
    report += `| ${r.testId} | ${r.testName} | ${status} | ${oldVal} | ${newVal} |\n`;
  });

  return report;
}

/**
 * Performance metrics comparison
 */
export interface PerformanceMetrics {
  pageLoadTime: number;
  timeToInteractive: number;
  memoryUsage: number;
  scrollFPS: number;
  filterResponseTime: number;
  sortResponseTime: number;
  exportTime: number;
}

export function comparePerformance(
  oldMetrics: PerformanceMetrics,
  newMetrics: PerformanceMetrics
): ComparisonResult[] {
  const results: ComparisonResult[] = [];

  const metrics: Array<{ key: keyof PerformanceMetrics; name: string; target?: number }> = [
    { key: 'pageLoadTime', name: 'Page Load Time', target: 2000 },
    { key: 'timeToInteractive', name: 'Time to Interactive', target: 3000 },
    { key: 'memoryUsage', name: 'Memory Usage', target: 100 },
    { key: 'scrollFPS', name: 'Scroll FPS', target: 60 },
    { key: 'filterResponseTime', name: 'Filter Response Time' },
    { key: 'sortResponseTime', name: 'Sort Response Time' },
    { key: 'exportTime', name: 'Export Time' },
  ];

  metrics.forEach(({ key, name, target }) => {
    const oldValue = oldMetrics[key];
    const newValue = newMetrics[key];
    const improvement = ((oldValue - newValue) / oldValue) * 100;
    const meetsTarget = target ? newValue <= target : true;

    results.push({
      testId: `perf-${key}`,
      testName: name,
      passed: newValue <= oldValue && meetsTarget,
      oldValue,
      newValue,
      difference: {
        absolute: oldValue - newValue,
        percentage: improvement.toFixed(2) + '%',
        meetsTarget,
      },
      message: improvement > 0
        ? `Improved by ${improvement.toFixed(2)}%`
        : `Regressed by ${Math.abs(improvement).toFixed(2)}%`,
    });
  });

  return results;
}

/**
 * Utility to capture performance metrics using browser APIs
 */
export function capturePerformanceMetrics(): Partial<PerformanceMetrics> {
  if (typeof window === 'undefined' || !window.performance) {
    return {};
  }

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  const paint = performance.getEntriesByType('paint');

  const metrics: Partial<PerformanceMetrics> = {};

  if (navigation) {
    metrics.pageLoadTime = navigation.loadEventEnd - navigation.fetchStart;
    metrics.timeToInteractive = navigation.domInteractive - navigation.fetchStart;
  }

  // Memory usage (Chrome only)
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    metrics.memoryUsage = memory.usedJSHeapSize / (1024 * 1024); // Convert to MB
  }

  return metrics;
}

/**
 * Utility to measure FPS during scrolling
 */
export function measureScrollFPS(
  element: HTMLElement,
  duration: number = 2000
): Promise<number> {
  return new Promise((resolve) => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animationId: number;

    const measureFrame = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime - lastTime >= duration) {
        cancelAnimationFrame(animationId);
        const fps = (frameCount / duration) * 1000;
        resolve(fps);
      } else {
        animationId = requestAnimationFrame(measureFrame);
      }
    };

    // Trigger scroll
    element.scrollTop += 1;
    animationId = requestAnimationFrame(measureFrame);
  });
}

/**
 * Utility to measure operation response time
 */
export async function measureOperationTime(
  operation: () => Promise<void> | void
): Promise<number> {
  const startTime = performance.now();
  await operation();
  const endTime = performance.now();
  return endTime - startTime;
}
