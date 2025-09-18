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
  const [textValues, setTextValues] = useState<Record<string, string[]>>({});
  const [loadingValuesKey, setLoadingValuesKey] = useState<string | null>(null);

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Extra Scores</h1>
        <p className="text-gray-600">Upload and manage additional scoring like attendance and homework, and configure pass/fail summary.</p>
      </div>

      <ModernCard>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload CSV/XLSX</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Choose file</label>
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
              className="w-full"
            />
            {parsing && (
              <div className="text-sm text-gray-500 mt-2">Parsing file...</div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Code column</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={codeColumn}
              onChange={(e) => setCodeColumn(e.target.value)}
              disabled={headers.length === 0}
            >
              {headers.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        </div>

        {rows.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-600">Preview ({Math.min(5, rows.length)} of {rows.length} rows)</div>
              <ActionButton
                variant="primary"
                onClick={() => importMutation.mutate({ payload: { rows, codeColumn } })}
                loading={importMutation.isPending}
              >
                Import {rows.length} rows
              </ActionButton>
            </div>
            <div className="overflow-auto border border-gray-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {headers.slice(0, 8).map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-gray-700 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="odd:bg-white even:bg-gray-50">
                      {headers.slice(0, 8).map((h) => (
                        <td key={h} className="px-3 py-2 whitespace-nowrap text-gray-800">{String(r[h] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </ModernCard>

      <ModernCard>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Manage Exams</h2>
          <ActionButton
            variant="primary"
            onClick={() => saveExamsMutation.mutate(editExams.map((e, i) => ({ ...e, order_index: i })))}
            loading={saveExamsMutation.isPending}
          >
            Save Changes
          </ActionButton>
        </div>
        {examsQuery.isLoading ? (
          <div className="text-gray-500">Loading exams...</div>
        ) : (
          <div className="overflow-auto border border-gray-200 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Order</th>
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-center">Show</th>
                  <th className="px-3 py-2 text-center">Include in Pass</th>
                </tr>
              </thead>
              <tbody>
                {editExams.map((e, i) => (
                  <tr key={e.id} className="odd:bg-white even:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <ActionButton variant="secondary" size="sm" onClick={() => moveExam(i, -1)} disabled={i === 0}>↑</ActionButton>
                        <ActionButton variant="secondary" size="sm" onClick={() => moveExam(i, 1)} disabled={i === editExams.length - 1}>↓</ActionButton>
                        <span className="ml-2 text-gray-500">{i + 1}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-900">{e.title}</td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={!e.hidden}
                        onChange={(ev) => setEditExams((prev) => prev.map((x, idx) => idx === i ? { ...x, hidden: !ev.target.checked } : x))}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={!!e.include_in_pass}
                        onChange={(ev) => setEditExams((prev) => prev.map((x, idx) => idx === i ? { ...x, include_in_pass: ev.target.checked } : x))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ModernCard>

      <ModernCard>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Manage Fields</h2>
          <ActionButton
            variant="primary"
            onClick={() => saveFieldsMutation.mutate(editFields.map((f, i) => ({ ...f, order_index: i })))}
            loading={saveFieldsMutation.isPending}
          >
            Save Changes
          </ActionButton>
        </div>
        {fieldsQuery.isLoading ? (
          <div className="text-gray-500">Loading fields...</div>
        ) : (
          <div className="overflow-auto border border-gray-200 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Order</th>
                  <th className="px-3 py-2 text-left">Key</th>
                  <th className="px-3 py-2 text-left">Label</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-center">Show</th>
                  <th className="px-3 py-2 text-center">Include in Pass</th>
                  <th className="px-3 py-2 text-right">Weight</th>
                  <th className="px-3 py-2 text-right">Max Points</th>
                  <th className="px-3 py-2 text-left">Scoring</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {editFields.map((f, i) => (
                  <Fragment key={f.key}>
                  <tr key={f.key} className="odd:bg-white even:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <ActionButton variant="secondary" size="sm" onClick={() => moveField(i, -1)} disabled={i === 0}>↑</ActionButton>
                        <ActionButton variant="secondary" size="sm" onClick={() => moveField(i, 1)} disabled={i === editFields.length - 1}>↓</ActionButton>
                        <span className="ml-2 text-gray-500">{i + 1}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600 font-mono">{f.key}</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={f.label}
                        onChange={(e) => setEditFields((prev) => prev.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{f.type}</td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={!(f.hidden ?? false)}
                        onChange={(e) => setEditFields((prev) => prev.map((x, idx) => idx === i ? { ...x, hidden: !e.target.checked } : x))}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={!!f.include_in_pass}
                        onChange={(e) => setEditFields((prev) => prev.map((x, idx) => idx === i ? { ...x, include_in_pass: e.target.checked } : x))}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.1"
                        value={Number(f.pass_weight ?? 0)}
                        onChange={(e) => setEditFields((prev) => prev.map((x, idx) => idx === i ? { ...x, pass_weight: Number(e.target.value) } : x))}
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="1"
                        value={f.max_points == null ? 100 : Number(f.max_points)}
                        onChange={(e) => setEditFields((prev) => prev.map((x, idx) => idx === i ? { ...x, max_points: Number(e.target.value) } : x))}
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {f.type === 'boolean' ? (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-xs">True</span>
                          <input
                            type="number"
                            step="1"
                            min={0}
                            max={100}
                            value={Number(f.bool_true_points ?? 100)}
                            onChange={(e) => setEditFields((prev) => prev.map((x, idx) => idx === i ? { ...x, bool_true_points: Number(e.target.value) } : x))}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-right"
                          />
                          <span className="text-gray-500 text-xs">False</span>
                          <input
                            type="number"
                            step="1"
                            min={0}
                            max={100}
                            value={Number(f.bool_false_points ?? 0)}
                            onChange={(e) => setEditFields((prev) => prev.map((x, idx) => idx === i ? { ...x, bool_false_points: Number(e.target.value) } : x))}
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-right"
                          />
                        </div>
                      ) : f.type === 'text' ? (
                        <ActionButton
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setOpenConfigKey((k) => k === f.key ? null : f.key);
                            if (!textValues[f.key]) loadTextValues(f.key);
                          }}
                        >
                          {openConfigKey === f.key ? 'Hide' : 'Manage'}
                        </ActionButton>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
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
                        Delete
                      </ActionButton>
                    </td>
                  </tr>
                  {openConfigKey === f.key && f.type === 'text' && (
                    <tr className="bg-gray-50">
                      <td className="px-3 py-2" colSpan={10}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium text-gray-700">Configure text scores for "{f.label}"</div>
                          <div className="flex items-center gap-2">
                            <ActionButton
                              variant="secondary"
                              size="sm"
                              onClick={() => loadTextValues(f.key)}
                              loading={loadingValuesKey === f.key}
                            >
                              Load distinct values
                            </ActionButton>
                            <ActionButton
                              variant="primary"
                              size="sm"
                              onClick={() => saveFieldsMutation.mutate(editFields.map((x, idx) => ({ ...x, order_index: idx })))}
                              loading={saveFieldsMutation.isPending}
                            >
                              Save Changes
                            </ActionButton>
                          </div>
                        </div>
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <table className="min-w-full text-sm">
                            <thead className="bg-white">
                              <tr>
                                <th className="px-3 py-2 text-left">Value</th>
                                <th className="px-3 py-2 text-right">Score (0-100)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(() => {
                                const fetched = textValues[f.key] || [];
                                const existing = Object.keys(f.text_score_map || {});
                                const all = Array.from(new Set([...fetched, ...existing])).sort((a, b) => a.localeCompare(b));
                                if (all.length === 0) {
                                  return (
                                    <tr>
                                      <td className="px-3 py-4 text-gray-500" colSpan={2}>No values found yet. Try loading distinct values after importing data.</td>
                                    </tr>
                                  );
                                }
                                return all.map((val) => (
                                  <tr key={val} className="odd:bg-white even:bg-gray-50">
                                    <td className="px-3 py-2 text-gray-800">{val || <span className="text-gray-400">(empty)</span>}</td>
                                    <td className="px-3 py-2 text-right">
                                      <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={Number((f.text_score_map || {})[val] ?? 0)}
                                        onChange={(e) => {
                                          const num = Number(e.target.value);
                                          setEditFields((prev) => prev.map((x) => {
                                            if (x.key !== f.key) return x;
                                            const map = { ...(x.text_score_map || {}) };
                                            map[val] = num;
                                            return { ...x, text_score_map: map };
                                          }));
                                        }}
                                        className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
                                      />
                                    </td>
                                  </tr>
                                ));
                              })()}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ModernCard>

      <ModernCard>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Pass/Fail Summary Settings</h2>
          <ActionButton
            variant="primary"
            onClick={() => settingsDraft && saveSettingsMutation.mutate(settingsDraft)}
            loading={saveSettingsMutation.isPending}
            disabled={!settingsDraft}
          >
            Save Settings
          </ActionButton>
        </div>
        {!settingsDraft ? (
          <div className="text-gray-500">Loading settings...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exam Score Source</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={settingsDraft.result_exam_score_source || 'final'}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, result_exam_score_source: e.target.value as any })}
              >
                <option value="final">Final Score (with manual grading)</option>
                <option value="raw">Raw Auto Score</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Choose whether to use final_score_percentage (includes manual grades) or raw score_percentage for calculations and display.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Calculation Mode</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={settingsDraft.result_pass_calc_mode || "best"}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, result_pass_calc_mode: e.target.value as any })}
              >
                <option value="best">Best Exam Score</option>
                <option value="avg">Average Exam Score</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Overall Pass Threshold (%)</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={Number(settingsDraft.result_overall_pass_threshold ?? 60)}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, result_overall_pass_threshold: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exam Weight</label>
              <input
                type="number"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={Number(settingsDraft.result_exam_weight ?? 1)}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, result_exam_weight: Number(e.target.value) })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Fail Rule</label>
              <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg">
                <input
                  id="failAny"
                  type="checkbox"
                  checked={!!settingsDraft.result_fail_on_any_exam}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, result_fail_on_any_exam: e.target.checked })}
                />
                <label htmlFor="failAny" className="text-sm text-gray-700">Fail overall if any included exam fails its threshold</label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Show Pass/Fail Message on Public</label>
              <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg">
                <input
                  id="msgHidden"
                  type="checkbox"
                  checked={!(settingsDraft.result_message_hidden ?? false)}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, result_message_hidden: !e.target.checked })}
                />
                <label htmlFor="msgHidden" className="text-sm text-gray-700">Show message</label>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Pass Message</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={settingsDraft.result_message_pass ?? ""}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, result_message_pass: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Fail Message</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={settingsDraft.result_message_fail ?? ""}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, result_message_fail: e.target.value })}
              />
            </div>
          </div>
        )}
      </ModernCard>
    </div>
  );
}
