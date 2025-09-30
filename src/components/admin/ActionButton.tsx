"use client";

import { ReactNode } from "react";

interface ActionButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "success" | "danger" | "warning";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
  type?: "button" | "submit" | "reset";
}

export default function ActionButton({
  children,
  onClick,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  className = "",
  type = "button"
}: ActionButtonProps) {
  const baseClasses = "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg";
  
  const variantClasses = {
    primary: "bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 focus:ring-blue-500 disabled:from-blue-300 disabled:to-blue-400",
    secondary: "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 hover:from-gray-200 hover:to-gray-300 focus:ring-gray-500 disabled:from-gray-50 disabled:to-gray-100 border border-gray-300",
    success: "bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 focus:ring-green-500 disabled:from-green-300 disabled:to-green-400",
    danger: "bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 focus:ring-red-500 disabled:from-red-300 disabled:to-red-400",
    warning: "bg-gradient-to-r from-orange-600 to-orange-700 text-white hover:from-orange-700 hover:to-orange-800 focus:ring-orange-500 disabled:from-orange-300 disabled:to-orange-400"
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-6 py-3 text-base gap-2"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      type={type}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${disabled || loading ? "cursor-not-allowed opacity-60" : ""}
        ${className}
      `}
    >
      {loading ? (
        <div className="spinner w-4 h-4"></div>
      ) : icon ? (
        <span className="flex items-center">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}