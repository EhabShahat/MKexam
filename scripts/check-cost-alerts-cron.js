/**
 * Cost Alerts Cron Job
 * 
 * This script should be run periodically (e.g., every hour) to:
 * - Check if costs exceed budget limits
 * - Store alerts in the database
 * - Generate daily summaries (once per day)
 * 
 * Usage:
 * - Hourly: node scripts/check-cost-alerts-cron.js
 * - Daily summary: node scripts/check-cost-alerts-cron.js --summary
 * 
 * Requirements: 12.7
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Default budget configuration
const DEFAULT_BUDGET = {
  daily_egress_gb: 10,
  daily_function_hours: 5,
  daily_total_cost: 1.0,
  monthly_total_cost: 30.0
};

const DEFAULT_PRICING = {
  supabase_egress_per_gb: 0.09,
  netlify_function_per_hour: 0.072
};

/**
 * Get daily cost metrics from database
 */
async function getDailyCostMetrics(date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // Get egress metrics
  const { data: egressData, error: egressError } = await supabase
    .from('performance_metrics')
    .select('value, metadata')
    .eq('metric_type', 'egress')
    .gte('recorded_at', startOfDay.toISOString())
    .lte('recorded_at', endOfDay.toISOString());

  if (egressError) throw egressError;

  // Get function execution metrics
  const { data: functionData, error: functionError } = await supabase
    .from('performance_metrics')
    .select('value')
    .eq('metric_type', 'function_execution')
    .gte('recorded_at', startOfDay.toISOString())
    .lte('recorded_at', endOfDay.toISOString());

  if (functionError) throw functionError;

  // Calculate totals
  const totalEgressBytes = egressData.reduce((sum, m) => sum + m.value, 0);
  const totalFunctionSeconds = functionData.reduce((sum, m) => sum + m.value, 0);

  // Categorize egress
  const egressByCategory = {
    rpc: 0,
    realtime: 0,
    storage: 0,
    auth: 0,
    other: 0
  };

  egressData.forEach(metric => {
    const category = metric.metadata?.category || 'other';
    const bytes = metric.value;
    if (category in egressByCategory) {
      egressByCategory[category] += bytes / (1024 * 1024 * 1024); // Convert to GB
    } else {
      egressByCategory.other += bytes / (1024 * 1024 * 1024);
    }
  });

  return {
    supabase_egress_gb: totalEgressBytes / (1024 * 1024 * 1024),
    netlify_function_seconds: totalFunctionSeconds,
    egress_by_category: egressByCategory,
    bandwidth_saved_gb: 0 // Would need cache hit data
  };
}

/**
 * Calculate cost estimate
 */
function calculateCostEstimate(metrics, pricing) {
  const supabaseCost = metrics.supabase_egress_gb * pricing.supabase_egress_per_gb;
  const netlifyHours = metrics.netlify_function_seconds / 3600;
  const netlifyCost = netlifyHours * pricing.netlify_function_per_hour;
  
  return {
    supabase_cost: supabaseCost,
    netlify_cost: netlifyCost,
    total_cost: supabaseCost + netlifyCost,
    savings: 0
  };
}

/**
 * Check budget limits and create alerts
 */
async function checkBudgetLimits(date, budget, pricing) {
  const alerts = [];
  
  try {
    const metrics = await getDailyCostMetrics(date);
    const costEstimate = calculateCostEstimate(metrics, pricing);

    // Check daily egress limit
    if (metrics.supabase_egress_gb > budget.daily_egress_gb) {
      const percentage = (metrics.supabase_egress_gb / budget.daily_egress_gb) * 100;
      alerts.push({
        alert_type: 'budget_exceeded',
        severity: percentage > 150 ? 'critical' : 'warning',
        title: 'Daily Egress Budget Exceeded',
        message: `Supabase egress has exceeded the daily budget. Current: ${metrics.supabase_egress_gb.toFixed(2)} GB, Budget: ${budget.daily_egress_gb} GB`,
        metrics: {
          current_value: metrics.supabase_egress_gb,
          threshold_value: budget.daily_egress_gb,
          percentage: percentage
        }
      });
    }

    // Check daily function time limit
    const functionHours = metrics.netlify_function_seconds / 3600;
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
    const THRESHOLD = 80;
    
    if (metrics.supabase_egress_gb > budget.daily_egress_gb * (THRESHOLD / 100) &&
        metrics.supabase_egress_gb <= budget.daily_egress_gb) {
      const percentage = (metrics.supabase_egress_gb / budget.daily_egress_gb) * 100;
      alerts.push({
        alert_type: 'threshold_warning',
        severity: 'warning',
        title: 'Egress Budget Threshold Warning',
        message: `Supabase egress is approaching the daily budget (${percentage.toFixed(0)}%)`,
        metrics: {
          current_value: metrics.supabase_egress_gb,
          threshold_value: budget.daily_egress_gb,
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
 * Store alert in database
 */
async function storeAlert(alert) {
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

  if (error) throw error;
  return data.id;
}

/**
 * Generate daily summary
 */
async function generateDailySummary(date, pricing) {
  const metrics = await getDailyCostMetrics(date);
  const costEstimate = calculateCostEstimate(metrics, pricing);
  const functionHours = metrics.netlify_function_seconds / 3600;

  const message = `
Daily Cost Summary for ${date.toISOString().split('T')[0]}:

Supabase Egress: ${metrics.supabase_egress_gb.toFixed(2)} GB ($${costEstimate.supabase_cost.toFixed(2)})
Netlify Functions: ${functionHours.toFixed(2)} hours ($${costEstimate.netlify_cost.toFixed(2)})
Total Cost: $${costEstimate.total_cost.toFixed(2)}

Egress by Category:
- RPC: ${metrics.egress_by_category.rpc.toFixed(2)} GB
- Real-time: ${metrics.egress_by_category.realtime.toFixed(2)} GB
- Storage: ${metrics.egress_by_category.storage.toFixed(2)} GB
- Auth: ${metrics.egress_by_category.auth.toFixed(2)} GB
- Other: ${metrics.egress_by_category.other.toFixed(2)} GB
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
}

/**
 * Main execution
 */
async function main() {
  const generateSummary = process.argv.includes('--summary');
  const date = new Date();

  console.log(`🔍 Checking cost alerts for ${date.toISOString().split('T')[0]}...\n`);

  try {
    // Check budget limits
    const alerts = await checkBudgetLimits(date, DEFAULT_BUDGET, DEFAULT_PRICING);
    
    console.log(`Found ${alerts.length} alert(s)\n`);

    // Store alerts
    for (const alert of alerts) {
      const id = await storeAlert(alert);
      console.log(`✅ Stored alert: ${alert.title} (${id})`);
    }

    // Generate daily summary if requested
    if (generateSummary) {
      console.log('\n📊 Generating daily summary...');
      const summary = await generateDailySummary(date, DEFAULT_PRICING);
      const id = await storeAlert(summary);
      console.log(`✅ Stored daily summary (${id})`);
    }

    console.log('\n✅ Cost alert check completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run
main();
