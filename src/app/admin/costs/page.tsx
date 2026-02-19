/**
 * Cost Reporting Dashboard
 * 
 * Displays:
 * - Daily/weekly/monthly cost trends
 * - Cost comparison vs previous period
 * - Cost per exam and cost per student
 * - Bandwidth savings from optimization
 * 
 * Requirements: 12.3, 12.6
 */

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

type Period = 'daily' | 'weekly' | 'monthly';

interface CostData {
  current: {
    metrics: any[];
    summary: any;
    cost: any;
  };
  previous: {
    metrics: any[];
    summary: any;
    cost: any;
  };
  comparison: {
    egress_change_percent: number;
    function_time_change_percent: number;
    cost_change_percent: number;
    savings_change_percent: number;
  };
  perExam?: Record<string, number>;
  perStudent?: Record<string, number>;
}

export default function CostReportingPage() {
  const [period, setPeriod] = useState<Period>('weekly');

  // Fetch cost data
  const { data: costData, isLoading, error } = useQuery<CostData>({
    queryKey: ['cost-report', period],
    queryFn: async () => {
      const response = await fetch(`/api/admin/costs?period=${period}`);
      if (!response.ok) {
        throw new Error('Failed to fetch cost data');
      }
      return response.json();
    },
    refetchInterval: 60000 // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Cost Reporting Dashboard</h1>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading cost data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Cost Reporting Dashboard</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error loading cost data: {(error as Error).message}</p>
        </div>
      </div>
    );
  }

  if (!costData) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Cost Reporting Dashboard</h1>
        <div className="text-gray-500">No cost data available</div>
      </div>
    );
  }

  const { current, previous, comparison } = costData;

  // Prepare chart data for cost trends
  const trendChartData = {
    labels: current.metrics.map((m: any) => m.date),
    datasets: [
      {
        label: 'Total Cost ($)',
        data: current.metrics.map((m: any) => {
          const egressCost = m.supabase_egress_gb * 0.09;
          const functionCost = (m.netlify_function_seconds / 3600) * 0.072;
          return (egressCost + functionCost).toFixed(2);
        }),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4
      },
      {
        label: 'Supabase Egress Cost ($)',
        data: current.metrics.map((m: any) => (m.supabase_egress_gb * 0.09).toFixed(2)),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4
      },
      {
        label: 'Netlify Function Cost ($)',
        data: current.metrics.map((m: any) => ((m.netlify_function_seconds / 3600) * 0.072).toFixed(2)),
        borderColor: 'rgb(245, 158, 11)',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.4
      }
    ]
  };

  // Prepare chart data for egress by category
  const categoryChartData = {
    labels: ['RPC', 'Real-time', 'Storage', 'Auth', 'Other'],
    datasets: [
      {
        label: 'Egress by Category (GB)',
        data: [
          current.summary.egress_by_category.rpc.toFixed(2),
          current.summary.egress_by_category.realtime.toFixed(2),
          current.summary.egress_by_category.storage.toFixed(2),
          current.summary.egress_by_category.auth.toFixed(2),
          current.summary.egress_by_category.other.toFixed(2)
        ],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(156, 163, 175, 0.8)'
        ]
      }
    ]
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Format percentage
  const formatPercent = (value: number) => {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  // Get color for percentage change
  const getChangeColor = (value: number, inverse = false) => {
    if (inverse) {
      return value < 0 ? 'text-green-600' : 'text-red-600';
    }
    return value > 0 ? 'text-red-600' : 'text-green-600';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Cost Reporting Dashboard</h1>
        
        {/* Period selector */}
        <div className="flex gap-2">
          <button
            onClick={() => setPeriod('daily')}
            className={`px-4 py-2 rounded-lg ${
              period === 'daily'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Daily
          </button>
          <button
            onClick={() => setPeriod('weekly')}
            className={`px-4 py-2 rounded-lg ${
              period === 'weekly'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setPeriod('monthly')}
            className={`px-4 py-2 rounded-lg ${
              period === 'monthly'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Cost */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Total Cost</div>
          <div className="text-2xl font-bold mb-2">
            {formatCurrency(current.cost.total_cost)}
          </div>
          <div className={`text-sm ${getChangeColor(comparison.cost_change_percent)}`}>
            {formatPercent(comparison.cost_change_percent)} vs previous period
          </div>
        </div>

        {/* Supabase Egress */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Supabase Egress</div>
          <div className="text-2xl font-bold mb-2">
            {current.summary.total_egress_gb.toFixed(2)} GB
          </div>
          <div className={`text-sm ${getChangeColor(comparison.egress_change_percent)}`}>
            {formatPercent(comparison.egress_change_percent)} vs previous period
          </div>
        </div>

        {/* Function Time */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Function Time</div>
          <div className="text-2xl font-bold mb-2">
            {(current.summary.total_function_seconds / 3600).toFixed(2)} hrs
          </div>
          <div className={`text-sm ${getChangeColor(comparison.function_time_change_percent)}`}>
            {formatPercent(comparison.function_time_change_percent)} vs previous period
          </div>
        </div>

        {/* Bandwidth Savings */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Bandwidth Saved</div>
          <div className="text-2xl font-bold mb-2">
            {current.summary.total_bandwidth_saved_gb.toFixed(2)} GB
          </div>
          <div className={`text-sm ${getChangeColor(comparison.savings_change_percent, true)}`}>
            {formatPercent(comparison.savings_change_percent)} vs previous period
          </div>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Cost Details */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Cost Breakdown</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Supabase Egress Cost</span>
              <span className="font-semibold">{formatCurrency(current.cost.supabase_egress_cost)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Netlify Function Cost</span>
              <span className="font-semibold">{formatCurrency(current.cost.netlify_function_cost)}</span>
            </div>
            <div className="border-t pt-3 flex justify-between items-center">
              <span className="text-gray-900 font-semibold">Total Cost</span>
              <span className="text-lg font-bold">{formatCurrency(current.cost.total_cost)}</span>
            </div>
            <div className="bg-green-50 border border-green-200 rounded p-3 flex justify-between items-center">
              <span className="text-green-800 font-medium">Estimated Savings</span>
              <span className="text-green-800 font-bold">{formatCurrency(current.cost.estimated_savings)}</span>
            </div>
          </div>
        </div>

        {/* Cache Performance */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Cache Performance</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Cache Hit Rate</span>
              <span className="font-semibold">{current.summary.average_cache_hit_rate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Bandwidth Saved</span>
              <span className="font-semibold">{current.summary.total_bandwidth_saved_gb.toFixed(2)} GB</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Cost Savings</span>
              <span className="font-semibold">{formatCurrency(current.cost.estimated_savings)}</span>
            </div>
            <div className="border-t pt-3">
              <div className="text-sm text-gray-600 mb-2">Optimization Impact</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${Math.min(current.summary.average_cache_hit_rate, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Trends Chart */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Cost Trends</h2>
        <div className="h-80">
          <Line
            data={trendChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'top' as const,
                },
                title: {
                  display: false
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: 'Cost ($)'
                  }
                }
              }
            }}
          />
        </div>
      </div>

      {/* Egress by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Egress by Category</h2>
          <div className="h-64">
            <Doughnut
              data={categoryChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'right' as const,
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Category Details</h2>
          <div className="space-y-3">
            {Object.entries(current.summary.egress_by_category).map(([category, value]) => (
              <div key={category} className="flex justify-between items-center">
                <span className="text-gray-600 capitalize">{category}</span>
                <div className="text-right">
                  <div className="font-semibold">{(value as number).toFixed(2)} GB</div>
                  <div className="text-sm text-gray-500">
                    {formatCurrency((value as number) * 0.09)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cost per Exam and Student */}
      {(costData.perExam || costData.perStudent) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {costData.perExam && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Cost per Exam</h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {Object.entries(costData.perExam)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .slice(0, 10)
                  .map(([examId, cost]) => (
                    <div key={examId} className="flex justify-between items-center py-2 border-b">
                      <span className="text-gray-600 text-sm truncate">{examId}</span>
                      <span className="font-semibold">{formatCurrency(cost as number)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {costData.perStudent && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Cost per Student</h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {Object.entries(costData.perStudent)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .slice(0, 10)
                  .map(([studentId, cost]) => (
                    <div key={studentId} className="flex justify-between items-center py-2 border-b">
                      <span className="text-gray-600 text-sm truncate">{studentId}</span>
                      <span className="font-semibold">{formatCurrency(cost as number)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
