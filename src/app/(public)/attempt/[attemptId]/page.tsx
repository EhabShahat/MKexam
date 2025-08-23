"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ExamQuestion, { type AnswerValue } from "@/components/ExamQuestion";
import type { AttemptState, Question } from "@/lib/types";
import ProgressBar from "@/components/ProgressBar";
import Timer from "@/components/Timer";
import { shuffle } from "@/lib/randomization";
import { useStudentLocale } from "@/components/public/PublicLocaleProvider";
import { t } from "@/i18n/student";

// Add CSS to prevent text selection
const noCopyStyle = `
  .no-copy {
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
  }
`;

export default function AttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<AttemptState | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [version, setVersion] = useState<number>(1);
  const saveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const answersRef = useRef<Record<string, AnswerValue>>({});
  const versionRef = useRef<number>(1);

  // Keep refs in sync to avoid stale closures during saves
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { versionRef.current = version; }, [version]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { locale } = useStudentLocale();

  // Unwrap params Promise
  useEffect(() => {
    async function unwrapParams() {
      const resolvedParams = await params;
      setAttemptId(resolvedParams.attemptId);
    }
    unwrapParams();
  }, [params]);

  const total = state?.questions.length ?? 0;
  const answered = useMemo(() => countAnswered(answers, state?.questions || []), [answers, state?.questions]);
  const autoSaveIntervalSec = useMemo(() => {
    const s = state?.exam?.settings as any;
    return Number(s?.auto_save_interval ?? 10);
  }, [state?.exam?.settings]);
  const storageKey = useMemo(() => `attempt:${attemptId}:draft`, [attemptId]);
  const displayMode = useMemo(() => {
    const s = state?.exam?.settings as any;
    return String(s?.display_mode ?? "full");
  }, [state?.exam?.settings]);
  const randomize = useMemo(() => {
    const s = state?.exam?.settings as any;
    return Boolean(s?.randomize_questions);
  }, [state?.exam?.settings]);
  const questions = useMemo(() => {
    if (!state) return [] as Question[];
    let qs = state.questions.slice();
    if (randomize && attemptId) qs = shuffle(qs, attemptId);
    // Shuffle options per question deterministically
    qs = qs.map((q) => {
      const opts = (q.options as string[] | null) ?? null;
      if (!opts || opts.length === 0) return q;
      const shuffled = attemptId ? shuffle(opts, `${attemptId}:${q.id}`) : opts;
      return { ...q, options: shuffled } as Question;
    });
    return qs;
  }, [state, randomize, attemptId]);

  useEffect(() => {
    if (!attemptId) return;
    
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/attempts/${attemptId}/state`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load state");
        if (cancelled) return;
        setState(data as AttemptState);
        setAnswers((data?.answers as any) || {});
        setVersion((data?.version as number) || 1);
        // Try recovery from localStorage
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const draft = JSON.parse(raw) as { answers?: Record<string, AnswerValue>; ts?: number };
            if (draft?.answers && Object.keys(draft.answers).length > 0) {
              setAnswers((prev) => ({ ...draft.answers, ...prev }));
            }
          }
        } catch {}
      } catch (e: any) {
        setError(e?.message || "Unexpected error");
      } finally {
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [attemptId, storageKey]);

  useEffect(() => {
    if (!state) return;
    if (saveTimer.current) clearInterval(saveTimer.current);
    saveTimer.current = setInterval(() => {
      void saveNow();
    }, Math.max(5, autoSaveIntervalSec) * 1000);
    return () => {
      if (saveTimer.current) clearInterval(saveTimer.current);
    };
    // Only depend on state and interval seconds to avoid thrashing on every keystroke
  }, [state, autoSaveIntervalSec]);

  function scheduleSave(delay = 800) {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => { void saveNow(); }, delay);
  }

  async function saveNow() {
    if (!state) return;
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }
    setSaveStatus("saving");
    inFlightRef.current = true;
    try {
      let retry = 0;
      // Attempt up to 2 times if version conflict occurs
      while (retry < 2) {
        const payloadAnswers = answersRef.current;
        const expectedVersion = versionRef.current;
        const res = await fetch(`/api/attempts/${attemptId}/save`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers: payloadAnswers,
            auto_save_data: { progress: { answered, total } },
            expected_version: expectedVersion,
          }),
        });
        if (res.status === 409) {
          const payload = await res.json();
          const latest = payload?.latest as AttemptState | undefined;
          if (latest?.version) {
            // Update version only; keep local answers to avoid clearing in UI
            setVersion(latest.version);
            versionRef.current = latest.version;
          }
          retry++;
          continue;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Save failed");
        if (data?.new_version) {
          setVersion(data.new_version);
          versionRef.current = data.new_version;
        }
        setSaveStatus("saved");
        setLastSavedAt(Date.now());
        break;
      }
    } catch {
      // ignore transient errors; next tick/interval will retry
      setSaveStatus("error");
    } finally {
      inFlightRef.current = false;
      if (queuedRef.current) {
        queuedRef.current = false;
        void saveNow();
      }
    }
  }

  async function onSubmit() {
    if (!state) return;
    try {
      setSubmitting(true);
      await saveNow();
      const res = await fetch(`/api/attempts/${attemptId}/submit`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Submit failed");
      setState((prev) => prev ? { ...prev, completion_status: "submitted", submitted_at: new Date().toISOString() } : prev);
      // Redirect to thank you page
      window.location.href = `/thank-you/${attemptId}`;
    } catch (e: any) {
      setError(e?.message || "Submit error");
    } finally {
      setSubmitting(false);
    }
  }

  function onAnswerChange(q: Question, val: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [q.id]: val }));
    scheduleSave(800);
  }

  // Persist to localStorage for recovery/offline support
  useEffect(() => {
    try {
      const payload = { answers, ts: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {}
  }, [answers, storageKey]);

  // Online/offline handling
  useEffect(() => {
    const set = () => setIsOnline(navigator.onLine);
    set();
    const onOnline = () => { set(); void saveNow(); };
    const onOffline = () => set();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, version, answered, total]);

  // Keyboard navigation for per-question mode
  useEffect(() => {
    if (displayMode !== "per_question") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentIdx((i) => Math.min(questions.length - 1, i + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [displayMode, questions.length]);

  if (!attemptId || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-[var(--muted-foreground)]">{t(locale, 'loading_exam')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="max-w-md mx-auto text-center p-8">
          <div className="w-16 h-16 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-4">
            {t(locale, 'unable_load_exam')}
          </h1>
          <p className="text-[var(--muted-foreground)] mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="btn btn-primary"
          >
            {t(locale, 'try_again')}
          </button>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <p className="text-[var(--muted-foreground)]">{t(locale, 'no_attempt_found')}</p>
        </div>
      </div>
    );
  }

  const disabled = state.completion_status === "submitted";
  const progressPercentage = total ? Math.round((answered / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Add style tag for no-copy functionality */}
      <style dangerouslySetInnerHTML={{ __html: noCopyStyle }} />
      {/* Header */}
      <header className="bg-[var(--card)] border-b border-[var(--border)] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-semibold text-[var(--foreground)]">{state.exam.title}</h1>
                <div className="flex items-center gap-4 text-sm text-[var(--muted-foreground)]">
                  <span>{t(locale, 'question_of_total', { current: currentIdx + 1, total })}</span>
                  <span>•</span>
                  <span>{t(locale, 'x_answered', { count: answered })}</span>
                  {!isOnline && (
                    <>
                      <span>•</span>
                      <span className="text-orange-600 flex items-center gap-1">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 12h18m-9-9v18"/>
                        </svg>
                        {t(locale, 'offline')}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Save Status */}
              <div className="flex items-center gap-2 text-sm">
                {saveStatus === "saving" && (
                  <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                    <div className="w-3 h-3 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                    {t(locale, 'auto_syncing')}
                  </div>
                )}
                {saveStatus === "saved" && lastSavedAt && (
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                    {t(locale, 'auto_saved')}
                  </div>
                )}
                {saveStatus === "error" && (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1 rounded-full">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="15" y1="9" x2="9" y2="15"/>
                      <line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                    {t(locale, 'sync_failed')}
                  </div>
                )}
                {saveStatus === "idle" && (
                  <div className="flex items-center gap-2 text-gray-500 bg-gray-50 px-3 py-1 rounded-full">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    {t(locale, 'auto_sync_enabled')}
                  </div>
                )}
              </div>

              {/* Timer */}
              <Timer 
                startedAt={state.started_at} 
                durationMinutes={state.exam.duration_minutes} 
                examEndsAt={state.exam.end_time} 
                onExpire={onSubmit} 
                disabled={disabled}
              />
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[var(--foreground)]">{t(locale, 'progress')}</span>
              <span className="text-sm text-[var(--muted-foreground)]">{progressPercentage}%</span>
            </div>
            <div className="w-full bg-[var(--muted)] rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-row min-h-[calc(100vh-200px)]">
        {/* Sidebar - Question Navigation */}
        <aside className={`bg-[var(--card)] border-r border-[var(--border)] transition-all duration-300 ${
          sidebarCollapsed 
            ? 'w-[10%] min-w-[40px] h-auto' 
            : 'w-[10%] min-w-[40px]'
        }`}>
          <div className="p-2">
            <div className="flex items-center justify-between mb-4">
              {!sidebarCollapsed && (
                <h2 className="font-semibold text-[var(--foreground)] block">{t(locale, 'questions')}</h2>
              )}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="btn-icon inline-flex"
                aria-label={sidebarCollapsed ? t(locale, 'expand_sidebar') : t(locale, 'collapse_sidebar')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d={sidebarCollapsed ? "M9 18l6-6-6-6" : "M15 18l-6-6 6-6"}/>
                </svg>
              </button>
            </div>

            {/* Mobile and Collapsed View */}
            {sidebarCollapsed ? (
              <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-200px)] pb-0">
                {questions.map((q, idx) => {
                  const isAnswered = isQuestionAnswered(q, answers[q.id]);
                  const isCurrent = idx === currentIdx;
                  
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIdx(idx)}
                      className={`flex-shrink-0 w-6 h-6 rounded-full border text-xs font-medium transition-all duration-200 flex items-center justify-center select-none ${
                        isCurrent 
                          ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm scale-110' 
                          : isAnswered
                          ? 'border-green-200 bg-green-600 text-white hover:brightness-110 hover:scale-105'
                          : 'border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--ring)] hover:scale-105'
                      }`}
                      title={`${t(locale, 'question_n', { n: idx + 1 })}${isAnswered ? ' ' + t(locale, 'answered_paren') : ''}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/* Expanded View */}
            {!sidebarCollapsed && (
              <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
                {questions.map((q, idx) => {
                  const isAnswered = isQuestionAnswered(q, answers[q.id]);
                  const isCurrent = idx === currentIdx;
                  
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIdx(idx)}
                      className={`w-full flex justify-center p-1 rounded-full border transition-all duration-200 ${
                        isCurrent 
                          ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm' 
                          : isAnswered
                          ? 'border-green-200 bg-green-600 text-white hover:brightness-95'
                          : 'border-[var(--border)] hover:border-[var(--ring)] hover:bg-[var(--muted)]/50'
                      }`}
                      title={`${t(locale, 'question_n', { n: idx + 1 })}${isAnswered ? ' ' + t(locale, 'answered_paren') : ''}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            )}

            {/* We've consolidated the collapsed view with the mobile view above */}
          </div>
        </aside>

        {/* Main Content */}
        <main className="w-[90%] p-4 sm:p-6 flex-1 overflow-y-auto no-copy" onCopy={(e) => e.preventDefault()} onCut={(e) => e.preventDefault()}>
          <div className="max-w-4xl mx-auto">
            {displayMode === "per_question" ? (
              <div className="space-y-6">
                {/* Current Question */}
                {questions[currentIdx] && (
                  <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-6 shadow-sm hover:shadow-md transition-all duration-300">
                    <ExamQuestion
                      key={questions[currentIdx].id}
                      q={questions[currentIdx]}
                      value={answers[questions[currentIdx].id] as AnswerValue}
                      onChange={(v) => onAnswerChange(questions[currentIdx], v)}
                      onSave={saveNow}
                      disabled={disabled}
                    />
                  </div>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between">
                  <button 
                    className="btn btn-outline transition-all duration-200 hover:translate-x-[-2px]"
                    onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))} 
                    disabled={currentIdx === 0}
                  >
                    <span className="mr-1">←</span> {t(locale, 'previous')}
                  </button>

                  <div className="flex items-center gap-2">
                    <button 
                      className="btn btn-outline btn-sm transition-all duration-200 hover:scale-105"
                      onClick={() => saveNow()}
                      disabled={disabled}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                        <polyline points="17,21 17,13 7,13 7,21"/>
                        <polyline points="7,3 7,8 15,8"/>
                      </svg>
                      {t(locale, 'save')}
                    </button>

                    {currentIdx === questions.length - 1 ? (
                      <button 
                        className="btn btn-primary transition-all duration-200 hover:scale-105"
                        onClick={() => setShowSubmitConfirm(true)}
                        disabled={disabled || submitting}
                      >
                        {submitting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            {t(locale, 'submitting')}
                          </>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20 6L9 17l-5-5"/>
                            </svg>
                            {t(locale, 'submit_exam')}
                          </>
                        )}
                      </button>
                    ) : (
                      <button 
                        className="btn btn-primary transition-all duration-200 hover:translate-x-[2px]"
                        onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))} 
                        disabled={currentIdx >= questions.length - 1}
                      >
                        {t(locale, 'next')} <span className="ml-1">→</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {questions.map((q, idx) => (
                  <div key={q.id} className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-6 shadow-sm hover:shadow-md transition-all duration-300">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                        {idx + 1}
                      </div>
                      <h3 className="font-medium text-[var(--foreground)]">{t(locale, 'question_n', { n: idx + 1 })}</h3>
                    </div>
                    <ExamQuestion
                      q={q}
                      value={answers[q.id] as AnswerValue}
                      onChange={(v) => onAnswerChange(q, v)}
                      onSave={saveNow}
                      disabled={disabled}
                    />
                  </div>
                ))}

                <div className="flex items-center justify-center gap-4 pt-6">
                  <button 
                    className="btn btn-outline"
                    onClick={() => saveNow()}
                    disabled={disabled}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                      <polyline points="17,21 17,13 7,13 7,21"/>
                      <polyline points="7,3 7,8 15,8"/>
                    </svg>
                    {t(locale, 'save_progress')}
                  </button>

                  <button 
                    className="btn btn-primary"
                    onClick={() => setShowSubmitConfirm(true)}
                    disabled={disabled || submitting}
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        {t(locale, 'submitting')}
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 6L9 17l-5-5"/>
                        </svg>
                        {t(locale, 'submit_exam')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {disabled && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                <div className="flex items-center justify-center gap-2 text-green-800">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                  <span className="font-medium">{t(locale, 'exam_submitted_successfully')}</span>
                </div>
                <p className="text-green-700 text-sm mt-1">
                  {t(locale, 'answers_recorded_close_hint')}
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 modal-backdrop">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg">{t(locale, 'submit_exam_q')}</h3>
                <p className="text-sm text-[var(--muted-foreground)]">{t(locale, 'cannot_be_undone')}</p>
              </div>
            </div>
            
            <div className="mb-6">
              <div className="bg-[var(--muted)] rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-[var(--muted-foreground)]">{t(locale, 'total_questions')}</span>
                    <span className="font-medium ml-2">{total}</span>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)]">{t(locale, 'answered_label')}</span>
                    <span className="font-medium ml-2">{answered}</span>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)]">{t(locale, 'unanswered_label')}</span>
                    <span className="font-medium ml-2">{total - answered}</span>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)]">{t(locale, 'progress_label')}</span>
                    <span className="font-medium ml-2">{progressPercentage}%</span>
                  </div>
                </div>
              </div>
              
              {total - answered > 0 && (
                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-orange-800 text-sm">
                    <strong>{t(locale, 'warning')}</strong> {t(locale, 'unanswered_warning', { count: total - answered })}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 justify-end">
              <button 
                className="btn btn-outline"
                onClick={() => setShowSubmitConfirm(false)}
                disabled={submitting}
              >
                {t(locale, 'cancel')}
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  setShowSubmitConfirm(false);
                  onSubmit();
                }}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {t(locale, 'submitting')}
                  </>
                ) : (
                  t(locale, 'confirm_submit_exam')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function countAnswered(answers: Record<string, AnswerValue>, questions: Question[]) {
  let count = 0;
  for (const q of questions) {
    if (isQuestionAnswered(q, answers[q.id])) {
      count++;
    }
  }
  return count;
}

function isQuestionAnswered(question: Question, value: AnswerValue): boolean {
  if (question.question_type === "paragraph") {
    return typeof value === "string" && value.trim().length > 0;
  } else if (question.question_type === "true_false") {
    return typeof value === "boolean";
  } else if (Array.isArray(value)) {
    return value.length > 0;
  } else if (typeof value === "string") {
    return value.length > 0;
  }
  return false;
}

function QuestionNav({ count, current, onJump }: { count: number; current: number; onJump: (i: number) => void }) {
  const items = Array.from({ length: count }, (_, i) => i);
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {items.map((i) => (
        <button
          key={i}
          className={
            "w-8 h-8 rounded-lg border text-sm font-medium transition-all duration-200 select-none " + 
            (i === current 
              ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm transform scale-110" 
              : "bg-[var(--card)] hover:bg-[var(--accent)] hover:border-[var(--ring)] hover:text-[var(--accent-foreground)] hover:scale-105")
          }
          onClick={() => onJump(i)}
          aria-current={i === current ? "page" : undefined}
          title={`Go to question ${i + 1}`}
        >
          {i + 1}
        </button>
      ))}
    </div>
  );
}
