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

export default function AdminResultsIndex() {
  const ALL = "__ALL__";
  const [examId, setExamId] = useState<string>("");
  const [studentFilter, setStudentFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [regradingAll, setRegradingAll] = useState(false);
  const [scoreSort, setScoreSort] = useState<"none" | "asc" | "desc">("none");
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

  const handleExportAllCsv = async () => {
    const data = allAttemptsQuery.data;
    if (!data) return;
    const exams = data.exams as Exam[];
    const rows = data.rows as Array<{ name: string; code?: string | null; scores: Record<string, number | null> }>;
    const headers = ["Student", "Code", ...exams.map((e) => e.title)];
    const esc = (v: any) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return s.includes(",") || s.includes("\n") || s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines: string[] = [];
    lines.push(headers.join(","));
    for (const r of rows) {
      const line = [
        esc(r.name),
        esc(r.code ?? ""),
        ...exams.map((e) => {
          const v = r.scores?.[e.id];
          return v == null ? "" : String(Math.round(v * 100) / 100);
        }),
      ];
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
    const data = allAttemptsQuery.data;
    if (!data) return;
    const XLSX = await import("xlsx");
    const exams = data.exams as Exam[];
    const rows = data.rows as Array<{ name: string; code?: string | null; scores: Record<string, number | null> }>;
    const out = rows.map((r) => {
      const obj: Record<string, any> = { Student: r.name, Code: r.code ?? "" };
      for (const e of exams) {
        const v = r.scores?.[e.id];
        obj[e.title] = v == null ? "" : Math.round(v * 100) / 100;
      }
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(out);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "All Exams");
    XLSX.writeFile(wb, `results_all_exams.xlsx`);
  };

  // Aggregated attempts across all exams when Select All is chosen
  const allAttemptsQuery = useQuery({
    enabled: examId === ALL && (examsQuery.data?.length || 0) > 0,
    queryKey: ["admin", "attempts", "ALL"],
    queryFn: async () => {
      const exams = examsQuery.data ?? [];
      const resultsByExam: Record<string, any[]> = {};
      await Promise.all(
        exams.map(async (ex) => {
          const res = await authFetch(`/api/admin/exams/${ex.id}/attempts`);
          const j = await res.json();
          if (res.ok) resultsByExam[ex.id] = (j.items as any[]) || [];
          else resultsByExam[ex.id] = [];
        })
      );
      // Also fetch master students list to map codes by name as a fallback
      let nameToCode: Map<string, string> = new Map();
      try {
        const sRes = await authFetch(`/api/admin/students`);
        const sJson = await sRes.json();
        if (sRes.ok && Array.isArray(sJson?.students)) {
          for (const s of sJson.students) {
            const nm = (String(s?.student_name ?? "").trim()) || "";
            const cd = s?.code ? String(s.code) : "";
            if (nm && cd && !nameToCode.has(nm)) nameToCode.set(nm, cd);
          }
        }
      } catch {}
      // Build per-student aggregation by student_name
      const byStudent: Map<string, { name: string; code: string | null; scores: Record<string, number | null> }> = new Map();
      for (const ex of exams) {
        const items = resultsByExam[ex.id] || [];
        const bestByName: Map<string, number> = new Map();
        const codeByName: Map<string, string | null> = new Map();
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
        }
        // Merge into rows
        for (const [name, val] of bestByName.entries()) {
          const row = byStudent.get(name) || { name, code: codeByName.get(name) ?? (nameToCode.get(name) ?? null), scores: {} };
          if (row.code == null) row.code = codeByName.get(name) ?? (nameToCode.get(name) ?? null);
          row.scores[ex.id] = val;
          byStudent.set(name, row);
        }
        // Ensure students with attempts but null score appear
        for (const at of items) {
          const name = (at.student_name ?? "").trim() || "(Anonymous)";
          if (!byStudent.has(name)) byStudent.set(name, { name, code: at.code ?? (nameToCode.get(name) ?? null), scores: { [ex.id]: null } });
          else {
            const existing = byStudent.get(name)!;
            if (existing.scores[ex.id] === undefined) existing.scores[ex.id] = null;
            if (!existing.code) existing.code = at.code ?? (nameToCode.get(name) ?? null);
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
    examsQuery.data?.find((e) => e.id === examId) ?? null, 
    [examsQuery.data, examId]
  );

  const filteredAttempts = useMemo(() => {
    const rows = attemptsQuery.data ?? [];
    return rows.filter((attempt) => {
      if (studentFilter && !String(attempt.student_name || "").toLowerCase().includes(studentFilter.toLowerCase())) {
        return false;
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
    { key: "student", label: "Student",  },
    { key: "time", label: "Time", width: "20vw" },
    { key: "score", label: "Score", width: "15vw", align: "center" as const },
    { key: "ip", label: "IP Address", width: "10vw" },
    { key: "actions", label: "Actions", width: "10vw" },
  ];

  // Columns for aggregated ALL view: Student + one column per exam title
  const columnsAll = useMemo(() => {
    const exams = examsQuery.data ?? [];
    return [
      { key: "student", label: "Student" },
      ...exams.map((ex) => ({ key: `exam_${ex.id}`, label: ex.title, align: "center" as const })),
    ];
  }, [examsQuery.data]);

  const renderCell = (attempt: Attempt, column: any) => {
    switch (column.key) {
      case "student":
        return attempt.student_name || <span className="text-gray-400">Anonymous</span>;
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
            {scoreVal}%
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
                className={`px-3 py-2 rounded-lg border text-sm transition ${
                  examId === ALL
                    ? 'bg-blue-600 text-white border-blue-600 shadow'
                    : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Select All
              </button>
              {(examsQuery.data ?? []).map((exam) => (
                <button
                  key={exam.id}
                  type="button"
                  onClick={() => setExamId(exam.id)}
                  className={`px-3 py-2 rounded-lg border text-sm transition ${
                    examId === exam.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow'
                      : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span>{exam.title}</span>
                  {exam.status === 'published' && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">
                      Published
                    </span>
                  )}
                </button>
              ))}
              {(!examsQuery.isLoading && (examsQuery.data ?? []).length === 0) && (
                <span className="text-sm text-gray-500">No exams found</span>
              )}
            </div>
          </div>
          
          {selectedExam && (
            <div className="flex items-center gap-3">
              <StatusBadge status={selectedExam.status as any} size="sm" />
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                {selectedExam.access_type}
              </span>
            </div>
          )}
        </div>

        {examId && examId !== ALL && (
          <div className="flex items-center gap-3 mt-4 pt-4 border-t">
            <ActionButton
              variant="secondary"
              onClick={handleRegradeAll}
              loading={regradingAll}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6M5 19A9 9 0 0119 5" />
                </svg>
              }
            >
              Regrade All Attempts
            </ActionButton>
            <Link href={`/admin/results/analysis/${examId}`}>
              <ActionButton
                variant="secondary"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
              >
                View Analysis
              </ActionButton>
            </Link>
            <ActionButton
              variant="secondary"
              onClick={handleExportCsv}
              loading={exportingCsv}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            >
              Export CSV
            </ActionButton>
            <ActionButton
              variant="secondary"
              onClick={handleExportXlsx}
              loading={exportingXlsx}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            >
              Export Excel
            </ActionButton>
          </div>
        )}

        {examId === ALL && (
          <div className="flex items-center gap-3 mt-4 pt-4 border-t">
            <ActionButton
              variant="secondary"
              onClick={handleExportAllCsv}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            >
              Export CSV (All)
            </ActionButton>
            <ActionButton
              variant="secondary"
              onClick={handleExportAllXlsx}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            >
              Export Excel (All)
            </ActionButton>
          </div>
        )}
      </ModernCard>

      {/* Filters (single exam only) */}
      {examId && examId !== ALL && (
        <ModernCard>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Student Name
              </label>
              <SearchInput
                placeholder="Filter by student name"
                value={studentFilter}
                onChange={setStudentFilter}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort by Score
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={scoreSort}
                onChange={(e) => setScoreSort(e.target.value as any)}
              >
                <option value="none">None</option>
                <option value="desc">Highest first</option>
                <option value="asc">Lowest first</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <ActionButton
                variant="secondary"
                onClick={clearFilters}
                className="w-full"
              >
                Clear Filters
              </ActionButton>
            </div>
          </div>
          
          {(studentFilter || startDate || endDate) && (
            <div className="mt-4 pt-4 border-t text-sm text-gray-600">
              Showing {filteredAttempts.length} of {attemptsQuery.data?.length || 0} attempts
            </div>
          )}
        </ModernCard>
      )}

      {/* Results Table */}
      {!examId && (
        <ModernCard>
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select an Exam</h3>
            <p className="text-gray-600">Choose an exam from the buttons above to view student results</p>
          </div>
        </ModernCard>
      )}

      {examId && examId !== ALL && (
        <ModernTable
          columns={columns}
          data={sortedAttempts}
          renderCell={renderCell}
          loading={attemptsQuery.isLoading}
          emptyMessage={
            attemptsQuery.data?.length === 0
              ? "No attempts found for this exam"
              : "No attempts match your current filters"
          }
        />
      )}

      {examId === ALL && (
        <ModernTable
          columns={columnsAll}
          data={(allAttemptsQuery.data?.rows || []).map((r: any) => r)}
          renderCell={(row: any, col: any) => {
            if (col.key === 'student') return row.name;
            if (col.key.startsWith('exam_')) {
              const exId = col.key.slice(5);
              const v = row.scores?.[exId];
              return v == null ? '-' : (
                <span className={`font-semibold ${
                  v >= 80 ? 'text-green-600' : v >= 60 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {Math.round(v * 100) / 100}%
                </span>
              );
            }
            return null;
          }}
          loading={allAttemptsQuery.isLoading}
          emptyMessage={
            allAttemptsQuery.data?.rows?.length ? undefined : 'No attempts found across exams'
          }
        />
      )}

      {examId && examId !== ALL && attemptsQuery.error && (
        <ModernCard>
          <div className="text-center text-red-600">
            <p className="font-semibold">Error loading attempts</p>
            <p className="text-sm mt-1">{(attemptsQuery.error as any).message}</p>
          </div>
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
                <h3 className="text-lg font-medium text-gray-900">
                  Delete Attempt
                </h3>
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