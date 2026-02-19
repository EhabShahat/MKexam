# Cost Alerting System

## Overview

The Cost Alerting System monitors Supabase egress and Netlify function execution costs, alerting administrators when budget limits are exceeded or approaching thresholds.

**Requirements Addressed:** 12.7

## Features

### 1. Budget Limit Monitoring
- Tracks daily Supabase egress (GB)
- Tracks daily Netlify function execution time (hours)
- Tracks total daily costs
- Alerts when budgets are exceeded

### 2. Threshold Warnings
- Warns when usage reaches 80% of budget
- Prevents budget overruns with early warnings
- Configurable threshold percentages

### 3. Daily Cost Summaries
- Generates comprehensive daily cost reports
- Breaks down costs by category
- Shows bandwidth savings from caching
- Can be sent to administrators

### 4. Alert Severity Levels
- **Info**: Daily summaries and informational alerts
- **Warning**: Threshold warnings (80%+ of budget)
- **Critical**: Budget exceeded by 150%+

## Architecture

### Components

1. **Cost Alerting Service** (`src/lib/costAlerting.ts`)
   - Core alerting logic
   - Budget checking functions
   - Alert generation and storage

2. **Cost Alerts API** (`src/app/api/admin/alerts/route.ts`)
   - GET endpoint for fetching alerts
   - POST endpoint for checking budgets

3. **Alerts Dashboard** (`src/app/admin/alerts/page.tsx`)
   - Visual alert display
   - Manual budget checking
   - Alert filtering by severity

4. **Database Table** (`db/cost_alerts.sql`)
   - Stores all alerts and summaries
   - Indexed for efficient querying
   - RLS policies for admin-only access

5. **Cron Job Script** (`scripts/check-cost-alerts-cron.js`)
   - Automated budget checking
   - Daily summary generation
   - Can be scheduled via cron or task scheduler

## Setup

### 1. Create Database Table

Run the setup script:

```bash
node scripts/setup-cost-alerts.js
```

Or manually execute the SQL:

```bash
psql -h your-db-host -U postgres -d your-db -f db/cost_alerts.sql
```

### 2. Configure Budget Limits

Edit the default budget in `src/lib/costAlerting.ts`:

```typescript
const DEFAULT_BUDGET: CostBudget = {
  daily_egress_gb: 10,        // 10 GB per day
  daily_function_hours: 5,     // 5 hours per day
  daily_total_cost: 1.0,       // $1 per day
  monthly_total_cost: 30.0     // $30 per month
};
```

### 3. Set Up Automated Checking

#### Option A: Cron Job (Linux/Mac)

Add to crontab:

```bash
# Check budget every hour
0 * * * * cd /path/to/project && node scripts/check-cost-alerts-cron.js

# Generate daily summary at 11:59 PM
59 23 * * * cd /path/to/project && node scripts/check-cost-alerts-cron.js --summary
```

#### Option B: Windows Task Scheduler

Create two scheduled tasks:

1. **Hourly Budget Check**
   - Program: `node.exe`
   - Arguments: `scripts/check-cost-alerts-cron.js`
   - Start in: `C:\path\to\project`
   - Trigger: Daily, repeat every 1 hour

2. **Daily Summary**
   - Program: `node.exe`
   - Arguments: `scripts/check-cost-alerts-cron.js --summary`
   - Start in: `C:\path\to\project`
   - Trigger: Daily at 11:59 PM

#### Option C: Netlify Scheduled Functions

Create a Netlify function:

```typescript
// netlify/functions/check-alerts.ts
import { schedule } from '@netlify/functions';
import { checkAndStoreAlerts } from '@/lib/costAlerting';

export const handler = schedule('0 * * * *', async () => {
  await checkAndStoreAlerts();
  return { statusCode: 200 };
});
```

## Usage

### Manual Budget Check

Visit the alerts dashboard:

```
https://your-domain.com/admin/alerts
```

Click "Check Budget Now" to manually trigger a budget check.

### Programmatic Usage

```typescript
import { 
  checkBudgetLimits, 
  generateDailyCostSummary,
  storeAlert 
} from '@/lib/costAlerting';

// Check budget limits
const alerts = await checkBudgetLimits(new Date());

// Store alerts
for (const alert of alerts) {
  await storeAlert(alert);
}

// Generate daily summary
const summary = await generateDailyCostSummary(new Date());
await storeAlert(summary);
```

### API Usage

**Get Recent Alerts:**

```bash
GET /api/admin/alerts?limit=50&severity=critical
```

**Check Budget:**

```bash
POST /api/admin/alerts/check
Content-Type: application/json

{
  "date": "2024-01-15",
  "generateSummary": true,
  "budget": {
    "daily_egress_gb": 10,
    "daily_function_hours": 5,
    "daily_total_cost": 1.0,
    "monthly_total_cost": 30.0
  }
}
```

## Alert Types

### 1. Budget Exceeded

Triggered when actual usage exceeds configured budget limits.

**Example:**
```
Title: Daily Egress Budget Exceeded
Severity: Critical (if >150%) or Warning (if >100%)
Message: Supabase egress has exceeded the daily budget. 
         Current: 12.45 GB, Budget: 10 GB
```

### 2. Threshold Warning

Triggered when usage reaches 80% of budget (configurable).

**Example:**
```
Title: Egress Budget Threshold Warning
Severity: Warning
Message: Supabase egress is approaching the daily budget (85%). 
         Current: 8.5 GB, Budget: 10 GB
```

### 3. Daily Summary

Comprehensive daily cost report.

**Example:**
```
Title: Daily Cost Summary
Severity: Info
Message: 
Daily Cost Summary for 2024-01-15:

Supabase Egress: 8.45 GB ($0.76)
Netlify Functions: 3.2 hours ($0.23)
Total Cost: $0.99

Egress by Category:
- RPC: 5.2 GB
- Real-time: 1.8 GB
- Storage: 1.2 GB
- Auth: 0.15 GB
- Other: 0.1 GB

Bandwidth Saved: 2.3 GB ($0.21)
```

## Alert Severity Guidelines

### Info
- Daily summaries
- Informational notifications
- No action required

### Warning
- Usage at 80-100% of budget
- Usage at 100-150% of budget
- Action recommended

### Critical
- Usage exceeds 150% of budget
- Immediate action required
- May indicate cost overrun

## Customization

### Custom Budget Configuration

Pass custom budget to functions:

```typescript
const customBudget: CostBudget = {
  daily_egress_gb: 20,
  daily_function_hours: 10,
  daily_total_cost: 2.0,
  monthly_total_cost: 60.0
};

const alerts = await checkBudgetLimits(
  new Date(), 
  customBudget
);
```

### Custom Pricing

```typescript
const customPricing: CostPricing = {
  supabase_egress_per_gb: 0.09,
  netlify_function_per_hour: 0.072
};

const summary = await generateDailyCostSummary(
  new Date(),
  customPricing
);
```

### Custom Threshold Percentage

Edit `src/lib/costAlerting.ts`:

```typescript
const THRESHOLD_PERCENTAGE = 75; // Alert at 75% instead of 80%
```

## Integration with Notification Systems

### Email Notifications

```typescript
import { checkBudgetLimits } from '@/lib/costAlerting';
import { sendEmail } from '@/lib/email';

const alerts = await checkBudgetLimits();

for (const alert of alerts) {
  if (alert.severity === 'critical') {
    await sendEmail({
      to: 'admin@example.com',
      subject: alert.title,
      body: alert.message
    });
  }
}
```

### Slack Notifications

```typescript
import { checkBudgetLimits } from '@/lib/costAlerting';

const alerts = await checkBudgetLimits();

for (const alert of alerts) {
  await fetch('https://hooks.slack.com/services/YOUR/WEBHOOK/URL', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `${alert.title}\n${alert.message}`,
      color: alert.severity === 'critical' ? 'danger' : 'warning'
    })
  });
}
```

## Monitoring and Maintenance

### View Alert History

```sql
-- Recent critical alerts
SELECT * FROM cost_alerts 
WHERE severity = 'critical' 
ORDER BY created_at DESC 
LIMIT 10;

-- Daily summaries for last week
SELECT * FROM cost_alerts 
WHERE alert_type = 'daily_summary' 
AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- Alert frequency by type
SELECT alert_type, severity, COUNT(*) 
FROM cost_alerts 
GROUP BY alert_type, severity;
```

### Clean Up Old Alerts

```sql
-- Delete alerts older than 90 days
DELETE FROM cost_alerts 
WHERE created_at < NOW() - INTERVAL '90 days';
```

## Troubleshooting

### No Alerts Generated

1. Check if performance_metrics table has data
2. Verify budget limits are configured correctly
3. Check if actual usage is below thresholds
4. Review cron job logs for errors

### Alerts Not Visible in Dashboard

1. Verify RLS policies are correctly configured
2. Check admin authentication
3. Review browser console for errors
4. Verify API endpoint is accessible

### Incorrect Cost Calculations

1. Verify pricing configuration matches actual costs
2. Check performance_metrics data accuracy
3. Review cost calculation logic
4. Ensure proper unit conversions (bytes to GB, seconds to hours)

## Best Practices

1. **Set Realistic Budgets**: Base budgets on historical usage patterns
2. **Monitor Regularly**: Review alerts dashboard daily
3. **Act on Warnings**: Don't wait for critical alerts
4. **Adjust Thresholds**: Fine-tune based on your needs
5. **Archive Old Alerts**: Keep database size manageable
6. **Test Alerting**: Manually trigger checks to verify functionality
7. **Document Changes**: Track budget adjustments over time

## Future Enhancements

- Email/SMS notification integration
- Predictive alerting based on usage trends
- Multi-tier budget configurations
- Alert acknowledgment and resolution tracking
- Cost forecasting and projections
- Integration with billing systems
- Custom alert rules and conditions
