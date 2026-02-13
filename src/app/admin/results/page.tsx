"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/components/ToastProvider";
import { useSyncEngine } from "@/hooks/useSyncEngine";
import { downloadArabicCSV, getBilingualHeader, formatArabicNumber, formatArabicDate } from "@/lib/exportUtils";
import ModernCard from "@/components/admin/ModernCard";
import ModernTable from "@/components/admin/ModernTable";
import SearchInput from "@/components/admin/SearchInput";
import ActionButton from "@/components/admin/ActionButton";
import StatusBadge from "@/components/admin/StatusBadge";
import StatusFilter, { StatusFilterValue } from "@/components/admin/StatusFilter";
import { ExamTypeMicroBadge } from "@/components/admin/ExamTypeSelector";
import DeviceInfoCell from "@/components/admin/DeviceInfoCell";
import { getDeviceUsageCount, getUsageCountForDevice } from "@/lib/deviceUsage";
import { parseUserAgent } from "@/lib/userAgent";

interface Exam {
  id: string;
  title: string;
  status: string;
  access_type: string;
  exam_type?: 'exam' | 'homework' | 'quiz';
}

interface Attempt {
  id: string;
  student_id?: string;
  student_name: string | null;
  code?: string | null;
  completion_status: string | null;
  started_at: string | null;
  submitted_at: string | null;
  score_percentage: number | null;
  final_score_percentage?: number | null;
  ip_address: string | null;
  device_info?: string | null;
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
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("published");
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
  const [expandedBreakdown, setExpandedBreakdown] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const toast = useToast();

  // Sync engine hook for automatic sync on page load
  const { 
    syncStatus, 
    syncAll 
  } = useSyncEngine({
    autoSyncOnMount: true,
    autoSyncMaxAge: 30 // Auto-sync if data is older than 30 minutes
  });

  // Manual refresh function for All Exams view
  const handleRefreshAllExams = async () => {
    setRefreshing(true);
    try {
      // First sync the data to ensure it's up to date
      const syncResult = await syncAll();
      if (!syncResult.success) {
        console.warn('Sync failed during refresh:', syncResult.error);
      }

      // Then invalidate all relevant queries to force refetch
      await Promise.all([
        allAttemptsQuery.refetch(),
        summariesQuery.refetch(),
        extraFieldsQuery.refetch(),
        settingsQuery.refetch(),
        passExamsQuery.refetch(),
      ]);
      
      toast.success({ 
        title: "Refreshed", 
        message: syncResult.success 
          ? "Data synced and refreshed successfully" 
          : "Data refreshed (sync had issues)" 
      });
    } catch (error) {
      toast.error({ 
        title: "Refresh Failed", 
        message: error instanceof Error ? error.message : "Unknown error" 
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Load filter from sessionStorage on mount
  useEffect(() => {
    try {
      const savedFilter = sessionStorage.getItem('results-status-filter');
      
      // Validate saved filter value
      if (savedFilter !== null) {
        if (savedFilter === 'all' || savedFilter === 'published' || savedFilter === 'completed') {
          setStatusFilter(savedFilter as StatusFilterValue);
        } else {
          // Clear invalid value from storage
          console.warn(`Invalid filter value in sessionStorage: "${savedFilter}". Clearing.`);
          try {
            sessionStorage.removeItem('results-status-filter');
          } catch (clearError) {
            // Ignore errors when clearing
            console.debug('Failed to clear invalid filter from sessionStorage', clearError);
          }
        }
      }
    } catch (error) {
      // Ignore errors (e.g., if sessionStorage is not available)
      console.warn('Failed to load filter from sessionStorage:', error);
    }
  }, []);

  // Save filter to sessionStorage when it changes
  useEffect(() => {
    try {
      sessionStorage.setItem('results-status-filter', statusFilter);
    } catch (error) {
      // Ignore errors (e.g., if sessionStorage is not available)
      console.warn('Failed to save filter to sessionStorage:', error);
    }
  }, [statusFilter]);

  const examsQuery = useQuery({
    queryKey: ["admin", "exams", "all"],
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    queryFn: async () => {
      const res = await authFetch(`/api/admin/exams`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Load exams failed");
      return (j.items as Exam[])?.sort((a, b) => a.title.localeCompare(b.title));
    },
  });

  // Show all exams in results page (not just published/done)
  const visibleExams = useMemo(() =>
    (examsQuery.data ?? []).sort((a, b) => a.title.localeCompare(b.title)),
  [examsQuery.data]);

  // Apply status filter to visible exams
  const filteredVisibleExams = useMemo(() => {
    if (statusFilter === 'all') {
      return visibleExams;
    } else if (statusFilter === 'published') {
      return visibleExams.filter((e) => e.status === 'published');
    } else if (statusFilter === 'completed') {
      return visibleExams.filter((e) => e.status === 'done');
    }
    return visibleExams;
  }, [visibleExams, statusFilter]);

  // Show all visible exams (including quiz/homework) in the results page
  const visibleActualExams = useMemo(() =>
    visibleExams,
  [visibleExams]);

  const handleExportAllCsv = async () => {
    const exams = visibleActualExams;
    const fields = visibleExtraFields;
    const rows = filteredAllRows as Array<{ 
      name: string; 
      code: string | null; 
      scores: Record<string, number | null>; 
      summary?: { overall_score: number | null }; 
      calculation?: CalculationResult 
    }>;
    
    // Create comprehensive bilingual headers with score breakdown
    const headers = [
      getBilingualHeader("Student Name"),
      getBilingualHeader("Code"),
      
      // Individual exam scores
      ...exams.map((e) => `${e.title} - ${getBilingualHeader("Score")}`),
      
      // Extra field values
      ...fields.map((f) => `${f.label || f.key} - ${getBilingualHeader("Value")}`),
      
      // Extra field contributions (weighted)
      ...fields.map((f) => `${f.label || f.key} - ${getBilingualHeader("Contribution")}`),
      
      // Score components
      getBilingualHeader("Exam Component"),
      getBilingualHeader("Extra Component"),
      getBilingualHeader("Final Score"),
      getBilingualHeader("Calculation Mode"),
      getBilingualHeader("Pass Status"),
      getBilingualHeader("Failed Due to Exam"),
      getBilingualHeader("Exams Included"),
      getBilingualHeader("Exams Passed"),
    ];

    // Prepare data with Arabic formatting and detailed breakdown
    const data = rows.map((r) => {
      const rowData = r.code ? (extrasByCode.get(r.code) || {}) : {};
      const calc = r.calculation;
      
      // Individual exam scores
      const examsVals = exams.map((e) => {
        const v = r.scores?.[e.id];
        return v == null || Number.isNaN(Number(v)) ? "" : formatArabicNumber(Number(v));
      });
      
      // Extra field raw values
      const extraVals = fields.map((f) => {
        const v = (rowData as any)?.[f.key];
        if (v == null || v === "") return "";
        if (f.type === 'boolean') return v ? "نعم / Yes" : "لا / No";
        const n = Number(v);
        if (!Number.isNaN(n)) return formatArabicNumber(n);
        return String(v);
      });
      
      // Extra field weighted contributions
      const extraContributions = fields.map((f) => {
        if (!calc?.extraComponent?.details) return "";
        const detail = calc.extraComponent.details.find(d => d.fieldKey === f.key);
        return detail ? formatArabicNumber(detail.weightedContribution) : "";
      });
      
      // Score components
      const examComponent = calc?.examComponent?.score != null ? formatArabicNumber(calc.examComponent.score) : "";
      const extraComponent = calc?.extraComponent?.score != null ? formatArabicNumber(calc.extraComponent.score) : "";
      const finalScore = calc?.finalScore != null ? formatArabicNumber(calc.finalScore) : "";
      
      // Calculation metadata
      const calcMode = calc?.examComponent?.mode === 'best' ? 
        "أفضل درجة / Best Score" : 
        calc?.examComponent?.mode === 'avg' ? "متوسط الدرجات / Average Score" : "";
      
      const passStatus = calc?.passed === true ? "نجح / Pass" : 
        calc?.passed === false ? "رسب / Fail" : "";
      
      const failedDueToExam = calc?.failedDueToExam ? "نعم / Yes" : "لا / No";
      
      const examsIncluded = calc?.examComponent ? 
        `${calc.examComponent.examsIncluded}/${calc.examComponent.examsTotal}` : "";
      
      const examsPassed = calc?.examComponent ? 
        `${calc.examComponent.examsPassed}/${calc.examComponent.examsTotal}` : "";
      
      return [
        r.name, 
        r.code ?? "", 
        ...examsVals, 
        ...extraVals, 
        ...extraContributions,
        examComponent,
        extraComponent,
        finalScore,
        calcMode,
        passStatus,
        failedDueToExam,
        examsIncluded,
        examsPassed
      ];
    });

    // Use Arabic-compatible export
    downloadArabicCSV({
      filename: "results_all_exams_detailed",
      headers,
      data,
      includeTimestamp: true,
      rtlSupport: true
    });
  };

  const handleExportAllXlsx = async () => {
    const XLSX = await import("xlsx");
    const exams = visibleActualExams;
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
    enabled: examId === ALL,
    queryKey: ["admin", "attempts", "ALL"],
    queryFn: async () => {
      const exams = visibleActualExams ?? [];
      const resultsByExam: Record<string, any[]> = {};
      
      // Fetch exam attempts if there are any actual exams
      if (exams.length > 0) {
        await Promise.all(
          exams.map(async (ex) => {
            const res = await authFetch(`/api/admin/exams/${ex.id}/attempts`);
            const j = await res.json();
            if (res.ok) resultsByExam[ex.id] = (j.items as any[]) || [];
            else resultsByExam[ex.id] = [];
          })
        );
      }
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
      
      // If there are no actual exams, create rows for all students from master list
      if (exams.length === 0) {
        try {
          const sRes = await authFetch(`/api/admin/students`);
          const sJson = await sRes.json();
          if (sRes.ok && Array.isArray(sJson?.students)) {
            for (const s of sJson.students) {
              const nm = (String(s?.student_name ?? "").trim()) || "";
              const cd = s?.code ? String(s.code) : null;
              const sid = s?.student_id ? String(s.student_id) : null;
              if (nm) {
                byStudent.set(nm, { name: nm, code: cd, student_id: sid, scores: {} });
              }
            }
          }
        } catch {}
      } else {
        // Normal aggregation when there are actual exams
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
      }
      // Return rows sorted by name
      const rows = Array.from(byStudent.values()).sort((a, b) => a.name.localeCompare(b.name));
      return { exams, rows };
    },
  });

  const attemptsQuery = useQuery({
    enabled: !!examId && examId !== ALL,
    queryKey: ["admin", "attempts", examId],
    staleTime: 0, // Always fetch fresh data
    gcTime: 0, // Don't cache
    queryFn: async () => {
      const res = await authFetch(`/api/admin/exams/${examId}/attempts`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Load attempts failed");
      // eslint-disable-next-line no-console
      console.log("FRONTEND: Received attempts, first item device_info:", j.items[0]?.device_info ? "HAS DATA" : "NULL");
      return j.items as Attempt[];
    },
  });

  // Calculate device usage counts for the current exam
  const deviceUsageMap = useMemo(() => {
    if (!attemptsQuery.data || examId === ALL) return new Map();
    return getDeviceUsageCount(attemptsQuery.data, examId);
  }, [attemptsQuery.data, examId]);

  // Auto-select a published exam by default
  useEffect(() => {
    if (!examId && examsQuery.data?.length) {
      const published = examsQuery.data.find((e) => e.status === "published");
      if (published) setExamId(published.id);
    }
  }, [examId, examsQuery.data]);

  const selectedExam = useMemo(() => 
    filteredVisibleExams.find((e) => e.id === examId) ?? null, 
    [filteredVisibleExams, examId]
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
      toast.success({ title: "اكتمل التصدير / Export Complete", message: "تم تحميل ملف CSV بنجاح / CSV file downloaded successfully" });
    } catch (e: any) {
      toast.error({ title: "فشل التصدير / Export Failed", message: e?.message || "خطأ غير معروف / Unknown error" });
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
      
      // Fetch stage progress for all attempts
      const stageProgressMap = new Map<string, any[]>();
      
      // Check if exam has stages by fetching analytics
      let hasStages = false;
      try {
        const analyticsRes = await authFetch(`/api/admin/exams/${examId}/analytics`);
        if (analyticsRes.ok) {
          const analyticsData = await analyticsRes.json();
          hasStages = analyticsData.analytics && analyticsData.analytics.length > 0;
        }
      } catch {
        // If analytics fetch fails, assume no stages
        hasStages = false;
      }
      
      // Fetch stage progress for each attempt if exam has stages
      if (hasStages) {
        await Promise.all(
          filteredAttempts.map(async (attempt) => {
            try {
              const res = await authFetch(`/api/admin/attempts/${attempt.id}/stage-progress`);
              if (res.ok) {
                const data = await res.json();
                stageProgressMap.set(attempt.id, data.stageProgress || []);
              }
            } catch {
              // If fetch fails, set empty array
              stageProgressMap.set(attempt.id, []);
            }
          })
        );
      }
      
      const rows = filteredAttempts.map((attempt) => {
        // Parse device info for export
        let deviceModel = 'Unknown';
        let deviceType = 'Unknown';
        let usageCount = 1;
        let localIP = '';
        let automationRisk = 'No';
        
        if (attempt.device_info) {
          try {
            const parsed = JSON.parse(attempt.device_info);
            
            // Extract enhanced device info
            if (parsed.friendlyName) {
              deviceModel = parsed.friendlyName;
            } else if (parsed.oem?.brand && parsed.oem?.model) {
              deviceModel = `${parsed.oem.brand} ${parsed.oem.model}`;
            } else {
              // Fall back to legacy parsing
              const deviceInfo = parsed.type ? parsed : parseUserAgent(parsed.userAgent || parsed.raw || '');
              deviceModel = `${deviceInfo.manufacturer} ${deviceInfo.model}`;
              deviceType = deviceInfo.type;
              usageCount = getUsageCountForDevice(deviceUsageMap, deviceInfo);
            }
            
            // Extract device type if not already set
            if (deviceType === 'Unknown' && parsed.type) {
              deviceType = parsed.type;
            }
            
            // Extract local IP
            if (parsed.allIPs?.local && parsed.allIPs.local.length > 0) {
              const ipv4Local = parsed.allIPs.local.find((ip: any) => ip.family === 'IPv4');
              localIP = ipv4Local?.ip || parsed.allIPs.local[0]?.ip || '';
            } else if (parsed.ips?.ips && parsed.ips.ips.length > 0) {
              const localIPs = parsed.ips.ips.filter((ip: any) => ip.type === 'local');
              const ipv4Local = localIPs.find((ip: any) => ip.family === 'IPv4');
              localIP = ipv4Local?.ip || localIPs[0]?.ip || '';
            }
            
            // Extract automation risk
            if (parsed.security?.automationRisk === true || parsed.security?.webdriver === true) {
              automationRisk = 'Yes';
            }
            
          } catch {
            // Keep defaults
          }
        }
        
        const baseRow: any = {
          id: attempt.id,
          student: attempt.student_name ?? "",
          code: attempt.code ?? "",
          status: attempt.completion_status ?? "",
          started_at: attempt.started_at ?? "",
          submitted_at: attempt.submitted_at ?? "",
          score_percentage: attempt.score_percentage ?? "",
          device_type: deviceType,
          device_model: deviceModel,
          local_ip: localIP,
          server_ip: attempt.ip_address ?? "",
          automation_risk: automationRisk,
          device_usage_count: usageCount > 1 ? usageCount : '',
        };
        
        // Add stage progress data if available
        const stageProgress = stageProgressMap.get(attempt.id);
        if (stageProgress && stageProgress.length > 0) {
          stageProgress.forEach((stage: any, index: number) => {
            const stageNum = index + 1;
            const stagePrefix = `stage_${stageNum}`;
            
            baseRow[`${stagePrefix}_type`] = stage.stage_type || '';
            baseRow[`${stagePrefix}_completed`] = stage.completed_at ? 'Yes' : 'No';
            baseRow[`${stagePrefix}_time_spent`] = stage.time_spent_seconds 
              ? `${Math.round(stage.time_spent_seconds)}s` 
              : '';
            
            // Video stage specific data
            if (stage.stage_type === 'video' && stage.watch_percentage !== null) {
              baseRow[`${stagePrefix}_watch_pct`] = `${Math.round(stage.watch_percentage)}%`;
            }
            
            // Content stage specific data
            if (stage.stage_type === 'content' && stage.slide_times) {
              const slideTimes = Object.values(stage.slide_times);
              const avgSlideTime = slideTimes.length > 0
                ? slideTimes.reduce((sum: number, time: any) => sum + Number(time), 0) / slideTimes.length
                : 0;
              baseRow[`${stagePrefix}_avg_slide_time`] = avgSlideTime > 0 
                ? `${Math.round(avgSlideTime)}s` 
                : '';
            }
            
            // Questions stage specific data
            if (stage.stage_type === 'questions' && stage.answered_count !== null) {
              baseRow[`${stagePrefix}_answered`] = `${stage.answered_count}/${stage.total_count || 0}`;
            }
          });
        }
        
        return baseRow;
      });
      
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Attempts");
      const title = (selectedExam?.title || "").trim();
      const baseName = title ? `attempts_${title}` : `attempts_${examId}`;
      const safeName = baseName.replace(/[\\/:*?"<>|]+/g, "_").trim();
      XLSX.writeFile(wb, `${safeName}.xlsx`);
      toast.success({ title: "Export Complete", message: "XLSX file saved successfully with stage progress" });
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
    { key: "student", label: "Student", width: "15vw", sortable: true, searchable: true },
    { key: "time", label: "Time", width: "20vw", sortable: true },
    { key: "score", label: "Score", width: "10vw", align: "center" as const, sortable: true },
    { key: "ip", label: "Device Info", width: "25vw", searchable: true },
    { key: "actions", label: "Actions", width: "10vw" },
  ];

  // Columns for aggregated ALL view: Student + one column per exam title
  // Load extra fields, settings, and exam config for ALL view
  const extraFieldsQuery = useQuery<ExtraField[]>({
    enabled: examId === ALL,
    queryKey: ["admin", "extra-fields"],
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
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

  // Build columns for ALL view: Student + each visible exam (only actual exams) + extra fields (not hidden) + Exam Component + Extra Component + Final
  const columnsAll = useMemo(() => {
    const exams = visibleActualExams;
    const extraCols = (extraFieldsQuery.data || []).filter((f) => !f.hidden).map((f) => ({ key: `extra_${f.key}`, label: f.label, align: "center" as const }));
    return [
      { key: "student", label: "Student", width: "15vw" },
      ...exams.map((ex) => ({ 
        key: `exam_${ex.id}`, 
        label: ex.title,
        align: "center" as const,
        renderHeader: () => (
          <div className="flex items-center justify-center gap-1">
            <span>{ex.title}</span>
            <ExamTypeMicroBadge type={ex.exam_type || "exam"} />
          </div>
        )
      })),
      ...extraCols,
      { key: "exam_component", label: "Exam Score", align: "center" as const },
      { key: "extra_component", label: "Extra Score", align: "center" as const },
      { key: "final", label: "Final", align: "center" as const },
    ];
  }, [visibleActualExams, extraFieldsQuery.data]);

  // Load summaries (extras + overall) for students present in aggregated ALL rows using existing public API
  const codesForAll = useMemo(() => {
    const rows = allAttemptsQuery.data?.rows || [];
    return Array.from(new Set((rows as any[]).map((r: any) => String(r.code || "")).filter((s) => s.length > 0)));
  }, [allAttemptsQuery.data]);

  // Import calculation types
  interface CalculationResult {
    success: boolean;
    error?: string;
    examComponent: {
      score: number | null;
      mode: 'best' | 'avg';
      examsIncluded: number;
      examsTotal: number;
      examsPassed: number;
      details: Array<{
        examId: string;
        examTitle: string;
        score: number;
        included: boolean;
        passed: boolean | null;
        passThreshold: number | null;
      }>;
    };
    extraComponent: {
      score: number | null;
      totalWeight: number;
      details: Array<{
        fieldKey: string;
        fieldLabel: string;
        rawValue: any;
        normalizedScore: number;
        weight: number;
        weightedContribution: number;
      }>;
    };
    finalScore: number | null;
    passed: boolean | null;
    passThreshold: number;
    failedDueToExam: boolean;
  }

  const summariesQuery = useQuery<{ code: string; calculation: CalculationResult; extras: Array<{ key: string; value: any }>; pass_summary: { overall_score: number | null; passed: boolean | null } }[]>({
    enabled: examId === ALL && codesForAll.length > 0,
    queryKey: ["admin", "summaries", codesForAll.join(",")],
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    queryFn: async () => {
      const out: { code: string; calculation: CalculationResult; extras: any[]; pass_summary: any }[] = [];
      const batchSize = 200;
      const totalBatches = Math.ceil(codesForAll.length / batchSize);
      
      for (let i = 0; i < codesForAll.length; i += batchSize) {
        const chunk = codesForAll.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        
        // Log progress for debugging
        console.log(`Fetching batch ${batchNum}/${totalBatches} (${chunk.length} students)`);
        
        const url = `/api/admin/summaries?codes=${encodeURIComponent(chunk.join(","))}`;
        const res = await authFetch(url);
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || "Failed to load summaries");
        out.push(...(((j?.items as any[]) || []).map((x: any) => ({ 
          code: x.code, 
          calculation: x.calculation || {
            success: false,
            examComponent: { score: null, mode: 'best', examsIncluded: 0, examsTotal: 0, examsPassed: 0, details: [] },
            extraComponent: { score: null, totalWeight: 0, details: [] },
            finalScore: null,
            passed: null,
            passThreshold: 50,
            failedDueToExam: false
          },
          extras: x.extras || [], 
          pass_summary: x.pass_summary || { overall_score: null, passed: null } 
        }))));
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
    const calculationByCode = new Map<string, CalculationResult>();
    for (const it of (summariesQuery.data || [])) {
      summaryByCode.set(it.code, it.pass_summary || { overall_score: null, passed: null });
      calculationByCode.set(it.code, it.calculation);
    }
    return rows.map((r) => ({ 
      ...r, 
      summary: summaryByCode.get(r.code || "") || { overall_score: null, passed: null },
      calculation: calculationByCode.get(r.code || "") || null
    }));
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
        // Get usage count for this device
        let usageCount: number | undefined;
        if (attempt.device_info) {
          try {
            const parsed = JSON.parse(attempt.device_info);
            const deviceInfo = parsed.type ? parsed : parseUserAgent(parsed.userAgent || parsed.raw || '');
            usageCount = getUsageCountForDevice(deviceUsageMap, deviceInfo);
          } catch {
            usageCount = undefined;
          }
        }
        
        return (
          <DeviceInfoCell 
            deviceInfo={attempt.device_info || null}
            ipAddress={attempt.ip_address}
            usageCount={usageCount}
          />
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card/80 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Exam Results
              </h1></div>
            <div className="flex items-center gap-3">
              <Link href="/admin/extra-scores">
                <ActionButton variant="secondary">Manage Extra Scores</ActionButton>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Exam Selection */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <h2 className="text-lg font-semibold text-gray-800">Select Exam</h2>
            <div className="ml-auto text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
              {filteredVisibleExams.length} available
            </div>
          </div>
          
          {/* Status Filter */}
          <div className="mb-4 flex justify-center">
            <StatusFilter value={statusFilter} onChange={setStatusFilter} />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setExamId(ALL)}
              className={`group relative p-4 rounded-xl border-2 transition-all duration-200 ${
                examId === ALL 
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-blue-500 shadow-lg transform scale-105' 
                  : 'bg-white text-gray-800 border-gray-200 hover:border-blue-300 hover:shadow-md hover:scale-102'
              }`}
            >
              <div className="flex items-center justify-center mb-2">
                <svg className={`w-6 h-6 ${examId === ALL ? 'text-white' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-4H3m16 8H5m14 4H3" />
                </svg>
              </div>
              <div className="text-center">
                <div className="font-semibold">All Exams</div>
                <div className={`text-xs mt-1 ${examId === ALL ? 'text-blue-100' : 'text-gray-500'}`}>
                  Aggregated view
                </div>
              </div>
              {examId === ALL && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
              )}
            </button>
            
            {filteredVisibleExams.map((exam) => (
              <button
                key={exam.id}
                type="button"
                onClick={() => setExamId(exam.id)}
                className={`group relative p-4 rounded-xl border-2 transition-all duration-200 ${
                  examId === exam.id 
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-blue-500 shadow-lg transform scale-105' 
                    : 'bg-white text-gray-800 border-gray-200 hover:border-blue-300 hover:shadow-md hover:scale-102'
                }`}
              >
                <div className="flex items-center justify-center mb-2">
                  <svg className={`w-6 h-6 ${examId === exam.id ? 'text-white' : 'text-indigo-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <div className="font-semibold text-sm leading-tight">{exam.title}</div>
                    <ExamTypeMicroBadge type={exam.exam_type || "exam"} />
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    {exam.status === 'published' && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        examId === exam.id 
                          ? 'bg-green-400 text-green-900' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        Published
                      </span>
                    )}
                    {exam.status === 'done' && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        examId === exam.id 
                          ? 'bg-gray-300 text-gray-800' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        Completed
                      </span>
                    )}
                    {exam.status === 'draft' && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        examId === exam.id 
                          ? 'bg-yellow-400 text-yellow-900' 
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        Draft
                      </span>
                    )}
                    {exam.status === 'archived' && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        examId === exam.id 
                          ? 'bg-red-400 text-red-900' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        Archived
                      </span>
                    )}
                  </div>
                </div>
                {examId === exam.id && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {examId === ALL ? (
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <h2 className="text-lg font-semibold text-gray-800">All Exams Overview</h2>
                  {summariesQuery.isFetching && (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Loading scores...</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 border border-green-200 rounded-full">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium text-green-700">
                      {passCounts.passed}/{passCounts.total} Passed
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Controls */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div className="flex-1 max-w-md">
                  <SearchInput placeholder="Search by name or code..." value={allSearch} onChange={setAllSearch} />
                </div>
                <div className="flex items-end gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Sort by Final Score</label>
                    <select 
                      className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" 
                      value={allScoreSort} 
                      onChange={(e) => setAllScoreSort(e.target.value as any)}
                    >
                      <option value="none">No sorting</option>
                      <option value="finalDesc">Highest first</option>
                      <option value="finalAsc">Lowest first</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <ActionButton 
                      variant="secondary" 
                      onClick={handleRefreshAllExams}
                      loading={refreshing || syncStatus.isLoading}
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh
                    </ActionButton>
                    <ActionButton variant="secondary" onClick={handleExportAllCsv}>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export CSV
                    </ActionButton>
                    <ActionButton variant="secondary" onClick={handleExportAllXlsx}>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export XLSX
                    </ActionButton>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Table */}
            <div className="overflow-x-auto">
              <ModernTable
                columns={columnsAll}
                data={sortedAllRows}
                renderCell={(row: any, col: any) => {
                  if (col.key === 'student') return (
                    <div className="flex flex-col">
                      <span className="font-medium">{row.name}</span>
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
              if (col.key === 'exam_component') {
                const calc = row.calculation as CalculationResult | null | undefined;
                const examScore = calc?.examComponent?.score;
                if (examScore == null) return '-';
                return (
                  <div className="flex flex-col items-center">
                    <span className="font-semibold text-blue-600">{Number(examScore).toFixed(2)}%</span>
                    <span className="text-xs text-gray-500">
                      {calc?.examComponent?.examsIncluded || 0}/{calc?.examComponent?.examsTotal || 0} exams
                    </span>
                  </div>
                );
              }
              if (col.key === 'extra_component') {
                const calc = row.calculation as CalculationResult | null | undefined;
                const extraScore = calc?.extraComponent?.score;
                if (extraScore == null) return '-';
                return (
                  <div className="flex flex-col items-center">
                    <span className="font-semibold text-purple-600">{Number(extraScore).toFixed(2)}%</span>
                    <span className="text-xs text-gray-500">
                      {calc?.extraComponent?.details?.length || 0} fields
                    </span>
                  </div>
                );
              }
              if (col.key === 'final') {
                const sm = row.summary as { overall_score: number | null; passed: boolean | null } | undefined;
                const calc = row.calculation as CalculationResult | null | undefined;
                const val = sm?.overall_score;
                const passed = sm?.passed;
                if (val == null || passed == null) return '-';
                
                // Show calculation mode indicator
                const mode = calc?.examComponent?.mode || 'best';
                const modeLabel = mode === 'best' ? 'Best' : 'Avg';
                const modeColor = mode === 'best' ? 'text-blue-600' : 'text-purple-600';
                const rowKey = `${row.code || row.name}`;
                const isExpanded = expandedBreakdown === rowKey;
                
                return (
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{Number(val).toFixed(2)}%</span>
                      <span className={`text-xs font-medium ${modeColor}`} title={`Calculation mode: ${modeLabel}`}>
                        [{modeLabel}]
                      </span>
                      {calc && (
                        <button
                          onClick={() => setExpandedBreakdown(isExpanded ? null : rowKey)}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                          title="Show calculation breakdown"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isExpanded ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                          </svg>
                        </button>
                      )}
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {passed ? 'Pass' : 'Fail'}
                    </span>
                    
                    {/* Expandable breakdown */}
                    {isExpanded && calc && (
                      <div className="absolute z-10 mt-2 w-96 bg-white border-2 border-blue-200 rounded-lg shadow-xl p-4 text-left">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-gray-900">Score Breakdown</h4>
                          <button
                            onClick={() => setExpandedBreakdown(null)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        
                        {/* Exam Component */}
                        <div className="mb-3 pb-3 border-b border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">Exam Component</span>
                            <span className="text-sm font-semibold text-blue-600">
                              {calc.examComponent.score != null ? `${calc.examComponent.score.toFixed(2)}%` : 'N/A'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600 space-y-1">
                            <div>Mode: <span className="font-medium">{calc.examComponent.mode === 'best' ? 'Best Score' : 'Average Score'}</span></div>
                            <div>Exams Included: <span className="font-medium">{calc.examComponent.examsIncluded}/{calc.examComponent.examsTotal}</span></div>
                            {calc.examComponent.details.filter(d => d.included).length > 0 && (
                              <div className="mt-2 space-y-1">
                                {calc.examComponent.details.filter(d => d.included).map((detail, idx) => (
                                  <div key={idx} className="flex justify-between items-center">
                                    <span className="truncate max-w-[200px]">{detail.examTitle}</span>
                                    <span className={`font-medium ${detail.passed === true ? 'text-green-600' : detail.passed === false ? 'text-red-600' : 'text-gray-600'}`}>
                                      {detail.score.toFixed(2)}%
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Extra Component */}
                        <div className="mb-3 pb-3 border-b border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">Extra Component</span>
                            <span className="text-sm font-semibold text-purple-600">
                              {calc.extraComponent.score != null ? `${calc.extraComponent.score.toFixed(2)}%` : 'N/A'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600 space-y-1">
                            <div>Total Weight: <span className="font-medium">{calc.extraComponent.totalWeight.toFixed(2)}</span></div>
                            {calc.extraComponent.details.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {calc.extraComponent.details.map((detail, idx) => (
                                  <div key={idx} className="flex justify-between items-center">
                                    <span className="truncate max-w-[150px]">{detail.fieldLabel}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-500">{detail.normalizedScore.toFixed(1)}%</span>
                                      <span className="font-medium text-purple-600">
                                        +{detail.weightedContribution.toFixed(2)}%
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Final Calculation */}
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Final Score</span>
                            <span className="text-sm font-bold text-gray-900">
                              {calc.finalScore != null ? `${calc.finalScore.toFixed(2)}%` : 'N/A'}
                            </span>
                          </div>
                          {calc.failedDueToExam && (
                            <div className="mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                              Failed due to exam requirement
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
              return null;
                }}
                loading={allAttemptsQuery.isLoading || extraFieldsQuery.isLoading || summariesQuery.isLoading || settingsQuery.isLoading || passExamsQuery.isLoading}
                emptyMessage={sortedAllRows.length ? undefined : 'No attempts found across exams'}
              />
            </div>
          </div>
        ) : (
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h2 className="text-lg font-semibold text-gray-800">Individual</h2>
                <div className="ml-auto text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                  {sortedAttempts.length} attempts
                </div>
              </div>
            </div>
            
            {/* Controls */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
                <div className="flex-1 max-w-md">
                  <SearchInput placeholder="Search student..." value={studentFilter} onChange={setStudentFilter} />
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                    <input 
                      type="date" 
                      className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                      value={startDate} 
                      onChange={(e) => setStartDate(e.target.value)} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                    <input 
                      type="date" 
                      className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                      value={endDate} 
                      onChange={(e) => setEndDate(e.target.value)} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Sort by Score</label>
                    <select 
                      className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                      value={scoreSort} 
                      onChange={(e) => setScoreSort(e.target.value as any)}
                    >
                      <option value="none">No sorting</option>
                      <option value="desc">Highest first</option>
                      <option value="asc">Lowest first</option>
                    </select>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {/* Mobile: Stack buttons in a grid */}
                    <div className="grid grid-cols-2 gap-2 sm:hidden">
                      <ActionButton variant="secondary" onClick={clearFilters} className="text-xs px-2 py-2">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Clear
                      </ActionButton>
                      <Link href={`/admin/results/analysis/${examId}`} className="block">
                        <ActionButton variant="secondary" className="w-full text-xs px-2 py-2">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          Analytics
                        </ActionButton>
                      </Link>
                      <ActionButton variant="secondary" onClick={handleExportCsv} loading={exportingCsv} className="text-xs px-2 py-2">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        CSV
                      </ActionButton>
                      <ActionButton variant="secondary" onClick={handleExportXlsx} loading={exportingXlsx} className="text-xs px-2 py-2">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        XLSX
                      </ActionButton>
                      <ActionButton variant="primary" onClick={handleRegradeAll} loading={regradingAll} className="text-xs px-2 py-2 col-span-2">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Regrade All
                      </ActionButton>
                    </div>

                    {/* Desktop: Horizontal layout */}
                    <div className="hidden sm:flex gap-2 flex-wrap">
                      <ActionButton variant="secondary" onClick={clearFilters}>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Clear
                      </ActionButton>
                      <Link href={`/admin/results/analysis/${examId}`}>
                        <ActionButton variant="secondary">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          Analytics
                        </ActionButton>
                      </Link>
                      <ActionButton variant="secondary" onClick={handleExportCsv} loading={exportingCsv}>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        CSV
                      </ActionButton>
                      <ActionButton variant="secondary" onClick={handleExportXlsx} loading={exportingXlsx}>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        XLSX
                      </ActionButton>
                      <ActionButton variant="primary" onClick={handleRegradeAll} loading={regradingAll}>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Regrade All
                      </ActionButton>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Table */}
            <div className="overflow-x-auto">
              <ModernTable
                columns={columns}
                data={sortedAttempts}
                renderCell={renderCell}
                loading={attemptsQuery.isLoading}
                emptyMessage={sortedAttempts.length ? undefined : 'No attempts found'}
                variant="default"
                sortable={true}
                selectable={false}
              />
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-2xl p-6 max-w-md w-full mx-4">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Attempt</h3>
                  <p className="text-sm text-gray-600 mt-1">This action cannot be undone</p>
                </div>
              </div>
              
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  Are you sure you want to delete this attempt? This will permanently remove all associated data including answers, scores, and submission history.
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
    </div>
  );
}