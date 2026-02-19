"use client";

import { useState, useEffect } from 'react';
import { useWebVitals } from '@/hooks/useWebVitals';
import { formatMetricValue, getMetricRating, queryPerformanceTracker } from '@/lib/performance';
import ModernCard from '@/components/admin/ModernCard';
import StatsCard from '@/components/admin/StatsCard';
import { createClient } from '@/lib/supabase/client';

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

interface OptimizationMetrics {
  totalEgress: number;
  egressByOperation: Record<string, number>;
  functionExecutionTime: number;
  cacheHitRate: number;
  slowQueries: Array<{ operation: string; value: number; recorded_at: string }>;
  compressionRatio: number;
  costEstimate: {
    supabaseEgress: number;
    netlifyFunctions: number;
    total: number;
    savings: number;
  };
}

export default function PerformanceDashboard() {
  const webVitals = useWebVitals();
  const [queryMetrics, setQueryMetrics] = useState<any>(null);
  const [optimizationMetrics, setOptimizationMetrics] = useState<OptimizationMetrics | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertSummary, setAlertSummary] = useState<any>(null);

  // Fetch optimization metrics from database
  useEffect(() => {
    async function fetchOptimizationMetrics() {
      try {
        setLoading(true);
        const supabase = createClient();
        
        // Calculate date range
        const now = new Date();
        const startDate = new Date();
        if (dateRange === 'today') {
          startDate.setHours(0, 0, 0, 0);
        } else if (dateRange === 'week') {
          startDate.setDate(now.getDate() - 7);
        } else {
          startDate.setMonth(now.getMonth() - 1);
        }

        // Fetch performance metrics summary
        const { data: metricsData, error: metricsError } = await supabase.rpc(
          'get_performance_summary',
          {
            p_start_date: startDate.toISOString(),
            p_end_date: now.toISOString()
          }
        );

        if (metricsError) {
          console.error('Error fetching metrics:', metricsError);
          return;
        }

        // Process metrics data
        const egressMetrics = metricsData?.filter((m: any) => m.metric_type === 'egress') || [];
        const functionMetrics = metricsData?.filter((m: any) => m.metric_type === 'function_execution') || [];
        const cacheMetrics = metricsData?.filter((m: any) => m.metric_type === 'cache_hit') || [];
        const queryTimeMetrics = metricsData?.filter((m: any) => m.metric_type === 'query_time') || [];

        // Calculate total egress in GB
        const totalEgressBytes = egressMetrics.reduce((sum: number, m: any) => sum + (m.total_value || 0), 0);
        const totalEgressGB = totalEgressBytes / (1024 * 1024 * 1024);

        // Calculate egress by operation
        const egressByOperation: Record<string, number> = {};
        egressMetrics.forEach((m: any) => {
          egressByOperation[m.operation] = (egressByOperation[m.operation] || 0) + (m.total_value || 0);
        });

        // Calculate total function execution time in seconds
        const totalFunctionTime = functionMetrics.reduce((sum: number, m: any) => sum + (m.total_value || 0), 0) / 1000;

        // Calculate cache hit rate
        const totalCacheHits = cacheMetrics.filter((m: any) => m.avg_value === 1).reduce((sum: number, m: any) => sum + (m.count || 0), 0);
        const totalCacheMisses = cacheMetrics.filter((m: any) => m.avg_value === 0).reduce((sum: number, m: any) => sum + (m.count || 0), 0);
        const cacheHitRate = totalCacheHits + totalCacheMisses > 0 
          ? (totalCacheHits / (totalCacheHits + totalCacheMisses)) * 100 
          : 0;

        // Get slow queries
        const { data: slowQueriesData } = await supabase
          .from('performance_metrics')
          .select('operation, value, recorded_at')
          .eq('metric_type', 'query_time')
          .gte('recorded_at', startDate.toISOString())
          .lte('recorded_at', now.toISOString())
          .order('value', { ascending: false })
          .limit(10);

        // Calculate compression ratio (from metadata if available)
        const compressionMetrics = metricsData?.filter((m: any) => 
          m.metadata && m.metadata.compression_ratio
        ) || [];
        const avgCompressionRatio = compressionMetrics.length > 0
          ? compressionMetrics.reduce((sum: number, m: any) => sum + (m.metadata.compression_ratio || 0), 0) / compressionMetrics.length
          : 0;

        // Calculate cost estimates
        // Supabase: $0.09 per GB egress
        // Netlify: $25 per 100 hours of function execution
        const supabaseCost = totalEgressGB * 0.09;
        const netlifyFunctionCost = (totalFunctionTime / 3600) * (25 / 100);
        
        // Estimate savings (assuming 60% egress reduction and 50% function time reduction)
        const estimatedSavings = (supabaseCost / 0.4 - supabaseCost) + (netlifyFunctionCost / 0.5 - netlifyFunctionCost);

        setOptimizationMetrics({
          totalEgress: totalEgressGB,
          egressByOperation,
          functionExecutionTime: totalFunctionTime,
          cacheHitRate,
          slowQueries: slowQueriesData || [],
          compressionRatio: avgCompressionRatio,
          costEstimate: {
            supabaseEgress: supabaseCost,
            netlifyFunctions: netlifyFunctionCost,
            total: supabaseCost + netlifyFunctionCost,
            savings: estimatedSavings
          }
        });
      } catch (error) {
        console.error('Error fetching optimization metrics:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchOptimizationMetrics();
  }, [refreshKey, dateRange]);

  // Fetch alert summary
  useEffect(() => {
    async function fetchAlertSummary() {
      try {
        const response = await fetch('/api/admin/performance/check-alerts');
        if (response.ok) {
          const data = await response.json();
          setAlertSummary(data.summary);
        }
      } catch (error) {
        console.error('Error fetching alert summary:', error);
      }
    }

    fetchAlertSummary();
  }, [refreshKey]);

  // Function to manually trigger alert check
  async function checkAlerts() {
    try {
      const response = await fetch('/api/admin/performance/check-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          egressGB: 10, // Configure based on your budget
          functionHours: 100 // Configure based on your budget
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts);
        
        if (data.alerts.length > 0) {
          alert(`Found ${data.alerts.length} performance alert(s). Check the dashboard for details.`);
        } else {
          alert('All metrics are within thresholds. No alerts generated.');
        }
      }
    } catch (error) {
      console.error('Error checking alerts:', error);
      alert('Failed to check alerts. See console for details.');
    }
  }

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
          <p className="text-gray-600 mt-1">Real-time performance metrics and cost monitoring</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={checkAlerts}
            className="btn btn-primary"
          >
            Check Alerts
          </button>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="input"
          >
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
          <button
            onClick={() => setRefreshKey(prev => prev + 1)}
            className="btn btn-secondary"
          >
            Refresh Metrics
          </button>
        </div>
      </div>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <ModernCard>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Active Performance Alerts</h3>
            <p className="text-sm text-gray-600">Metrics that have exceeded thresholds</p>
          </div>
          <div className="space-y-3">
            {alerts.map((alert: any, index: number) => (
              <div
                key={index}
                className={`p-4 rounded-lg border-l-4 ${
                  alert.severity === 'critical'
                    ? 'bg-red-50 border-red-500'
                    : 'bg-yellow-50 border-yellow-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-semibold ${
                        alert.severity === 'critical' ? 'text-red-700' : 'text-yellow-700'
                      }`}>
                        {alert.severity === 'critical' ? '🚨 CRITICAL' : '⚠️ WARNING'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {alert.metric.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800">{alert.message}</p>
                    <div className="text-xs text-gray-600 mt-1">
                      Current: {alert.current_value.toFixed(2)} | Threshold: {alert.threshold}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 ml-4">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ModernCard>
      )}

      {/* Alert Summary */}
      {alertSummary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatsCard
            title="Total Alerts (24h)"
            value={alertSummary.total.toString()}
            icon="🔔"
          />
          <StatsCard
            title="Critical Alerts"
            value={alertSummary.critical.toString()}
            trend={{
              value: alertSummary.critical,
              isPositive: alertSummary.critical === 0
            }}
            icon="🚨"
          />
          <StatsCard
            title="Warning Alerts"
            value={alertSummary.warning.toString()}
            trend={{
              value: alertSummary.warning,
              isPositive: alertSummary.warning === 0
            }}
            icon="⚠️"
          />
          <StatsCard
            title="Most Common"
            value={
              Object.keys(alertSummary.byMetric).length > 0
                ? Object.entries(alertSummary.byMetric)
                    .sort(([, a]: any, [, b]: any) => b - a)[0][0]
                    .replace(/_/g, ' ')
                : 'None'
            }
            icon="📊"
          />
        </div>
      )}

      {/* Optimization Metrics Overview */}
      {optimizationMetrics && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Supabase Egress"
              value={`${optimizationMetrics.totalEgress.toFixed(2)} GB`}
              trend={{
                value: optimizationMetrics.totalEgress,
                isPositive: false
              }}
              icon="📊"
            />
            <StatsCard
              title="Function Execution"
              value={`${(optimizationMetrics.functionExecutionTime / 3600).toFixed(2)} hrs`}
              trend={{
                value: optimizationMetrics.functionExecutionTime,
                isPositive: false
              }}
              icon="⚡"
            />
            <StatsCard
              title="Cache Hit Rate"
              value={`${optimizationMetrics.cacheHitRate.toFixed(1)}%`}
              trend={{
                value: optimizationMetrics.cacheHitRate,
                isPositive: optimizationMetrics.cacheHitRate >= 70
              }}
              icon="💾"
            />
            <StatsCard
              title="Estimated Cost"
              value={`$${optimizationMetrics.costEstimate.total.toFixed(2)}`}
              trend={{
                value: optimizationMetrics.costEstimate.savings,
                isPositive: true
              }}
              icon="💰"
            />
          </div>

          {/* Cost Breakdown */}
          <ModernCard>
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Cost Breakdown & Estimates</h3>
              <p className="text-sm text-gray-600">Infrastructure costs for selected period</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-gray-600">Supabase Egress</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                  ${optimizationMetrics.costEstimate.supabaseEgress.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {optimizationMetrics.totalEgress.toFixed(2)} GB @ $0.09/GB
                </div>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="text-sm text-gray-600">Netlify Functions</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                  ${optimizationMetrics.costEstimate.netlifyFunctions.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {(optimizationMetrics.functionExecutionTime / 3600).toFixed(2)} hrs @ $25/100hrs
                </div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-sm text-gray-600">Estimated Savings</div>
                <div className="text-2xl font-bold text-green-600 mt-1">
                  ${optimizationMetrics.costEstimate.savings.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  From optimization efforts
                </div>
              </div>
            </div>
          </ModernCard>

          {/* Egress by Operation */}
          <ModernCard>
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Egress by Operation</h3>
              <p className="text-sm text-gray-600">Bandwidth usage breakdown by operation type</p>
            </div>
            <div className="space-y-3">
              {Object.entries(optimizationMetrics.egressByOperation)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([operation, bytes]) => {
                  const gb = bytes / (1024 * 1024 * 1024);
                  const percentage = (bytes / Object.values(optimizationMetrics.egressByOperation).reduce((a, b) => a + b, 0)) * 100;
                  return (
                    <div key={operation} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{operation}</div>
                        <div className="text-sm text-gray-600">{percentage.toFixed(1)}% of total</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">{gb.toFixed(3)} GB</div>
                        <div className="text-sm text-gray-600">${(gb * 0.09).toFixed(3)}</div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </ModernCard>

          {/* Cache Performance */}
          <ModernCard>
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Cache Performance</h3>
              <p className="text-sm text-gray-600">Cache hit rates and effectiveness</p>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-700">Cache Hit Rate</span>
                  <span className={`font-semibold ${
                    optimizationMetrics.cacheHitRate >= 80 ? 'text-green-600' :
                    optimizationMetrics.cacheHitRate >= 70 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {optimizationMetrics.cacheHitRate.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      optimizationMetrics.cacheHitRate >= 80 ? 'bg-green-600' :
                      optimizationMetrics.cacheHitRate >= 70 ? 'bg-yellow-600' :
                      'bg-red-600'
                    }`}
                    style={{ width: `${optimizationMetrics.cacheHitRate}%` }}
                  />
                </div>
                <div className="text-xs text-gray-600 mt-2">
                  Target: ≥ 80% (Good), ≥ 70% (Acceptable), &lt; 70% (Needs Improvement)
                </div>
              </div>
              {optimizationMetrics.compressionRatio > 0 && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-700">Average Compression Ratio</span>
                    <span className={`font-semibold ${
                      optimizationMetrics.compressionRatio >= 60 ? 'text-green-600' :
                      optimizationMetrics.compressionRatio >= 50 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {optimizationMetrics.compressionRatio.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        optimizationMetrics.compressionRatio >= 60 ? 'bg-green-600' :
                        optimizationMetrics.compressionRatio >= 50 ? 'bg-yellow-600' :
                        'bg-red-600'
                      }`}
                      style={{ width: `${optimizationMetrics.compressionRatio}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-600 mt-2">
                    Target: ≥ 60% (Good), ≥ 50% (Acceptable), &lt; 50% (Needs Improvement)
                  </div>
                </div>
              )}
            </div>
          </ModernCard>

          {/* Slow Queries */}
          {optimizationMetrics.slowQueries.length > 0 && (
            <ModernCard>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Slow Queries (&gt; 1 second)</h3>
                <p className="text-sm text-gray-600">Database queries requiring optimization</p>
              </div>
              <div className="space-y-2">
                {optimizationMetrics.slowQueries.map((query, index) => (
                  <div key={index} className="p-3 bg-red-50 border border-red-200 rounded">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <code className="text-sm text-gray-800">{query.operation}</code>
                        <div className="text-xs text-gray-600 mt-1">
                          {new Date(query.recorded_at).toLocaleString()}
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-red-600 ml-4">
                        {query.value.toFixed(0)}ms
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ModernCard>
          )}
        </>
      )}

      {loading && (
        <ModernCard>
          <div className="text-center py-8">
            <div className="text-gray-600">Loading optimization metrics...</div>
          </div>
        </ModernCard>
      )}

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
          <h3 className="text-lg font-semibold text-gray-900">Performance Targets & Alert Thresholds</h3>
          <p className="text-sm text-gray-600">Application performance goals and alerting thresholds</p>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-700">Supabase Egress Budget</span>
            <span className="font-semibold text-gray-900">Alert at 80% of budget</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-700">Netlify Function Time Budget</span>
            <span className="font-semibold text-gray-900">Alert at 80% of budget</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-700">Cache Hit Rate</span>
            <span className="font-semibold text-gray-900">Alert if &lt; 70%</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-700">Compression Ratio</span>
            <span className="font-semibold text-gray-900">Alert if &lt; 50%</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-700">Query Response Time</span>
            <span className="font-semibold text-gray-900">Alert if &gt; 1 second</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-700">Error Rate</span>
            <span className="font-semibold text-gray-900">Alert if &gt; 1%</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-700">Page Load Time</span>
            <span className="font-semibold text-gray-900">&lt; 2 seconds</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-700">Time to Interactive</span>
            <span className="font-semibold text-gray-900">&lt; 2 seconds</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-700">Cumulative Layout Shift</span>
            <span className="font-semibold text-gray-900">&lt; 0.1</span>
          </div>
        </div>
      </ModernCard>

      {/* Monitoring Procedures */}
      <ModernCard>
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Monitoring & Alerting Procedures</h3>
          <p className="text-sm text-gray-600">How to use this dashboard and respond to alerts</p>
        </div>
        <div className="prose prose-sm max-w-none">
          <h4 className="font-semibold text-gray-900 mb-2">Regular Monitoring</h4>
          <ul className="space-y-1 text-gray-700">
            <li>Check this dashboard daily to ensure metrics stay within targets</li>
            <li>Metrics refresh automatically every 10 seconds</li>
            <li>Click "Check Alerts" to manually trigger threshold checks</li>
            <li>Green indicators mean performance is good</li>
            <li>Yellow indicators mean performance needs improvement</li>
            <li>Red indicators mean performance is poor and requires attention</li>
          </ul>

          <h4 className="font-semibold text-gray-900 mt-4 mb-2">Alert Response</h4>
          <ul className="space-y-1 text-gray-700">
            <li><strong>Egress &gt; 80%:</strong> Review egress by operation, check if compression is working, verify cache hit rates</li>
            <li><strong>Function Time &gt; 80%:</strong> Review slow functions, check if ISR is configured, verify batch processing</li>
            <li><strong>Cache Hit Rate &lt; 70%:</strong> Review cache TTL settings, check cache invalidation logic, verify cache warming</li>
            <li><strong>Slow Queries &gt; 1s:</strong> Review database indexes, check RLS policies, optimize query structure</li>
            <li><strong>Error Rate &gt; 1%:</strong> Check error logs, review recent deployments, verify database connectivity</li>
          </ul>

          <h4 className="font-semibold text-gray-900 mt-4 mb-2">Automated Alerting</h4>
          <ul className="space-y-1 text-gray-700">
            <li>Alerts are automatically logged to the audit log when thresholds are exceeded</li>
            <li>Critical alerts indicate immediate action required</li>
            <li>Warning alerts indicate monitoring and potential optimization needed</li>
            <li>Configure budget limits in the API route to match your infrastructure plan</li>
            <li>Set up a cron job to call the check-alerts endpoint every 5-15 minutes</li>
          </ul>

          <h4 className="font-semibold text-gray-900 mt-4 mb-2">Troubleshooting</h4>
          <ul className="space-y-1 text-gray-700">
            <li>Use browser DevTools Performance tab for detailed analysis</li>
            <li>Check Network tab for slow requests</li>
            <li>Review Lighthouse reports for optimization suggestions</li>
            <li>Monitor Supabase dashboard for database performance</li>
            <li>Check Netlify function logs for execution errors</li>
          </ul>
        </div>
      </ModernCard>
    </div>
  );
}
