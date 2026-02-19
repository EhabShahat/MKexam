"use client";

import { useEffect, useState, useCallback, useMemo, memo } from "react";
import { useStudentLocale } from "@/components/public/PublicLocaleProvider";
import { t } from "@/i18n/student";
import type { CodeFormatSettings } from "@/lib/codeGenerator";
import { validateCodeFormat } from "@/lib/codeGenerator";
import { useRenderPerformance } from "@/lib/reorderedFlowPerformance";


export interface CodeInputFormProps {
  /** Current code value */
  code: string;
  /** Callback when code changes */
  onCodeChange: (code: string) => void;
  /** Callback when form is submitted */
  onSubmit: (code: string) => void;
  /** Whether the form is in a checking/loading state */
  checking?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Display mode - code-only shows minimal UI, full shows complete interface */
  mode?: "code-only" | "full";
  /** Custom title for the form */
  title?: string;
  /** Custom hint text */
  hint?: string;
  /** Whether to auto-focus the input field */
  autoFocus?: boolean;
  /** Custom submit button text */
  submitText?: string;
  /** Custom CSS classes */
  className?: string;
  /** Whether to show real-time validation feedback */
  showValidation?: boolean;
}

function CodeInputForm({
  code,
  onCodeChange,
  onSubmit,
  checking = false,
  error = null,
  mode = "full",
  title,
  hint,
  autoFocus = true,
  submitText,
  className = "",
  showValidation = true,
}: CodeInputFormProps) {
  const { locale, dir } = useStudentLocale();
  const [internalError, setInternalError] = useState<string | null>(null);
  const [codeSettings, setCodeSettings] = useState<CodeFormatSettings | null>(null);

  // Track render performance for this component
  useRenderPerformance('CodeInputForm');

  // Use external error if provided, otherwise use internal error
  const displayError = error || internalError;

  // Fetch code format settings on mount
  useEffect(() => {
    async function fetchCodeSettings() {
      try {
        const res = await fetch("/api/public/code-settings", { cache: "no-store" });
        if (res.ok) {
          const settings = await res.json();
          setCodeSettings(settings);
        }
      } catch (error) {
        console.warn("Failed to fetch code settings, using defaults");
        setCodeSettings({
          code_length: 4,
          code_format: "numeric",
          code_pattern: null,
          enable_multi_exam: true,
        });
      }
    }
    void fetchCodeSettings();
  }, []);

  // Helper function to validate code format
  const isValidCode = useCallback((code: string): boolean => {
    if (!codeSettings || !code) return false;
    return validateCodeFormat(code, codeSettings);
  }, [codeSettings]);

  // Helper functions for input field - memoized for performance
  const placeholder = useMemo((): string => {
    if (!codeSettings) return "0000";

    const { code_length, code_format, code_pattern } = codeSettings;

    if (code_format === "custom" && code_pattern) {
      return code_pattern.replace(/N/g, "0").replace(/A/g, "A").replace(/#/g, "0");
    }

    switch (code_format) {
      case "numeric":
        return "0".repeat(code_length);
      case "alphabetic":
        return "A".repeat(code_length);
      case "alphanumeric":
        return "A0".repeat(Math.ceil(code_length / 2)).substring(0, code_length);
      default:
        return "0".repeat(code_length);
    }
  }, [codeSettings]);

  const maxLength = useMemo((): number => {
    if (!codeSettings) return 4;

    const { code_length, code_format, code_pattern } = codeSettings;

    if (code_format === "custom" && code_pattern) {
      return code_pattern.length;
    }

    return code_length;
  }, [codeSettings]);

  // Real-time validation feedback - memoized for performance
  const validationFeedback = useMemo((): { isValid: boolean; message?: string } => {
    if (!showValidation || !code || !codeSettings) {
      return { isValid: true };
    }

    const isValid = isValidCode(code);
    if (!isValid && code.length > 0) {
      return {
        isValid: false,
        message: t(locale, "code_must_be_4_digits"),
      };
    }

    return { isValid: true };
  }, [code, codeSettings, isValidCode, showValidation, locale]);

  // Memoized text values
  const finalTitle = useMemo(() => title || t(locale, "select_exam"), [title, locale]);
  const finalHint = useMemo(() => hint || t(locale, "results_search_hint_code"), [hint, locale]);
  const finalSubmitText = useMemo(() => submitText || t(locale, "find_exams"), [submitText, locale]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValidCode(code)) {
      setInternalError(t(locale, "code_must_be_4_digits"));
      return;
    }

    setInternalError(null);
    onSubmit(code);
  }, [code, isValidCode, locale, onSubmit]);

  const handleCodeChange = useCallback((value: string) => {
    const upperValue = value.toUpperCase();
    onCodeChange(upperValue);
    
    // Clear error when user starts typing
    if (displayError) {
      setInternalError(null);
    }
  }, [onCodeChange, displayError]);

  const validation = validationFeedback;

  const formContent = useMemo(() => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label htmlFor="exam-code" className="block text-sm font-semibold text-gray-700 mb-2">
        {t(locale, "exam_code")}
      </label>
      <div className="relative">
        <input
          id="exam-code"
          type="text"
          value={code}
          onChange={(e) => handleCodeChange(e.target.value)}
          className={`w-full px-4 py-4 text-center text-2xl font-mono tracking-[0.5em] border-2 rounded-xl focus:ring-4 transition-all duration-200 bg-gray-50 focus:bg-white ${
            validation.isValid
              ? "border-gray-300 focus:border-blue-500 focus:ring-blue-100"
              : "border-red-300 focus:border-red-500 focus:ring-red-100"
          }`}
          placeholder={placeholder}
          maxLength={maxLength}
          inputMode={codeSettings?.code_format === "numeric" ? "numeric" : "text"}
          autoComplete="one-time-code"
          autoFocus={autoFocus}
          required
        />
        <div className={`absolute inset-y-0 ${dir === "rtl" ? "left-4" : "right-4"} flex items-center pointer-events-none`}>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2m-2-2h-6m6 0v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9a2 2 0 012-2h6z" />
          </svg>
        </div>
      </div>

      {/* Real-time validation feedback */}
      {showValidation && !validation.isValid && validation.message && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-amber-800 text-sm" role="alert">{validation.message}</p>
        </div>
      )}

      {/* Error display */}
      {displayError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800 text-sm" role="alert">{displayError}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={checking || !isValidCode(code)}
        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:scale-100 disabled:cursor-not-allowed shadow-lg hover:shadow-xl disabled:shadow-md"
      >
        {checking ? (
          <span className="flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            {t(locale, "checking_code")}
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            {finalSubmitText}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ transform: dir === "rtl" ? "scaleX(-1)" : undefined }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </span>
        )}
      </button>

    </form>
  ), [handleSubmit, locale, code, handleCodeChange, validation, placeholder, maxLength, codeSettings, dir, autoFocus, showValidation, displayError, checking, isValidCode, finalSubmitText]);

  if (mode === "code-only") {
    return (
      <div className={`max-w-md mx-auto ${className}`}>
        {formContent}
      </div>
    );
  }

  return (
    <div className={`max-w-md mx-auto ${className}`}>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{finalTitle}</h2>
        <p className="text-gray-600 text-sm">{finalHint}</p>
      </div>
      {formContent}
    </div>
  );
}

// Export with memo for performance optimization
export default memo(CodeInputForm);