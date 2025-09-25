"use client";

import { ReactNode } from "react";

interface StatItem {
  key: string;
  label: string;
  value: string | number;
  change?: {
    value: number;
    type: "increase" | "decrease";
    period: string;
  };
  icon?: ReactNode;
  color?: "blue" | "green" | "red" | "yellow" | "purple" | "gray";
  format?: "number" | "percentage" | "currency";
}

interface StatsTableProps {
  title?: string;
  subtitle?: string;
  stats: StatItem[];
  layout?: "grid" | "list";
  columns?: 2 | 3 | 4;
  className?: string;
}

export default function StatsTable({
  title,
  subtitle,
  stats,
  layout = "grid",
  columns = 3,
  className = ""
}: StatsTableProps) {
  const formatValue = (value: string | number, format?: string) => {
    if (typeof value === "string") return value;
    
    switch (format) {
      case "percentage":
        return `${value}%`;
      case "currency":
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD"
        }).format(value);
      case "number":
      default:
        return new Intl.NumberFormat("en-US").format(value);
    }
  };

  const getColorClasses = (color: string = "gray") => {
    const colorMap = {
      blue: "bg-blue-50 text-blue-700 border-blue-200",
      green: "bg-green-50 text-green-700 border-green-200",
      red: "bg-red-50 text-red-700 border-red-200",
      yellow: "bg-yellow-50 text-yellow-700 border-yellow-200",
      purple: "bg-purple-50 text-purple-700 border-purple-200",
      gray: "bg-gray-50 text-gray-700 border-gray-200"
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.gray;
  };

  const getIconColorClasses = (color: string = "gray") => {
    const colorMap = {
      blue: "text-blue-600 bg-blue-100",
      green: "text-green-600 bg-green-100",
      red: "text-red-600 bg-red-100",
      yellow: "text-yellow-600 bg-yellow-100",
      purple: "text-purple-600 bg-purple-100",
      gray: "text-gray-600 bg-gray-100"
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.gray;
  };

  if (layout === "list") {
    return (
      <div className={`bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg overflow-hidden ${className}`}>
        {(title || subtitle) && (
          <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
            {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
            {subtitle && <p className="text-gray-600 mt-1">{subtitle}</p>}
          </div>
        )}
        
        <div className="divide-y divide-gray-100">
          {stats.map((stat) => (
            <div key={stat.key} className="px-6 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {stat.icon && (
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getIconColorClasses(stat.color)}`}>
                      {stat.icon}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{stat.label}</p>
                    {stat.change && (
                      <p className="text-xs text-gray-500">
                        vs {stat.change.period}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">
                    {formatValue(stat.value, stat.format)}
                  </p>
                  {stat.change && (
                    <div className={`flex items-center justify-end gap-1 text-xs font-medium ${
                      stat.change.type === "increase" ? "text-green-600" : "text-red-600"
                    }`}>
                      <svg 
                        className={`w-3 h-3 ${stat.change.type === "increase" ? "rotate-0" : "rotate-180"}`} 
                        fill="currentColor" 
                        viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                      </svg>
                      {Math.abs(stat.change.value)}%
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {(title || subtitle) && (
        <div className="text-center">
          {title && <h3 className="text-2xl font-bold text-gray-900">{title}</h3>}
          {subtitle && <p className="text-gray-600 mt-2">{subtitle}</p>}
        </div>
      )}
      
      <div className={`grid grid-cols-1 md:grid-cols-${Math.min(columns, 2)} lg:grid-cols-${columns} gap-6`}>
        {stats.map((stat) => (
          <div
            key={stat.key}
            className="bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg p-6 hover:shadow-xl transition-all duration-200 hover:scale-105"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {stat.icon && (
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getIconColorClasses(stat.color)}`}>
                    {stat.icon}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  {stat.change && (
                    <p className="text-xs text-gray-500">vs {stat.change.period}</p>
                  )}
                </div>
              </div>
              
              {stat.change && (
                <div className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                  stat.change.type === "increase" 
                    ? "bg-green-100 text-green-700" 
                    : "bg-red-100 text-red-700"
                }`}>
                  <svg 
                    className={`w-3 h-3 ${stat.change.type === "increase" ? "rotate-0" : "rotate-180"}`} 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                  {Math.abs(stat.change.value)}%
                </div>
              )}
            </div>
            
            <div className="text-3xl font-bold text-gray-900 mb-2">
              {formatValue(stat.value, stat.format)}
            </div>
            
            {/* Progress bar for percentage values */}
            {stat.format === "percentage" && typeof stat.value === "number" && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    stat.color === "green" ? "bg-green-500" :
                    stat.color === "blue" ? "bg-blue-500" :
                    stat.color === "red" ? "bg-red-500" :
                    stat.color === "yellow" ? "bg-yellow-500" :
                    stat.color === "purple" ? "bg-purple-500" :
                    "bg-gray-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, stat.value))}%` }}
                ></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
