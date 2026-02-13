'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface DeviceInfoStatsData {
  stats: {
    total: number;
    withDeviceInfo: number;
    withoutDeviceInfo: number;
    enhanced: number;
    legacy: number;
    invalid: number;
    null: number;
    healthPercentage: number;
  };
  examId: string;
  limit: number;
}

interface DeviceInfoStatsProps {
  examId?: string;
  limit?: number;
}

/**
 * Device Info Statistics Component
 * Displays health metrics for device info collection across attempts
 */
export default function DeviceInfoStats({ examId, limit = 100 }: DeviceInfoStatsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch device info health data
  const { data, isLoading, error, refetch } = useQuery<DeviceInfoStatsData>({
    queryKey: ['device-info-health', examId, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (examId) params.append('examId', examId);
      params.append('limit', limit.toString());

      const response = await fetch(`/api/admin/device-info/health?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch device info health data');
      }
      return response.json();
    },
    staleTime: 30000, // Cache for 30 seconds
  });

  if (isLoading) {
    return (
      <div className="card p-4">
        <div className="flex items-center gap-2 text-gray-600">
          <div className="animate-spin">⏳</div>
          <span>Loading device info statistics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-4 border-red-200 bg-red-50">
        <div className="flex items-center gap-2 text-red-700">
          <span>❌</span>
          <span>Failed to load device info statistics</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { stats } = data;
  const healthColor = 
    stats.healthPercentage >= 90 ? 'text-green-600' :
    stats.healthPercentage >= 70 ? 'text-yellow-600' :
    'text-red-600';

  return (
    <div className="card">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">
            📊 Device Info Health
          </h3>
          <button
            onClick={() => refetch()}
            className="btn-secondary text-sm px-3 py-1"
            title="Refresh statistics"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Health percentage - always visible */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Collection Rate</span>
            <span className={`text-2xl font-bold ${healthColor}`}>
              {stats.healthPercentage}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                stats.healthPercentage >= 90 ? 'bg-green-500' :
                stats.healthPercentage >= 70 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ width: `${stats.healthPercentage}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {stats.withDeviceInfo} of {stats.total} attempts have device info
          </p>
        </div>

        {/* Toggle for detailed stats */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          {isExpanded ? '▼ Hide Details' : '▶ Show Details'}
        </button>

        {/* Detailed statistics */}
        {isExpanded && (
          <div className="mt-4 space-y-3 pt-3 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-3">
              <StatItem
                label="Total Attempts"
                value={stats.total}
                icon="📝"
              />
              <StatItem
                label="With Device Info"
                value={stats.withDeviceInfo}
                icon="✅"
                color="text-green-600"
              />
              <StatItem
                label="Missing Device Info"
                value={stats.withoutDeviceInfo}
                icon="❌"
                color="text-red-600"
              />
              <StatItem
                label="Enhanced Format"
                value={stats.enhanced}
                icon="🆕"
                color="text-blue-600"
              />
              <StatItem
                label="Legacy Format"
                value={stats.legacy}
                icon="📜"
                color="text-gray-600"
              />
              <StatItem
                label="Invalid Format"
                value={stats.invalid}
                icon="⚠️"
                color="text-orange-600"
              />
            </div>

            <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
              Showing last {data.limit} attempts
              {examId && examId !== 'all' && ` for exam ${examId}`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface StatItemProps {
  label: string;
  value: number;
  icon: string;
  color?: string;
}

function StatItem({ label, value, icon, color = 'text-gray-900' }: StatItemProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-gray-600">{label}</span>
      </div>
      <div className={`text-xl font-bold ${color}`}>
        {value}
      </div>
    </div>
  );
}
