import { getExamStatus, getStatusIcon, type ExamWithScheduling } from '@/lib/examStatus';

interface EnhancedStatusBadgeProps {
  exam: ExamWithScheduling;
  showTimeInfo?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function EnhancedStatusBadge({ 
  exam, 
  showTimeInfo = false,
  size = 'md'
}: EnhancedStatusBadgeProps) {
  const statusInfo = getExamStatus(exam);
  
  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1.5",
    lg: "text-base px-4 py-2"
  };

  const colorClasses: Record<string, string> = {
    green: "bg-green-100 text-green-800 border-green-300",
    blue: "bg-blue-100 text-blue-800 border-blue-300",
    yellow: "bg-yellow-100 text-yellow-800 border-yellow-300",
    gray: "bg-gray-100 text-gray-800 border-gray-300",
    red: "bg-red-100 text-red-800 border-red-300",
    purple: "bg-purple-100 text-purple-800 border-purple-300"
  };

  // Ultra-minimal: Combine status and time in one badge
  const displayText = statusInfo.timeInfo 
    ? `${statusInfo.statusLabel} • ${statusInfo.timeInfo}`
    : statusInfo.statusLabel;

  return (
    <span 
      className={`
        inline-flex items-center gap-1.5 font-medium rounded-lg border
        ${sizeClasses[size]} 
        ${colorClasses[statusInfo.statusColor] || colorClasses.gray}
      `}
      title={`${statusInfo.statusLabel} (${statusInfo.mode} mode)`}
    >
      <span>{displayText}</span>
    </span>
  );
}
