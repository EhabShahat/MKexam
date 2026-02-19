"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/components/ToastProvider";
import { downloadArabicCSV, getBilingualHeader, formatArabicNumber } from "@/lib/exportUtils";

interface HistoryWeeks {
  label: string;
  startDate: string; // YYYY-MM-DD
}

interface HistoryStudentRow {
  student_id: string;
  code: string;
  student_name: string | null;
  weeklyCounts: number[];
  total: number;
  lastAttendedAt?: string | null;
}

interface HistoryResponse {
  weeks: HistoryWeeks[];
  students: HistoryStudentRow[];
  nonAttendees: {
    last2Weeks: { id: string; code: string; student_name: string | null }[];
    lastMonth: { id: string; code: string; student_name: string | null }[];
    threePlusMonths: { id: string; code: string; student_name: string | null }[];
  }
}

export default function AttendanceHistoryPage() {
  const toast = useToast();
  const { data, isLoading } = useQuery<HistoryResponse>({
    queryKey: ["admin", "attendance", "history"],
    queryFn: async () => {
      const res = await authFetch("/api/admin/attendance?action=history&weeks=100");
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Load failed");
      return j as HistoryResponse;
    },
  });

  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "attendance">("attendance");
  const [showTemplate, setShowTemplate] = useState(false);

  const rows = data?.students || [];
  const weeks = data?.weeks || [];

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = rows;
    if (term) {
      list = rows.filter((s) => [s.code, s.student_name].map((v) => (v || "").toLowerCase()).some((v) => v.includes(term)));
    }
    if (sortBy === "attendance") {
      list = [...list].sort((a, b) => (b.total - a.total) || (a.student_name || "").localeCompare(b.student_name || ""));
    } else {
      list = [...list].sort((a, b) => (a.student_name || "").localeCompare(b.student_name || ""));
    }
    return list;
  }, [rows, q, sortBy]);

  // Students directory for contacts
  const { data: studentsData } = useQuery({
    queryKey: ["admin", "students", "global"],
    queryFn: async () => {
      const res = await authFetch("/api/admin/students");
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Load failed");
      return (j.students as Array<{ student_id: string; code: string; student_name: string | null; mobile_number?: string | null; mobile_number2?: string | null }>);
    },
  });
  const studentsById = useMemo(() => {
    const map = new Map<string, { name: string | null; code: string; mobile?: string | null; mobile2?: string | null }>();
    (studentsData || []).forEach((s) => map.set(s.student_id, { name: s.student_name || null, code: s.code, mobile: s.mobile_number || null, mobile2: s.mobile_number2 || null }));
    return map;
  }, [studentsData]);

  const [whatsTemplate, setWhatsTemplate] = useState("اغابي {name}، حضرتك بقالك فترة مش بتيجي، فحبين نطمن عليك.");

  function formatWhatsappNumber(raw?: string | null): string | null {
    if (!raw) return null;
    const digits = String(raw).replace(/\D/g, "");
    return digits || null;
  }

  function openWhatsAppFor(id: string) {
    const s = studentsById.get(id);
    const mobile = formatWhatsappNumber(s?.mobile) || formatWhatsappNumber(s?.mobile2);
    if (!mobile) { toast.error("No mobile number"); return; }
    const msg = (whatsTemplate || "").replace("{name}", s?.name || "").replace("{code}", s?.code || "");
    const url = `https://wa.me/${mobile}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  function callNumberFor(id: string) {
    const s = studentsById.get(id);
    const mobile = formatWhatsappNumber(s?.mobile) || formatWhatsappNumber(s?.mobile2);
    if (!mobile) { toast.error("No mobile number"); return; }
    window.open(`tel:${mobile}`);
  }

  // Compute per-day (column) totals across ALL rows, then show only columns with any records
  const columnCounts = useMemo(() => {
    return weeks.map((_, i) => rows.reduce((sum, r) => sum + (r.weeklyCounts[i] || 0), 0));
  }, [weeks, rows]);

  const visibleIndices = useMemo(() => {
    return columnCounts.map((c, i) => [c, i] as const).filter(([c]) => c > 0).map(([, i]) => i);
  }, [columnCounts]);

  const visibleHeaders = useMemo(() => {
    return visibleIndices.map((i) => `${formatDayLabel(weeks[i]?.startDate)} (${columnCounts[i] || 0})`);
  }, [visibleIndices, weeks, columnCounts]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">History</h1>
          <p className="text-gray-500">View attendance records by week</p>
        </div>

      {/* Non-Attendees cards */}
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700">Non-Attendees</h2>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded hover:bg-gray-100" title="Edit WhatsApp message template" onClick={() => setShowTemplate((v) => !v)}>
              <svg className="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 8c-2.21 0-4 1.79-4 4m9 7h3m-6 0h.01M4 4l16 16M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </button>
          </div>
        </div>
        {showTemplate && (
          <div className="mb-3 bg-white border border-gray-200 rounded-xl p-3">
            <label className="block text-xs text-gray-500 mb-1">WhatsApp template (use {`{name}`}, {`{code}`})</label>
            <input className="input w-full" value={whatsTemplate} onChange={(e) => setWhatsTemplate(e.target.value)} />
          </div>
        )}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <DisclosureCard
            title={`Last 2 Weeks (${data?.nonAttendees.last2Weeks.length || 0})`}
            items={data?.nonAttendees.last2Weeks || []}
            onWhatsApp={openWhatsAppFor}
            onCall={callNumberFor}
          />
          <DisclosureCard
            title={`Last Month (${data?.nonAttendees.lastMonth.length || 0})`}
            items={data?.nonAttendees.lastMonth || []}
            onWhatsApp={openWhatsAppFor}
            onCall={callNumberFor}
          />
          <DisclosureCard
            title={`3+ Months (${data?.nonAttendees.threePlusMonths.length || 0})`}
            items={data?.nonAttendees.threePlusMonths || []}
            onWhatsApp={openWhatsAppFor}
            onCall={callNumberFor}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="max-w-6xl mx-auto bg-white border border-gray-200 rounded-xl shadow-sm p-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Search with icon */}
          <div className="relative w-full sm:w-96">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="11" cy="11" r="7" strokeWidth="2" />
              <path d="M20 20l-3.5-3.5" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input className="input w-full pl-9" placeholder="Search by name or ID..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          {/* Sort + Export */}
          <div className="flex items-center gap-2">
            {/* Segmented sort control */}
            <div className="inline-flex items-stretch rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
              <button
                className={`px-3 py-2 text-sm ${sortBy === 'attendance' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-white'}`}
                onClick={() => setSortBy('attendance')}
                title="Sort by attendance"
              >
                <span className="inline-flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="2" strokeLinecap="round" d="M4 18h4M4 14h8M4 10h12M4 6h16"/></svg>
                  Attendance
                </span>
              </button>
              <button
                className={`px-3 py-2 text-sm border-l border-gray-200 ${sortBy === 'name' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-white'}`}
                onClick={() => setSortBy('name')}
                title="Sort by name"
              >
                <span className="inline-flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="2" strokeLinecap="round" d="M7 20h10M8 16h8M9 12h6M10 8h4M11 4h2"/></svg>
                  Name
                </span>
              </button>
            </div>

            <button className="btn bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => exportCSV(visibleHeaders, filtered, visibleIndices)}>
              <span className="inline-flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 4h16v12H4z"/><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M8 20h8M12 16v4"/></svg>
               Export
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-[92vw] lg:max-w-7xl mx-auto overflow-x-auto">
        <table className="min-w-[400px] w-full bg-white rounded-xl border border-gray-200 overflow-hidden">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name (Attendance)</th>
              {visibleHeaders.map((label, idx) => (
                <th key={visibleIndices[idx]} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 whitespace-nowrap">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={1 + visibleIndices.length} className="p-6 text-center text-gray-500">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={1 + visibleIndices.length} className="p-6 text-center text-gray-500">No data</td></tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.student_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="font-medium">{s.student_name || '-'}</div>
                    <div className="text-xs text-gray-500">{
                      (() => {
                        const visTotal = visibleIndices.reduce((sum, i) => sum + (s.weeklyCounts[i] || 0), 0);
                        return `${s.code} (${visTotal}/${visibleIndices.length})`;
                      })()
                    }</div>
                  </td>
                  {visibleIndices.map((i) => {
                    const v = s.weeklyCounts[i] || 0;
                    return (
                      <td key={i} className="px-3 py-2 text-center">
                        {v > 0 ? <span className="text-emerald-600 font-semibold">✓</span> : <span className="text-gray-400">✗</span>}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}

function DisclosureCard({ title, items, onWhatsApp, onCall }: { title: string; items: { id: string; code: string; student_name: string | null }[]; onWhatsApp: (id: string) => void; onCall: (id: string) => void; }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow">
      <button className="w-full flex items-center justify-between px-4 py-3" onClick={() => setOpen((o) => !o)}>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" /></svg>
          <div className="font-medium text-gray-900">{title}</div>
        </div>
        <svg className={`w-5 h-5 text-gray-500 transition-transform ${open ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
      </button>
      {open && (
        <div className="max-h-64 overflow-auto border-t border-gray-100">
          {items.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No people in this group</div>
          ) : (
            <ul className="divide-y">
              {items.map((it) => (
                <li key={it.id} className="px-4 py-2 text-sm flex items-center justify-between gap-2">
                  <div className="truncate">
                    <div>{it.student_name || '-'}</div>
                    <div className="text-gray-500 text-xs">{it.code}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-1.5 rounded hover:bg-gray-100" onClick={() => onWhatsApp(it.id)} title="WhatsApp message" aria-label="WhatsApp message">
                      <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="currentColor"><path d="M20.52 3.48A11.86 11.86 0 0012 0C5.37 0 0 5.37 0 12c0 2.12.56 4.18 1.63 6.02L0 24l6.13-1.6A11.87 11.87 0 0012 24c6.63 0 12-5.37 12-12 0-3.2-1.25-6.21-3.48-8.52zM12 22a9.9 9.9 0 01-5.03-1.38l-.36-.21-3.6.94.96-3.51-.23-.37A9.94 9.94 0 012 12C2 6.49 6.49 2 12 2s10 4.49 10 10-4.49 10-10 10zm5.03-6.93c-.28-.14-1.64-.81-1.89-.9-.25-.09-.44-.14-.63.14-.19.28-.72.9-.88 1.08-.16.18-.33.2-.6.07-.28-.14-1.19-.44-2.26-1.4-.84-.75-1.41-1.67-1.57-1.95-.16-.28-.02-.43.12-.57.12-.12.28-.33.42-.49.14-.16.19-.28.28-.47.09-.19.05-.36-.02-.51-.07-.14-.63-1.53-.86-2.09-.23-.55-.46-.48-.63-.49l-.54-.01c-.19 0-.5.07-.76.36-.26.28-.99.97-.99 2.36s1.02 2.74 1.16 2.92c.14.18 2.01 3.06 4.86 4.3.68.29 1.21.47 1.62.6.68.22 1.29.19 1.77.12.54-.08 1.64-.67 1.87-1.31.23-.63.23-1.17.16-1.29-.07-.12-.25-.19-.53-.33z"/></svg>
                    </button>
                    <button className="p-1.5 rounded hover:bg-gray-100" onClick={() => onCall(it.id)} title="Call" aria-label="Call">
                      <svg className="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.12.89.3 1.76.54 2.61a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.47-1.47a2 2 0 012.11-.45c.85.24 1.72.42 2.61.54A2 2 0 0122 16.92z"/></svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function exportCSV(headers: string[], rows: HistoryStudentRow[], visibleIndices: number[]) {
  // Create bilingual headers
  const csvHeaders = [
    getBilingualHeader("Code"),
    getBilingualHeader("Student Name"),
    ...headers, // Keep week headers as-is
    getBilingualHeader("Total")
  ];

  // Prepare data with Arabic formatting
  const data = rows.map((r) => {
    const visTotal = visibleIndices.reduce((sum, i) => sum + (r.weeklyCounts[i] || 0), 0);
    const weekAttendance = visibleIndices.map((i) => ((r.weeklyCounts[i] || 0) > 0 ? "حضر / Present" : "غائب / Absent"));
    
    return [
      r.code,
      r.student_name || "",
      ...weekAttendance,
      formatArabicNumber(visTotal)
    ];
  });

  // Use Arabic-compatible export
  downloadArabicCSV({
    filename: "attendance_history",
    headers: csvHeaders,
    data,
    includeTimestamp: true,
    rtlSupport: true
  });
}

function formatDayLabel(dateStr?: string) {
  if (!dateStr) return "";
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    if (isNaN(d.getTime())) return dateStr;
    const month = d.toLocaleString("en-US", { month: "short" });
    const day = d.getDate();
    return `${month}-${day}`;
  } catch {
    return dateStr;
  }
}
