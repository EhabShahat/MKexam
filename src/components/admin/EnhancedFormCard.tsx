"use client";

import { ReactNode } from "react";

interface EnhancedFormCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
  headerColor?: "blue" | "green" | "purple" | "orange" | "red";
}

export default function EnhancedFormCard({ 
  title, 
  description, 
  icon, 
  children, 
  className = "",
  headerColor = "blue"
}: EnhancedFormCardProps) {
  const colorClasses = {
    blue: {
      header: "bg-gradient-to-r from-blue-50 to-indigo-50",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600"
    },
    green: {
      header: "bg-gradient-to-r from-green-50 to-emerald-50",
      iconBg: "bg-green-100",
      iconColor: "text-green-600"
    },
    purple: {
      header: "bg-gradient-to-r from-purple-50 to-violet-50",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600"
    },
    orange: {
      header: "bg-gradient-to-r from-orange-50 to-amber-50",
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600"
    },
    red: {
      header: "bg-gradient-to-r from-red-50 to-rose-50",
      iconBg: "bg-red-100",
      iconColor: "text-red-600"
    }
  };

  const colors = colorClasses[headerColor];

  return (
    <div className={`bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 ${className}`}>
      {/* Enhanced Header */}
      <div className={`${colors.header} px-6 py-4 border-b border-gray-200`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 ${colors.iconBg} rounded-lg shadow-sm`}>
            <div className={`w-5 h-5 ${colors.iconColor}`}>
              {icon}
            </div>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            <p className="text-gray-600 text-sm">{description}</p>
          </div>
        </div>
      </div>
      
      {/* Card Content */}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

// Enhanced Form Field Component
interface EnhancedFormFieldProps {
  label: string;
  icon?: ReactNode;
  required?: boolean;
  children: ReactNode;
  description?: string;
  className?: string;
}

export function EnhancedFormField({ 
  label, 
  icon, 
  required = false, 
  children, 
  description,
  className = ""
}: EnhancedFormFieldProps) {
  return (
    <div className={`group ${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-blue-600 transition-colors">
        <span className="flex items-center gap-2">
          {icon && <div className="w-4 h-4">{icon}</div>}
          {label}
          {required && <span className="text-red-500">*</span>}
        </span>
      </label>
      {children}
      {description && (
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      )}
    </div>
  );
}

// Enhanced Input Component
interface EnhancedInputProps {
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  disabled?: boolean;
}

export function EnhancedInput({ 
  type = "text", 
  placeholder, 
  value, 
  onChange, 
  className = "",
  disabled = false
}: EnhancedInputProps) {
  return (
    <input
      type={type}
      className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

// Enhanced Textarea Component
interface EnhancedTextareaProps {
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  className?: string;
  disabled?: boolean;
}

export function EnhancedTextarea({ 
  placeholder, 
  value, 
  onChange, 
  rows = 4,
  className = "",
  disabled = false
}: EnhancedTextareaProps) {
  return (
    <textarea
      className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white shadow-sm hover:shadow-md resize-none disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      rows={rows}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

// Enhanced Select Component
interface EnhancedSelectProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function EnhancedSelect({ 
  value, 
  onChange, 
  children, 
  className = "",
  disabled = false
}: EnhancedSelectProps) {
  return (
    <select
      className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white shadow-sm hover:shadow-md appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      value={value}
      onChange={onChange}
      disabled={disabled}
    >
      {children}
    </select>
  );
}
