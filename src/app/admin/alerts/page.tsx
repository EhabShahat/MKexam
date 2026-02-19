'use client';

/**
 * Cost Alerts Dashboard
 * 
 * Displays cost alerts and budget warnings
 * Allows admins to check current budget status
 * 
 * Requirements: 12.7
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface CostAlert {
  id: string;
  alert_type: 'budget_exceeded' | 'daily_summary' | 'threshold_warning';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metrics: {
    current_value: number;
    threshold_value: number;
    percentage: number;
  };
  created_at: string;
}

export default function AlertsPage() {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const queryClient = useQueryClient();

  // Fetch alerts
  const { data: alertsData, isLoading, error } = useQuery({
    queryKey: ['cost-alerts', selectedSeverity],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('limit', '50');
      if (selectedSeverity !== 'all') {
        params.append('severity', selectedSeverity);
      }

      const response = await fetch(`/api/admin/alerts?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch alerts');
      }
      return response.json();
    },
    refetchInterval: 60000 // Refresh every minute
  });

  // Check budget mutation
  const checkBudgetMutation = useMutation({
    mutationFn: async (generateSummary: boolean) => {
      const response = await fetch('/api/admin/alerts/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generateSummary })
      });
      if (!response.ok) {
        throw new Error('Failed to check budget');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-alerts'] });
    }
  });

  const alerts: CostAlert[] = alertsData?.alerts || [];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'info':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '🚨';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📋';
    }
  };

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case 'budget_exceeded':
        return 'Budget Exceeded';
      case 'threshold_warning':
        return 'Threshold Warning';
      case 'daily_summary':
        return 'Daily Summary';
      default:
        return type;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Cost Alerts</h1>
        <p className="text-gray-600">
          Monitor budget limits and cost thresholds
        </p>
      </div>

      {/* Actions */}
      <div className="mb-6 flex gap-4 items-center">
        <button
          onClick={() => checkBudgetMutation.mutate(false)}
          disabled={checkBudgetMutation.isPending}
          className="btn btn-primary"
        >
          {checkBudgetMutation.isPending ? 'Checking...' : 'Check Budget Now'}
        </button>

        <button
          onClick={() => checkBudgetMutation.mutate(true)}
          disabled={checkBudgetMutation.isPending}
          className="btn"
        >
          {checkBudgetMutation.isPending ? 'Generating...' : 'Generate Daily Summary'}
        </button>

        {/* Severity Filter */}
        <div className="ml-auto">
          <label className="text-sm text-gray-600 mr-2">Filter by severity:</label>
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="input"
          >
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>
      </div>

      {/* Success Message */}
      {checkBudgetMutation.isSuccess && (
        <div className="mb-6 p-4 bg-green-100 border border-green-300 rounded-lg">
          <p className="text-green-800">
            {checkBudgetMutation.data.message}
          </p>
        </div>
      )}

      {/* Error Message */}
      {(error || checkBudgetMutation.isError) && (
        <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg">
          <p className="text-red-800">
            {error instanceof Error ? error.message : 'An error occurred'}
            {checkBudgetMutation.error instanceof Error && checkBudgetMutation.error.message}
          </p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading alerts...</p>
        </div>
      )}

      {/* Alerts List */}
      {!isLoading && alerts.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 text-lg">No alerts found</p>
          <p className="text-gray-500 text-sm mt-2">
            Click "Check Budget Now" to check current budget status
          </p>
        </div>
      )}

      {!isLoading && alerts.length > 0 && (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`card border-2 ${getSeverityColor(alert.severity)}`}
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl">
                  {getSeverityIcon(alert.severity)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold">{alert.title}</h3>
                    <span className="text-xs px-2 py-1 rounded bg-white bg-opacity-50">
                      {getAlertTypeLabel(alert.alert_type)}
                    </span>
                    <span className="text-xs px-2 py-1 rounded bg-white bg-opacity-50 uppercase">
                      {alert.severity}
                    </span>
                  </div>
                  
                  <div className="text-sm whitespace-pre-line mb-3">
                    {alert.message}
                  </div>

                  {alert.alert_type !== 'daily_summary' && alert.metrics.threshold_value > 0 && (
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Current: </span>
                        <span className="font-semibold">
                          {alert.metrics.current_value.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Budget: </span>
                        <span className="font-semibold">
                          {alert.metrics.threshold_value.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Usage: </span>
                        <span className="font-semibold">
                          {alert.metrics.percentage.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 text-xs text-gray-600">
                    {formatDate(alert.created_at)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {!isLoading && alerts.length > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card bg-red-50 border border-red-200">
            <div className="text-sm text-gray-600 mb-1">Critical Alerts</div>
            <div className="text-2xl font-bold text-red-700">
              {alerts.filter(a => a.severity === 'critical').length}
            </div>
          </div>
          <div className="card bg-yellow-50 border border-yellow-200">
            <div className="text-sm text-gray-600 mb-1">Warnings</div>
            <div className="text-2xl font-bold text-yellow-700">
              {alerts.filter(a => a.severity === 'warning').length}
            </div>
          </div>
          <div className="card bg-blue-50 border border-blue-200">
            <div className="text-sm text-gray-600 mb-1">Info</div>
            <div className="text-2xl font-bold text-blue-700">
              {alerts.filter(a => a.severity === 'info').length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
