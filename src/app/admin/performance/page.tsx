"use client";

import { useState, useEffect } from 'react';
import { useWebVitals } from '@/hooks/useWebVitals';
import { formatMetricValue, getMetricRating, queryPerformanceTracker } from '@/lib/performance';
import ModernCard from '@/components/admin/ModernCard';
import StatsCard from '@/components/admin/StatsCard';

// Helper function to format metrics with units
function formatMetric(value: number, unit: string): string {
  if (unit === 'ms') {
    return `${Math.round(value)}ms`;
  }
  if (unit === 'score') {
    return value.toFixed(3);
  }
  return value.toString();
}

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  unit: string;
  target: number;
}

export default function PerformanceDashboard() {
  const webVitals = useWebVitals();
  const [queryMetrics, setQueryMetrics] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // Get query performance metrics
    const metrics = queryPerformanceTracker.getMetrics();
    setQueryMetrics(metrics);
  }, [refreshKey]);

  // Refresh metrics every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const performanceMetrics: PerformanceMetric[] = [
    {
      name: 'Cumulative Layout Shift',
      value: webVitals.CLS || 0,
      rating: getMetricRating('CLS', webVitals.CLS || 0),
      unit: 'score',
      target: 0.1,
    },
    {
      name: 'First Contentful Paint',
      value: webVitals.FCP || 0,
      rating: getMetricRating('FCP', webVitals.FCP || 0),
      unit: 'ms',
      target: 1800,
    },
    {
      name: 'Largest Contentful Paint',
      value: webVitals.LCP || 0,
      rating: getMetricRating('LCP', webVitals.LCP || 0),
      unit: 'ms',
      target: 2500,
    },
    {
      name: 'First Input Delay',
      value: webVitals.FID || 0,
      rating: getMetricRating('FID', webVitals.FID || 0),
      unit: 'ms',
      target: 100,
    },
    {
      name: 'Time to First Byte',
      value: webVitals.TTFB || 0,
      rating: getMetricRating('TTFB', webVitals.TTFB || 0),
      unit: 'ms',
      target: 800,
    },
    {
      name: 'Interaction to Next Paint',
      value: webVitals.INP || 0,
      rating: getMetricRating('INP', webVitals.INP || 0),
      unit: 'ms',
      target: 200,
    },
  ];

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'good':
        return 'text-green-600 bg-green-50';
      case 'needs-improvement':
        return 'text-yellow-600 bg-yellow-50';
      case 'poor':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getRatingIcon = (rating: string) => {
    switch (rating) {
      case 'good':
        return '✓';
      case 'needs-improvement':
        return '⚠';
      case 'poor':
        return '✗';
      default:
        return '?';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Performance Dashboard</h1>
          <p className="text-gray-600 mt-1">Real-time performance metrics and monitoring</p>
        </div>
        <button
          onClick={() => setRefreshKey(prev => prev + 1)}
          className="btn btn-secondary"
        >
          Refresh Metrics
        </button>
      </div>

      {/* Web Vitals Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {performanceMetrics.map((metric) => (
          <StatsCard
            key={metric.name}
            title={`${metric.name} (Target: ${formatMetric(metric.target, metric.unit as any)})`}
            value={
              metric.value > 0
                ? formatMetric(metric.value, metric.unit as any)
                : 'Measuring...'
            }
            trend={metric.value > 0 ? {
              value: Math.abs(metric.value - metric.target),
              isPositive: metric.value <= metric.target
            } : undefined}
            icon={getRatingIcon(metric.rating)}
          />
        ))}
      </div>

      {/* Web Vitals Details */}
      <ModernCard>
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Core Web Vitals</h3>
          <p className="text-sm text-gray-600">Performance metrics from the browser</p>
        </div>
        <div className="space-y-4">
          {performanceMetrics.map((metric) => (
            <div key={metric.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{metric.name}</h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${getRatingColor(metric.rating)}`}>
                    {metric.rating.replace('-', ' ')}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Target: {formatMetric(metric.target, metric.unit as any)}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">
                  {metric.value > 0 ? formatMetric(metric.value, metric.unit as any) : '—'}
                </div>
                {metric.value > 0 && (
                  <div className={`text-sm font-medium ${
                    metric.value <= metric.target ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {metric.value <= metric.target ? 'Within target' : 'Exceeds target'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ModernCard>

      {/* Query Performance */}
      {queryMetrics && (
        <ModernCard>
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Database Query Performance</h3>
            <p className="text-sm text-gray-600">Query response times and statistics</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">Total Queries</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {queryMetrics.totalQueries}
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">Average Response Time</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {formatMetric(queryMetrics.averageTime, 'ms')}
              </div>
              <div className={`text-sm font-medium mt-1 ${
                queryMetrics.averageTime < 500 ? 'text-green-600' : 'text-red-600'
              }`}>
                Target: &lt; 500ms
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">95th Percentile</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {formatMetric(queryMetrics.p95Time, 'ms')}
              </div>
              <div className={`text-sm font-medium mt-1 ${
                queryMetrics.p95Time < 500 ? 'text-green-600' : 'text-red-600'
              }`}>
                Target: &lt; 500ms
              </div>
            </div>
          </div>

          {queryMetrics.slowQueries && queryMetrics.slowQueries.length > 0 && (
            <div className="mt-6">
              <h4 className="font-semibold text-gray-900 mb-3">Slow Queries (&gt; 500ms)</h4>
              <div className="space-y-2">
                {queryMetrics.slowQueries.map((query: any, index: number) => (
                  <div key={index} className="p-3 bg-red-50 border border-red-200 rounded">
                    <div className="flex items-center justify-between">
                      <code className="text-sm text-gray-800">{query.query}</code>
                      <span className="text-sm font-semibold text-red-600">
                        {formatMetric(query.duration, 'ms')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ModernCard>
      )}

      {/* Performance Targets */}
      <ModernCard>
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Performance Targets</h3>
          <p className="text-sm text-gray-600">Application performance goals</p>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-700">Page Load Time</span>
            <span className="font-semibold text-gray-900">&lt; 2 seconds</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-700">Time to Interactive</span>
            <span className="font-semibold text-gray-900">&lt; 2 seconds</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-700">Scroll FPS</span>
            <span className="font-semibold text-gray-900">≥ 60 FPS</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-700">Bundle Size Reduction</span>
            <span className="font-semibold text-gray-900">≥ 30%</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-700">Cumulative Layout Shift</span>
            <span className="font-semibold text-gray-900">&lt; 0.1</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-700">Query Response Time (p95)</span>
            <span className="font-semibold text-gray-900">&lt; 500ms</span>
          </div>
        </div>
      </ModernCard>

      {/* Monitoring Procedures */}
      <ModernCard>
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Monitoring Procedures</h3>
          <p className="text-sm text-gray-600">How to use this dashboard</p>
        </div>
        <div className="prose prose-sm max-w-none">
          <h4 className="font-semibold text-gray-900 mb-2">Regular Monitoring</h4>
          <ul className="space-y-1 text-gray-700">
            <li>Check this dashboard daily to ensure metrics stay within targets</li>
            <li>Metrics refresh automatically every 10 seconds</li>
            <li>Green indicators mean performance is good</li>
            <li>Yellow indicators mean performance needs improvement</li>
            <li>Red indicators mean performance is poor and requires attention</li>
          </ul>

          <h4 className="font-semibold text-gray-900 mt-4 mb-2">Performance Alerts</h4>
          <ul className="space-y-1 text-gray-700">
            <li>If CLS exceeds 0.1, check for layout shift issues</li>
            <li>If LCP exceeds 2.5s, optimize image loading and code splitting</li>
            <li>If query p95 exceeds 500ms, review database indexes and RLS policies</li>
            <li>If FID exceeds 100ms, reduce JavaScript execution time</li>
          </ul>

          <h4 className="font-semibold text-gray-900 mt-4 mb-2">Troubleshooting</h4>
          <ul className="space-y-1 text-gray-700">
            <li>Use browser DevTools Performance tab for detailed analysis</li>
            <li>Check Network tab for slow requests</li>
            <li>Review Lighthouse reports for optimization suggestions</li>
            <li>Monitor Supabase dashboard for database performance</li>
          </ul>
        </div>
      </ModernCard>
    </div>
  );
}
