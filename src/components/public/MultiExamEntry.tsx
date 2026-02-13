"use client";

import { useEffect, useMemo, useState, useCallback, memo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { useStudentLocale } from "@/components/public/PublicLocaleProvider";
import { t } from "@/i18n/student";
import type { CodeFormatSettings } from "@/lib/codeGenerator";
import { validateCodeFormat } from "@/lib/codeGenerator";
import { collectDeviceInfoWithTimeout } from "@/lib/collectDeviceInfoWithTimeout";
import { useStudentCode } from "@/hooks/useStudentCode";
import ClearCodeButton from "@/components/ClearCodeButton";
import CodeInputForm from "@/components/CodeInputForm";

interface ByCodeExamItem {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  access_type: "open" | "code_based" | "ip_restricted";
  is_active: boolean;
  not_started: boolean;
  ended: boolean;
  attempt_status: "in_progress" | "completed" | null;
  attempt_id: string | null;
}

interface MultiExamEntryProps {
  mode?: "full" | "exams-only";
  code?: string;
  onBack?: () => void;
  showExams?: boolean;
  showResults?: boolean;
  showRegister?: boolean;
  showIdCard?: boolean;
}

function MultiExamEntry({ mode = "full", code: propCode, onBack, showExams = true, showResults = true, showRegister = false, showIdCard = false }: MultiExamEntryProps = {}) {
  const { locale, dir } = useStudentLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { storedCode, isLoading: isLoadingCode, isValidating, validateAndRedirect, storeCode, clearCode: clearStoredCode } = useStudentCode();

  const [code, setCode] = useState(propCode || "");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exams, setExams] = useState<ByCodeExamItem[] | null>(null);
  const [startingExamId, setStartingExamId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [codeSettings, setCodeSettings] = useState<CodeFormatSettings | null>(null);
  const [isMultiExamMode, setIsMultiExamMode] = useState<boolean>(true);
  const [hasAutoSubmitted, setHasAutoSubmitted] = useState(false);

  // Track current ?code value from URL
  const codeParam = useMemo(() => (searchParams?.get("code") || "").trim(), [searchParams]);

  // Restore code from localStorage on mount and auto-submit
  useEffect(() => {
    console.log('[MultiExamEntry] Auto-submit effect triggered', {
      isLoadingCode,
      storedCode,
      code,
      propCode,
      codeParam,
      hasAutoSubmitted,
      codeSettings: !!codeSettings,
      mode
    });

    // Wait for hook to finish loading
    if (isLoadingCode) {
      console.log('[MultiExamEntry] Still loading code from storage, waiting...');
      return;
    }
    
    // Only auto-submit if we have all the required conditions
    if (storedCode && !code && !propCode && !codeParam && !hasAutoSubmitted && codeSettings && mode === "full") {
      console.log('[MultiExamEntry] All conditions met, auto-submitting stored code:', storedCode);
      setCode(storedCode);
      setHasAutoSubmitted(true);
      // Call verifyCode directly with storedCode - no need to include in deps
      void (async () => {
        const c = storedCode.trim();
        if (!codeSettings || !c) return;
        
        setChecking(true);
        setError(null);
        setExams(null);
        
        try {
          const res = await fetch(`/api/public/exams/by-code?code=${encodeURIComponent(c)}`);
          if (!res.ok) {
            const errData = await res.json();
            setError(errData.error || t(locale, "unable_load_exam"));
            setChecking(false);
            return;
          }
          
          const data = await res.json();
          if (data.exams && data.exams.length > 0) {
            setExams(data.exams);
            setStudentName(data.studentName || null);
            
            if (data.exams.length === 1 && !isMultiExamMode) {
              setStartingExamId(data.exams[0].id);
            }
          } else {
            setError(t(locale, "err_invalid_code"));
          }
        } catch (err) {
          console.error("Error verifying code:", err);
          setError(t(locale, "unable_load_exam"));
        } finally {
          setChecking(false);
        }
      })();
    } else {
      console.log('[MultiExamEntry] Conditions not met for auto-submit');
    }
  }, [isLoadingCode, storedCode, code, propCode, codeParam, hasAutoSubmitted, codeSettings, mode, isMultiExamMode, locale]);

  // Fetch code format settings on mount
  useEffect(() => {
    async function fetchCodeSettings() {
      try {
        const res = await fetch("/api/public/code-settings", { cache: "no-store" });
        if (res.ok) {
          const settings = await res.json();
          setCodeSettings(settings);
          setIsMultiExamMode(settings.enable_multi_exam ?? true);
        }
      } catch (error) {
        console.warn("Failed to fetch code settings, using defaults");
        setCodeSettings({
          code_length: 4,
          code_format: "numeric",
          code_pattern: null,
          enable_multi_exam: true,
        });
        setIsMultiExamMode(true);
      }
    }
    void fetchCodeSettings();
  }, []);

  // Memoized validation function to prevent unnecessary re-renders
  const isValidCode = useCallback((code: string): boolean => {
    if (!codeSettings || !code) return false;
    return validateCodeFormat(code, codeSettings);
  }, [codeSettings]);

  // Memoized error handling function
  const handleApiError = useCallback((errKey: string): string => {
    switch (errKey) {
      case "code_required":
        return t(locale, "err_code_required");
      case "invalid_code":
        return t(locale, "err_invalid_code");
      case "code_already_used":
        return t(locale, "err_code_already_used");
      case "exam_not_published":
        return t(locale, "err_exam_not_published");
      case "exam_not_started":
        return t(locale, "err_exam_not_started");
      case "exam_ended":
        return t(locale, "err_exam_ended");
      case "attempt_limit_reached":
        return t(locale, "err_attempt_limit_reached");
      case "ip_not_whitelisted":
        return t(locale, "err_ip_not_whitelisted");
      case "ip_blacklisted":
        return t(locale, "err_ip_blacklisted");
      default:
        return t(locale, "unable_load_exam");
    }
  }, [locale]);

  // Optimized verifyCode function with better error handling
  const verifyCode = useCallback(async (nextCode?: string) => {
    const c = (nextCode ?? code).trim();
    if (!isValidCode(c)) {
      setError(t(locale, "code_must_be_4_digits"));
      return;
    }
    
    setChecking(true);
    setError(null);
    setExams(null);
    
    try {
      const res = await fetch(`/api/public/exams/by-code?code=${encodeURIComponent(c)}`);
      if (!res.ok) {
        setError(t(locale, "code_not_found"));
        // Clear stored code if it's invalid
        clearStoredCode('code not found');
        return;
      }
      
      const data = await res.json();
      const items: ByCodeExamItem[] = data?.exams || [];
      setStudentName(data?.student_name || null);

      // Store the valid code
      console.log('[MultiExamEntry] Storing valid code:', c, 'student_id:', data?.student_id);
      await storeCode(c, data?.student_id);
      console.log('[MultiExamEntry] Code stored successfully');

      // In single exam mode, auto-start or continue without showing the list
      if (!isMultiExamMode) {
        // Prefer continuing an in-progress attempt
        const inProgress = items.find((ex) => ex.attempt_status === "in_progress");
        if (inProgress) {
          await startOrContinueExam(inProgress.id, c);
          return;
        }
        // Otherwise start the first available active exam
        const available = items.find(
          (ex) => ex.is_active && !ex.not_started && !ex.ended && ex.attempt_status !== "completed"
        );
        if (available) {
          await startOrContinueExam(available.id, c);
          return;
        }
      }

      setExams(items);
    } catch {
      setError(t(locale, "error_loading_results"));
    } finally {
      setChecking(false);
    }
  }, [code, isValidCode, locale, isMultiExamMode, t, storeCode, clearStoredCode]);

  // Optimized startOrContinueExam function
  const startOrContinueExam = useCallback(async (examId: string, overrideCode?: string, existingAttemptId?: string | null) => {
    const c = (overrideCode ?? code).trim();
    if (!isValidCode(c)) return;

    setStartingExamId(examId);
    setError(null);
    
    try {
      // If there's an existing attempt, redirect directly to it
      if (existingAttemptId) {
        console.log('[MultiExamEntry] Continuing existing attempt:', existingAttemptId);
        const attemptUrl = `/attempt/${existingAttemptId}`;
        try {
          router.push(attemptUrl);
        } catch {
          window.location.href = attemptUrl;
        }
        return;
      }

      // Otherwise, start a new attempt
      console.log('[MultiExamEntry] Starting new exam attempt:', {
        examId,
        hasCode: !!c,
        timestamp: new Date().toISOString()
      });
      
      // Log form submission attempt
      console.log('[MultiExamEntry] Form submission initiated:', {
        examId,
        accessType: 'code_based',
        timestamp: new Date().toISOString()
      });
      
      const deviceInfo = await collectDeviceInfoWithTimeout();
      
      if (!deviceInfo) {
        console.warn('[MultiExamEntry] Device info collection returned null, proceeding without device info:', {
          examId,
          willProceedWithoutDeviceInfo: true,
          timestamp: new Date().toISOString()
        });
      } else {
        console.log('[MultiExamEntry] Device info collected successfully, sending to server:', {
          examId,
          hasFriendlyName: !!deviceInfo.friendlyName,
          hasOEM: !!deviceInfo.oem,
          hasBrowserDetails: !!deviceInfo.browserDetails,
          hasPlatformDetails: !!deviceInfo.platformDetails,
          hasIPs: !!deviceInfo.ips,
          ipCount: deviceInfo.ips?.ips?.length || 0,
          hasFingerprint: !!deviceInfo.fingerprint,
          isPartialData: !!deviceInfo.partialData,
          partialReason: deviceInfo.partialReason,
          timestamp: new Date().toISOString()
        });
      }
      
      // Retry logic for API call (Requirement 9.1)
      const maxApiRetries = 2;
      let apiError: any = null;
      let apiData: any = null;
      let apiSuccess = false;
      
      for (let apiAttempt = 0; apiAttempt <= maxApiRetries && !apiSuccess; apiAttempt++) {
        try {
          if (apiAttempt > 0) {
            console.log('[MultiExamEntry] Retrying API call:', {
              attempt: apiAttempt,
              maxRetries: maxApiRetries,
              examId,
              timestamp: new Date().toISOString()
            });
            
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * apiAttempt));
          }
          
          const res = await fetch(`/api/public/exams/${examId}/access`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: c, studentName: null, deviceInfo }),
          });
          
          apiData = await res.json();
          
          if (!res.ok) {
            apiError = apiData?.error || "failed";
            
            // Don't retry on client errors (4xx) except 408 (timeout) and 429 (rate limit)
            if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
              console.error('[MultiExamEntry] Client error, not retrying:', {
                status: res.status,
                error: apiError,
                attempt: apiAttempt
              });
              break; // Don't retry client errors
            }
            
            if (apiAttempt < maxApiRetries) {
              console.warn('[MultiExamEntry] API call failed, will retry:', {
                status: res.status,
                error: apiError,
                attempt: apiAttempt,
                timestamp: new Date().toISOString()
              });
              continue;
            }
          } else {
            apiSuccess = true;
          }
        } catch (fetchError) {
          apiError = fetchError;
          
          if (apiAttempt < maxApiRetries) {
            console.warn('[MultiExamEntry] API call threw error, will retry:', {
              error: fetchError instanceof Error ? fetchError.message : String(fetchError),
              attempt: apiAttempt,
              timestamp: new Date().toISOString()
            });
            continue;
          }
        }
      }
      
      if (!apiSuccess) {
        console.error('[MultiExamEntry] Exam access request failed after retries:', {
          error: apiError,
          attempts: maxApiRetries + 1
        });
        
        const errKey = (typeof apiError === 'string' ? apiError : apiError?.error) || "failed";
        setError(handleApiError(errKey));
        return;
      }

      console.log('[MultiExamEntry] Exam access granted successfully:', {
        attemptId: apiData.attemptId,
        hasDeviceInfo: !!deviceInfo
      });

      // Store code on successful validation
      storeCode(c, apiData.studentId);

      const attemptId: string = apiData.attemptId;
      const studentNameFromResponse: string = apiData.studentName || "Student";
      const welcomeUrl = `/welcome/${attemptId}?name=${encodeURIComponent(studentNameFromResponse)}`;
      
      try {
        router.push(welcomeUrl);
      } catch {
        window.location.href = welcomeUrl;
      }
    } catch {
      setError(t(locale, "unable_load_exam"));
    } finally {
      setStartingExamId(null);
    }
  }, [code, isValidCode, locale, storeCode, router, handleApiError, t]);

  // Auto-validate provided code in exams-only mode
  useEffect(() => {
    if (mode === "exams-only" && propCode && codeSettings && isValidCode(propCode)) {
      setCode(propCode);
      void verifyCode(propCode);
    }
  }, [mode, propCode, codeSettings, isValidCode, verifyCode]);

  // Prefill/refetch based on ?code param; rerun on param changes (including return navigation)
  useEffect(() => {
    console.log('[MultiExamEntry] URL param effect triggered', {
      codeParam,
      codeSettings: !!codeSettings,
      isValid: codeSettings && codeParam ? isValidCode(codeParam) : false,
      exams: exams?.length
    });
    
    // Only verify if we don't already have exams loaded
    if (codeSettings && codeParam && isValidCode(codeParam) && exams === null) {
      console.log('[MultiExamEntry] Verifying code from URL parameter:', codeParam);
      setCode(codeParam);
      void verifyCode(codeParam);
    }
  }, [codeParam, codeSettings, isValidCode, verifyCode, exams]);

  // Memoized event handlers for better performance
  const refetchIfCode = useCallback(() => {
    // Refetch if we have a valid code (either from URL param or stored code)
    const currentCode = codeParam || code;
    if (codeSettings && currentCode && isValidCode(currentCode)) {
      void verifyCode(currentCode);
    }
  }, [codeSettings, isValidCode, codeParam, code, verifyCode]);

  const handleVisibilityChange = useCallback(() => {
    try {
      if (document.visibilityState === "visible") refetchIfCode();
    } catch { }
  }, [refetchIfCode]);

  // Also refetch when the page regains focus or becomes visible (handles browser back/BFCache cases and admin deletions)
  useEffect(() => {
    window.addEventListener("focus", refetchIfCode);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", refetchIfCode);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refetchIfCode, handleVisibilityChange]);

  // Memoized computed values
  const hasResults = useMemo(() => (exams?.length || 0) > 0, [exams]);

  // Memoized date formatter
  const formatDateInCairo = useCallback((iso: string | null) => {
    if (!iso) return "";
    try {
      const dt = new Date(iso);
      return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
        timeZone: "Africa/Cairo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(dt);
    } catch {
      try { return new Date(iso!).toLocaleString(locale); } catch { return iso!; }
    }
  }, [locale]);

  // Memoized change code handler
  const handleChangeCode = useCallback(() => {
    setExams(null);
    setError(null);
    setStudentName(null);
    setHasAutoSubmitted(false);
  }, []);

  // Memoized exam item renderer for better performance
  const renderExamItem = useCallback((ex: ByCodeExamItem) => {
    // Check if exam time has finished
    const timeFinished = ex.end_time ? new Date(ex.end_time) < new Date() : false;
    
    // Determine if exam is completed (has a completed attempt)
    const isCompleted = ex.attempt_status === "completed";
    
    // Determine button state and label
    let buttonLabel: string;
    let isDisabled: boolean;
    
    if (ex.not_started) {
      // Exam hasn't started yet
      buttonLabel = t(locale, "start_exam");
      isDisabled = true;
    } else if (ex.attempt_status === "completed") {
      // Exam was submitted - always show as attempted and disabled
      buttonLabel = t(locale, "attempted");
      isDisabled = true;
    } else if (ex.attempt_status === "in_progress") {
      // Exam is in progress
      if (timeFinished || ex.ended) {
        // Time ran out while in progress - disable button
        buttonLabel = t(locale, "exam_ended");
        isDisabled = true;
      } else {
        // Still have time - allow continue
        buttonLabel = t(locale, "continue_to_exam");
        isDisabled = false;
      }
    } else if (ex.ended || timeFinished) {
      // Exam time has ended and no attempt (or attempt was deleted)
      // Disable button since time is up
      buttonLabel = t(locale, "exam_ended");
      isDisabled = true;
    } else {
      // No attempt yet (attempt_status is null) and exam is still active
      // This is the case when:
      // 1. Student never attempted the exam
      // 2. Admin deleted the attempt while exam is still active
      // In both cases, allow the student to start/retake the exam
      buttonLabel = t(locale, "start_exam");
      isDisabled = false;
    }
    
    return (
      <div key={ex.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              <span className="inline-flex items-center gap-2">
                {isCompleted && (
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {ex.title}
              </span>
            </h3>
            {ex.description && (
              <p className="text-gray-600 text-sm mt-1">{ex.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              disabled={isDisabled || startingExamId === ex.id}
              onClick={() => startOrContinueExam(ex.id, undefined, ex.attempt_id)}
              className="btn btn-primary"
            >
              {startingExamId === ex.id ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {t(locale, "starting_exam")}
                </span>
              ) : (
                buttonLabel
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }, [locale, startingExamId, startOrContinueExam, t]);

  // Memoized exam list
  const examsList = useMemo(() => {
    if (!exams) return null;
    return exams.map(renderExamItem);
  }, [exams, renderExamItem]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4" dir={dir} lang={locale}>
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-lg backdrop-blur-sm">
          {/* Brand Logo */}
          <div className="mb-8">
            <BrandLogo useAppSettings={true} size="lg" />
          </div>

          {/* Loading state when verifying code from URL */}
          {exams === null && codeParam && checking && (
            <div className="text-center py-8">
              <div className="inline-flex items-center gap-3 px-6 py-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-blue-900 font-medium">{t(locale, "checking_code")}</span>
              </div>
            </div>
          )}

          {/* Code entry section - only show if Exams button is enabled AND no code in URL */}
          {exams === null && showExams && !codeParam && (
            <>
              <CodeInputForm
                code={code}
                onCodeChange={setCode}
                onSubmit={verifyCode}
                checking={checking}
                error={error}
                mode="full"
                showValidation={true}
              />

              {/* Additional action buttons below code entry */}
              {(showResults || showRegister) && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className={`grid grid-cols-1 ${
                    [showResults, showRegister].filter(Boolean).length === 2 
                      ? 'sm:grid-cols-2'
                      : 'sm:grid-cols-1'
                  } gap-4`}>
                    {showResults && (
                      <a href="/results" className="group">
                        <div className="h-full rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition-colors p-6 text-center shadow-sm">
                          <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          </div>
                          <div className="font-semibold text-indigo-900 text-lg">{t(locale, "results")}</div>
                          <p className="text-sm text-indigo-800/80 mt-1">{t(locale, "search_your_results")}</p>
                        </div>
                      </a>
                    )}

                    {showRegister && (
                      <a href="/register" className="group">
                        <div className="h-full rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors p-6 text-center shadow-sm">
                          <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                          </div>
                          <div className="font-semibold text-purple-900 text-lg">{t(locale, "register")}</div>
                          <p className="text-sm text-purple-800/80 mt-1">{t(locale, "apply_to_join")}</p>
                        </div>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* ID Card button in separate section - full width */}
              {showIdCard && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <a href="/id" className="group block">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors p-6 text-center shadow-sm">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                        </svg>
                      </div>
                      <div className="font-semibold text-emerald-900 text-lg">{t(locale, "public_id")}</div>
                      <p className="text-sm text-emerald-800/80 mt-1">{t(locale, "view_id_card")}</p>
                    </div>
                  </a>
                </div>
              )}
            </>
          )}

          {/* Show only Results, Register, and ID Card buttons when Exams is disabled */}
          {exams === null && !showExams && (showResults || showRegister || showIdCard) && (
            <div>
              {/* Display student code under brand logo if available */}
              {storedCode && (
                <div className="text-center mb-6 pb-6 border-b border-gray-200">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-gray-600">{t(locale, "current_code")}:</span>
                    <span className="text-lg font-bold text-gray-900 font-mono tracking-wider">{storedCode}</span>
                  </div>
                </div>
              )}

              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {t(locale, "select_exam")}
                </h2>
                <p className="text-gray-600 text-sm">
                  {t(locale, "choose_action_below")}
                </p>
              </div>

              <div className="space-y-4">
                {/* Results and Register buttons in grid */}
                {(showResults || showRegister) && (
                  <div className={`grid grid-cols-1 ${
                    [showResults, showRegister].filter(Boolean).length === 2 
                      ? 'sm:grid-cols-2' 
                      : 'sm:grid-cols-1'
                  } gap-4`}>
                    {showResults && (
                      <a href="/results" className="group">
                        <div className="h-full rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition-colors p-6 text-center shadow-sm">
                          <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          </div>
                          <div className="font-semibold text-indigo-900 text-lg">{t(locale, "results")}</div>
                          <p className="text-sm text-indigo-800/80 mt-1">{t(locale, "search_your_results")}</p>
                        </div>
                      </a>
                    )}

                    {showRegister && (
                      <a href="/register" className="group">
                        <div className="h-full rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors p-6 text-center shadow-sm">
                          <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                          </div>
                          <div className="font-semibold text-purple-900 text-lg">{t(locale, "register")}</div>
                          <p className="text-sm text-purple-800/80 mt-1">{t(locale, "apply_to_join")}</p>
                        </div>
                      </a>
                    )}
                  </div>
                )}

                {/* ID Card button - full width in new row */}
                {showIdCard && (
                  <a href="/id" className="group block">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors p-6 text-center shadow-sm">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                        </svg>
                      </div>
                      <div className="font-semibold text-emerald-900 text-lg">{t(locale, "public_id")}</div>
                      <p className="text-sm text-emerald-800/80 mt-1">{t(locale, "view_id_card")}</p>
                    </div>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Exams list */}
          {exams !== null && (
            <div>
              {/* Display student code under brand logo */}
              <div className="text-center mb-6 pb-6 border-b border-gray-200">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-600">{t(locale, "current_code")}:</span>
                  <span className="text-lg font-bold text-gray-900 font-mono tracking-wider">{code}</span>
                </div>
              </div>

              {!hasResults && (
                <p className="text-center text-gray-600 text-sm mb-6">{t(locale, "no_exams_for_code")}</p>
              )}

              <div className="grid grid-cols-1 gap-4">
                {examsList}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// Export with memo for performance optimization
export default memo(MultiExamEntry);
