"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/components/ToastProvider";
import ModernCard from "@/components/admin/ModernCard";
import ModernTable from "@/components/admin/ModernTable";
import SearchInput from "@/components/admin/SearchInput";
import ActionButton from "@/components/admin/ActionButton";
import StatusBadge from "@/components/admin/StatusBadge";

interface Exam {
  id: string;
  title: string;
  status: string;
  access_type: string;
}

interface Attempt {
  id: string;
  student_name: string | null;
  code?: string | null;
  completion_status: string | null;
  started_at: string | null;
  submitted_at: string | null;
  score_percentage: number | null;
  final_score_percentage?: number | null;
  ip_address: string | null;
  manual_total_count?: number | null;
  manual_graded_count?: number | null;
  manual_pending_count?: number | null;
}

// Extra score field definition (subset)
interface ExtraField {
  key: string;
  label: string;
  type: "number" | "text" | "boolean";
  hidden?: boolean;
  include_in_pass?: boolean;
  pass_weight?: number | null;
  max_points?: number | null;
  bool_true_points?: number | null;
  bool_false_points?: number | null;
  text_score_map?: Record<string, number> | null;
}

interface AppSettings {
  result_pass_calc_mode?: "best" | "avg";
  result_overall_pass_threshold?: number;
  result_exam_weight?: number;
}

export default function AdminResultsIndex() {
  const ALL = "__ALL__";
  const [examId, setExamId] = useState<string>("");
  const [studentFilter, setStudentFilter] = useState("");
  const [allSearch, setAllSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [regradingAll, setRegradingAll] = useState(false);
  const [scoreSort, setScoreSort] = useState<"none" | "asc" | "desc">("none");
  const [allScoreSort, setAllScoreSort] = useState<"none" | "finalAsc" | "finalDesc">("none");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  const toast = useToast();

  const examsQuery = useQuery({
    queryKey: ["admin", "exams", "all"],
    queryFn: async () => {
      const res = await authFetch(`/api/admin/exams`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Load exams failed");
      return (j.items as Exam[])?.sort((a, b) => a.title.localeCompare(b.title));
    },
  });

  // Only show published and done exams in UI (and ALL aggregation)
  const visibleExams = useMemo(() =>
    (examsQuery.data ?? []).filter((e) => e.status === "published" || e.status === "done"),
  [examsQuery.data]);

  const handleExportAllCsv = async () => {
    const exams = visibleExams;
    const fields = visibleExtraFields;
    const rows = filteredAllRows as Array<{ name: string; code: string | null; scores: Record<string, number | null>; summary?: { overall_score: number | null } }>;
    const headers = [
      "Student",
      "Code",
      ...exams.map((e) => e.title),
      ...fields.map((f) => f.label || f.key),
      "Final",
    ];
    const esc = (v: any) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return s.includes(",") || s.includes("\n") || s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines: string[] = [];
    lines.push(headers.join(","));
    for (const r of rows) {
      const data = r.code ? (extrasByCode.get(r.code) || {}) : {};
      const examsVals = exams.map((e) => {
        const v = r.scores?.[e.id];
        return v == null || Number.isNaN(Number(v)) ? "" : Number(v).toFixed(2);
      });
      const extraVals = fields.map((f) => {
        const v = (data as any)?.[f.key];
        if (v == null || v === "") return "";
        if (f.type === 'boolean') return String(v);
        const n = Number(v);
        if (!Number.isNaN(n)) return Number(n).toFixed(2);
        return String(v);
      });
      const finalVal = r?.summary?.overall_score != null ? Number(r.summary.overall_score).toFixed(2) : "";
      const line = [esc(r.name), esc(r.code ?? ""), ...examsVals.map(esc), ...extraVals.map(esc), esc(finalVal)];
      lines.push(line.join(","));
    }
    const csv = "\ufeff" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `results_all_exams.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportAllXlsx = async () => {
    const XLSX = await import("xlsx");
    const exams = visibleExams;
    const fields = visibleExtraFields;
    const rows = filteredAllRows as Array<{ name: string; code: string | null; scores: Record<string, number | null>; summary?: { overall_score: number | null } }>;
    const out = rows.map((r) => {
      const obj: Record<string, any> = { Student: r.name, Code: r.code ?? "" };
      for (const e of exams) {
        const v = r.scores?.[e.id];
        obj[e.title] = v == null || Number.isNaN(Number(v)) ? "" : Number(v).toFixed(2);
      }
      const data = r.code ? (extrasByCode.get(r.code) || {}) : {};
      for (const f of fields) {
        const v = (data as any)?.[f.key];
        if (v == null || v === "") obj[f.label || f.key] = "";
        else if (f.type === 'boolean') obj[f.label || f.key] = String(v);
        else if (!Number.isNaN(Number(v))) obj[f.label || f.key] = Number(v).toFixed(2);
        else obj[f.label || f.key] = String(v);
      }
      obj["Final"] = r?.summary?.overall_score != null ? Number(r.summary.overall_score).toFixed(2) : "";
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(out);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "All Exams");
    XLSX.writeFile(wb, `results_all_exams.xlsx`);
  };

  // Aggregated attempts across all exams when Select All is chosen
  const allAttemptsQuery = useQuery({
    enabled: examId === ALL && (visibleExams.length || 0) > 0,
    queryKey: ["admin", "attempts", "ALL"],
    queryFn: async () => {
      const exams = visibleExams ?? [];
      const resultsByExam: Record<string, any[]> = {};
      await Promise.all(
        exams.map(async (ex) => {
          const res = await authFetch(`/api/admin/exams/${ex.id}/attempts`);
          const j = await res.json();
          if (res.ok) resultsByExam[ex.id] = (j.items as any[]) || [];
          else resultsByExam[ex.id] = [];
        })
      );
      // Also fetch master students list to map codes and ids
      let nameToCode: Map<string, string> = new Map();
      let codeToId: Map<string, string> = new Map();
      let nameToId: Map<string, string> = new Map();
      try {
        const sRes = await authFetch(`/api/admin/students`);
        const sJson = await sRes.json();
        if (sRes.ok && Array.isArray(sJson?.students)) {
          for (const s of sJson.students) {
            const nm = (String(s?.student_name ?? "").trim()) || "";
            const cd = s?.code ? String(s.code) : "";
            const sid = s?.student_id ? String(s.student_id) : "";
            if (nm && cd && !nameToCode.has(nm)) nameToCode.set(nm, cd);
            if (cd && sid) codeToId.set(cd, sid);
            if (nm && sid && !nameToId.has(nm)) nameToId.set(nm, sid);
          }
        }
      } catch {}
      // Build per-student aggregation by student_name
      const byStudent: Map<string, { name: string; code: string | null; student_id: string | null; scores: Record<string, number | null> }> = new Map();
      for (const ex of exams) {
        const items = resultsByExam[ex.id] || [];
        const bestByName: Map<string, number> = new Map();
        const codeByName: Map<string, string | null> = new Map();
        const idByName: Map<string, string | null> = new Map();
        for (const at of items) {
          const name = (at.student_name ?? "").trim() || "(Anonymous)";
          const val = at.final_score_percentage ?? at.score_percentage;
          const n = val == null ? null : Number(val);
          if (n == null || Number.isNaN(n)) continue;
          const prev = bestByName.get(name);
          if (prev == null || n > prev) bestByName.set(name, n);
          const existingCode = codeByName.get(name);
          if (!existingCode && at.code) codeByName.set(name, at.code);
          else if (!codeByName.has(name)) codeByName.set(name, at.code ?? (nameToCode.get(name) ?? null));
          // set id by code or name
          if (!idByName.has(name)) {
            const code = at.code ?? (nameToCode.get(name) ?? null);
            const sid = code ? (codeToId.get(code) ?? null) : (nameToId.get(name) ?? null);
            idByName.set(name, sid ?? null);
          }
        }
        // Merge into rows
        for (const [name, val] of bestByName.entries()) {
          const row = byStudent.get(name) || { name, code: codeByName.get(name) ?? (nameToCode.get(name) ?? null), student_id: idByName.get(name) ?? null, scores: {} };
          if (row.code == null) row.code = codeByName.get(name) ?? (nameToCode.get(name) ?? null);
          if (row.student_id == null) row.student_id = idByName.get(name) ?? null;
          row.scores[ex.id] = val;
          byStudent.set(name, row);
        }
        // Ensure students with attempts but null score appear
        for (const at of items) {
          const name = (at.student_name ?? "").trim() || "(Anonymous)";
          if (!byStudent.has(name)) byStudent.set(name, { name, code: at.code ?? (nameToCode.get(name) ?? null), student_id: (at.code ? (codeToId.get(at.code) ?? null) : (nameToId.get(name) ?? null)), scores: { [ex.id]: null } });
          else {
            const existing = byStudent.get(name)!;
            if (existing.scores[ex.id] === undefined) existing.scores[ex.id] = null;
            if (!existing.code) existing.code = at.code ?? (nameToCode.get(name) ?? null);
            if (!existing.student_id) existing.student_id = (existing.code ? (codeToId.get(existing.code) ?? null) : (nameToId.get(name) ?? null));
            byStudent.set(name, existing);
          }
        }
      }
      // Return rows sorted by name
      const rows = Array.from(byStudent.values()).sort((a, b) => a.name.localeCompare(b.name));
      return { exams, rows };
    },
  });

  const attemptsQuery = useQuery({
    enabled: !!examId && examId !== ALL,
    queryKey: ["admin", "attempts", examId],
    queryFn: async () => {
      const res = await authFetch(`/api/admin/exams/${examId}/attempts`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Load attempts failed");
      return j.items as Attempt[];
    },
  });

  // Auto-select a published exam by default
  useEffect(() => {
    if (!examId && examsQuery.data?.length) {
      const published = examsQuery.data.find((e) => e.status === "published");
      if (published) setExamId(published.id);
    }
  }, [examId, examsQuery.data]);

  const selectedExam = useMemo(() => 
    visibleExams.find((e) => e.id === examId) ?? null, 
    [visibleExams, examId]
  );

  const filteredAttempts = useMemo(() => {
    const rows = attemptsQuery.data ?? [];
    return rows.filter((attempt) => {
      if (studentFilter) {
        const term = studentFilter.toLowerCase().trim();
        const nm = String(attempt.student_name || "").toLowerCase();
        const cd = String(attempt.code || "").toLowerCase();
        if (!nm.includes(term) && !cd.includes(term)) return false;
      }
      if (startDate && attempt.started_at) {
        const startDateTime = new Date(startDate);
        const attemptStart = new Date(attempt.started_at);
        if (attemptStart < startDateTime) return false;
      }
      if (endDate && attempt.started_at) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999); // Include full end date
        const attemptStart = new Date(attempt.started_at);
        if (attemptStart > endDateTime) return false;
      }
      return true;
    });
  }, [attemptsQuery.data, studentFilter, startDate, endDate]);

  const sortedAttempts = useMemo(() => {
    const rows = filteredAttempts.slice();
    if (scoreSort === "none") return rows;
    if (scoreSort === "asc") {
      rows.sort((a, b) => {
        const av = (a.final_score_percentage ?? a.score_percentage);
        const bv = (b.final_score_percentage ?? b.score_percentage);
        if (av === null && bv === null) return 0;
        if (av === null) return 1; // nulls last
        if (bv === null) return -1;
        return (av as number) - (bv as number);
      });
    } else if (scoreSort === "desc") {
      rows.sort((a, b) => {
        const av = (a.final_score_percentage ?? a.score_percentage);
        const bv = (b.final_score_percentage ?? b.score_percentage);
        if (av === null && bv === null) return 0;
        if (av === null) return 1; // nulls last
        if (bv === null) return -1;
        return (bv as number) - (av as number);
      });
    }
    return rows;
  }, [filteredAttempts, scoreSort]);

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const res = await authFetch(`/api/admin/exams/${examId}/attempts/export`);
      const blob = await res.blob();
      if (!res.ok) {
        const txt = await blob.text();
        throw new Error(txt || "Export failed");
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attempts_${examId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success({ title: "Export Complete", message: "CSV file downloaded successfully" });
    } catch (e: any) {
      toast.error({ title: "Export Failed", message: e?.message || "Unknown error" });
    } finally {
      setExportingCsv(false);
    }
  };

  const handleRegradeAll = async () => {
    if (!examId) return;
    setRegradingAll(true);
    try {
      const res = await authFetch(`/api/admin/exams/${examId}/regrade`, { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Regrade failed');
      toast.success({ title: 'Regrade started', message: `Regraded ${j?.result?.regraded_count ?? ''} attempts` });
      attemptsQuery.refetch();
    } catch (e: any) {
      toast.error({ title: 'Regrade failed', message: e?.message || 'Unknown error' });
    } finally {
      setRegradingAll(false);
    }
  };

  const handleExportXlsx = async () => {
    setExportingXlsx(true);
    try {
      const XLSX = await import("xlsx");
      const rows = filteredAttempts.map((attempt) => ({
        id: attempt.id,
        student: attempt.student_name ?? "",
        code: attempt.code ?? "",
        status: attempt.completion_status ?? "",
        started_at: attempt.started_at ?? "",
        submitted_at: attempt.submitted_at ?? "",
        score_percentage: attempt.score_percentage ?? "",
        ip_address: attempt.ip_address ?? "",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Attempts");
      const title = (selectedExam?.title || "").trim();
      const baseName = title ? `attempts_${title}` : `attempts_${examId}`;
      const safeName = baseName.replace(/[\\/:*?"<>|]+/g, "_").trim();
      XLSX.writeFile(wb, `${safeName}.xlsx`);
      toast.success({ title: "Export Complete", message: "XLSX file saved successfully" });
    } catch (e: any) {
      toast.error({ title: "Export Failed", message: e?.message || "Unknown error" });
    } finally {
      setExportingXlsx(false);
    }
  };

  const deleteAttempt = async (attemptId: string) => {
    try {
      setDeleting(attemptId);
      const response = await authFetch(`/api/admin/attempts/${attemptId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete attempt');
      }
      
      // Refresh the data
      attemptsQuery.refetch();
      setDeleteConfirm(null);
      toast.success({ title: "Success", message: "Attempt deleted successfully" });
    } catch (error) {
      console.error('Delete error:', error);
      toast.error({ 
        title: "Delete Failed", 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setDeleting(null);
    }
  };

  const clearFilters = () => {
    setStudentFilter("");
    setStartDate("");
    setEndDate("");
  };

  const columns = [
    { key: "student", label: "Student", width: "15vw" },
    { key: "time", label: "Time", width: "15vw" },
    { key: "score", label: "Score", width: "10vw", align: "center" as const },
    { key: "ip", label: "IP Address", width: "10vw" },
    { key: "actions", label: "Actions", width: "10vw" },
  ];

  // Columns for aggregated ALL view: Student + one column per exam title
  // Load extra fields, settings, and exam config for ALL view
  const extraFieldsQuery = useQuery<ExtraField[]>({
    enabled: examId === ALL,
    queryKey: ["admin", "extra-fields"],
    queryFn: async () => {
      const res = await authFetch("/api/admin/extra-scores/fields");
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to load fields");
      const items = (j.items as ExtraField[]) || [];
      return items.sort((a, b) => (a.hidden === b.hidden ? 0 : a.hidden ? 1 : -1) || (a.label || "").localeCompare(b.label || ""));
    },
  });
  const settingsQuery = useQuery<AppSettings | null>({
    enabled: examId === ALL,
    queryKey: ["admin", "settings", "extra"],
    queryFn: async () => {
      const res = await authFetch("/api/admin/settings");
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to load settings");
      return (j.item as any) || null;
    },
  });
  // Exams used for pass calc (done only, include_in_pass flag)
  const passExamsQuery = useQuery<{ id: string; title: string; include_in_pass: boolean }[]>({
    enabled: examId === ALL,
    queryKey: ["admin", "extra-exams", "pass"],
    queryFn: async () => {
      const res = await authFetch("/api/admin/extra-scores/exams");
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to load exams config");
      const items = (j.items as any[]) || [];
      return items.map((x) => ({ id: x.id, title: x.title, include_in_pass: x.include_in_pass !== false }));
    },
  });

  // Build columns for ALL view: Student + each visible exam + extra fields (not hidden) + Final
  const columnsAll = useMemo(() => {
    const exams = visibleExams;
    const extraCols = (extraFieldsQuery.data || []).filter((f) => !f.hidden).map((f) => ({ key: `extra_${f.key}`, label: f.label, align: "center" as const }));
    return [
      { key: "student", label: "Student", width: "15vw" },
      ...exams.map((ex) => ({ key: `exam_${ex.id}`, label: ex.title, align: "center" as const })),
      ...extraCols,
      { key: "final", label: "Final", align: "center" as const },
    ];
  }, [visibleExams, extraFieldsQuery.data]);

  // Load summaries (extras + overall) for students present in aggregated ALL rows using existing public API
  const codesForAll = useMemo(() => {
    const rows = allAttemptsQuery.data?.rows || [];
    return Array.from(new Set((rows as any[]).map((r: any) => String(r.code || "")).filter((s) => s.length > 0)));
  }, [allAttemptsQuery.data]);

  const summariesQuery = useQuery<{ code: string; extras: Array<{ key: string; value: any }>; pass_summary: { overall_score: number | null; passed: boolean | null } }[]>({
    enabled: examId === ALL && codesForAll.length > 0,
    queryKey: ["admin", "summaries", codesForAll.join(",")],
    queryFn: async () => {
      const out: { code: string; extras: any[]; pass_summary: any }[] = [];
      const batchSize = 200;
      for (let i = 0; i < codesForAll.length; i += batchSize) {
        const chunk = codesForAll.slice(i, i + batchSize);
        const url = `/api/admin/summaries?codes=${encodeURIComponent(chunk.join(","))}`;
        const res = await authFetch(url);
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || "Failed to load summaries");
        out.push(...(((j?.items as any[]) || []).map((x: any) => ({ code: x.code, extras: x.extras || [], pass_summary: x.pass_summary || { overall_score: null, passed: null } }))));
      }
      return out;
    },
  });

  // Memo helpers for ALL view
  const extrasByCode = useMemo(() => {
    const m = new Map<string, Record<string, any>>();
    for (const it of (summariesQuery.data || [])) {
      const obj: Record<string, any> = {};
      for (const e of (it.extras || [])) obj[e.key] = (e as any).value;
      m.set(it.code, obj);
    }
    return m;
  }, [summariesQuery.data]);
  const visibleExtraFields = useMemo(() => (extraFieldsQuery.data || []).filter((f) => !f.hidden), [extraFieldsQuery.data]);
  const passExamIds = useMemo(() => (passExamsQuery.data || []).filter((e) => e.include_in_pass).map((e) => e.id), [passExamsQuery.data]);
  const allRowsWithSummaries = useMemo(() => {
    if (examId !== ALL) return [] as Array<any>;
    const rows = (allAttemptsQuery.data?.rows || []) as Array<{ name: string; code: string | null; student_id: string | null; scores: Record<string, number | null> }>;
    const summaryByCode = new Map<string, any>();
    for (const it of (summariesQuery.data || [])) summaryByCode.set(it.code, it.pass_summary || { overall_score: null, passed: null });
    return rows.map((r) => ({ ...r, summary: summaryByCode.get(r.code || "") || { overall_score: null, passed: null } }));
  }, [examId, allAttemptsQuery.data, summariesQuery.data]);

  // Filter ALL rows by name or code
  const filteredAllRows = useMemo(() => {
    const list = allRowsWithSummaries || [];
    const term = allSearch.trim().toLowerCase();
    if (!term) return list;
    return list.filter((r: any) => {
      const nm = String(r.name || '').toLowerCase();
      const cd = String(r.code || '').toLowerCase();
      return nm.includes(term) || cd.includes(term);
    });
  }, [allRowsWithSummaries, allSearch]);

  // Sort ALL rows by final summary score when requested
  const sortedAllRows = useMemo(() => {
    const list = filteredAllRows.slice();
    if (allScoreSort === "none") return list;
    list.sort((a: any, b: any) => {
      const av = a?.summary?.overall_score;
      const bv = b?.summary?.overall_score;
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // nulls last
      if (bv == null) return -1;
      return allScoreSort === "finalAsc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return list;
  }, [filteredAllRows, allScoreSort]);

  // Count passed among currently filtered rows
  const passCounts = useMemo(() => {
    const list = filteredAllRows || [];
    let passed = 0;
    for (const r of list) {
      if (r?.summary?.passed === true) passed++;
    }
    return { passed, total: list.length };
  }, [filteredAllRows]);

  const renderCell = (attempt: Attempt, column: any) => {
    switch (column.key) {
      case "student":
        return (
          <div className="flex flex-col">
            <span>{attempt.student_name || <span className="text-gray-400">Anonymous</span>}</span>
            {attempt.code ? (
              <span className="text-xs text-gray-500">{attempt.code}</span>
            ) : null}
          </div>
        );
      case "time":
        return (
          <div className="text-sm">
            <div className="text-gray-900">
              {attempt.started_at ? new Date(attempt.started_at).toLocaleString() : "-"}
            </div>
            <div className="text-gray-500">
              {attempt.submitted_at ? (
                new Date(attempt.submitted_at).toLocaleString()
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  in_progress
                </span>
              )}
            </div>
          </div>
        );
      case "score":
        const hasManual = (attempt.manual_total_count ?? 0) > 0;
        const pending = attempt.manual_pending_count ?? 0;
        const scoreVal = hasManual && pending > 0
          ? attempt.score_percentage
          : (attempt.final_score_percentage ?? attempt.score_percentage);
        const suffix = hasManual
          ? (pending > 0 ? ` (${pending}) pending` : " (✔️)")
          : "";
        return scoreVal !== null && scoreVal !== undefined ? (
          <span className={`font-bold ${
            (scoreVal as number) >= 80 ? 'text-green-600' :
            (scoreVal as number) >= 60 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {Number(scoreVal).toFixed(2)}%
            {suffix && (
              <span className="ml-1 font-normal text-gray-500">{suffix}</span>
            )}
          </span>
        ) : "-";
      case "ip":
        return (
          <code className="bg-gray-100 px-2 py-1 rounded text-xs">
            {attempt.ip_address || "Unknown"}
          </code>
        );
      case "actions":
        return (
          <div className="flex items-center gap-2">
            <Link href={`/admin/results/${attempt.id}`}>
              <ActionButton variant="secondary" size="sm">View</ActionButton>
            </Link>
            <ActionButton 
              variant="danger" 
              size="sm"
              onClick={() => setDeleteConfirm(attempt.id)}
            >
              Delete
            </ActionButton>
          </div>
        );
      default:
        return null;
    }
  };

  

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exam Results</h1>
          <p className="text-gray-600 mt-1">View and analyze student exam attempts</p>
        </div>
        <div>
          <Link href="/admin/extra-scores">
            <ActionButton variant="secondary">Manage Extra Scores</ActionButton>
          </Link>
        </div>
      </div>

      {/* Exam Selection */
      }
      <ModernCard>
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Exams
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setExamId(ALL)}
                className={`px-3 py-2 rounded-lg border text-sm transition ${examId === ALL ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'}`}
              >
                Select All
              </button>
              {visibleExams.map((exam) => (
                <button
                  key={exam.id}
                  type="button"
                  onClick={() => setExamId(exam.id)}
                  className={`px-3 py-2 rounded-lg border text-sm transition ${examId === exam.id ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'}`}
                >
                  <span>{exam.title}</span>
                  {exam.status === 'published' && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">
                      Published
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </ModernCard>

      {examId === ALL ? (
        <ModernCard>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-4">
            <div className="flex-1">
              <SearchInput placeholder="Search by name or code..." value={allSearch} onChange={setAllSearch} />
            </div>
            <div className="flex items-end gap-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                Passed {passCounts.passed}/{passCounts.total}
              </span>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Sort</label>
                <select className="input" value={allScoreSort} onChange={(e) => setAllScoreSort(e.target.value as any)}>
                  <option value="none">None</option>
                  <option value="finalDesc">Final: Highest first</option>
                  <option value="finalAsc">Final: Lowest first</option>
                </select>
              </div>
              <ActionButton variant="secondary" onClick={handleExportAllCsv}>Export CSV</ActionButton>
              <ActionButton variant="secondary" onClick={handleExportAllXlsx}>Export XLSX</ActionButton>
            </div>
          </div>
          <ModernTable
            columns={columnsAll}
            data={sortedAllRows}
            renderCell={(row: any, col: any) => {
              if (col.key === 'student') return (
                <div className="flex flex-col">
                  <span>{row.name}</span>
                  {row.code ? <span className="text-xs text-gray-500">{row.code}</span> : null}
                </div>
              );
              if (col.key.startsWith('exam_')) {
                const exId = col.key.slice(5);
                const v = row.scores?.[exId];
                return v == null ? '-' : (
                  <span className={`font-semibold ${v >= 80 ? 'text-green-600' : v >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {Number(v).toFixed(2)}%
                  </span>
                );
              }
              if (col.key.startsWith('extra_')) {
                const k = col.key.slice(6);
                const data = row.code ? (extrasByCode.get(row.code) || {}) : {};
                const f = visibleExtraFields.find((x) => x.key === k);
                const v = (data as any)?.[k];
                if (!f) return v == null ? '-' : String(v);
                if (f.type === 'boolean') {
                  const truthy = v === true || String(v).toLowerCase() === 'true' || v === 1 || v === '1' || String(v).toLowerCase() === 'yes';
                  return truthy ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Yes</span> : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">No</span>;
                }
                if (f.type === 'number') {
                  const maxp = Number(f.max_points || 0);
                  const n = Number(v);
                  if (Number.isNaN(n)) return '-';
                  if (maxp === 100) return `${Number(n).toFixed(2)}%`;
                  return maxp > 0 ? `${Number(n).toFixed(2)}/${maxp}` : `${Number(n).toFixed(2)}`;
                }
                return v == null || String(v).trim() === '' ? '-' : String(v);
              }
              if (col.key === 'final') {
                const sm = row.summary as { overall_score: number | null; passed: boolean | null } | undefined;
                const val = sm?.overall_score;
                const passed = sm?.passed;
                if (val == null || passed == null) return '-';
                return (
                  <div className="flex flex-col items-center">
                    <span className="font-semibold">{Number(val).toFixed(2)}%</span>
                    <span className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {passed ? 'Pass' : 'Fail'}
                    </span>
                  </div>
                );
              }
              return null;
            }}
            loading={allAttemptsQuery.isLoading || extraFieldsQuery.isLoading || summariesQuery.isLoading || settingsQuery.isLoading || passExamsQuery.isLoading}
            emptyMessage={sortedAllRows.length ? undefined : 'No attempts found across exams'}
          />
        </ModernCard>
      ) : (
        <ModernCard>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-4">
            <div className="flex-1">
              <SearchInput placeholder="Search student..." value={studentFilter} onChange={setStudentFilter} />
            </div>
            <div className="flex items-end gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Start date</label>
                <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">End date</label>
                <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Sort by score</label>
                <select className="input" value={scoreSort} onChange={(e) => setScoreSort(e.target.value as any)}>
                  <option value="none">None</option>
                  <option value="desc">Highest first</option>
                  <option value="asc">Lowest first</option>
                </select>
              </div>
              <ActionButton variant="secondary" onClick={clearFilters}>Clear</ActionButton>
              <ActionButton variant="secondary" onClick={handleExportCsv} loading={exportingCsv}>Export CSV</ActionButton>
              <ActionButton variant="secondary" onClick={handleExportXlsx} loading={exportingXlsx}>Export XLSX</ActionButton>
              <ActionButton variant="primary" onClick={handleRegradeAll} loading={regradingAll}>Regrade all</ActionButton>
            </div>
          </div>
          <ModernTable
            columns={columns}
            data={sortedAttempts}
            renderCell={renderCell}
            loading={attemptsQuery.isLoading}
            emptyMessage={sortedAttempts.length ? undefined : 'No attempts found'}
          />
        </ModernCard>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">Delete Attempt</h3>
              </div>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-500">
                Are you sure you want to delete this attempt? This action cannot be undone and will permanently remove all associated data including answers and scores.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <ActionButton
                variant="secondary"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting === deleteConfirm}
              >
                Cancel
              </ActionButton>
              <ActionButton
                variant="danger"
                onClick={() => deleteAttempt(deleteConfirm)}
                loading={deleting === deleteConfirm}
              >
                Delete Attempt
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}