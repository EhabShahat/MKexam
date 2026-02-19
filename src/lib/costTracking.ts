/**
 * Cost Tracking Service
 * 
 * Tracks and calculates costs for:
 * - Supabase egress bandwidth (GB/day)
 * - Netlify function execution time (seconds/day)
 * - Categorizes egress by operation type
 * - Calculates bandwidth saved through caching
 * 
 * Requirements: 12.1, 12.2, 12.4, 12.5
 */

import { supabaseServer } from '@/lib/supabase/server';

export type EgressCategory = 'rpc' | 'realtime' | 'storage' | 'auth' | 'other';

export interface DailyCostMetrics {
  date: string;
  supabase_egress_gb: number;
  netlify_function_seconds: number;
  egress_by_category: Record<EgressCategory, number>;
  bandwidth_saved_gb: number;
  cache_hit_count: number;
  cache_miss_count: number;
  total_requests: number;
}

export interface CostEstimate {
  supabase_egress_cost: number;
  netlify_function_cost: number;
  total_cost: number;
  estimated_savings: number;
}

export interface CostPricing {
  supabase_egress_per_gb: number; // Default: $0.09 per GB
  netlify_function_per_hour: number; // Default: $0.00002 per second = $0.072 per hour
}

const DEFAULT_PRICING: CostPricing = {
  supabase_egress_per_gb: 0.09,
  netlify_function_per_hour: 0.072
};

/**
 * Track daily Supabase egress in GB
 * 
 * Requirement 12.1: Track daily Supabase egress in GB
 */
export async function trackDailyEgress(
  date: Date = new Date()
): Promise<number> {
  try {
    const supabase = supabaseServer();
    
    // Get start and end of day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const { data, error } = await supabase
      .from('performance_metrics')
      .select('value')
      .eq('metric_type', 'egress')
      .gte('recorded_at', startOfDay.toISOString())
      .lte('recorded_at', endOfDay.toISOString());
    
    if (error) {
      console.error('Error tracking daily egress:', error);
      return 0;
    }
    
    // Sum all egress in bytes and convert to GB
    const totalBytes = data?.reduce((sum, metric) => sum + (metric.value || 0), 0) || 0;
    const totalGB = totalBytes / (1024 * 1024 * 1024);
    
    return totalGB;
  } catch (error) {
    console.error('Error in trackDailyEgress:', error);
    return 0;
  }
}

/**
 * Track Netlify function execution time
 * 
 * Requirement 12.2: Track total Netlify function execution time in seconds
 */
export async function trackDailyFunctionTime(
  date: Date = new Date()
): Promise<number> {
  try {
    const supabase = supabaseServer();
    
    // Get start and end of day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const { data, error } = await supabase
      .from('performance_metrics')
      .select('value')
      .eq('metric_type', 'function_execution')
      .gte('recorded_at', startOfDay.toISOString())
      .lte('recorded_at', endOfDay.toISOString());
    
    if (error) {
      console.error('Error tracking daily function time:', error);
      return 0;
    }
    
    // Sum all execution time in milliseconds and convert to seconds
    const totalMs = data?.reduce((sum, metric) => sum + (metric.value || 0), 0) || 0;
    const totalSeconds = totalMs / 1000;
    
    return totalSeconds;
  } catch (error) {
    console.error('Error in trackDailyFunctionTime:', error);
    return 0;
  }
}

/**
 * Categorize egress by operation type
 * 
 * Requirement 12.4: Categorize egress by operation type (RPC, real-time, storage)
 */
export async function categorizeEgress(
  date: Date = new Date()
): Promise<Record<EgressCategory, number>> {
  try {
    const supabase = supabaseServer();
    
    // Get start and end of day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const { data, error } = await supabase
      .from('performance_metrics')
      .select('operation, value, metadata')
      .eq('metric_type', 'egress')
      .gte('recorded_at', startOfDay.toISOString())
      .lte('recorded_at', endOfDay.toISOString());
    
    if (error) {
      console.error('Error categorizing egress:', error);
      return { rpc: 0, realtime: 0, storage: 0, auth: 0, other: 0 };
    }
    
    const categories: Record<EgressCategory, number> = {
      rpc: 0,
      realtime: 0,
      storage: 0,
      auth: 0,
      other: 0
    };
    
    // Categorize based on operation name
    for (const metric of data || []) {
      const bytes = metric.value || 0;
      const operation = metric.operation?.toLowerCase() || '';
      const category = metric.metadata?.category as EgressCategory | undefined;
      
      // Use explicit category if provided, otherwise infer from operation name
      if (category && categories.hasOwnProperty(category)) {
        categories[category] += bytes;
      } else if (operation.includes('rpc') || operation.includes('function')) {
        categories.rpc += bytes;
      } else if (operation.includes('realtime') || operation.includes('subscription')) {
        categories.realtime += bytes;
      } else if (operation.includes('storage') || operation.includes('upload') || operation.includes('download')) {
        categories.storage += bytes;
      } else if (operation.includes('auth') || operation.includes('login') || operation.includes('token')) {
        categories.auth += bytes;
      } else {
        categories.other += bytes;
      }
    }
    
    // Convert bytes to GB
    for (const key in categories) {
      categories[key as EgressCategory] = categories[key as EgressCategory] / (1024 * 1024 * 1024);
    }
    
    return categories;
  } catch (error) {
    console.error('Error in categorizeEgress:', error);
    return { rpc: 0, realtime: 0, storage: 0, auth: 0, other: 0 };
  }
}

/**
 * Calculate bandwidth saved through caching
 * 
 * Requirement 12.5: Calculate bandwidth saved through caching
 */
export async function calculateBandwidthSavings(
  date: Date = new Date()
): Promise<{
  saved_gb: number;
  cache_hits: number;
  cache_misses: number;
  hit_rate: number;
}> {
  try {
    const supabase = supabaseServer();
    
    // Get start and end of day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Get cache hit/miss metrics
    const { data: cacheData, error: cacheError } = await supabase
      .from('performance_metrics')
      .select('value, metadata')
      .eq('metric_type', 'cache_hit')
      .gte('recorded_at', startOfDay.toISOString())
      .lte('recorded_at', endOfDay.toISOString());
    
    if (cacheError) {
      console.error('Error calculating bandwidth savings:', cacheError);
      return { saved_gb: 0, cache_hits: 0, cache_misses: 0, hit_rate: 0 };
    }
    
    let cacheHits = 0;
    let cacheMisses = 0;
    let totalSavedBytes = 0;
    
    for (const metric of cacheData || []) {
      const isHit = metric.value === 1;
      const responseSize = metric.metadata?.response_size || 0;
      
      if (isHit) {
        cacheHits++;
        // On cache hit, we saved the bandwidth that would have been used
        totalSavedBytes += responseSize;
      } else {
        cacheMisses++;
      }
    }
    
    const totalRequests = cacheHits + cacheMisses;
    const hitRate = totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0;
    const savedGB = totalSavedBytes / (1024 * 1024 * 1024);
    
    return {
      saved_gb: savedGB,
      cache_hits: cacheHits,
      cache_misses: cacheMisses,
      hit_rate: hitRate
    };
  } catch (error) {
    console.error('Error in calculateBandwidthSavings:', error);
    return { saved_gb: 0, cache_hits: 0, cache_misses: 0, hit_rate: 0 };
  }
}

/**
 * Get daily cost metrics
 */
export async function getDailyCostMetrics(
  date: Date = new Date()
): Promise<DailyCostMetrics> {
  const [egressGB, functionSeconds, egressByCategory, bandwidthSavings] = await Promise.all([
    trackDailyEgress(date),
    trackDailyFunctionTime(date),
    categorizeEgress(date),
    calculateBandwidthSavings(date)
  ]);
  
  return {
    date: date.toISOString().split('T')[0],
    supabase_egress_gb: egressGB,
    netlify_function_seconds: functionSeconds,
    egress_by_category: egressByCategory,
    bandwidth_saved_gb: bandwidthSavings.saved_gb,
    cache_hit_count: bandwidthSavings.cache_hits,
    cache_miss_count: bandwidthSavings.cache_misses,
    total_requests: bandwidthSavings.cache_hits + bandwidthSavings.cache_misses
  };
}

/**
 * Calculate cost estimate based on metrics
 */
export function calculateCostEstimate(
  metrics: DailyCostMetrics,
  pricing: CostPricing = DEFAULT_PRICING
): CostEstimate {
  // Calculate Supabase egress cost
  const supabaseEgressCost = metrics.supabase_egress_gb * pricing.supabase_egress_per_gb;
  
  // Calculate Netlify function cost (convert seconds to hours)
  const functionHours = metrics.netlify_function_seconds / 3600;
  const netlifyFunctionCost = functionHours * pricing.netlify_function_per_hour;
  
  // Calculate total cost
  const totalCost = supabaseEgressCost + netlifyFunctionCost;
  
  // Calculate estimated savings from caching
  const savedEgressCost = metrics.bandwidth_saved_gb * pricing.supabase_egress_per_gb;
  
  return {
    supabase_egress_cost: supabaseEgressCost,
    netlify_function_cost: netlifyFunctionCost,
    total_cost: totalCost,
    estimated_savings: savedEgressCost
  };
}

/**
 * Get cost metrics for a date range
 */
export async function getCostMetricsRange(
  startDate: Date,
  endDate: Date
): Promise<DailyCostMetrics[]> {
  const metrics: DailyCostMetrics[] = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dailyMetrics = await getDailyCostMetrics(new Date(currentDate));
    metrics.push(dailyMetrics);
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return metrics;
}

/**
 * Get aggregated cost summary for a period
 */
export function aggregateCostMetrics(
  metrics: DailyCostMetrics[]
): {
  total_egress_gb: number;
  total_function_seconds: number;
  total_bandwidth_saved_gb: number;
  average_cache_hit_rate: number;
  egress_by_category: Record<EgressCategory, number>;
} {
  const summary = {
    total_egress_gb: 0,
    total_function_seconds: 0,
    total_bandwidth_saved_gb: 0,
    average_cache_hit_rate: 0,
    egress_by_category: {
      rpc: 0,
      realtime: 0,
      storage: 0,
      auth: 0,
      other: 0
    } as Record<EgressCategory, number>
  };
  
  let totalHitRate = 0;
  let daysWithData = 0;
  
  for (const metric of metrics) {
    summary.total_egress_gb += metric.supabase_egress_gb;
    summary.total_function_seconds += metric.netlify_function_seconds;
    summary.total_bandwidth_saved_gb += metric.bandwidth_saved_gb;
    
    // Aggregate egress by category
    for (const category in metric.egress_by_category) {
      summary.egress_by_category[category as EgressCategory] += 
        metric.egress_by_category[category as EgressCategory];
    }
    
    // Calculate average hit rate
    if (metric.total_requests > 0) {
      const hitRate = (metric.cache_hit_count / metric.total_requests) * 100;
      totalHitRate += hitRate;
      daysWithData++;
    }
  }
  
  summary.average_cache_hit_rate = daysWithData > 0 ? totalHitRate / daysWithData : 0;
  
  return summary;
}

/**
 * Compare costs between two periods
 */
export async function compareCostPeriods(
  currentStart: Date,
  currentEnd: Date,
  previousStart: Date,
  previousEnd: Date,
  pricing: CostPricing = DEFAULT_PRICING
): Promise<{
  current: {
    metrics: DailyCostMetrics[];
    summary: ReturnType<typeof aggregateCostMetrics>;
    cost: CostEstimate;
  };
  previous: {
    metrics: DailyCostMetrics[];
    summary: ReturnType<typeof aggregateCostMetrics>;
    cost: CostEstimate;
  };
  comparison: {
    egress_change_percent: number;
    function_time_change_percent: number;
    cost_change_percent: number;
    savings_change_percent: number;
  };
}> {
  // Get metrics for both periods
  const [currentMetrics, previousMetrics] = await Promise.all([
    getCostMetricsRange(currentStart, currentEnd),
    getCostMetricsRange(previousStart, previousEnd)
  ]);
  
  // Aggregate metrics
  const currentSummary = aggregateCostMetrics(currentMetrics);
  const previousSummary = aggregateCostMetrics(previousMetrics);
  
  // Calculate costs (use average daily metrics for estimate)
  const currentAvgMetrics: DailyCostMetrics = {
    date: currentEnd.toISOString().split('T')[0],
    supabase_egress_gb: currentSummary.total_egress_gb / currentMetrics.length,
    netlify_function_seconds: currentSummary.total_function_seconds / currentMetrics.length,
    egress_by_category: currentSummary.egress_by_category,
    bandwidth_saved_gb: currentSummary.total_bandwidth_saved_gb / currentMetrics.length,
    cache_hit_count: 0,
    cache_miss_count: 0,
    total_requests: 0
  };
  
  const previousAvgMetrics: DailyCostMetrics = {
    date: previousEnd.toISOString().split('T')[0],
    supabase_egress_gb: previousSummary.total_egress_gb / previousMetrics.length,
    netlify_function_seconds: previousSummary.total_function_seconds / previousMetrics.length,
    egress_by_category: previousSummary.egress_by_category,
    bandwidth_saved_gb: previousSummary.total_bandwidth_saved_gb / previousMetrics.length,
    cache_hit_count: 0,
    cache_miss_count: 0,
    total_requests: 0
  };
  
  const currentCost = calculateCostEstimate(currentAvgMetrics, pricing);
  const previousCost = calculateCostEstimate(previousAvgMetrics, pricing);
  
  // Calculate percentage changes
  const egressChange = previousSummary.total_egress_gb > 0
    ? ((currentSummary.total_egress_gb - previousSummary.total_egress_gb) / previousSummary.total_egress_gb) * 100
    : 0;
  
  const functionTimeChange = previousSummary.total_function_seconds > 0
    ? ((currentSummary.total_function_seconds - previousSummary.total_function_seconds) / previousSummary.total_function_seconds) * 100
    : 0;
  
  const costChange = previousCost.total_cost > 0
    ? ((currentCost.total_cost - previousCost.total_cost) / previousCost.total_cost) * 100
    : 0;
  
  const savingsChange = previousCost.estimated_savings > 0
    ? ((currentCost.estimated_savings - previousCost.estimated_savings) / previousCost.estimated_savings) * 100
    : 0;
  
  return {
    current: {
      metrics: currentMetrics,
      summary: currentSummary,
      cost: currentCost
    },
    previous: {
      metrics: previousMetrics,
      summary: previousSummary,
      cost: previousCost
    },
    comparison: {
      egress_change_percent: egressChange,
      function_time_change_percent: functionTimeChange,
      cost_change_percent: costChange,
      savings_change_percent: savingsChange
    }
  };
}
