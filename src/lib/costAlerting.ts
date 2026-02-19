/**
 * Cost Alerting Service
 * 
 * Provides alerting functionality for:
 * - Budget limit violations
 * - Daily cost summaries
 * - Cost threshold monitoring
 * 
 * Requirements: 12.7
 */

import { getDailyCostMetrics, calculateCostEstimate, CostPricing } from '@/lib/costTracking';
import { supabaseServer } from '@/lib/supabase/server';

export interface CostBudget {
  daily_egress_gb: number;
  daily_function_hours: number;
  daily_total_cost: number;
  monthly_total_cost: number;
}

export interface CostAlert {
  id?: string;
  alert_type: 'budget_exceeded' | 'daily_summary' | 'threshold_warning';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metrics: {
    current_value: number;
    threshold_value: number;
    percentage: number;
  };
  created_at?: string;
}

const DEFAULT_BUDGET: CostBudget = {
  daily_egress_gb: 10, // 10 GB per day
  daily_function_hours: 5, // 5 hours per day
  daily_total_cost: 1.0, // $1 per day
  monthly_total_cost: 30.0 // $30 per month
};

const DEFAULT_PRICING: CostPricing = {
  supabase_egress_per_gb: 0.09,
  netlify_function_per_hour: 0.072
};

/**
 * Check if costs exceed budget limits
 * 
 * Requirement 12.7: Alert when costs exceed budget limits
 */
export async function checkBudgetLimits(
  date: Date = new Date(),
  budget: CostBudget = DEFAULT_BUDGET,
  pricing: CostPricing = DEFAULT_PRICING
): Promise<CostAlert[]> {
  const alerts: CostAlert[] = [];

  try {
    // Get daily metrics
    const dailyMetrics = await getDailyCostMetrics(date);
    const costEstimate = calculateCostEstimate(dailyMetrics, pricing);

    // Check daily egress limit
    if (dailyMetrics.supabase_egress_gb > budget.daily_egress_gb) {
      const percentage = (dailyMetrics.supabase_egress_gb / budget.daily_egress_gb) * 100;
      alerts.push({
        alert_type: 'budget_exceeded',
        severity: percentage > 150 ? 'critical' : 'warning',
        title: 'Daily Egress Budget Exceeded',
        message: `Supabase egress has exceeded the daily budget. Current: ${dailyMetrics.supabase_egress_gb.toFixed(2)} GB, Budget: ${budget.daily_egress_gb} GB`,
        metrics: {
          current_value: dailyMetrics.supabase_egress_gb,
          threshold_value: budget.daily_egress_gb,
          percentage: percentage
        }
      });
    }

    // Check daily function time limit
    const functionHours = dailyMetrics.netlify_function_seconds / 3600;
    if (functionHours > budget.daily_function_hours) {
      const percentage = (functionHours / budget.daily_function_hours) * 100;
      alerts.push({
        alert_type: 'budget_exceeded',
        severity: percentage > 150 ? 'critical' : 'warning',
        title: 'Daily Function Time Budget Exceeded',
        message: `Netlify function execution time has exceeded the daily budget. Current: ${functionHours.toFixed(2)} hours, Budget: ${budget.daily_function_hours} hours`,
        metrics: {
          current_value: functionHours,
          threshold_value: budget.daily_function_hours,
          percentage: percentage
        }
      });
    }

    // Check daily total cost limit
    if (costEstimate.total_cost > budget.daily_total_cost) {
      const percentage = (costEstimate.total_cost / budget.daily_total_cost) * 100;
      alerts.push({
        alert_type: 'budget_exceeded',
        severity: percentage > 150 ? 'critical' : 'warning',
        title: 'Daily Cost Budget Exceeded',
        message: `Total daily cost has exceeded the budget. Current: $${costEstimate.total_cost.toFixed(2)}, Budget: $${budget.daily_total_cost.toFixed(2)}`,
        metrics: {
          current_value: costEstimate.total_cost,
          threshold_value: budget.daily_total_cost,
          percentage: percentage
        }
      });
    }

    // Check threshold warnings (80% of budget)
    const THRESHOLD_PERCENTAGE = 80;

    if (dailyMetrics.supabase_egress_gb > budget.daily_egress_gb * (THRESHOLD_PERCENTAGE / 100) &&
        dailyMetrics.supabase_egress_gb <= budget.daily_egress_gb) {
      const percentage = (dailyMetrics.supabase_egress_gb / budget.daily_egress_gb) * 100;
      alerts.push({
        alert_type: 'threshold_warning',
        severity: 'warning',
        title: 'Egress Budget Threshold Warning',
        message: `Supabase egress is approaching the daily budget (${percentage.toFixed(0)}%). Current: ${dailyMetrics.supabase_egress_gb.toFixed(2)} GB, Budget: ${budget.daily_egress_gb} GB`,
        metrics: {
          current_value: dailyMetrics.supabase_egress_gb,
          threshold_value: budget.daily_egress_gb,
          percentage: percentage
        }
      });
    }

    if (functionHours > budget.daily_function_hours * (THRESHOLD_PERCENTAGE / 100) &&
        functionHours <= budget.daily_function_hours) {
      const percentage = (functionHours / budget.daily_function_hours) * 100;
      alerts.push({
        alert_type: 'threshold_warning',
        severity: 'warning',
        title: 'Function Time Budget Threshold Warning',
        message: `Netlify function time is approaching the daily budget (${percentage.toFixed(0)}%). Current: ${functionHours.toFixed(2)} hours, Budget: ${budget.daily_function_hours} hours`,
        metrics: {
          current_value: functionHours,
          threshold_value: budget.daily_function_hours,
          percentage: percentage
        }
      });
    }

    if (costEstimate.total_cost > budget.daily_total_cost * (THRESHOLD_PERCENTAGE / 100) &&
        costEstimate.total_cost <= budget.daily_total_cost) {
      const percentage = (costEstimate.total_cost / budget.daily_total_cost) * 100;
      alerts.push({
        alert_type: 'threshold_warning',
        severity: 'warning',
        title: 'Total Cost Budget Threshold Warning',
        message: `Total daily cost is approaching the budget (${percentage.toFixed(0)}%). Current: $${costEstimate.total_cost.toFixed(2)}, Budget: $${budget.daily_total_cost.toFixed(2)}`,
        metrics: {
          current_value: costEstimate.total_cost,
          threshold_value: budget.daily_total_cost,
          percentage: percentage
        }
      });
    }

  } catch (error) {
    console.error('Error checking budget limits:', error);
    throw error;
  }

  return alerts;
}

/**
 * Generate daily cost summary
 * 
 * Requirement 12.7: Send daily cost summary to admins
 */
export async function generateDailyCostSummary(
  date: Date = new Date(),
  pricing: CostPricing = DEFAULT_PRICING
): Promise<CostAlert> {
  try {
    const dailyMetrics = await getDailyCostMetrics(date);
    const costEstimate = calculateCostEstimate(dailyMetrics, pricing);
    const functionHours = dailyMetrics.netlify_function_seconds / 3600;

    const message = `
Daily Cost Summary for ${date.toISOString().split('T')[0]}:

Supabase Egress: ${dailyMetrics.supabase_egress_gb.toFixed(2)} GB ($${costEstimate.supabase_egress_cost.toFixed(2)})
Netlify Functions: ${functionHours.toFixed(2)} hours ($${costEstimate.netlify_function_cost.toFixed(2)})
Total Cost: $${costEstimate.total_cost.toFixed(2)}

Egress by Category:
- RPC: ${dailyMetrics.egress_by_category.rpc.toFixed(2)} GB
- Real-time: ${dailyMetrics.egress_by_category.realtime.toFixed(2)} GB
- Storage: ${dailyMetrics.egress_by_category.storage.toFixed(2)} GB
- Auth: ${dailyMetrics.egress_by_category.auth.toFixed(2)} GB
- Other: ${dailyMetrics.egress_by_category.other.toFixed(2)} GB

Bandwidth Saved: ${dailyMetrics.bandwidth_saved_gb.toFixed(2)} GB ($${costEstimate.estimated_savings.toFixed(2)})
    `.trim();

    return {
      alert_type: 'daily_summary',
      severity: 'info',
      title: 'Daily Cost Summary',
      message,
      metrics: {
        current_value: costEstimate.total_cost,
        threshold_value: 0,
        percentage: 0
      }
    };
  } catch (error) {
    console.error('Error generating daily cost summary:', error);
    throw error;
  }
}

/**
 * Store alert in database
 */
export async function storeAlert(alert: CostAlert): Promise<string> {
  try {
    const supabase = supabaseServer();
    
    const { data, error } = await supabase
      .from('cost_alerts')
      .insert({
        alert_type: alert.alert_type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        metrics: alert.metrics,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return data.id;
  } catch (error) {
    console.error('Error storing alert:', error);
    throw error;
  }
}

/**
 * Get recent alerts
 */
export async function getRecentAlerts(
  limit: number = 10,
  severity?: 'info' | 'warning' | 'critical'
): Promise<CostAlert[]> {
  try {
    const supabase = supabaseServer();
    
    let query = supabase
      .from('cost_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching recent alerts:', error);
    throw error;
  }
}

/**
 * Check and store budget alerts
 * 
 * This function should be called periodically (e.g., via cron job)
 * to check budget limits and store alerts
 */
export async function checkAndStoreAlerts(
  date: Date = new Date(),
  budget: CostBudget = DEFAULT_BUDGET,
  pricing: CostPricing = DEFAULT_PRICING
): Promise<string[]> {
  try {
    const alerts = await checkBudgetLimits(date, budget, pricing);
    const alertIds: string[] = [];

    for (const alert of alerts) {
      const id = await storeAlert(alert);
      alertIds.push(id);
    }

    return alertIds;
  } catch (error) {
    console.error('Error checking and storing alerts:', error);
    throw error;
  }
}

/**
 * Generate and store daily summary
 * 
 * This function should be called once per day (e.g., via cron job)
 * to generate and store the daily cost summary
 */
export async function generateAndStoreDailySummary(
  date: Date = new Date(),
  pricing: CostPricing = DEFAULT_PRICING
): Promise<string> {
  try {
    const summary = await generateDailyCostSummary(date, pricing);
    const id = await storeAlert(summary);
    return id;
  } catch (error) {
    console.error('Error generating and storing daily summary:', error);
    throw error;
  }
}
