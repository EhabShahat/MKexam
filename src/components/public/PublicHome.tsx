"use client";

import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import CodeManagement from "@/components/CodeManagement";
import { useStudentCode } from "@/hooks/useStudentCode";
import { useStudentLocale } from "@/components/public/PublicLocaleProvider";
import { t } from "@/i18n/student";
import { useRenderPerformance } from "@/lib/reorderedFlowPerformance";

export default function PublicHome(props: {
  mode: "exam" | "results" | "disabled";
  disabledMessage: string | null;
  showExams: boolean;
  showResults: boolean;
  showRegister: boolean;
  currentCode?: string; // New prop for current code
  onCodeClear?: () => void; // New prop for code clearing
}) {
  const { mode, disabledMessage, showExams, showResults, showRegister, currentCode, onCodeClear } = props;
  const { locale } = useStudentLocale();
  
  // Track render performance for this component
  useRenderPerformance('PublicHome');
  
  // Use the useStudentCode hook for reactive state management
  const { storedCode, codeMetadata, isValidating, hasValidCode } = useStudentCode();
  
  // Use the stored code from the hook if no currentCode prop is provided
  const displayCode = currentCode || storedCode;
  const showCodeManagement = displayCode && onCodeClear;

  const showPublicId = mode !== "disabled";
  const visibleCount = (showExams ? 1 : 0) + (showResults ? 1 : 0) + (showRegister ? 1 : 0) + (showPublicId ? 1 : 0);
  const gridColsSm = visibleCount === 1 
    ? "sm:grid-cols-1" 
    : visibleCount === 2 
      ? "sm:grid-cols-2" 
      : visibleCount === 3 
        ? "sm:grid-cols-3" 
        : "sm:grid-cols-4";

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-xl">
        {/* Logo */}
        <div className="mb-8 text-center">
          <BrandLogo useAppSettings={true} size="lg" />
        </div>

        {/* Display student code under brand logo if available */}
        {displayCode && (
          <div className="text-center mb-6 pb-6 border-b border-gray-200">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-gray-600">{t(locale, "current_code")}:</span>
              <span className="text-lg font-bold text-gray-900 font-mono tracking-wider">{displayCode}</span>
            </div>
          </div>
        )}

        {/* Content */}
        {mode === "disabled" ? (
          <div className="text-center">
            <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{disabledMessage || t(locale, "no_exams_available")}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className={`grid grid-cols-1 ${gridColsSm} gap-4`}>
            {showExams && (
              displayCode ? (
                <button 
                  onClick={() => {
                    // Navigate with code in URL for immediate verification
                    window.location.href = `/exams?code=${encodeURIComponent(displayCode)}`;
                  }}
                  className="group w-full text-left"
                >
                  <div className="h-full rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors p-6 text-center shadow-sm">
                    <div className=" h-12 mx-auto mb-3 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
                      </svg>
                    </div>
                    <div className="font-semibold text-blue-900 text-lg text-center">{t(locale, "exams")}</div>
                    <p className="text-sm text-blue-800/80 mt-1">{t(locale, "browse_exams")}</p>
                  </div>
                </button>
              ) : (
                <Link href="/exams" className="group">
                  <div className="h-full rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors p-6 text-center shadow-sm">
                    <div className=" h-12 mx-auto mb-3 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
                      </svg>
                    </div>
                    <div className="font-semibold text-blue-900 text-lg text-center">{t(locale, "exams")}</div>
                    <p className="text-sm text-blue-800/80 mt-1">{t(locale, "browse_exams")}</p>
                  </div>
                </Link>
              )
            )}

            {showResults && (
              <Link href="/results" className="group">
                <div className="h-full rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition-colors p-6 text-center shadow-sm">
                  <div className=" h-12 mx-auto mb-3 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="font-semibold text-indigo-900 text-lg text-center">{t(locale, "results")}</div>
                  <p className="text-sm text-indigo-800/80 mt-1">{t(locale, "search_your_results")}</p>
                </div>
              </Link>
            )}

            {showRegister && (
              <Link href="/register" className="group">
                <div className="h-full rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors p-6 text-center shadow-sm">
                  <div className=" h-12 mx-auto mb-3 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <div className="font-semibold text-purple-900 text-lg text-center">{t(locale, "register")}</div>
                  <p className="text-sm text-purple-800/80 mt-1">{t(locale, "apply_to_join")}</p>
                </div>
              </Link>
            )}

            {showPublicId && (
              <Link href="/id" className="group">
                <div className="h-full rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors p-6 text-center shadow-sm">
                  <div className=" h-12 mx-auto mb-3 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H9l-4 4v-4H5a2 2 0 01-2-2V5zm2 0v10h14V5H5zm2 2h6v2H7V7zm0 4h10v2H7v-2z" />
                    </svg>
                  </div>
                  <div className="font-semibold text-emerald-900 text-lg text-center">{t(locale, "public_id")}</div>
                  <p className="text-sm text-emerald-800/80 mt-1">{t(locale, "view_id_card")}</p>
                </div>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Code Management UI - only show if displayCode is provided */}
      {/* Removed - Code management section hidden */}

      {/* Tiny admin access link */}
      <div className="fixed bottom-2 inset-x-0 text-center">
        <Link href="/admin" className="text-[10px] text-gray-400 hover:text-gray-600 hover:underline underline-offset-2">
          {t(locale, "admin_access")}
        </Link>
      </div>
    </>
  );
}
