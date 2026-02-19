-- Cost Alerts Table
-- Stores cost alerts and daily summaries for monitoring budget limits
-- Requirements: 12.7

CREATE TABLE IF NOT EXISTS public.cost_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL CHECK (alert_type IN ('budget_exceeded', 'daily_summary', 'threshold_warning')),
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title text NOT NULL,
  message text NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_cost_alerts_created_at 
ON public.cost_alerts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cost_alerts_severity 
ON public.cost_alerts(severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cost_alerts_type 
ON public.cost_alerts(alert_type, created_at DESC);

-- Enable RLS
ALTER TABLE public.cost_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view alerts
CREATE POLICY "Admins can view cost alerts"
ON public.cost_alerts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE admin_users.id = auth.uid()
  )
);

-- Policy: System can insert alerts (for automated alerting)
CREATE POLICY "System can insert cost alerts"
ON public.cost_alerts
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.cost_alerts IS 'Stores cost alerts and daily summaries for budget monitoring';
