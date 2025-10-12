"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import ModernCard from "@/components/admin/ModernCard";
import ActionButton from "@/components/admin/ActionButton";
import { useToast } from "@/components/ToastProvider";
import { authFetch } from "@/lib/authFetch";

interface ExtraField {
  id?: string;
  key: string;
  label: string;
  type: "number" | "text" | "boolean";
  order_index?: number | null;
  hidden?: boolean;
  include_in_pass?: boolean;
  pass_weight?: number;
  max_points?: number | null;
  bool_true_points?: number;
  bool_false_points?: number;
  text_score_map?: Record<string, number>;
}


interface AppSettings {
  result_message_hidden?: boolean;
  result_pass_calc_mode?: "best" | "avg";
  result_overall_pass_threshold?: number;
  result_exam_weight?: number;
  result_message_pass?: string | null;
  result_message_fail?: string | null;
  result_exam_score_source?: 'final' | 'raw';
  result_fail_on_any_exam?: boolean;
}

interface ExamConfigItem {
  id: string;
  title: string;
  status: string;
  order_index: number | null;
  hidden: boolean;
  include_in_pass: boolean;
}

export default function ExtraScoresAdminPage() {
  const toast = useToast();
  const qc = useQueryClient();

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [codeColumn, setCodeColumn] = useState<string>("code");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  // Fields state
  const fieldsQuery = useQuery({
    queryKey: ["admin", "extra-fields"],
    queryFn: async () => {
      const res = await authFetch("/api/admin/extra-scores/fields");
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to load fields");
      const items = (j.items as ExtraField[]) || [];
      return items.sort((a, b) =>
        (a.order_index ?? 0) - (b.order_index ?? 0) || a.label.localeCompare(b.label)
      );
    },
  });

  // Exams: load and edit
  const examsQuery = useQuery<ExamConfigItem[]>({
    queryKey: ["admin", "extra-exams"],
    queryFn: async () => {
      const res = await authFetch("/api/admin/extra-scores/exams");
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to load exams");
      const items = (j.items as ExamConfigItem[]) || [];
      return items.sort((a, b) => (a.order_index ?? 9999) - (b.order_index ?? 9999) || a.title.localeCompare(b.title));
    },
  });
  const [editExams, setEditExams] = useState<ExamConfigItem[]>([]);
  useEffect(() => {
    if (examsQuery.data) setEditExams(examsQuery.data);
  }, [examsQuery.data]);

  function moveExam(index: number, dir: -1 | 1) {
    setEditExams((prev) => {
      const arr = prev.slice();
      const j = index + dir;
      if (j < 0 || j >= arr.length) return prev;
      const t = arr[index];
      arr[index] = arr[j];
      arr[j] = t;
      return arr.map((e, i) => ({ ...e, order_index: i }));
    });
  }

  const saveExamsMutation = useMutation({
    mutationFn: async (updates: ExamConfigItem[]) => {
      const payload = updates.map((e, i) => ({ exam_id: e.id, hidden: e.hidden, include_in_pass: e.include_in_pass, order_index: i }));
      const res = await authFetch("/api/admin/extra-scores/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: payload }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Save exams failed");
      return j;
    },
    onSuccess: () => {
      toast.success({ title: "Saved", message: "Exam settings updated" });
      qc.invalidateQueries({ queryKey: ["admin", "extra-exams"] });
    },
    onError: (e: any) => toast.error({ title: "Save failed", message: e?.message || "Unknown error" }),
  });
  const [editFields, setEditFields] = useState<ExtraField[]>([]);
  useEffect(() => {
    if (fieldsQuery.data) setEditFields(fieldsQuery.data);
  }, [fieldsQuery.data]);
  const [openConfigKey, setOpenConfigKey] = useState<string | null>(null);
  const [configModalField, setConfigModalField] = useState<ExtraField | null>(null);
  const [textValues, setTextValues] = useState<Record<string, string[]>>({});
  const [loadingValuesKey, setLoadingValuesKey] = useState<string | null>(null);

  // Auto-sync attendance and assessment types data when page loads
  useEffect(() => {
    const syncAllOnLoad = async () => {
      try {
        console.log("Starting auto-sync attendance...");
        const attendanceRes = await authFetch("/api/admin/extra-scores/sync-attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fieldKey: "attendance_percentage" }),
        });
        
        if (attendanceRes.ok) {
          const attendanceData = await attendanceRes.json();
          console.log("Auto-sync attendance successful:", attendanceData);
        } else {
          const errorData = await attendanceRes.json();
          console.error("Auto-sync attendance failed:", errorData);
        }

        // Auto-sync homework and quiz fields
        console.log("Starting auto-sync homework and quiz...");
        const assessmentRes = await authFetch("/api/admin/extra-scores/sync-exam-tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedTags: ["homework", "quiz"] }),
        });
        
        if (assessmentRes.ok) {
          const assessmentData = await assessmentRes.json();
          console.log("Auto-sync homework and quiz successful:", assessmentData);
        } else {
          const errorData = await assessmentRes.json();
          console.error("Auto-sync homework and quiz failed:", errorData);
        }
        
        // Refresh fields after syncing all
        qc.invalidateQueries({ queryKey: ["admin", "extra-fields"] });
      } catch (error) {
        console.error("Auto-sync error:", error);
      }
    };

    // Delay auto-sync slightly to ensure other queries are loaded first
    const timer = setTimeout(syncAllOnLoad, 1000);
    return () => clearTimeout(timer);
  }, [qc]);

  async function loadTextValues(fieldKey: string) {
    try {
      setLoadingValuesKey(fieldKey);
      const res = await authFetch(`/api/admin/extra-scores/fields/values?key=${encodeURIComponent(fieldKey)}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to load values");
      setTextValues((prev) => ({ ...prev, [fieldKey]: (j.values as string[]) || [] }));
    } catch (e: any) {
      toast.error({ title: "Load failed", message: e?.message || "Unknown error" });
    } finally {
      setLoadingValuesKey(null);
    }
  }

  // Settings state
  const settingsQuery = useQuery<AppSettings | null>({
    queryKey: ["admin", "settings", "extra"],
    queryFn: async () => {
      const res = await authFetch("/api/admin/settings");
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to load settings");
      return (j.item as any) || null;
    },
  });
  const [settingsDraft, setSettingsDraft] = useState<AppSettings | null>(null);
  useEffect(() => {
    if (settingsQuery.data !== undefined) setSettingsDraft(settingsQuery.data);
  }, [settingsQuery.data]);

  function detectDefaultCodeColumn(hs: string[]) {
    const lowered = hs.map((h) => h.toLowerCase());
    const candidates = ["code", "student_code", "exam_code", "student id", "studentid", "id"];
    const idx = lowered.findIndex((h) => candidates.includes(h));
    if (idx >= 0) return hs[idx];
    return hs[0] || "code";
  }

  async function parseSelectedFile(f: File) {
    setParsing(true);
    try {
      const ext = f.name.toLowerCase().split(".").pop();
      if (ext === "csv") {
        const text = await f.text();
        const parsed = Papa.parse<Record<string, any>>(text, { header: true, skipEmptyLines: true });
        const items = (parsed.data || []).filter(Boolean);
        const hs = parsed.meta.fields || Object.keys(items[0] || {});
        setRows(items);
        setHeaders(hs);
        setCodeColumn(detectDefaultCodeColumn(hs));
      } else if (ext === "xlsx" || ext === "xls") {
        const buf = await f.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const items = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
        const hs = Object.keys(items[0] || {});
        setRows(items);
        setHeaders(hs);
        setCodeColumn(detectDefaultCodeColumn(hs));
      } else {
        toast.error({ title: "Unsupported file", message: "Please upload a CSV or XLSX file" });
      }
    } catch (e: any) {
      toast.error({ title: "Parse failed", message: e?.message || "Unknown error" });
    } finally {
      setParsing(false);
    }
  }

  const importMutation = useMutation({
    mutationFn: async ({ payload }: { payload: { rows: any[]; codeColumn: string } }) => {
      const res = await authFetch("/api/admin/extra-scores/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Import failed");
      return j;
    },
    onSuccess: (j) => {
      toast.success({ title: "Import complete", message: `Upserted ${j.upserted} students, created ${j.fields_created} fields` });
      qc.invalidateQueries({ queryKey: ["admin", "extra-fields"] });
      setRows([]);
      setHeaders([]);
      setFile(null);
    },
    onError: (e: any) => toast.error({ title: "Import failed", message: e?.message || "Unknown error" }),
  });

  function moveField(index: number, dir: -1 | 1) {
    setEditFields((prev) => {
      const arr = prev.slice();
      const j = index + dir;
      if (j < 0 || j >= arr.length) return prev;
      const t = arr[index];
      arr[index] = arr[j];
      arr[j] = t;
      return arr.map((f, i) => ({ ...f, order_index: i }));
    });
  }

  const saveFieldsMutation = useMutation({
    mutationFn: async (updates: ExtraField[]) => {
      const res = await authFetch("/api/admin/extra-scores/fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Save fields failed");
      return j;
    },
    onSuccess: () => {
      toast.success({ title: "Saved", message: "Fields updated" });
      qc.invalidateQueries({ queryKey: ["admin", "extra-fields"] });
    },
    onError: (e: any) => toast.error({ title: "Save failed", message: e?.message || "Unknown error" }),
  });

  const deleteFieldMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await authFetch(`/api/admin/extra-scores/fields?key=${encodeURIComponent(key)}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Delete failed");
      return j;
    },
    onSuccess: (j: any) => {
      const count = Number(j?.updated_count ?? 0);
      toast.success({ title: "Deleted", message: `Field removed from ${count} student${count === 1 ? '' : 's'}` });
      setOpenConfigKey(null);
      qc.invalidateQueries({ queryKey: ["admin", "extra-fields"] });
    },
    onError: (e: any) => toast.error({ title: "Delete failed", message: e?.message || "Unknown error" }),
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (payload: Partial<AppSettings>) => {
      const res = await authFetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Save settings failed");
      return j;
    },
    onSuccess: () => {
      toast.success({ title: "Saved", message: "Settings updated" });
      qc.invalidateQueries({ queryKey: ["admin", "settings", "extra"] });
    },
    onError: (e: any) => toast.error({ title: "Save failed", message: e?.message || "Unknown error" }),
  });


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Extra Scores
              </h1></div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="text-sm font-medium text-emerald-700">
                  Score Manager
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* File Upload Section */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <h2 className="text-lg font-semibold text-gray-800">Data Import</h2>
            <div className="ml-auto text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
              CSV / XLSX
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-3">Select File</label>
              <div className="relative">
                <input
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setFile(f);
                    setRows([]);
                    setHeaders([]);
                    if (f) parseSelectedFile(f);
                  }}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                />
                {file && (
                  <div className="absolute top-2 right-2 bg-green-100 text-green-700 px-2 py-1 rounded-md text-xs font-medium">
                    {file.name}
                  </div>
                )}
              </div>
              {parsing && (
                <div className="flex items-center gap-2 mt-3 text-sm text-blue-600">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Parsing file...
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">
                CSV, XLSX, XLS.
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Student Code Column</label>
              <select
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                value={codeColumn}
                onChange={(e) => setCodeColumn(e.target.value)}
                disabled={headers.length === 0}
              >
                {headers.length === 0 ? (
                  <option>Select file first</option>
                ) : (
                  headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))
                )}
              </select>
            </div>
          </div>

          {rows.length > 0 && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Data Preview</h3>
                    <p className="text-sm text-gray-600">Showing {Math.min(5, rows.length)} of {rows.length} rows</p>
                  </div>
                </div>
                <ActionButton
                  variant="primary"
                  onClick={() => importMutation.mutate({ payload: { rows, codeColumn } })}
                  loading={importMutation.isPending}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Import {rows.length} rows
                </ActionButton>
              </div>
              
              <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gradient-to-r from-gray-100 to-gray-200">
                      <tr>
                        {headers.slice(0, 8).map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-gray-700 font-semibold whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                        {headers.length > 8 && (
                          <th className="px-4 py-3 text-left text-gray-500 font-medium">
                            +{headers.length - 8} more...
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {rows.slice(0, 5).map((r, i) => (
                        <tr key={i} className="hover:bg-gray-100 transition-colors">
                          {headers.slice(0, 8).map((h) => (
                            <td key={h} className="px-4 py-3 whitespace-nowrap text-gray-800">
                              {String(r[h] ?? "")}
                            </td>
                          ))}
                          {headers.length > 8 && (
                            <td className="px-4 py-3 text-gray-400 text-xs">...</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Exam Management Section */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg">
          <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                <h2 className="text-lg font-semibold text-gray-800">Exam Configuration</h2>
              </div>
              <ActionButton
                variant="primary"
                onClick={() => saveExamsMutation.mutate(editExams.map((e, i) => ({ ...e, order_index: i })))}
                loading={saveExamsMutation.isPending}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save
              </ActionButton>
            </div>
          </div>
          
          <div className="p-6">
            {examsQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <svg className="w-8 h-8 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="ml-3 text-gray-600">Loading exams...</span>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gradient-to-r from-gray-100 to-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-gray-700 font-semibold">Order</th>
                        <th className="px-4 py-3 text-left text-gray-700 font-semibold">Exam Title</th>
                        <th className="px-4 py-3 text-center text-gray-700 font-semibold">Visible</th>
                        <th className="px-4 py-3 text-center text-gray-700 font-semibold">Include in Pass Calculation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {editExams.map((e, i) => (
                        <tr key={e.id} className="hover:bg-gray-100 transition-colors">
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="flex flex-col gap-1">
                                <button
                                  onClick={() => moveExam(i, -1)}
                                  disabled={i === 0}
                                  className="w-6 h-6 flex items-center justify-center bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs font-bold transition-colors"
                                >
                                  ↑
                                </button>
                                <button
                                  onClick={() => moveExam(i, 1)}
                                  disabled={i === editExams.length - 1}
                                  className="w-6 h-6 flex items-center justify-center bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs font-bold transition-colors"
                                >
                                  ↓
                                </button>
                              </div>
                              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                                <span className="text-indigo-700 font-semibold text-sm">{i + 1}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-medium text-gray-900">{e.title}</div>
                            <div className="text-xs text-gray-500 mt-1">ID: {e.id}</div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <label className="inline-flex items-center">
                              <input
                                type="checkbox"
                                checked={!e.hidden}
                                onChange={(ev) => setEditExams((prev) => prev.map((x, idx) => idx === i ? { ...x, hidden: !ev.target.checked } : x))}
                                className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 focus:ring-2"
                              />
                              <span className="ml-2 text-sm text-gray-600">Show</span>
                            </label>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <label className="inline-flex items-center">
                              <input
                                type="checkbox"
                                checked={!!e.include_in_pass}
                                onChange={(ev) => setEditExams((prev) => prev.map((x, idx) => idx === i ? { ...x, include_in_pass: ev.target.checked } : x))}
                                className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 focus:ring-2"
                              />
                              <span className="ml-2 text-sm text-gray-600">Include</span>
                            </label>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Field Management Section */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg">
          <div className="px-6 py-4 bg-gradient-to-r from-orange-50 to-red-50 border-b border-orange-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h2 className="text-lg font-semibold text-gray-800">Fields</h2>
                <div className="ml-2 text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                  {editFields.length}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ActionButton
                  variant="secondary"
                  onClick={async () => {
                    try {
                      console.log("Manual sync attendance...");
                      const attendanceRes = await authFetch("/api/admin/extra-scores/sync-attendance", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ fieldKey: "attendance_percentage" }),
                      });
                      
                      console.log("Manual sync homework and quiz...");
                      const assessmentRes = await authFetch("/api/admin/extra-scores/sync-exam-tags", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ selectedTags: ["homework", "quiz"] }),
                      });
                      
                      if (attendanceRes.ok && assessmentRes.ok) {
                        const attendanceData = await attendanceRes.json();
                        const assessmentData = await assessmentRes.json();
                        console.log("Manual sync successful:", { attendanceData, assessmentData });
                        toast.success({ 
                          title: "All Fields Synced", 
                          message: `Updated attendance, homework, and quiz scores for all students` 
                        });
                        qc.invalidateQueries({ queryKey: ["admin", "extra-fields"] });
                      } else {
                        let errorMessage = "Unknown error";
                        if (!attendanceRes.ok) {
                          const errorData = await attendanceRes.json();
                          errorMessage = errorData.error || "Attendance sync failed";
                        } else if (!assessmentRes.ok) {
                          const errorData = await assessmentRes.json();
                          errorMessage = errorData.error || "Assessment types sync failed";
                        }
                        console.error("Manual sync failed:", errorMessage);
                        toast.error({ title: "Sync failed", message: errorMessage });
                      }
                    } catch (error: any) {
                      console.error("Manual sync error:", error);
                      toast.error({ title: "Sync failed", message: error?.message || "Unknown error" });
                    }
                  }}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync
                </ActionButton>
                <ActionButton
                  variant="primary"
                  onClick={() => saveFieldsMutation.mutate(editFields.map((f, i) => ({ ...f, order_index: i })))}
                  loading={saveFieldsMutation.isPending}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save
                </ActionButton>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            {fieldsQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <svg className="w-8 h-8 animate-spin text-orange-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="ml-3 text-gray-600">Loading fields...</span>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gradient-to-r from-gray-100 to-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-gray-700 font-semibold">Order</th>
                        <th className="px-4 py-3 text-left text-gray-700 font-semibold">Key</th>
                        <th className="px-4 py-3 text-right text-gray-700 font-semibold">Actions</th>
                      </tr>
                    </thead>
              <tbody>
                {editFields.map((f, i) => (
                  <Fragment key={f.key}>
                  <tr key={f.key} className="odd:bg-white even:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <ActionButton 
                          variant="secondary" 
                          size="sm" 
                          onClick={() => moveField(i, -1)} 
                          disabled={i === 0}
                        >
                          ↑
                        </ActionButton>
                        <ActionButton 
                          variant="secondary" 
                          size="sm" 
                          onClick={() => moveField(i, 1)} 
                          disabled={i === editFields.length - 1}
                        >
                          ↓
                        </ActionButton>
                        <span className="ml-2 text-gray-500">{i + 1}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600 font-mono">
                      <div className="flex items-center gap-2">
                        {f.key}
                        {['attendance_percentage', 'exam_type_homework', 'exam_type_quiz'].includes(f.key)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Configuration Gear Button */}
                        <ActionButton
                          variant="secondary"
                          size="sm"
                          onClick={() => setConfigModalField(f)}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </ActionButton>
                        
                        {/* Delete Button or SYS Badge */}
                        {['attendance_percentage', 'exam_type_homework', 'exam_type_quiz'].includes(f.key) ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            SYS
                          </span>
                        ) : (
                          <ActionButton
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              if (confirm(`Delete field "${f.label}" (${f.key})? This will permanently remove this key from ALL students' extra_scores data and delete the field. This cannot be undone.`)) {
                                deleteFieldMutation.mutate(f.key);
                              }
                            }}
                            loading={deleteFieldMutation.isPending}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </ActionButton>
                        )}
                      </div>
                    </td>
                  </tr>
                  </Fragment>
                ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>


        {/* Settings Section */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg">
          <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <h2 className="text-lg font-semibold text-gray-800">Pass/Fail Configuration</h2>
              </div>
              <ActionButton
                variant="primary"
                onClick={() => settingsDraft && saveSettingsMutation.mutate(settingsDraft)}
                loading={saveSettingsMutation.isPending}
                disabled={!settingsDraft}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save
              </ActionButton>
            </div>
          </div>
          
          <div className="p-6">
            {!settingsDraft ? (
              <div className="flex items-center justify-center py-8">
                <svg className="w-8 h-8 animate-spin text-purple-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="ml-3 text-gray-600">Loading settings...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Exam Score Source</label>
                  <select
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    value={settingsDraft?.result_exam_score_source || 'final'}
                    onChange={(e) => settingsDraft && setSettingsDraft({ ...settingsDraft, result_exam_score_source: e.target.value as any })}
                  >
                    <option value="final">Final Score (with manual grading)</option>
                    <option value="raw">Raw Auto Score</option>
                  </select></div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Calculation Mode</label>
                  <select
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    value={settingsDraft?.result_pass_calc_mode || "best"}
                    onChange={(e) => settingsDraft && setSettingsDraft({ ...settingsDraft, result_pass_calc_mode: e.target.value as any })}
                  >
                    <option value="best">Best Exam Score</option>
                    <option value="avg">Average Exam Score</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Overall Pass Threshold (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    value={Number(settingsDraft?.result_overall_pass_threshold ?? 60)}
                    onChange={(e) => settingsDraft && setSettingsDraft({ ...settingsDraft, result_overall_pass_threshold: Number(e.target.value) })}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Exam Weight</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    value={Number(settingsDraft?.result_exam_weight ?? 1)}
                    onChange={(e) => settingsDraft && setSettingsDraft({ ...settingsDraft, result_exam_weight: Number(e.target.value) })}
                  />
                </div>
                
                <div className="md:col-span-2 space-y-4">
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <label className="flex items-center gap-3">
                      <input
                        id="failAny"
                        type="checkbox"
                        checked={!!settingsDraft?.result_fail_on_any_exam}
                        onChange={(e) => settingsDraft && setSettingsDraft({ ...settingsDraft, result_fail_on_any_exam: e.target.checked })}
                        className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 focus:ring-2"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-700">Strict Fail Rule</span></div>
                    </label>
                  </div>
                  
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <label className="flex items-center gap-3">
                      <input
                        id="msgHidden"
                        type="checkbox"
                        checked={!(settingsDraft?.result_message_hidden ?? false)}
                        onChange={(e) => settingsDraft && setSettingsDraft({ ...settingsDraft, result_message_hidden: !e.target.checked })}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-700">Show Pass/Fail Messages</span>
                        </div>
                    </label>
                  </div>
                </div>
                
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Pass Message</label>
                  <input
                    type="text"
                    placeholder="Congratulations! You have passed."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    value={settingsDraft?.result_message_pass ?? ""}
                    onChange={(e) => settingsDraft && setSettingsDraft({ ...settingsDraft, result_message_pass: e.target.value })}
                  />
                </div>
                
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Fail Message</label>
                  <input
                    type="text"
                    placeholder="Unfortunately, you did not meet the passing requirements."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                    value={settingsDraft?.result_message_fail ?? ""}
                    onChange={(e) => settingsDraft && setSettingsDraft({ ...settingsDraft, result_message_fail: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Field Configuration Modal */}
    {configModalField && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          {/* Modal Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <h3 className="text-xl font-semibold">Field Configuration</h3>
                {['attendance_percentage', 'exam_type_homework', 'exam_type_quiz'].includes(configModalField?.key || '') && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white">
                    SYSTEM
                  </span>
                )}
              </div>
              <button
                onClick={() => setConfigModalField(null)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
            {/* Field Info Card */}
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Field Key</label>
                  <div className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-600 font-mono text-sm">
                    {configModalField?.key}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Field Label</label>
                  <input
                    type="text"
                    value={configModalField?.label || ''}
                    onChange={(e) => {
                      if (!configModalField) return;
                      const updatedField = { ...configModalField, label: e.target.value };
                      setConfigModalField(updatedField);
                      setEditFields((prev) => prev.map((x) => x.key === configModalField.key ? updatedField : x));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Configuration Sections */}
            <div className="space-y-6">
              {/* Basic Settings */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                  </svg>
                  Basic Settings
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Field Type</label>
                    <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600">
                      <span className="capitalize">{configModalField?.type}</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Visibility</label>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={!(configModalField?.hidden ?? false)}
                        onChange={(e) => {
                          if (!configModalField) return;
                          const updatedField = { ...configModalField, hidden: !e.target.checked };
                          setConfigModalField(updatedField);
                          setEditFields((prev) => prev.map((x) => x.key === configModalField.key ? updatedField : x));
                        }}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <span className="ml-2 text-sm text-gray-700">Show in results</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Pass/Fail Calculation</label>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={!!(configModalField?.include_in_pass)}
                        onChange={(e) => {
                          if (!configModalField) return;
                          const updatedField = { ...configModalField, include_in_pass: e.target.checked };
                          setConfigModalField(updatedField);
                          setEditFields((prev) => prev.map((x) => x.key === configModalField.key ? updatedField : x));
                        }}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <span className="ml-2 text-sm text-gray-700">Include in pass/fail</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Scoring Settings */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Scoring Configuration
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Pass/Fail Weight</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={Number(configModalField?.pass_weight ?? 0)}
                      onChange={(e) => {
                        if (!configModalField) return;
                        const updatedField = { ...configModalField, pass_weight: Number(e.target.value) };
                        setConfigModalField(updatedField);
                        setEditFields((prev) => prev.map((x) => x.key === configModalField.key ? updatedField : x));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                    />
                    <p className="text-xs text-gray-500 mt-1">Weight in pass/fail calculation (0.0 - 1.0)</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Maximum Points</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="1000"
                      value={configModalField?.max_points == null ? 100 : Number(configModalField?.max_points || 100)}
                      onChange={(e) => {
                        if (!configModalField) return;
                        const updatedField = { ...configModalField, max_points: Number(e.target.value) };
                        setConfigModalField(updatedField);
                        setEditFields((prev) => prev.map((x) => x.key === configModalField.key ? updatedField : x));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                    />
                    <p className="text-xs text-gray-500 mt-1">Maximum possible points for this field</p>
                  </div>
                </div>
              </div>

              {/* Type-specific Configuration */}
              {configModalField?.type === 'boolean' && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Boolean Field Scoring
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">True Value Score</label>
                      <input
                        type="number"
                        step="1"
                        min={0}
                        max={100}
                        value={Number(configModalField?.bool_true_points ?? 100)}
                        onChange={(e) => {
                          if (!configModalField) return;
                          const updatedField = { ...configModalField, bool_true_points: Number(e.target.value) };
                          setConfigModalField(updatedField);
                          setEditFields((prev) => prev.map((x) => x.key === configModalField.key ? updatedField : x));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">False Value Score</label>
                      <input
                        type="number"
                        step="1"
                        min={0}
                        max={100}
                        value={Number(configModalField?.bool_false_points ?? 0)}
                        onChange={(e) => {
                          if (!configModalField) return;
                          const updatedField = { ...configModalField, bool_false_points: Number(e.target.value) };
                          setConfigModalField(updatedField);
                          setEditFields((prev) => prev.map((x) => x.key === configModalField.key ? updatedField : x));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              )}

              {configModalField?.type === 'text' && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Text Value Scoring
                    <ActionButton
                      variant="secondary"
                      size="sm"
                      onClick={() => configModalField && loadTextValues(configModalField.key)}
                      loading={loadingValuesKey === configModalField?.key}
                    >
                      Load Values
                    </ActionButton>
                  </h4>
                  
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Text Value</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Score (0-100)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {(() => {
                          const fetched = textValues[configModalField?.key || ''] || [];
                          const existing = Object.keys(configModalField?.text_score_map || {});
                          const all = Array.from(new Set([...fetched, ...existing])).sort((a, b) => a.localeCompare(b));
                          if (all.length === 0) {
                            return (
                              <tr>
                                <td className="px-4 py-8 text-gray-500 text-center" colSpan={2}>
                                  No values found yet. Try loading distinct values after importing data.
                                </td>
                              </tr>
                            );
                          }
                          return all.map((val) => (
                            <tr key={val} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-800">
                                {val || <span className="text-gray-400 italic">(empty)</span>}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={Number((configModalField?.text_score_map || {})[val] ?? 0)}
                                  onChange={(e) => {
                                    if (!configModalField) return;
                                    const num = Number(e.target.value);
                                    const updatedField = {
                                      ...configModalField,
                                      text_score_map: {
                                        ...(configModalField.text_score_map || {}),
                                        [val]: num
                                      }
                                    };
                                    setConfigModalField(updatedField);
                                    setEditFields((prev) => prev.map((x) => x.key === configModalField.key ? updatedField : x));
                                  }}
                                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-right focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                />
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
            <ActionButton
              variant="secondary"
              onClick={() => setConfigModalField(null)}
            >
              Close
            </ActionButton>
            <ActionButton
              variant="primary"
              onClick={() => {
                saveFieldsMutation.mutate(editFields.map((f, i) => ({ ...f, order_index: i })));
                setConfigModalField(null);
              }}
              loading={saveFieldsMutation.isPending}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save Changes
            </ActionButton>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
