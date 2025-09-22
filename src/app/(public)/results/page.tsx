"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import BrandLogo from "@/components/BrandLogo";
import { useRouter } from "next/navigation";
import { useStudentLocale } from "@/components/public/PublicLocaleProvider";
import { t } from "@/i18n/student";

interface ExamResult {
  id: string;
  exam_id: string;
  exam_title: string;
  student_name: string;
  student_code: string;
  completion_status: string;
  submitted_at: string | null;
  score_percentage: number | null;
  is_pass?: boolean | null;
  pass_threshold?: number | null;
}

interface ExtraItem {
  key: string;
  label: string;
  value: any;
  max_points?: number | null;
  type?: "number" | "text" | "boolean";
}

interface PassSummary {
  overall_score: number | null;
  passed: boolean | null;
  threshold: number | null;
  message: string | null;
  hidden: boolean;
  exam_passed?: number;
  exam_total?: number;
}

interface SummaryResponse {
  student: { id: string; code: string; student_name?: string | null } | null;
  extras: ExtraItem[];
  pass_summary: PassSummary;
}

interface PublicSettings {
  brand_name?: string;
  brand_logo_url?: string;
  enable_name_search?: boolean;
  enable_code_search?: boolean;
  results_show_view_attempt?: boolean;
}

export default function PublicResultsPage({
  initialSystemMode,
  initialDisabledMessage,
  skipModeFetch = !!initialSystemMode,
}: {
  initialSystemMode?: 'exam' | 'results' | 'disabled';
  initialDisabledMessage?: string | null;
  skipModeFetch?: boolean;
} = {}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [effectiveMode, setEffectiveMode] = useState<"name" | "code">("name");
  const [settings, setSettings] = useState<PublicSettings>({});
  const [showResults, setShowResults] = useState(false);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [verifiedCode, setVerifiedCode] = useState<string | null>(null);
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [verificationAttempted, setVerificationAttempted] = useState(false);
  const [reviewAttemptId, setReviewAttemptId] = useState<string | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  
  // Fetch app settings
  const router = useRouter();
  const [systemMode, setSystemMode] = useState<'exam' | 'results' | 'disabled' | null>(initialSystemMode ?? null);
  const [disabledMessage, setDisabledMessage] = useState<string | null>(initialDisabledMessage ?? null);
  const { locale, dir } = useStudentLocale();
  
  // Fetch app settings
  const settingsQuery = useQuery<PublicSettings, Error>({
    queryKey: ["public", "settings"],
    enabled: systemMode !== 'disabled',
    queryFn: async () => {
      try {
        const res = await fetch("/api/public/settings");
        if (!res.ok) {
          console.error("Settings API error:", res.status, res.statusText);
          return {}; // Return empty object on error to prevent UI breaking
        }
        const data = await res.json();
        return data || {};
      } catch (error) {
        console.error("Settings fetch error:", error);
        return {}; // Return empty object on error
      }
    },
    retry: 3, // Retry failed requests 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff
  });
  const isCodeMode = effectiveMode === "code";

  // Attempt Review query (enabled when modal is open and we have a valid attemptId and verified code)
  const reviewQuery = useQuery<{ attempt: any; items: any[] }, Error>({
    queryKey: ["public", "review", reviewAttemptId, verifiedCode],
    enabled: systemMode !== 'disabled' && isCodeMode && isVerified && isReviewOpen && !!reviewAttemptId,
    queryFn: async () => {
      const res = await fetch(`/api/public/review?attemptId=${encodeURIComponent(reviewAttemptId!)}&code=${encodeURIComponent(verifiedCode!)}`);
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load review');
      return res.json();
    },
    staleTime: 0,
  });
  
  // Get code format settings to validate input
  const { data: codeSettings } = useQuery({
    queryKey: ["public", "code-settings"],
    queryFn: async () => {
      const res = await fetch("/api/public/code-settings");
      if (!res.ok) throw new Error("Failed to fetch code settings");
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Check if current search term matches the code format
  const isValidCodeFormat = useMemo(() => {
    if (!codeSettings || !searchTerm.trim()) return false;
    
    const { code_length, code_format, code_pattern } = codeSettings;
    const code = searchTerm.trim();
    
    if (code_format === "custom" && code_pattern) {
      if (code.length !== code_pattern.length) return false;
      for (let i = 0; i < code_pattern.length; i++) {
        const patternChar = code_pattern[i];
        const codeChar = code[i];
        switch (patternChar) {
          case "N": if (!/\d/.test(codeChar)) return false; break;
          case "A": if (!/[A-Z]/i.test(codeChar)) return false; break;
          case "#": if (!/[A-Z0-9]/i.test(codeChar)) return false; break;
          default: if (codeChar !== patternChar) return false;
        }
      }
      return true;
    }
    
    if (code.length !== code_length) return false;
    switch (code_format) {
      case "numeric": return /^\d+$/.test(code);
      case "alphabetic": return /^[A-Z]+$/i.test(code);
      case "alphanumeric": return /^[A-Z0-9]+$/i.test(code);
      default: return /^\d+$/.test(code);
    }
  }, [codeSettings, searchTerm]);

  const isUuid = (v: string | null | undefined) => !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

  const formatAnswer = (val: any): string => {
    if (val === null || val === undefined || val === '') return t(locale, 'not_answered');
    if (Array.isArray(val)) return val.map((x) => String(x)).join(', ');
    if (typeof val === 'boolean') return val ? t(locale, 'true') : t(locale, 'false');
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  const nameCanSearch = searchTerm.trim().length > 0;
  const canSearch = isCodeMode ? isVerified : nameCanSearch;

  // Manual code verification handler
  const handleVerifyCode = async () => {
    if (!isCodeMode) return;
    setVerificationAttempted(true);
    if (!isValidCodeFormat || isCheckingCode) return;
    try {
      setIsCheckingCode(true);
      const res = await fetch(`/api/public/validate-code?code=${encodeURIComponent(searchTerm.trim())}`);
      if (!res.ok) throw new Error('Validation failed');
      const data = await res.json();
      if (data?.valid) {
        setIsVerified(true);
        setVerifiedCode(searchTerm.trim());
      } else {
        setIsVerified(false);
        setVerifiedCode(null);
      }
    } catch (e) {
      console.error('Code validation error', e);
      setIsVerified(false);
      setVerifiedCode(null);
    } finally {
      setIsCheckingCode(false);
    }
  };

  // Format extras values for display
  const formatExtraValue = (item: { value: any; max_points?: number | null; type?: 'number' | 'text' | 'boolean' }) => {
    const v = item?.value as any;
    if (v === null || v === undefined || v === '') return '-';
    if (typeof v === 'boolean') {
      return v ? t(locale, 'true') : t(locale, 'false');
    }
    const n = Number(v);
    if (!Number.isNaN(n)) {
      const rounded = Math.round(n * 10) / 10;
      const max = item?.max_points;
      if (typeof max === 'number' && max > 0) {
        if (max === 100) return `${rounded}%`;
        return `${rounded}/${max}`;
      }
      return `${rounded}`;
    }
    return String(v);
  };

  // Fetch overall summary (extra scoring + overall pass/fail) when searching by verified code
  const summaryQuery = useQuery<SummaryResponse, Error>({
    queryKey: ["public", "summary", verifiedCode ?? searchTerm],
    enabled: systemMode !== 'disabled' && isCodeMode && canSearch,
    queryFn: async () => {
      const codeParam = encodeURIComponent((verifiedCode ?? searchTerm).trim());
      const res = await fetch(`/api/public/summary?code=${codeParam}`);
      if (!res.ok) throw new Error("Failed to load summary");
      return res.json();
    },
    staleTime: 30_000,
  });

  // Fetch filtered exam results from server only when user enters a term
  const resultsQuery = useQuery<ExamResult[], Error>({
    enabled: systemMode !== 'disabled' && canSearch,
    queryKey: ["public", "results", isCodeMode ? (verifiedCode ?? searchTerm) : searchTerm, effectiveMode],
    queryFn: async () => {
      try {
        const q = encodeURIComponent((isCodeMode ? (verifiedCode ?? searchTerm) : searchTerm).trim());
        const res = await fetch(`/api/public/results?q=${q}`);
        if (!res.ok) {
          console.error("Results API error:", res.status, res.statusText);
          throw new Error(res.statusText || "Failed to load results");
        }
        const data = await res.json();
        return (data.items as ExamResult[]) || [];
      } catch (error) {
        console.error("Results fetch error:", error);
        throw error; // Rethrow to show error UI
      }
    },
    retry: 2, // Retry failed requests 2 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff
  });

  // Determine display name after verification (prefer summary, fallback to first result)
  const displayStudentName = useMemo(() => {
    if (!isCodeMode || !isVerified) return null;
    const n1 = summaryQuery.data?.student?.student_name;
    if (n1 && String(n1).trim() !== '') return n1 as string;
    const items = resultsQuery.data || [];
    if (items.length > 0 && items[0]?.student_name) return items[0].student_name as string;
    return null;
  }, [isCodeMode, isVerified, summaryQuery.data, resultsQuery.data]);

  // Update settings when the query completes
  useEffect(() => {
    if (settingsQuery.data) {
      const enableName = settingsQuery.data.enable_name_search !== false;
      const enableCode = settingsQuery.data.enable_code_search !== false;
      // Preserve branding fields in settings as well
      setSettings({
        brand_name: settingsQuery.data.brand_name,
        brand_logo_url: settingsQuery.data.brand_logo_url,
        enable_name_search: enableName,
        enable_code_search: enableCode,
        results_show_view_attempt: settingsQuery.data.results_show_view_attempt,
      });
      const mode = enableCode && !enableName ? "code" : "name";
      setEffectiveMode(mode);
    }
  }, [settingsQuery.data]);
  
  // Fetch system mode & disabled message
  useEffect(() => {
    if (skipModeFetch) return; // SSR provided system mode; avoid re-fetch
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/public/system-mode');
        if (!res.ok) throw new Error('Failed to fetch system mode');
        const data = await res.json();
        if (!cancelled) {
          setSystemMode((data?.mode as 'exam' | 'results' | 'disabled') ?? 'results');
          setDisabledMessage(data?.message ?? null);
        }
      } catch (e) {
        console.error('System mode fetch error:', e);
        if (!cancelled) setSystemMode('results');
      }
    })();
    return () => { cancelled = true; };
  }, [skipModeFetch]);

  // Do not redirect away in 'exam' mode; Results page remains accessible unless system is 'disabled'
  // (Admin home buttons control visibility; 'disabled' mode handled below with dedicated UI)

  // Reveal results and scroll into view
  useEffect(() => {
    if (systemMode !== 'disabled' && resultsQuery.data) {
      setShowResults(true);
      setTimeout(() => { try { resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch { try { (resultsRef.current as any)?.scrollIntoView?.(true); } catch {} } }, 50);
    }
  }, [systemMode, resultsQuery.data]);

  // Tri-state UI rendering
  if (systemMode === null) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-600">
          <div className="w-8 h-8 mx-auto mb-4 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          {t(locale, "loading_generic")}
        </div>
      </main>
    );
  }

  if (systemMode === 'disabled') {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-xl mx-auto px-4 py-16">
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center shadow-sm">
            <div className="text-5xl mb-4">🔒</div>
            <h1 className="text-2xl font-semibold mb-2">{t(locale, "results_unavailable")}</h1>
            <p className="text-gray-600 mb-6">{disabledMessage || t(locale, "results_portal_unavailable")}</p>
            <a href="/" className="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">{t(locale, "go_home")}</a>
          </div>
        </div>
      </main>
    );
  }

  // Results mode UI
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex flex-col items-center mb-8">
          <BrandLogo useAppSettings={true} size="lg" />
          <p className="mt-8 text-gray-600">{isCodeMode ? t(locale, "results_search_hint_code") : t(locale, "results_search_hint_name")}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          {isCodeMode ? (
            !isVerified ? (
              <div className="space-y-3">
                <label htmlFor="results-code" className="block text-sm font-semibold text-gray-700">{t(locale, "exam_code")}</label>
                <div className="relative">
                  <input
                    id="results-code"
                    type="text"
                    inputMode="numeric"
                    value={searchTerm}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setSearchTerm(v);
                      setIsVerified(false);
                      setVerificationAttempted(false);
                    }}
                    className="w-full px-4 py-4 text-center text-2xl font-mono tracking-[0.5em] border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 bg-gray-50 focus:bg-white"
                    placeholder="0000"
                    maxLength={4}
                    autoComplete="one-time-code"
                  />
                  <div className={`absolute inset-y-0 ${dir === 'rtl' ? 'left-4' : 'right-4'} flex items-center pointer-events-none`}>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2m-2-2h-6m6 0v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9a2 2 0 012-2h6z" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-gray-500 text-center">{t(locale, "exam_code_hint")}</p>
                <div className="min-h-[18px] text-xs text-center">
                  {!searchTerm.trim() ? (
                    <span className="text-gray-500">&nbsp;</span>
                  ) : isCheckingCode ? (
                    <span className="text-blue-700">{t(locale, "checking_code")}</span>
                  ) : (verificationAttempted && !isValidCodeFormat) ? (
                    <span className="text-yellow-700">{t(locale, "code_must_be_4_digits")}</span>
                  ) : (verificationAttempted && !isVerified) ? (
                    <span className="text-red-700">{t(locale, "code_not_found")}</span>
                  ) : (
                    <span className="text-gray-500">&nbsp;</span>
                  )}
                </div>
              </div>
            ) : null
          ) : (
            <div className="space-y-3">
              <label htmlFor="results-name" className="block text-8xl font-semibold text-gray-700">{t(locale, "student_name")}</label>
              <div className="relative">
                <input
                  id="results-name"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 bg-gray-50 focus:bg-white"
                  placeholder={t(locale, "name_placeholder")}
                  autoComplete="name"
                />
                <div className={`absolute inset-y-0 ${dir === 'rtl' ? 'left-4' : 'right-4'} flex items-center pointer-events-none`}>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {(!isCodeMode || !isVerified) && (
            <button
              className="mt-6 w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 disabled:cursor-not-allowed shadow-lg"
              onClick={() => {
                if (isCodeMode) {
                  handleVerifyCode();
                } else {
                  if (nameCanSearch) resultsQuery.refetch();
                }
              }}
              disabled={isCodeMode ? (!isValidCodeFormat || isCheckingCode) : (!nameCanSearch || resultsQuery.isFetching)}
            >
              {resultsQuery.isFetching ? t(locale, 'searching') : (isCodeMode ? t(locale, 'find_results') : t(locale, 'search_results'))}
            </button>
          )}
          
        </div>

        
               
        <div
          ref={resultsRef}
          className={`mt-6 transition-all duration-500 ease-out transform ${showResults ? 'opacity-100 translate-y-0 max-h-[2000px]' : 'opacity-0 -translate-y-2 max-h-0'} overflow-hidden`}
        >
          {isCodeMode && isVerified && (
            <div className="mb-4 flex items-center justify-between">
              <div className="text-center w-full text-8xl font-bold text-gray-900">
                {displayStudentName}
              </div>
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-lg">
            {searchTerm.trim().length === 0 ? (
              <div className="text-center text-gray-600 py-4">{isCodeMode ? t(locale, 'enter_code_to_view_results') : t(locale, 'enter_name_to_view_results')}</div>
            ) : resultsQuery.isLoading ? (
              <div className="flex justify-center items-center py-8">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
            ) : resultsQuery.error ? (
              <div className="text-center text-red-600 py-6">
                <div className="text-4xl mb-2">⚠️</div>
                <h3 className="text-lg font-medium mb-1">{t(locale, 'error_loading_results')}</h3>
                <p>{resultsQuery.error.message}</p>
              </div>
            ) : (resultsQuery.data || []).length === 0 ? (
              <div className="text-center text-gray-600 py-4">{t(locale, 'no_results_found')}</div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {(resultsQuery.data || []).map((r: ExamResult) => (
                  <li key={r.id} className="py-4">
                    <div className="flex items-start justify-between">
                      <div style={{ paddingInlineEnd: '1rem' }}>
                        <div className="font-semibold text-gray-900">{r.exam_title}</div>
                        <div className="text-sm text-gray-500" suppressHydrationWarning>
                          {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—'}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {typeof r.score_percentage === 'number' ? (
                          <div className={`font-bold text-lg px-3 py-1 rounded-lg ${
                            r.score_percentage >= 80 ? 'bg-green-50 text-green-700' :
                            r.score_percentage >= 60 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {r.score_percentage}%
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                        {r.is_pass === true ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            {t(locale, 'pass')}
                          </span>
                        ) : r.is_pass === false ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                            {t(locale, 'fail')}
                          </span>
                        ) : (typeof r.score_percentage === 'number' && typeof r.pass_threshold === 'number') ? (
                          (r.score_percentage >= r.pass_threshold ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">{t(locale, 'pass')}</span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">{t(locale, 'fail')}</span>
                          ))
                        ) : null}
                        {isCodeMode && isVerified && isUuid(r.id) && r.submitted_at && (settings.results_show_view_attempt !== false) && (
                          <button
                            className="ml-2 inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                            onClick={() => { setReviewAttemptId(r.id); setIsReviewOpen(true); }}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            {t(locale, 'view_attempt')}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* Extras and Overall Pass/Fail Summary (Code search only) */}
          {isCodeMode && canSearch && (
            <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">{t(locale, 'additional_scoring')}</h3>
                {summaryQuery.isFetching && (
                  <span className="text-sm text-gray-500">Loading…</span>
                )}
              </div>
              {summaryQuery.error ? (
                <div className="text-red-600 text-sm">{summaryQuery.error.message}</div>
              ) : (
                <>
                  {((summaryQuery.data?.extras?.length || 0) > 0) ? (
                    <ul className="divide-y divide-gray-200">
                      {(summaryQuery.data!.extras).map((item) => (
                        <li key={item.key} className="py-2 flex items-center justify-between">
                          <span className="text-gray-700">{item.label}</span>
                          <span className="font-medium text-gray-900">{formatExtraValue(item as any)}</span>
                        </li>)
                      )}
                    </ul>
                  ) : (
                    <div className="text-gray-500 text-sm">No additional scoring available.</div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        {/* Separate overall Pass/Fail summary at bottom */}
        {isCodeMode && canSearch && summaryQuery.data && !summaryQuery.data.pass_summary?.hidden && (
          <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6 shadow-lg">
            <div className={`p-4 rounded-lg flex items-center justify-between ${summaryQuery.data.pass_summary?.passed ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
              <div className="flex items-center gap-2">
                {summaryQuery.data.pass_summary?.passed ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                )}
                <span className="font-semibold">
                  {(() => {
                    const m = summaryQuery.data.pass_summary?.message;
                    if (m != null && String(m).trim() !== '') return m as string;
                    return summaryQuery.data.pass_summary?.passed ? t(locale, 'pass') : t(locale, 'fail');
                  })()}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {typeof summaryQuery.data.pass_summary?.exam_total === 'number' && summaryQuery.data.pass_summary.exam_total > 0 && (
                  <span className="text-sm font-medium">
                    {summaryQuery.data.pass_summary.exam_passed}/{summaryQuery.data.pass_summary.exam_total}
                  </span>
                )}
                {typeof summaryQuery.data.pass_summary?.overall_score === 'number' && (
                  <span className="font-bold">{summaryQuery.data.pass_summary.overall_score}%</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Attempt Review Modal */}
        {isReviewOpen && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={() => { setIsReviewOpen(false); setReviewAttemptId(null); }}></div>
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="w-full max-w-3xl bg-white rounded-xl shadow-xl border border-gray-200 max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">{t(locale, 'attempt_review')}</h3>
                  <button className="text-gray-500 hover:text-gray-700" onClick={() => { setIsReviewOpen(false); setReviewAttemptId(null); }}>✕</button>
                </div>
                <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 56px)' }}>
                  {reviewQuery.isLoading ? (
                    <div className="flex justify-center items-center py-8">
                      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                      <span className="ml-3 text-gray-600">{t(locale, 'loading_generic')}</span>
                    </div>
                  ) : reviewQuery.error ? (
                    <div className="text-center text-red-600 py-6">
                      <div className="text-4xl mb-2">⚠️</div>
                      <p>{reviewQuery.error.message}</p>
                    </div>
                  ) : reviewQuery.data ? (
                    <div>
                      <div className="mb-4">
                        <div className="text-sm text-gray-500" suppressHydrationWarning>{new Date(reviewQuery.data.attempt.submitted_at || Date.now()).toLocaleString()}</div>
                        <div className="text-xl font-semibold text-gray-900">{reviewQuery.data.attempt.exam_title}</div>
                      </div>
                      <ul className="divide-y divide-gray-200">
                        {reviewQuery.data.items.map((it: any) => (
                          <li key={it.question_id} className="py-4">
                            <div className="mb-2 text-sm text-gray-500">{t(locale, 'question_n').replace('{n}', String(it.index))}</div>
                            <div className="font-medium text-gray-900 mb-2">{it.question_text}</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className={`p-3 rounded-lg border ${it.is_correct === true ? 'bg-green-50 border-green-200' : it.is_correct === false ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                                <div className="text-xs font-semibold text-gray-600 mb-1">{t(locale, 'your_answer')}</div>
                                <div className="text-gray-900 whitespace-pre-wrap break-words">{formatAnswer(it.student_answer)}</div>
                              </div>
                              <div className="p-3 rounded-lg border bg-gray-50 border-gray-200">
                                <div className="text-xs font-semibold text-gray-600 mb-1">{t(locale, 'correct_answer')}</div>
                                <div className="text-gray-900 whitespace-pre-wrap break-words">{formatAnswer(it.correct_answer)}</div>
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-gray-600 flex gap-4">
                              {typeof it.points === 'number' && (
                                <span>{t(locale, 'points')} {it.points}</span>
                              )}
                              {typeof it.awarded_points === 'number' && (
                                <span>{t(locale, 'manual_points')}: {it.awarded_points}</span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}