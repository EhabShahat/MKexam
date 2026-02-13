"use client";

import { useState } from "react";

export interface ExamType {
  value: "exam" | "homework" | "quiz";
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  description: string;
}

const examTypes: ExamType[] = [
  {
    value: "exam",
    label: "Exam",
    icon: "📝",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    description: "Formal assessment with grading"
  },
  {
    value: "homework",
    label: "Homework",
    icon: "📚",
    color: "text-green-700",
    bgColor: "bg-green-100",
    description: "Assignment for practice"
  },
  {
    value: "quiz",
    label: "Quiz",
    icon: "⚡",
    color: "text-purple-700",
    bgColor: "bg-purple-100",
    description: "Quick knowledge check"
  }
];

interface ExamTypeSelectorProps {
  value: "exam" | "homework" | "quiz";
  onChange: (value: "exam" | "homework" | "quiz") => void;
  disabled?: boolean;
}

export default function ExamTypeSelector({ value, onChange, disabled = false }: ExamTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Exam Type
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {examTypes.map((type) => {
          const isSelected = value === type.value;
          return (
            <button
              key={type.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(type.value)}
              className={`
                relative flex flex-col items-center p-4 rounded-lg border-2 transition-all duration-200
                ${isSelected
                  ? `border-blue-500 ${type.bgColor} ring-2 ring-blue-200`
                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                }
                ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              <div className="text-2xl mb-2">{type.icon}</div>
              <div className={`font-medium text-sm ${isSelected ? type.color : "text-gray-900"}`}>
                {type.label}
              </div>
              <div className="text-xs text-gray-500 text-center mt-1">
                {type.description}
              </div>
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ExamTypeBadge({ type }: { type: "exam" | "homework" | "quiz" }) {
  const examType = examTypes.find(t => t.value === type) || examTypes[0];
  
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${examType.bgColor} ${examType.color}`}>
      <span>{examType.icon}</span>
      {examType.label}
    </span>
  );
}

export function ExamTypeMicroBadge({ type }: { type: "exam" | "homework" | "quiz" }) {
  const examType = examTypes.find(t => t.value === type) || examTypes[0];
  const letter = type === "exam" ? "E" : type === "homework" ? "H" : "Q";
  
  return (
    <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold ${examType.bgColor} ${examType.color}`}>
      {letter}
    </span>
  );
}
