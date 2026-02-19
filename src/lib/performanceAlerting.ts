/**
 * Performance Alerting Service
 * 
 * Monitors performance metrics against thresholds and sends alerts when exceeded.
 * 
 * Requirements: 9.7, 12.7
 */

import { supabaseServer } from '@/lib/supabase/server';

export interface AlertThreshold {
  metric: string;
  threshold: number;
  comparison: 'greater_than' | 'less_than';
  severity: 'warning' | 'critical';
}

export interface PerformanceAlert {
  metric: string;
  current_value: number;
  threshold: number;
  severity: 'warning' | 'critical';
  message: string;
  timestamp: Date;
}

// Default alert thresholds based on requirements
const DEFAULT_THRESHOLDS: AlertThreshold[] = [
  {
    metric: 'egress_percentage',
    threshold: 80, // 80% of budget
    comparison: 'greater_than',
    severity: 'warning'
  },
  {
    metric: 'function_time_percentage',
    threshold: 80, // 80% of budget
    comparison: 'greater_than',
    severity: 'warning'
  },
  {
    metric: 'cache_hit_rate',
    threshold: 70, // Below 70%
    comparison: 'less_than',
    severity: 'warning'
  },
  {
    metric: 'compression_ratio',
    threshold: 50, // Below 50%
    comparison: 'less_than',
    severity: 'warning'
  },
  {
    metric: 'query_time',
    threshold: 1000, // > 1 second
    comparison: 'greater_than',
    severity: 'critical'
  },
  {
    metric: 'error_rate',
    threshold: 1, // > 1%
    comparison: 'greater_than',
    severity: 'critical'
  }
];

/**
 * Check metrics against thresholds and generate alerts
 * 
 * Requirement 9.7: Alert administrators when metrics exceed thresholds
 * Requirement 12.7: Alert when costs exceed budget limits
 */
export async function checkPerformanceThresholds(
  budgets?: {
    egressGB?: number;
    functionHours?: number;
  }
): Promise<PerformanceAlert[]> {
  const alerts: PerformanceAlert[] = [];
  
  try {
    const supabase = supabaseServer();
    
    // Get metrics for the last 24 hours
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const { data: metricsData, error } = await supabase.rpc(
      'get_performance_summary',
      {
        p_start_date: yesterday.toISOString(),
        p_end_date: now.toISOString()
      }
    );
    
    if (error) {
      console.error('Error fetching metrics for alerting:', error);
      return alerts;
    }
    
    // Check egress threshold
    if (budgets?.egressGB) {
      const egressMetrics = metricsData?.filter((m: any) => m.metric_type === 'egress') || [];
      const totalEgressBytes = egressMetrics.reduce((sum: number, m: any) => sum + (m.total_value || 0), 0);
      const totalEgressGB = totalEgressBytes / (1024 * 1024 * 1024);
      const egressPercentage = (totalEgressGB / budgets.egressGB) * 100;
      
      if (egressPercentage > 80) {
        alerts.push({
          metric: 'egress_percentage',
          current_value: egressPercentage,
          threshold: 80,
          severity: egressPercentage > 95 ? 'critical' : 'warning',
          message: `Supabase egress is at ${egressPercentage.toFixed(1)}% of budget (${totalEgressGB.toFixed(2)} GB / ${budgets.egressGB} GB)`,
          timestamp: now
        });
      }
    }
    
    // Check function execution time threshold
    if (budgets?.functionHours) {
      const functionMetrics = metricsData?.filter((m: any) => m.metric_type === 'function_execution') || [];
      const totalFunctionMs = functionMetrics.reduce((sum: number, m: any) => sum + (m.total_value || 0), 0);
      const totalFunctionHours = totalFunctionMs / (1000 * 60 * 60);
      const functionPercentage = (totalFunctionHours / budgets.functionHours) * 100;
      
      if (functionPercentage > 80) {
        alerts.push({
          metric: 'function_time_percentage',
          current_value: functionPercentage,
          threshold: 80,
          severity: functionPercentage > 95 ? 'critical' : 'warning',
          message: `Netlify function execution time is at ${functionPercentage.toFixed(1)}% of budget (${totalFunctionHours.toFixed(2)} hrs / ${budgets.functionHours} hrs)`,
          timestamp: now
        });
      }
    }
    
    // Check cache hit rate
    const cacheMetrics = metricsData?.filter((m: any) => m.metric_type === 'cache_hit') || [];
    const totalCacheHits = cacheMetrics.filter((m: any) => m.avg_value === 1).reduce((sum: number, m: any) => sum + (m.count || 0), 0);
    const totalCacheMisses = cacheMetrics.filter((m: any) => m.avg_value === 0).reduce((sum: number, m: any) => sum + (m.count || 0), 0);
    const cacheHitRate = totalCacheHits + totalCacheMisses > 0 
      ? (totalCacheHits / (totalCacheHits + totalCacheMisses)) * 100 
      : 0;
    
    if (cacheHitRate < 70 && (totalCacheHits + totalCacheMisses) > 100) {
      alerts.push({
        metric: 'cache_hit_rate',
        current_value: cacheHitRate,
        threshold: 70,
        severity: cacheHitRate < 50 ? 'critical' : 'warning',
        message: `Cache hit rate is ${cacheHitRate.toFixed(1)}% (below 70% threshold)`,
        timestamp: now
      });
    }
    
    // Check for slow queries
    const { data: slowQueries } = await supabase
      .from('performance_metrics')
      .select('operation, value')
      .eq('metric_type', 'query_time')
      .gte('recorded_at', yesterday.toISOString())
      .gt('value', 1000)
      .order('value', { ascending: false })
      .limit(5);
    
    if (slowQueries && slowQueries.length > 0) {
      alerts.push({
        metric: 'query_time',
        current_value: slowQueries[0].value,
        threshold: 1000,
        severity: 'critical',
        message: `${slowQueries.length} slow queries detected (> 1 second). Slowest: ${slowQueries[0].operation} at ${slowQueries[0].value}ms`,
        timestamp: now
      });
    }
    
    // Check error rate
    const errorMetrics = metricsData?.filter((m: any) => m.metric_type === 'error') || [];
    const totalErrors = errorMetrics.reduce((sum: number, m: any) => sum + (m.count || 0), 0);
    const totalRequests = metricsData?.reduce((sum: number, m: any) => sum + (m.count || 0), 0) || 0;
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
    
    if (errorRate > 1 && totalRequests > 100) {
      alerts.push({
        metric: 'error_rate',
        current_value: errorRate,
        threshold: 1,
        severity: errorRate > 5 ? 'critical' : 'warning',
        message: `Error rate is ${errorRate.toFixed(2)}% (${totalErrors} errors out of ${totalRequests} requests)`,
        timestamp: now
      });
    }
    
  } catch (error) {
    console.error('Error checking performance thresholds:', error);
  }
  
  return alerts;
}

/**
 * Send alert notification
 * 
 * In a production environment, this would integrate with:
 * - Email service (SendGrid, AWS SES)
 * - SMS service (Twilio)
 * - Slack/Discord webhooks
 * - PagerDuty or similar alerting service
 * 
 * For now, we log to console and store in database
 */
export async function sendAlert(alert: PerformanceAlert): Promise<void> {
  try {
    const supabase = supabaseServer();
    
    // Log alert to audit log
    await supabase.from('audit_logs').insert({
      action: 'performance_alert',
      details: {
        metric: alert.metric,
        current_value: alert.current_value,
        threshold: alert.threshold,
        severity: alert.severity,
        message: alert.message
      },
      ip_address: 'system',
      user_agent: 'performance-alerting-service'
    });
    
    // Log to console for immediate visibility
    const logLevel = alert.severity === 'critical' ? 'error' : 'warn';
    console[logLevel](`[PERFORMANCE ALERT] ${alert.severity.toUpperCase()}: ${alert.message}`);
    
    // TODO: Integrate with external alerting services
    // - Send email to administrators
    // - Send SMS for critical alerts
    // - Post to Slack/Discord channel
    // - Create PagerDuty incident
    
  } catch (error) {
    console.error('Error sending alert:', error);
  }
}

/**
 * Run performance checks and send alerts if thresholds are exceeded
 * 
 * This function should be called periodically (e.g., every 5 minutes via cron job)
 */
export async function runPerformanceChecks(budgets?: {
  egressGB?: number;
  functionHours?: number;
}): Promise<PerformanceAlert[]> {
  const alerts = await checkPerformanceThresholds(budgets);
  
  // Send alerts for any threshold violations
  for (const alert of alerts) {
    await sendAlert(alert);
  }
  
  return alerts;
}

/**
 * Get recent alerts from audit log
 */
export async function getRecentAlerts(hours: number = 24): Promise<any[]> {
  try {
    const supabase = supabaseServer();
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('action', 'performance_alert')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching recent alerts:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error getting recent alerts:', error);
    return [];
  }
}

/**
 * Calculate alert summary statistics
 */
export async function getAlertSummary(hours: number = 24): Promise<{
  total: number;
  critical: number;
  warning: number;
  byMetric: Record<string, number>;
}> {
  const alerts = await getRecentAlerts(hours);
  
  const summary = {
    total: alerts.length,
    critical: 0,
    warning: 0,
    byMetric: {} as Record<string, number>
  };
  
  for (const alert of alerts) {
    const severity = alert.details?.severity || 'warning';
    if (severity === 'critical') {
      summary.critical++;
    } else {
      summary.warning++;
    }
    
    const metric = alert.details?.metric || 'unknown';
    summary.byMetric[metric] = (summary.byMetric[metric] || 0) + 1;
  }
  
  return summary;
}
