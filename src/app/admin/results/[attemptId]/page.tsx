"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/authFetch";
import { useParams } from "next/navigation";
import StatusBadge from "@/components/admin/StatusBadge";

export default function AdminAttemptDetails() {
    const { attemptId } = useParams<{ attemptId: string }>();

    const stateQ = useQuery({
        queryKey: ["admin", "attempt", attemptId, "state"],
        enabled: !!attemptId,
        queryFn: async () => {
            const res = await authFetch(`/api/admin/attempts/${attemptId}/state`);
            const j = await res.json();
            if (!res.ok) throw new Error(j?.error || "Load attempt state failed");
            return j;
        },
    });

    // Manual grading UI state
    const [savingManual, setSavingManual] = useState(false);
    const [regrading, setRegrading] = useState(false);
    const [manualEdits, setManualEdits] = useState<Record<string, { awarded_points: string; notes: string }>>({});
    const hasManualSections = !!(stateQ.data && Array.isArray((stateQ.data as any).questions));
    const ungradedQuestions = ((): any[] => {
        const qs = Array.isArray((stateQ.data as any)?.questions) ? (stateQ.data as any).questions : [];
        // Only include paragraph/photo_upload questions that don't have auto_grade_on_answer enabled
        return qs.filter((q: any) =>
            (q?.question_type === 'paragraph' || q?.question_type === 'photo_upload') &&
            !q?.auto_grade_on_answer
        );
    })();
    const manualMap: Record<string, { awarded_points?: number; notes?: string; graded_at?: string }> = (stateQ.data as any)?.manual_grades_map || {};

    function setEdit(qid: string, patch: Partial<{ awarded_points: string; notes: string }>) {
        setManualEdits((prev: Record<string, { awarded_points: string; notes: string }>) => ({
            ...prev,
            [qid]: { awarded_points: prev[qid]?.awarded_points ?? '', notes: prev[qid]?.notes ?? '', ...patch }
        }));
    }

    async function saveManualGrades() {
        if (!attemptId) return;
        const entries = Object.entries(manualEdits) as Array<[string, { awarded_points: string; notes: string }]>;
        const payload = entries
            .map(([question_id, v]) => ({
                question_id,
                awarded_points: Number(v.awarded_points),
                notes: v.notes?.trim() ? v.notes : null,
            }))
            .filter((r) => Number.isFinite(r.awarded_points));
        if (payload.length === 0) return;
        setSavingManual(true);
        try {
            const res = await fetch(`/api/admin/attempts/${attemptId}/manual-grades`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ grades: payload }),
            });
            const j = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(j?.error || 'Save failed');
            setManualEdits({});
            stateQ.refetch();
            metaQ.refetch();
        } catch (e) {
            console.error(e);
            alert((e as any)?.message || 'Save failed');
        } finally {
            setSavingManual(false);
        }
    }

    async function regradeThisAttempt() {
        if (!attemptId) return;
        setRegrading(true);
        try {
            const res = await fetch(`/api/admin/attempts/${attemptId}/regrade`, { method: 'POST' });
            const j = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(j?.error || 'Regrade failed');
            stateQ.refetch();
            metaQ.refetch();
        } catch (e) {
            console.error(e);
            alert((e as any)?.message || 'Regrade failed');
        } finally {
            setRegrading(false);
        }
    }

    const metaQ = useQuery({
        queryKey: ["admin", "attempt", attemptId, "meta"],
        enabled: !!attemptId,
        queryFn: async () => {
            const res = await authFetch(`/api/admin/attempts/${attemptId}`);
            const j = await res.json();
            if (!res.ok) throw new Error(j?.error || "Load attempt meta failed");
            return j.item as any;
        },
    });

    const actQ = useQuery({
        queryKey: ["admin", "attempt", attemptId, "activity"],
        enabled: !!attemptId,
        queryFn: async () => {
            const res = await authFetch(`/api/admin/attempts/${attemptId}/activity?limit=500`);
            const j = await res.json();
            if (!res.ok) throw new Error(j?.error || "Load activity failed");
            return Array.isArray(j?.items) ? j.items : [];
        },
    });

    const di: any = metaQ.data?.device_info || {};
    const fingerprint = di?.fingerprint || null;

    const logsQ = useQuery({
        queryKey: ["admin", "device-logs", fingerprint],
        enabled: !!fingerprint,
        queryFn: async () => {
            const res = await authFetch(`/api/admin/device-fingerprint/${fingerprint}`);
            const j = await res.json();
            if (!res.ok) throw new Error(j?.error || "Load device logs failed");
            return Array.isArray(j?.items) ? j.items : [];
        },
    });

    if (!attemptId) {
        return (
            <div className="space-y-4">
                <div className="p-3">Loading…</div>
            </div>
        );
    }

    // Helpers for formatting device info
    const fmtBool = (v: any) => (v === true ? "Yes" : v === false ? "No" : "-");
    const fmtPct = (v: any) => (typeof v === "number" ? `${v}%` : "-");
    const fmtNum = (v: any, d = 0) => (typeof v === "number" ? v.toFixed(d) : "-");
    const fmtBytes = (b: any) => {
        const n = typeof b === "number" ? b : NaN;
        if (!isFinite(n) || n < 0) return "-";
        const gb = n / (1024 * 1024 * 1024);
        if (gb >= 1) return `${gb.toFixed(2)} GB`;
        const mb = n / (1024 * 1024);
        if (mb >= 1) return `${mb.toFixed(1)} MB`;
        const kb = n / 1024;
        if (kb >= 1) return `${kb.toFixed(0)} KB`;
        return `${n} B`;
    };
    const joinBrands = (brands: any) =>
        Array.isArray(brands)
            ? brands
                .map((b: any) => `${b.brand || b.brandName || "Brand"} ${b.version || b.versionName || ""}`.trim())
                .join(", ")
            : "-";
    const pick = (v: any) => (v === null || v === undefined || v === "" ? "-" : String(v));

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold">Attempt Details</h1>
                <span className="text-xs font-mono border rounded px-2 py-1">{attemptId}</span>
                <div className="ml-auto">
                    <Link href="/admin/results" className="border px-3 py-2 rounded">Back to Results</Link>
                </div>
            </div>

            {(stateQ.isLoading || metaQ.isLoading) && <div className="p-3">Loading…</div>}
            {(stateQ.error || metaQ.error) && (
                <div className="p-3 text-red-600">{String(((stateQ.error || metaQ.error) as any)?.message)}</div>
            )}

            {metaQ.data && (
                <div className="bg-white border rounded p-3">
                    <h2 className="font-semibold mb-2">Summary</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                        <div><span className="text-gray-600">Student:</span> {metaQ.data.student_name ?? "-"}</div>
                        <div className="flex items-center gap-2">
                            <span className="text-gray-600">Status:</span>
                            {(() => {
                                const status = (metaQ.data.completion_status ?? "in_progress") as "in_progress" | "submitted" | "abandoned" | "invalid";
                                return <StatusBadge status={status} size="sm" />;
                            })()}
                        </div>
                        <div><span className="text-gray-600">Started:</span> {metaQ.data.started_at ?? "-"}</div>
                        <div><span className="text-gray-600">Submitted:</span> {metaQ.data.submitted_at ?? "-"}</div>
                        <div><span className="text-gray-600">Latest IP:</span> {metaQ.data.ip_address ?? "-"}</div>
                        {stateQ.data && (() => {
                            const questions = Array.isArray(stateQ.data?.questions) ? stateQ.data.questions : [];
                            const answers = stateQ.data?.answers ?? {};
                            let correctCount = 0;
                            let totalGradable = 0;

                            questions.forEach((q: any) => {
                                const ans = answers[q.id];
                                const correct = isCorrect(q, ans);
                                if (correct !== null) {
                                    totalGradable++;
                                    if (correct) correctCount++;
                                }
                            });

                            return totalGradable > 0 ? (
                                <div><span className="text-gray-600">Score:</span> <span className="font-semibold">{correctCount} of {totalGradable} correct</span></div>
                            ) : null;
                        })()}
                    </div>
                    {Array.isArray(metaQ.data.ips) && metaQ.data.ips.length > 0 && (
                        <div className="mt-3">
                            <div className="text-sm text-gray-600">IP history</div>
                            <ul className="text-xs mt-1 list-disc pl-5">
                                {metaQ.data.ips.map((ip: any, i: number) => (
                                    <li key={i}>{ip.created_at}: {ip.ip_address}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {stateQ.data && (
                        <details className="mt-4">
                            <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                                Per-question responses
                            </summary>
                            <div className="mt-3">
                                <PerQuestionTable state={stateQ.data} />
                            </div>
                        </details>
                    )}
                    {hasManualSections && ungradedQuestions.length > 0 && (
                        <details className="mt-4">
                            <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                                Manual grading (paragraph / photo)
                            </summary>
                            <div className="mt-3 space-y-3">
                                {ungradedQuestions.map((q: any) => {
                                    const maxPts = Number.isFinite(Number(q.points)) ? Number(q.points) : 1;
                                    const current = manualMap[q.id] || {};
                                    const edit = manualEdits[q.id] || { awarded_points: String(current.awarded_points ?? ''), notes: current.notes ?? '' };
                                    const ans = (stateQ.data as any)?.answers?.[q.id];
                                    return (
                                        <div key={q.id} className="border rounded p-2">
                                            <div className="text-sm font-medium">{stripHtml(String(q.question_text || ''))}</div>
                                            <div className="text-xs text-gray-500 mt-1">Question ID: {q.id} · Max points: {maxPts}</div>
                                            <div className="mt-2">
                                                <div className="text-xs text-gray-600 mb-1">Student Answer:</div>
                                                {(() => {
                                                    if (q.question_type === 'photo_upload') {
                                                        const url = typeof ans === 'string' ? ans : '';
                                                        return url ? (
                                                            <div className="flex items-start gap-3">
                                                                <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block">
                                                                    <img src={url} alt="Student uploaded image" className="max-h-40 rounded border" />
                                                                </a>
                                                                <div className="text-xs break-all">
                                                                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Open full image</a>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-xs text-gray-500">No image uploaded.</div>
                                                        );
                                                    }
                                                    if (q.question_type === 'paragraph') {
                                                        const text = typeof ans === 'string' ? ans : '';
                                                        return text ? (
                                                            <div className="p-2 bg-gray-50 border rounded text-sm whitespace-pre-wrap">{text}</div>
                                                        ) : (
                                                            <div className="text-xs text-gray-500">No answer submitted.</div>
                                                        );
                                                    }
                                                    // Fallback display for other types
                                                    return (
                                                        <div className="text-xs text-gray-500">{hasAnswer(q, ans) ? fmtAnswer(q, ans) : 'No answer submitted.'}</div>
                                                    );
                                                })()}
                                            </div>
                                            <div className="mt-2 flex flex-col md:flex-row gap-2">
                                                <div className="flex items-center gap-2">
                                                    <label className="text-sm">Awarded</label>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={maxPts}
                                                        step={0.5}
                                                        value={edit.awarded_points}
                                                        onChange={(e) => setEdit(q.id, { awarded_points: e.target.value })}
                                                        className="px-2 py-1 border rounded w-28"
                                                    />
                                                    <span className="text-sm text-gray-600">/ {maxPts}</span>
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="Notes (optional)"
                                                    value={edit.notes}
                                                    onChange={(e) => setEdit(q.id, { notes: e.target.value })}
                                                    className="flex-1 px-2 py-1 border rounded"
                                                />
                                            </div>
                                            {current.graded_at && (
                                                <div className="text-xs text-gray-500 mt-1">Last graded: {new Date(current.graded_at).toLocaleString()}</div>
                                            )}
                                        </div>
                                    );
                                })}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={saveManualGrades}
                                        disabled={savingManual}
                                        className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
                                    >
                                        {savingManual ? 'Saving…' : 'Save Manual Grades'}
                                    </button>
                                    <button
                                        onClick={regradeThisAttempt}
                                        disabled={regrading}
                                        className="px-3 py-2 rounded border"
                                    >
                                        {regrading ? 'Regrading…' : 'Regrade This Attempt'}
                                    </button>
                                </div>
                            </div>
                        </details>
                    )}
                </div>
            )}

            {metaQ.data && (() => {
                const di: any = metaQ.data.device_info || {};
                const parsed = di?.parsed || {};
                const browser = parsed.browser || {};
                const os = parsed.os || {};
                const device = parsed.device || {};
                
                // Enhanced device tracking fields
                const browserDetails = di?.browserDetails || {};
                const platformDetails = di?.platformDetails || {};
                const clientHints = di?.clientHints || {};
                
                const s = di?.screen || {};
                const vp = di?.viewport || {};
                const net = di?.network || {};
                const bat = di?.battery || {};
                const gpu = di?.gpu || {};
                const oem = di?.oem || {};
                const sec = di?.security || {};
                const friendlyName = di?.friendlyName || "Unknown Device";
                
                // IP addresses - enhanced structure
                const allIPs = di?.allIPs || {};
                const localIPs = Array.isArray(allIPs?.local) ? allIPs.local : [];
                const publicIPs = Array.isArray(allIPs?.public) ? allIPs.public : [];
                const serverIP = di?.serverDetectedIP || allIPs?.server || metaQ.data.ip_address;

                const tzStr = (() => {
                    const tz = di?.timezone;
                    const off = typeof di?.timezoneOffset === "number" ? di.timezoneOffset : null; // minutes
                    if (off === null) return pick(tz);
                    const hours = -off / 60; // JS offset is minutes behind UTC
                    const sign = hours >= 0 ? "+" : "";
                    const h = Math.trunc(hours);
                    const m = Math.round(Math.abs(hours - h) * 60);
                    const hh = `${sign}${String(Math.abs(h)).padStart(2, "0")}`;
                    const mm = `:${String(m).padStart(2, "0")}`;
                    return `${pick(tz)} (UTC${hh}${mm})`;
                })();

                const hasDeviceInfo = Object.keys(di).length > 0;
                const fingerprint = di.fingerprint || "-";
                const location = di.location || {};

                return (
                    <div className="space-y-4">
                        <details className="bg-white border rounded shadow-sm overflow-hidden" open>
                            <summary className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between border-b-0 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                    </div>
                                    <div>
                                        <h2 className="font-semibold text-gray-900 leading-none">{friendlyName}</h2>
                                        <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider font-medium">FP: {fingerprint}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {sec.automationRisk && (
                                        <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L1 21h22L12 2zm0 14h-2v-2h2v2zm0-4h-2V8h2v4z" /></svg>
                                            Automation Risk
                                        </span>
                                    )}
                                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                                        {hasDeviceInfo ? 'Telemetry Active' : 'No Data'}
                                    </span>
                                </div>
                            </summary>
                            <div className="p-4 bg-white border-t border-gray-100">
                                {hasDeviceInfo ? (
                                    <div className="space-y-6">
                                        {/* Security Signals Dashboard */}
                                        <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-bold text-orange-600 uppercase">Automation</p>
                                                <p className="text-xs font-semibold flex items-center gap-1">
                                                    {sec.webdriver ? <span className="text-red-600">Detected</span> : <span className="text-green-600">None</span>}
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-bold text-orange-600 uppercase">Ext. Display</p>
                                                <p className="text-xs font-semibold">
                                                    {sec.isExtended === true ? <span className="text-orange-600">Yes (Multi-Monitor)</span> : "No"}
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-bold text-orange-600 uppercase">Input Method</p>
                                                <p className="text-xs font-semibold">
                                                    {di.touch ? "Touchscreen" : "Precision Mouse"}
                                                    <span className="text-[10px] text-gray-400 ml-1">({sec.maxTouchPoints || 0} pts)</span>
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-bold text-orange-600 uppercase">Privacy</p>
                                                <p className="text-xs font-semibold text-gray-600">
                                                    {sec.doNotTrack ? "DNT Active" : "Standard"}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Grid of Key Info */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            {/* Browser & OS */}
                                            <div className="space-y-2">
                                                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Platform</h3>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold text-gray-800">{friendlyName}</span>
                                                    <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                                        {browserDetails?.version || browser?.version || "?"}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-600 space-y-0.5">
                                                    <div className="flex items-center gap-1">
                                                        <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                        Browser: {browserDetails?.name || browser?.name || "Unknown"}
                                                        {browserDetails?.engine && <span className="text-gray-400 ml-1">({browserDetails.engine})</span>}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                        OS: {platformDetails?.os || os?.name || "Unknown"}
                                                        {platformDetails?.osVersion && <span className="text-gray-400 ml-1">v{platformDetails.osVersion}</span>}
                                                    </div>
                                                    {(platformDetails?.architecture || clientHints?.architecture) && (
                                                        <div className="text-[10px] text-gray-500">
                                                            Arch: {platformDetails?.architecture || clientHints?.architecture}
                                                            {(platformDetails?.bitness || clientHints?.bitness) && `-${platformDetails?.bitness || clientHints?.bitness}bit`}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Device Hardware */}
                                            <div className="space-y-2">
                                                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hardware</h3>
                                                <div className="text-sm font-semibold text-gray-800">
                                                    {di.hardwareConcurrency || "?"} CPU Cores · {di.deviceMemory ? `${di.deviceMemory}GB RAM` : "? GB"}
                                                </div>
                                                {(oem?.brand || oem?.model) && (
                                                    <div className="text-xs text-gray-600">
                                                        Device: {oem?.brand || ""} {oem?.model || ""}
                                                        {oem?.source && <span className="text-[9px] text-gray-400 ml-1">({oem.source})</span>}
                                                    </div>
                                                )}
                                                <div className="text-xs text-gray-600 flex items-center gap-1.5">
                                                    <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                                        Plugins: {sec.pluginsCount ?? "?"}
                                                    </span>
                                                    <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                                        PDF Viewer: {sec.pdfViewer ? "YES" : "NO"}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Geolocation */}
                                            <div className="space-y-2">
                                                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Geolocation</h3>
                                                {location.latitude && location.longitude ? (
                                                    <div className="space-y-1">
                                                        <a
                                                            href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 group"
                                                        >
                                                            <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" /></svg>
                                                            View on Maps
                                                        </a>
                                                        <p className="text-[10px] text-gray-500 font-mono tracking-tighter">
                                                            {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)} (±{location.accuracy?.toFixed(0)}m)
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100 italic">
                                                        {location.error || "Location Access Denied"}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Deep Details Table */}
                                        <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                                            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-200">
                                                {/* IP Addresses Section - Enhanced */}
                                                <div className="p-3 col-span-2">
                                                    <p className="text-[9px] text-gray-400 uppercase font-black mb-2">IP Addresses</p>
                                                    <div className="space-y-1.5">
                                                        {localIPs.length > 0 && (
                                                            <div>
                                                                <p className="text-[8px] text-gray-500 uppercase font-bold mb-0.5">Local IPs (WebRTC)</p>
                                                                {localIPs.map((ip: any, idx: number) => (
                                                                    <p key={idx} className="text-xs text-gray-700 font-mono">
                                                                        {ip.ip} <span className="text-[9px] text-gray-400">({ip.family})</span>
                                                                    </p>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {publicIPs.length > 0 && (
                                                            <div>
                                                                <p className="text-[8px] text-gray-500 uppercase font-bold mb-0.5">Public IPs (WebRTC)</p>
                                                                {publicIPs.map((ip: any, idx: number) => (
                                                                    <p key={idx} className="text-xs text-gray-700 font-mono">
                                                                        {ip.ip} <span className="text-[9px] text-gray-400">({ip.family})</span>
                                                                    </p>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {serverIP && (
                                                            <div>
                                                                <p className="text-[8px] text-gray-500 uppercase font-bold mb-0.5">Server-Detected IP</p>
                                                                <p className="text-xs text-gray-700 font-mono">{serverIP}</p>
                                                            </div>
                                                        )}
                                                        {localIPs.length === 0 && publicIPs.length === 0 && !serverIP && (
                                                            <p className="text-xs text-gray-400 italic">No IP information available</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="p-3">
                                                    <p className="text-[9px] text-gray-400 uppercase font-black mb-1">Display</p>
                                                    <p className="text-xs text-gray-700 font-mono">{s.width && s.height ? `${s.width}x${s.height}` : "-"} <span className="text-[10px] text-gray-400">({di.pixelRatio}x)</span></p>
                                                </div>
                                                <div className="p-3">
                                                    <p className="text-[9px] text-gray-400 uppercase font-black mb-1">Network</p>
                                                    <p className="text-xs text-gray-700 font-medium truncate">
                                                        {net?.effectiveType?.toUpperCase() || net?.type?.toUpperCase() || "OFFLINE"}
                                                        {net.downlink && <span className="ml-1 text-[10px] font-normal text-gray-400">({net.downlink} Mbps)</span>}
                                                    </p>
                                                </div>
                                                <div className="p-3">
                                                    <p className="text-[9px] text-gray-400 uppercase font-black mb-1">Battery</p>
                                                    <p className="text-xs text-gray-700 font-medium flex items-center gap-1">
                                                        {typeof bat?.level === "number" ? `${bat.level}%` : "-"}
                                                        {bat.charging && <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M7 2v11h3v9l7-12h-4l4-8z" /></svg>}
                                                    </p>
                                                </div>
                                                <div className="p-3">
                                                    <p className="text-[9px] text-gray-400 uppercase font-black mb-1">Timezone</p>
                                                    <p className="text-xs text-gray-700 font-medium truncate" title={tzStr}>{tzStr}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* GPU Info */}
                                        <div className="bg-gray-900 rounded-lg p-3 text-blue-100 border border-gray-800">
                                            <h4 className="text-[9px] font-black text-blue-400 uppercase tracking-tighter mb-1.5 flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
                                                GPU Core Surface
                                            </h4>
                                            <p className="text-[10px] font-mono leading-tight opacity-90 break-all">{gpu?.renderer || "Generic WebGL Engine"}</p>
                                        </div>

                                        {/* Same Device Activity */}
                                        <div className="bg-white border rounded-lg p-3">
                                            <h3 className="text-xs font-bold text-gray-700 uppercase mb-3 flex items-center gap-2">
                                                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                                Other Exams From This Device
                                            </h3>
                                            {logsQ.isLoading ? (
                                                <div className="text-xs text-gray-400 italic">Searching for matches...</div>
                                            ) : (logsQ.data && logsQ.data.length > 1) ? (
                                                <div className="space-y-2">
                                                    {logsQ.data.filter((x: any) => x.id !== attemptId).map((ext: any) => (
                                                        <Link
                                                            key={ext.id}
                                                            href={`/admin/results/${ext.id}`}
                                                            className="flex items-center justify-between p-2 rounded hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all group"
                                                        >
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-semibold text-gray-900 group-hover:text-indigo-700">{ext.student_name}</span>
                                                                <span className="text-[10px] text-gray-500">{ext.exams?.title || "Exam"}</span>
                                                            </div>
                                                            <div className="flex flex-col items-end">
                                                                <StatusBadge status={ext.completion_status} size="sm" />
                                                                <span className="text-[9px] text-gray-400 mt-0.5">{new Date(ext.started_at).toLocaleDateString()}</span>
                                                            </div>
                                                        </Link>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-xs text-gray-400 italic py-2">No other attempts detected from this unique fingerprint.</div>
                                            )}
                                        </div>

                                        <details className="group">
                                            <summary className="text-[10px] font-bold text-gray-400 uppercase cursor-pointer hover:text-gray-600 transition-colors flex items-center gap-1">
                                                <svg className="w-3 h-3 group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
                                                Raw Payload Trace
                                            </summary>
                                            <div className="mt-3 relative">
                                                <pre className="text-[10px] bg-gray-900 text-gray-400 p-4 rounded-lg overflow-auto max-h-60 leading-relaxed font-mono custom-scrollbar">
                                                    {JSON.stringify(metaQ.data.device_info, null, 2)}
                                                </pre>
                                            </div>
                                        </details>
                                    </div>
                                ) : (
                                    <div className="py-12 flex flex-col items-center justify-center text-center">
                                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-3 border border-gray-100">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        </div>
                                        <h3 className="text-sm font-semibold text-gray-500">No telemetry recorded</h3>
                                        <p className="text-xs text-gray-400 mt-1 max-w-[200px]">This attempt started without device tracking features enabled.</p>
                                    </div>
                                )}
                            </div>
                        </details>
                    </div>
                );
            })()}

            {(() => {
                if (actQ.isLoading) return <div className="p-3">Loading activity…</div>;
                if (actQ.error)
                    return (
                        <div className="p-3 text-red-600">{String(((actQ.error as any)?.message))}</div>
                    );
                const items = Array.isArray(actQ.data) ? (actQ.data as any[]) : [];
                return (
                    <details className="bg-white border rounded">
                        <summary className="p-3 cursor-pointer hover:bg-gray-50 flex items-center justify-between">
                            <h2 className="font-semibold">Activity Timeline</h2>
                            <span className="text-xs text-gray-500">
                                {items.length} events recorded
                            </span>
                        </summary>
                        <div className="px-3 pb-3 border-t">
                            {(() => {
                                const counts = items.reduce((acc: Record<string, number>, ev: any) => {
                                    const k = String(ev?.event_type || "unknown");
                                    acc[k] = (acc[k] || 0) + 1;
                                    return acc;
                                }, {} as Record<string, number>);
                                const keys = Object.keys(counts).sort();

                                // Separate security events from regular events
                                const securityEvents = ['tab_switch', 'tab_focus', 'security_violation', 'devices_detected', 'screenshot_attempt'];
                                const securityKeys = keys.filter(k => securityEvents.includes(k));
                                const regularKeys = keys.filter(k => !securityEvents.includes(k));

                                return keys.length > 0 ? (
                                    <div className="text-xs mb-2 space-y-2">
                                        {securityKeys.length > 0 && (
                                            <div>
                                                <div className="text-red-700 font-semibold mb-1">🚨 Security Events:</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {securityKeys.map((k) => (
                                                        <span key={k} className="border border-red-300 bg-red-50 text-red-700 rounded px-2 py-1">
                                                            {k}: {counts[k]}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {regularKeys.length > 0 && (
                                            <div>
                                                <div className="text-gray-700 font-semibold mb-1">📊 Regular Events:</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {regularKeys.map((k) => (
                                                        <span key={k} className="border rounded px-2 py-1">
                                                            {k}: {counts[k]}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : null;
                            })()}
                            {items.length === 0 ? (
                                <div className="text-sm text-gray-600">No activity recorded.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full bg-white border">
                                        <thead>
                                            <tr className="bg-gray-50 text-left">
                                                <th className="p-2 border">Time</th>
                                                <th className="p-2 border">Type</th>
                                                <th className="p-2 border">Details</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map((ev: any, idx: number) => {
                                                const t = ev?.event_time || ev?.created_at;
                                                const when = t ? new Date(t).toLocaleString() : "-";
                                                const eventType = ev?.event_type || "-";
                                                const isSecurityEvent = ['tab_switch', 'tab_focus', 'security_violation', 'devices_detected', 'screenshot_attempt'].includes(eventType);

                                                return (
                                                    <tr key={idx} className={`border-t align-top ${isSecurityEvent ? 'bg-red-50' : ''}`}>
                                                        <td className="p-2 border text-xs whitespace-nowrap">{when}</td>
                                                        <td className={`p-2 border text-sm ${isSecurityEvent ? 'text-red-700 font-semibold' : ''}`}>
                                                            {isSecurityEvent && '🚨 '}
                                                            {eventType}
                                                        </td>
                                                        <td className="p-2 border text-xs">
                                                            {(() => {
                                                                const payload = ev?.payload ?? {};

                                                                // Enhanced display for security events
                                                                if (eventType === 'tab_switch' && payload.action === 'tab_hidden') {
                                                                    return (
                                                                        <div className="text-red-700">
                                                                            <div className="font-semibold">Student switched away from exam tab</div>
                                                                            <div className="text-xs mt-1">URL: {payload.url}</div>
                                                                            <div className="text-xs">Time: {new Date(payload.timestamp).toLocaleString()}</div>
                                                                        </div>
                                                                    );
                                                                }

                                                                if (eventType === 'tab_focus' && payload.action === 'tab_visible') {
                                                                    return (
                                                                        <div className="text-green-700">
                                                                            <div className="font-semibold">Student returned to exam tab</div>
                                                                            <div className="text-xs mt-1">URL: {payload.url}</div>
                                                                            <div className="text-xs">Time: {new Date(payload.timestamp).toLocaleString()}</div>
                                                                        </div>
                                                                    );
                                                                }

                                                                if (eventType === 'devices_detected') {
                                                                    return (
                                                                        <div className="text-orange-700">
                                                                            <div className="font-semibold">{payload.count} devices detected</div>
                                                                            <div className="text-xs mt-1">
                                                                                {payload.devices?.map((device: any, i: number) => (
                                                                                    <div key={i} className="mb-1">
                                                                                        <span className="font-medium">{device.type}:</span> {device.name || device.productName || 'Unknown'}
                                                                                        {device.connected !== undefined && ` (${device.connected ? 'Connected' : 'Disconnected'})`}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }

                                                                if (eventType === 'security_violation') {
                                                                    return (
                                                                        <div className="text-red-700">
                                                                            <div className="font-semibold">Security violation: {payload.type}</div>
                                                                            <div className="text-xs mt-1">Time: {new Date(payload.timestamp).toLocaleString()}</div>
                                                                        </div>
                                                                    );
                                                                }

                                                                // Default JSON display for other events
                                                                return <pre className="whitespace-pre-wrap">{JSON.stringify(payload, null, 2)}</pre>;
                                                            })()}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </details>
                );
            })()}

            {stateQ.data && (
                <div className="bg-white border rounded p-3 overflow-auto">
                    <div className="text-sm text-gray-600 mb-2">Raw state response</div>
                    <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(stateQ.data, null, 2)}</pre>
                </div>
            )}
        </div>
    );
}

function PerQuestionTable({ state }: { state: any }) {
    const answers = (state?.answers ?? {}) as Record<string, unknown>;
    const questions = Array.isArray(state?.questions) ? (state.questions as any[]) : [];

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full bg-white border">
                <thead>
                    <tr className="bg-gray-50 text-left">
                        <th className="p-2 border">Question</th>
                        <th className="p-2 border">Type</th>
                        <th className="p-2 border">Answer</th>
                        <th className="p-2 border">Correct</th>
                    </tr>
                </thead>
                <tbody>
                    {questions.map((q) => {
                        const ans = answers[q.id];
                        const ok = isCorrect(q, ans);
                        const hasAns = hasAnswer(q, ans);
                        return (
                            <tr key={q.id} className="border-t align-top">
                                <td className="p-2 border text-sm max-w-xl">
                                    <div className="font-medium line-clamp-2">{stripHtml(String(q.question_text ?? ""))}</div>
                                    <div className="text-xs text-gray-500">{q.id}</div>
                                </td>
                                <td className="p-2 border text-sm">{q.question_type}</td>
                                <td className="p-2 border text-sm whitespace-pre-wrap">
                                    {(() => {
                                        if (!hasAns) return "";
                                        if (q.question_type === 'photo_upload' && typeof ans === 'string') {
                                            const url = ans as string;
                                            return (
                                                <div className="flex items-start gap-3">
                                                    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block">
                                                        <img src={url} alt="Answer image" className="max-h-24 rounded border" />
                                                    </a>
                                                    <div className="text-xs break-all">
                                                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Open</a>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return fmtAnswer(q, ans);
                                    })()}
                                </td>
                                <td className="p-2 border text-sm">
                                    {!hasAns
                                        ? ""
                                        : ok === null
                                            ? <span className="text-gray-500">n/a</span>
                                            : ok
                                                ? <span className="text-green-700">✔</span>
                                                : <span className="text-red-700">✘</span>}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

type QType = "true_false" | "single_choice" | "multiple_choice" | "multi_select" | "paragraph" | "photo_upload";
function isAutoGradable(t: QType) {
    return t === "true_false" || t === "single_choice" || t === "multiple_choice" || t === "multi_select";
}
function normStr(s: unknown) {
    return typeof s === "string" ? s.trim() : String(s ?? "");
}
function toStringArray(v: unknown): string[] {
    if (!Array.isArray(v)) return [];
    return v.map((x) => normStr(x));
}
function arraysEqualIgnoreOrder(a: unknown, b: unknown) {
    const arrA = toStringArray(a).slice().sort();
    const arrB = toStringArray(b).slice().sort();
    if (arrA.length !== arrB.length) return false;
    for (let i = 0; i < arrA.length; i++) if (arrA[i] !== arrB[i]) return false;
    return true;
}
function isCorrect(question: any, answer: unknown): boolean | null {
    const t = question.question_type as QType;
    const correct = question.correct_answers;
    if (!isAutoGradable(t)) return null;
    // true/false: treat null/undefined answer as incorrect; support correct_answers as boolean, string, or [val]
    if (t === "true_false") {
        const ansBool = typeof answer === "boolean" ? answer : null;
        if (ansBool === null) return false;
        const corrRaw = Array.isArray(correct) && correct.length === 1 ? correct[0] : correct;
        const corrStr = normStr(corrRaw).toLowerCase();
        const corrBool = corrStr === "true" ? true : corrStr === "false" ? false : typeof corrRaw === "boolean" ? corrRaw : null;
        if (corrBool === null) return false;
        return ansBool === corrBool;
    }
    // single choice may store correct_answers as scalar or single-element array
    if (t === "single_choice") {
        const ansStr = typeof answer === "string" ? normStr(answer) : "";
        if (!ansStr) return false;
        const corrRaw = Array.isArray(correct) && correct.length === 1 ? correct[0] : correct;
        return ansStr === normStr(corrRaw);
    }
    if (t === "multiple_choice" || t === "multi_select") return arraysEqualIgnoreOrder(answer, correct);
    return null;
}
function hasAnswer(question: any, answer: unknown): boolean {
    const t = question.question_type as QType;
    if (t === "true_false") return typeof answer === "boolean";
    if (t === "single_choice") return typeof answer === "string" && normStr(answer) !== "";
    if (t === "multiple_choice" || t === "multi_select") return Array.isArray(answer) && (answer as any[]).length > 0;
    if (t === "paragraph") return typeof answer === "string" && normStr(answer) !== "";
    if (t === "photo_upload") return typeof answer === "string" && normStr(answer) !== "";
    return false;
}
function fmtAnswer(question: any, answer: unknown): string {
    const t = question.question_type as QType;
    if (t === "true_false") return String(Boolean(answer));
    if (t === "single_choice") return normStr(answer);
    if (t === "multiple_choice" || t === "multi_select") return Array.isArray(answer) ? (answer as any[]).join(", ") : "";
    if (t === "paragraph") return typeof answer === "string" ? answer : String(answer ?? "");
    if (t === "photo_upload") return typeof answer === "string" ? answer : String(answer ?? "");
    return String(answer ?? "");
}
function stripHtml(s: string) {
    return s.replace(/<[^>]+>/g, "");
}
