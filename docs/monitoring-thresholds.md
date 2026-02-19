# Monitoring Thresholds & Alerting

## Overview

This document defines monitoring thresholds for the optimization features and when to trigger alerts or rollbacks.

## Critical Thresholds

### Error Rate
- **Baseline**: < 0.5%
- **Warning**: > 1%
- **Critical**: > 2%
- **Action**: Rollback if critical threshold exceeded for > 5 minutes

### Response Time (p95)
- **Baseline**: < 1000ms
- **Warning**: > 2000ms
- **Critical**: > 5000ms
- **Action**: Investigate if warning, rollback if critical

### Cache Hit Rate
- **Target**: > 80%
- **Warning**: < 70%
- **Critical**: < 50%
- **Action**: Investigate cache configuration, check TTLs

### Compression Ratio
- **Target**: > 60%
- **Warning**: < 50%
- **Critical**: < 40%
- **Action**: Review data characteristics, check compression algorithm

### Database Query Time
- **Baseline**: < 100ms (p95)
- **Warning**: > 500ms
- **Critical**: > 1000ms
- **Action**: Check indexes, review query plans

### Supabase Egress
- **Target**: 60% reduction from baseline
- **Warning**: < 40% reduction
- **Critical**: Increase from baseline
- **Action**: Review optimization effectiveness

### Netlify Function Execution Time
- **Target**: 50% reduction from baseline
- **Warning**: < 30% reduction
- **Critical**: Increase from baseline
- **Action**: Review function optimization

## Monitoring Queries

### Error Rate
```sql
SELECT 
  DATE_TRUNC('minute', created_at) as minute,
  COUNT(*) FILTER (WHERE level = 'error') as errors,
  COUNT(*) as total,
  (COUNT(*) FILTER (WHERE level = 'error')::float / COUNT(*)) * 100 as error_rate
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY minute
ORDER BY minute DESC;
```

### Cache Hit Rate
```sql
SELECT 
  cache_type,
  SUM(hits) as total_hits,
  SUM(misses) as total_misses,
  (SUM(hits)::float / (SUM(hits) + SUM(misses))) * 100 as hit_rate
FROM cache_statistics
WHERE recorded_at > NOW() - INTERVAL '1 hour'
GROUP BY cache_type;
```

### Response Time Percentiles
```sql
SELECT 
  operation,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY value) as p50,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value) as p95,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY value) as p99
FROM performance_metrics
WHERE metric_type = 'response_time'
  AND recorded_at > NOW() - INTERVAL '1 hour'
GROUP BY operation;
```

### Egress Tracking
```sql
SELECT 
  DATE_TRUNC('day', recorded_at) as day,
  operation,
  SUM(value) / 1024 / 1024 as egress_mb
FROM performance_metrics
WHERE metric_type = 'egress'
  AND recorded_at > NOW() - INTERVAL '7 days'
GROUP BY day, operation
ORDER BY day DESC, egress_mb DESC;
```

## Alert Configuration

### Slack/Email Alerts

```typescript
// Example alert configuration
const alerts = {
  errorRate: {
    warning: 0.01,  // 1%
    critical: 0.02, // 2%
    channels: ['#engineering', '#ops'],
  },
  responseTime: {
    warning: 2000,  // 2s
    critical: 5000, // 5s
    channels: ['#engineering'],
  },
  cacheHitRate: {
    warning: 0.70,  // 70%
    critical: 0.50, // 50%
    channels: ['#engineering'],
  },
};
```

### Automated Actions

```typescript
// Automated rollback triggers
const autoRollback = {
  enabled: true,
  conditions: [
    {
      metric: 'error_rate',
      threshold: 0.02,
      duration: 300, // 5 minutes
      action: 'disable_all_optimizations',
    },
    {
      metric: 'response_time_p95',
      threshold: 10000, // 10s
      duration: 180, // 3 minutes
      action: 'disable_compression',
    },
  ],
};
```

## Dashboard Metrics

### Real-time Dashboard
- Current error rate (last 5 minutes)
- Current response time (p50, p95, p99)
- Cache hit rate by type
- Active optimizations status
- Recent alerts

### Daily Report
- Total egress (GB)
- Average response time
- Cache statistics
- Error summary
- Cost estimates

### Weekly Report
- Egress reduction vs baseline
- Function time reduction vs baseline
- Cost savings
- Optimization effectiveness
- Issues and incidents

## Health Check Endpoint

```typescript
// GET /api/health/optimizations
{
  "status": "healthy",
  "timestamp": "2024-02-19T12:00:00Z",
  "metrics": {
    "errorRate": 0.005,
    "responseTimeP95": 850,
    "cacheHitRate": 0.85,
    "compressionRatio": 0.72
  },
  "features": {
    "compression": true,
    "caching": true,
    "fieldSelection": true,
    "jsonbOptimization": true
  },
  "thresholds": {
    "errorRate": { "current": 0.005, "warning": 0.01, "critical": 0.02 },
    "responseTime": { "current": 850, "warning": 2000, "critical": 5000 }
  }
}
```

## Incident Response

### Level 1: Warning
- **Trigger**: Warning threshold exceeded
- **Action**: Monitor closely, investigate cause
- **Notification**: Slack message to #engineering
- **Response Time**: 30 minutes

### Level 2: Critical
- **Trigger**: Critical threshold exceeded
- **Action**: Immediate investigation, prepare rollback
- **Notification**: Slack alert + email to on-call
- **Response Time**: 10 minutes

### Level 3: Emergency
- **Trigger**: Multiple critical thresholds or data corruption
- **Action**: Immediate rollback
- **Notification**: Page on-call engineer
- **Response Time**: 5 minutes

## Monitoring Tools

- **Supabase Dashboard**: Database metrics, query performance
- **Netlify Analytics**: Function execution time, bandwidth
- **Custom Dashboard**: Optimization-specific metrics
- **Logs**: Centralized logging for error tracking

---

**Last Updated**: 2024-02-19
**Version**: 1.0
**Owner**: DevOps Team
