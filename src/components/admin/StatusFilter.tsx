"use client";

import { useMemo } from "react";

export type StatusFilterValue = "all" | "published" | "completed";

export interface StatusFilterProps {
  value: StatusFilterValue;
  onChange: (value: StatusFilterValue) => void;
}

export default function StatusFilter({ value, onChange }: StatusFilterProps) {
  const options = useMemo(() => [
    { value: "all" as const, label: "All Exams", icon: "M4 6h16M4 12h16M4 18h16" },
    { value: "published" as const, label: "Published", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
    { value: "completed" as const, label: "Completed", icon: "M5 13l4 4L19 7" },
  ], []);

  return (
    <div 
      className="inline-flex items-center gap-2 p-1 bg-gray-100 rounded-lg"
      role="group"
      aria-label="Filter exams by status"
    >
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-all duration-200
              ${isActive 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }
            `}
            aria-pressed={isActive}
            aria-label={`Filter by ${option.label}`}
          >
            <svg 
              className="w-4 h-4" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d={option.icon} 
              />
            </svg>
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
