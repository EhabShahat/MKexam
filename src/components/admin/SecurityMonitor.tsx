"use client";

import { useState, useEffect } from 'react';
import { getAllRateLimitStatus, getRateLimitStatus } from '@/lib/rateLimiter';

interface SecurityStatus {
  rateLimits: Record<string, {
    isLimited: boolean;
    remainingAttempts: number;
    resetTime: number | null;
    suspiciousPatterns: string[];
  }>;
  timestamp: number;
}

interface SecurityLog {
  event: string;
  details: Record<string, unknown>;
  severity: string;
  timestamp: number;
  user_agent: string;
  synced: boolean;
}

export default function SecurityMonitor() {
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus | null>(null);
  const [localLogs, setLocalLogs] = useState<SecurityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load security status and local logs
  useEffect(() => {
    const loadSecurityData = async () => {
      try {
        setIsLoading(true);
        
        // Get client-side rate limit status
        const clientRateLimits = getAllRateLimitStatus();
        
        // Get local security logs
        const storedLogs = localStorage.getItem('security_logs');
        const logs = storedLogs ? JSON.parse(storedLogs) : [];
        
        setSecurityStatus({
          rateLimits: clientRateLimits,
          timestamp: Date.now(),
        });
        
        setLocalLogs(logs);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load security data');
      } finally {
        setIsLoading(false);
      }
    };

    loadSecurityData();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadSecurityData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-red-500 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPatternDescription = (pattern: string) => {
    switch (pattern) {
      case 'rapid_failures': return 'Rapid successive failures detected';
      case 'regular_intervals': return 'Bot-like regular intervals detected';
      case 'high_frequency': return 'High frequency attempts detected';
      default: return pattern;
    }
  };

  if (isLoading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading security data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="p-6">
          <div className="text-red-600 font-medium">Error loading security data</div>
          <div className="text-sm text-gray-600 mt-1">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Rate Limiting Status */}
      <div className="card">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Rate Limiting Status</h3>
          
          {securityStatus && (
            <div className="space-y-4">
              {Object.entries(securityStatus.rateLimits).map(([operation, status]) => (
                <div key={operation} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900 capitalize">
                      {operation.replace(/([A-Z])/g, ' $1').toLowerCase()}
                    </h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      status.isLimited 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {status.isLimited ? 'Limited' : 'Active'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Remaining attempts:</span>
                      <span className="ml-2 font-medium">
                        {status.remainingAttempts === Infinity ? '∞' : status.remainingAttempts}
                      </span>
                    </div>
                    
                    {status.resetTime && (
                      <div>
                        <span className="text-gray-600">Reset time:</span>
                        <span className="ml-2 font-medium">
                          {formatTimestamp(status.resetTime)}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {status.suspiciousPatterns.length > 0 && (
                    <div className="mt-3">
                      <div className="text-sm text-gray-600 mb-1">Suspicious patterns:</div>
                      <div className="space-y-1">
                        {status.suspiciousPatterns.map((pattern, index) => (
                          <div key={index} className="text-xs bg-yellow-50 text-yellow-800 px-2 py-1 rounded">
                            {getPatternDescription(pattern)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Security Logs */}
      <div className="card">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Security Events</h3>
            <div className="text-sm text-gray-600">
              {localLogs.length} events ({localLogs.filter(log => !log.synced).length} unsynced)
            </div>
          </div>
          
          {localLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No security events recorded
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {localLogs
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 50)
                .map((log, index) => (
                  <div key={index} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(log.severity)}`}>
                          {log.severity}
                        </span>
                        <span className="font-medium text-gray-900">{log.event}</span>
                        {!log.synced && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            Unsynced
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                    
                    {Object.keys(log.details).length > 0 && (
                      <div className="text-sm text-gray-600">
                        <div className="font-medium mb-1">Details:</div>
                        <div className="bg-gray-50 rounded p-2 font-mono text-xs">
                          {JSON.stringify(log.details, null, 2)}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Security Actions */}
      <div className="card">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Actions</h3>
          
          <div className="space-y-3">
            <button
              onClick={() => {
                localStorage.removeItem('security_logs');
                setLocalLogs([]);
              }}
              className="btn btn-secondary"
            >
              Clear Local Security Logs
            </button>
            
            <button
              onClick={() => {
                localStorage.removeItem('rate_limit_codeValidation');
                localStorage.removeItem('rate_limit_codeStorage');
                localStorage.removeItem('rate_limit_securityLogSync');
                window.location.reload();
              }}
              className="btn btn-secondary"
            >
              Reset All Rate Limits
            </button>
            
            <button
              onClick={async () => {
                try {
                  const response = await fetch('/api/security/logs');
                  const data = await response.json();
                  console.log('Server security status:', data);
                  alert('Check console for server security status');
                } catch (error) {
                  console.error('Failed to fetch server status:', error);
                  alert('Failed to fetch server security status');
                }
              }}
              className="btn btn-primary"
            >
              Check Server Security Status
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}