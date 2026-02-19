-- Performance Monitoring Infrastructure
-- This file creates tables and functions for tracking performance metrics and cache statistics

-- Performance Metrics Table
-- Tracks various performance metrics including egress, function execution, cache hits, and query times
CREATE TABLE IF NOT EXISTS public.performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type text NOT NULL CHECK (metric_type IN ('egress', 'function_execution', 'cache_hit', 'query_time', 'error')),
  operation text NOT NULL,
  value numeric NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_perf_metrics_type_time 
ON public.performance_metrics(metric_type, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_perf_metrics_operation 
ON public.performance_metrics(operation, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_perf_metrics_recorded_at 
ON public.performance_metrics(recorded_at DESC);

-- Cache Statistics Table
-- Tracks cache performance metrics including hits, misses, evictions, and size
CREATE TABLE IF NOT EXISTS public.cache_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_type text NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  misses integer NOT NULL DEFAULT 0,
  evictions integer NOT NULL DEFAULT 0,
  size_bytes bigint NOT NULL DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for cache statistics
CREATE INDEX IF NOT EXISTS idx_cache_stats_type_time 
ON public.cache_statistics(cache_type, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_cache_stats_type 
ON public.cache_statistics(cache_type);

-- Function to log performance metrics
CREATE OR REPLACE FUNCTION public.log_performance_metric(
  p_metric_type text,
  p_operation text,
  p_value numeric,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_metric_id uuid;
BEGIN
  INSERT INTO public.performance_metrics (metric_type, operation, value, metadata)
  VALUES (p_metric_type, p_operation, p_value, p_metadata)
  RETURNING id INTO v_metric_id;
  
  RETURN v_metric_id;
END;
$$;

-- Function to log cache statistics
CREATE OR REPLACE FUNCTION public.log_cache_statistics(
  p_cache_type text,
  p_hits integer,
  p_misses integer,
  p_evictions integer DEFAULT 0,
  p_size_bytes bigint DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stat_id uuid;
BEGIN
  INSERT INTO public.cache_statistics (cache_type, hits, misses, evictions, size_bytes)
  VALUES (p_cache_type, p_hits, p_misses, p_evictions, p_size_bytes)
  RETURNING id INTO v_stat_id;
  
  RETURN v_stat_id;
END;
$$;

-- Function to get performance metrics summary
CREATE OR REPLACE FUNCTION public.get_performance_summary(
  p_start_date timestamptz DEFAULT (now() - interval '24 hours'),
  p_end_date timestamptz DEFAULT now(),
  p_metric_type text DEFAULT NULL
)
RETURNS TABLE(
  metric_type text,
  operation text,
  total_count bigint,
  avg_value numeric,
  min_value numeric,
  max_value numeric,
  p50_value numeric,
  p95_value numeric,
  p99_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.metric_type,
    pm.operation,
    COUNT(*)::bigint as total_count,
    AVG(pm.value) as avg_value,
    MIN(pm.value) as min_value,
    MAX(pm.value) as max_value,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pm.value) as p50_value,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY pm.value) as p95_value,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY pm.value) as p99_value
  FROM public.performance_metrics pm
  WHERE pm.recorded_at >= p_start_date
    AND pm.recorded_at <= p_end_date
    AND (p_metric_type IS NULL OR pm.metric_type = p_metric_type)
  GROUP BY pm.metric_type, pm.operation
  ORDER BY pm.metric_type, total_count DESC;
END;
$$;

-- Function to get cache statistics summary
CREATE OR REPLACE FUNCTION public.get_cache_summary(
  p_start_date timestamptz DEFAULT (now() - interval '24 hours'),
  p_end_date timestamptz DEFAULT now()
)
RETURNS TABLE(
  cache_type text,
  total_hits bigint,
  total_misses bigint,
  hit_rate numeric,
  total_evictions bigint,
  avg_size_bytes numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.cache_type,
    SUM(cs.hits)::bigint as total_hits,
    SUM(cs.misses)::bigint as total_misses,
    CASE 
      WHEN SUM(cs.hits + cs.misses) > 0 
      THEN ROUND((SUM(cs.hits)::numeric / SUM(cs.hits + cs.misses)::numeric) * 100, 2)
      ELSE 0
    END as hit_rate,
    SUM(cs.evictions)::bigint as total_evictions,
    AVG(cs.size_bytes) as avg_size_bytes
  FROM public.cache_statistics cs
  WHERE cs.recorded_at >= p_start_date
    AND cs.recorded_at <= p_end_date
  GROUP BY cs.cache_type
  ORDER BY total_hits DESC;
END;
$$;

-- Grant permissions to authenticated users
GRANT SELECT ON public.performance_metrics TO authenticated;
GRANT SELECT ON public.cache_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_performance_metric TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_cache_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_performance_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cache_summary TO authenticated;

-- Comments for documentation
COMMENT ON TABLE public.performance_metrics IS 'Stores performance metrics for monitoring Supabase egress, function execution, cache hits, and query times';
COMMENT ON TABLE public.cache_statistics IS 'Stores cache performance statistics including hits, misses, evictions, and size';
COMMENT ON FUNCTION public.log_performance_metric IS 'Logs a performance metric with type, operation, value, and optional metadata';
COMMENT ON FUNCTION public.log_cache_statistics IS 'Logs cache statistics for a specific cache type';
COMMENT ON FUNCTION public.get_performance_summary IS 'Returns aggregated performance metrics with percentiles for a date range';
COMMENT ON FUNCTION public.get_cache_summary IS 'Returns aggregated cache statistics with hit rates for a date range';
