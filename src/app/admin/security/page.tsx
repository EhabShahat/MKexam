import { Metadata } from 'next';
import SecurityMonitor from '@/components/admin/SecurityMonitor';

export const metadata: Metadata = {
  title: 'Security Monitor - Admin',
  description: 'Monitor security events, rate limiting, and suspicious activity',
};

export default function SecurityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Security Monitor</h1>
        <p className="text-gray-600 mt-1">
          Monitor security events, rate limiting status, and suspicious activity patterns.
        </p>
      </div>
      
      <SecurityMonitor />
    </div>
  );
}