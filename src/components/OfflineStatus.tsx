/**
 * Offline Status Component
 * 
 * Provides user feedback about network status and offline operations
 * in the reordered student experience flow.
 */

"use client";

import { useEffect, useState } from 'react';
import { useOfflineStatus, type NetworkStatus } from '@/lib/offlineHandler';
import { useStudentLocale } from '@/components/public/PublicLocaleProvider';
import { t } from '@/i18n/student';

interface OfflineStatusProps {
  /** Whether to show the status indicator (default: true) */
  show?: boolean;
  /** Position of the status indicator */
  position?: 'top' | 'bottom';
  /** Whether to show detailed network information */
  showDetails?: boolean;
  /** Custom CSS classes */
  className?: string;
}

export default function OfflineStatus({
  show = true,
  position = 'top',
  showDetails = false,
  className = '',
}: OfflineStatusProps) {
  const { isOnline, networkStatus, networkQuality, queueStatus } = useOfflineStatus();
  const { locale, dir } = useStudentLocale();
  const [isVisible, setIsVisible] = useState(false);
  const [lastOnlineTime, setLastOnlineTime] = useState<number | null>(null);

  // Track when we go offline/online
  useEffect(() => {
    if (isOnline) {
      setLastOnlineTime(Date.now());
      // Hide status after a delay when online
      const timer = setTimeout(() => setIsVisible(false), 3000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(true);
    }
  }, [isOnline]);

  // Show status when network status changes
  useEffect(() => {
    if (networkStatus !== 'online') {
      setIsVisible(true);
    }
  }, [networkStatus]);

  if (!show || (!isVisible && networkStatus === 'online')) {
    return null;
  }

  const getStatusConfig = (status: NetworkStatus) => {
    switch (status) {
      case 'offline':
        return {
          color: 'bg-red-500',
          textColor: 'text-red-800',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636L5.636 18.364M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" />
            </svg>
          ),
          message: t(locale, 'offline_mode'),
          description: t(locale, 'offline_description'),
        };
      case 'slow':
        return {
          color: 'bg-yellow-500',
          textColor: 'text-yellow-800',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
          message: t(locale, 'slow_connection'),
          description: t(locale, 'slow_connection_description'),
        };
      case 'unstable':
        return {
          color: 'bg-orange-500',
          textColor: 'text-orange-800',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
          ),
          message: t(locale, 'unstable_connection'),
          description: t(locale, 'unstable_connection_description'),
        };
      case 'online':
      default:
        return {
          color: 'bg-green-500',
          textColor: 'text-green-800',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ),
          message: t(locale, 'back_online'),
          description: t(locale, 'connection_restored'),
        };
    }
  };

  const statusConfig = getStatusConfig(networkStatus);
  const positionClasses = position === 'top' 
    ? 'top-4' 
    : 'bottom-4';

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div
      className={`fixed ${positionClasses} ${dir === 'rtl' ? 'left-4' : 'right-4'} z-50 max-w-sm ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className={`rounded-lg border ${statusConfig.borderColor} ${statusConfig.bgColor} p-4 shadow-lg backdrop-blur-sm`}>
        <div className="flex items-start gap-3">
          {/* Status indicator */}
          <div className={`flex-shrink-0 w-2 h-2 rounded-full ${statusConfig.color} mt-2`} />
          
          {/* Status content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className={statusConfig.textColor}>
                {statusConfig.icon}
              </div>
              <p className={`text-sm font-medium ${statusConfig.textColor}`}>
                {statusConfig.message}
              </p>
            </div>
            
            <p className={`text-xs ${statusConfig.textColor} opacity-80 mt-1`}>
              {statusConfig.description}
            </p>

            {/* Queue status */}
            {queueStatus.size > 0 && (
              <div className={`text-xs ${statusConfig.textColor} opacity-70 mt-2`}>
                {t(locale, 'pending_operations')}: {queueStatus.size}
              </div>
            )}

            {/* Detailed network information */}
            {showDetails && networkQuality.latency > 0 && (
              <div className={`text-xs ${statusConfig.textColor} opacity-60 mt-2 space-y-1`}>
                <div>{t(locale, 'latency')}: {Math.round(networkQuality.latency)}ms</div>
                <div>{t(locale, 'reliability')}: {Math.round(networkQuality.reliability * 100)}%</div>
              </div>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={() => setIsVisible(false)}
            className={`flex-shrink-0 ${statusConfig.textColor} opacity-50 hover:opacity-100 transition-opacity`}
            aria-label={t(locale, 'close')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact offline status indicator for inline use
 */
export function CompactOfflineStatus({ className = '' }: { className?: string }) {
  const { isOnline, networkStatus } = useOfflineStatus();
  const { locale } = useStudentLocale();

  if (isOnline && networkStatus === 'online') {
    return null;
  }

  const getStatusColor = (status: NetworkStatus) => {
    switch (status) {
      case 'offline': return 'text-red-600';
      case 'slow': return 'text-yellow-600';
      case 'unstable': return 'text-orange-600';
      default: return 'text-green-600';
    }
  };

  const getStatusIcon = (status: NetworkStatus) => {
    switch (status) {
      case 'offline':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636L5.636 18.364" />
          </svg>
        );
      case 'slow':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
          </svg>
        );
      case 'unstable':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
    }
  };

  return (
    <div className={`inline-flex items-center gap-1 ${getStatusColor(networkStatus)} ${className}`}>
      {getStatusIcon(networkStatus)}
      <span className="text-xs">
        {networkStatus === 'offline' && t(locale, 'offline')}
        {networkStatus === 'slow' && t(locale, 'slow')}
        {networkStatus === 'unstable' && t(locale, 'unstable')}
      </span>
    </div>
  );
}