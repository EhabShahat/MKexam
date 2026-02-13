"use client";

import { useRouter } from "next/navigation";
import { clearCode, getStoredCode } from "@/hooks/useStudentCode";
import { useStudentLocale } from "@/components/public/PublicLocaleProvider";
import { t } from "@/i18n/student";

interface ClearCodeButtonProps {
  className?: string;
  variant?: "primary" | "outline" | "text";
}

export default function ClearCodeButton({ className = "", variant = "outline" }: ClearCodeButtonProps) {
  const router = useRouter();
  const { locale } = useStudentLocale();
  const storedCode = getStoredCode();

  // Don't render if no code is stored
  if (!storedCode) {
    return null;
  }

  const handleClearCode = () => {
    clearCode();
    // Redirect to exam entry page
    router.push("/exams");
  };

  const baseClasses = "inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200";
  
  const variantClasses = {
    primary: "bg-red-600 hover:bg-red-700 text-white shadow-sm hover:shadow-md",
    outline: "border-2 border-gray-300 hover:border-red-500 text-gray-700 hover:text-red-600 bg-white hover:bg-red-50",
    text: "text-gray-600 hover:text-red-600 hover:bg-red-50",
  };

  return (
    <button
      onClick={handleClearCode}
      type="button"
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      aria-label={t(locale, "clear_stored_code")}
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
      <span>{t(locale, "clear_code")}</span>
    </button>
  );
}
