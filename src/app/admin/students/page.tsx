"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ModernCard from "@/components/admin/ModernCard";
import ModernTable from "@/components/admin/ModernTable";
import DataTable from "@/components/admin/DataTable";
import SearchInput from "@/components/admin/SearchInput";
import ActionButton from "@/components/admin/ActionButton";
import StatusBadge from "@/components/admin/StatusBadge";
import { useMemo, useState, useEffect, useRef, Fragment } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/components/ToastProvider";
import IdCardCanvas from "@/components/IdCard/IdCardCanvas";
import { useLocalNameDuplicateCheck, useLocalDuplicateCheck, DuplicateStudent } from "@/hooks/useLocalDuplicateCheck";

interface Student {
  student_id: string;
  code: string;
  student_name: string | null;
  mobile_number: string | null;
  mobile_number2?: string | null;
  address?: string | null;
  national_id?: string | null;
  photo_url?: string | null;
  created_at?: string;
  national_id_photo_url?: string | null;
  student_created_at: string;
  total_exams_attempted?: number;
  completed_exams?: number;
  in_progress_exams?: number;
}

export default function GlobalStudentsPage() {
  // Spinner style
  const spinnerStyle = `
    .spinner {
      border: 2px solid rgba(0, 0, 0, 0.1);
      border-left-color: currentColor;
      border-radius: 50%;
      display: inline-block;
      animation: spinner 0.75s linear infinite;
    }
    
    @keyframes spinner {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  
  const qc = useQueryClient();
  const toast = useToast();
  const [actionError, setActionError] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [isAddStudentExpanded, setIsAddStudentExpanded] = useState(false);
  // Modal state for showing ID card popup
  const [idCardStudentId, setIdCardStudentId] = useState<string | null>(null);
  // Edit modal state
  const [editModalStudent, setEditModalStudent] = useState<Student | null>(null);
  // Full-screen image viewer
  const [fullScreenImage, setFullScreenImage] = useState<{ url: string; title: string } | null>(null);
  // Expanded card details tracking
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  
  const toggleCardExpansion = (studentId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };
  
  // Function to send WhatsApp message
  function sendWhatsApp(student: any) {
    if (!student.mobile_number) {
      toast.error("No mobile number available for this student");
      return;
    }
    
    const template = settings?.whatsapp_default_template || "Hello {name}! Your exam code is: {code}";
    const message = template
      .replace("{code}", student.code || "")
      .replace("{name}", student.student_name || "");
    
    // Clean the mobile number (remove non-digits)
    const cleanNumber = student.mobile_number.replace(/\D/g, '');
    
    // Check if the number starts with a country code, if not add a default one
    const mobileNumber = cleanNumber.startsWith('+')
      ? cleanNumber
      : (cleanNumber.startsWith('0')
          ? cleanNumber.substring(1) // Remove leading zero if present
          : cleanNumber);
    
    const url = `https://wa.me/${mobileNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    toast.success("WhatsApp message prepared");
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "students", "global"],
    queryFn: async () => {
      const res = await authFetch("/api/admin/students");
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Load failed");
      return (j.students as Student[]) ?? [];
    },
  });

  // Reset attempts for a student (removes links in student_exam_attempts)
  const resetAttempts = useMutation({
    mutationFn: async ({ id, examId }: { id: string; examId?: string }) => {
      if (!id || id === 'undefined') {
        throw new Error("Invalid student ID");
      }
      setActionError(null);
      const res = await authFetch(`/api/admin/students/${id}/reset-attempts`, {
        method: "POST",
        body: examId ? JSON.stringify({ examId }) : undefined,
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Reset failed");
      return j as { deleted_count: number };
    },
    onSuccess: (result) => {
      setActionError(null);
      qc.invalidateQueries({ queryKey: ["admin", "students", "global"] });
      toast.success(`Reset ${result.deleted_count || 0} attempt link(s)`);
    },
    onError: (error: any) => {
      setActionError(error?.message || "Failed to reset attempts");
    },
  });

  const students = data ?? [];

  const selectedStudent = useMemo(() => {
    if (!idCardStudentId) return null;
    return students.find((s) => s.student_id === idCardStudentId) || null;
  }, [students, idCardStudentId]);

  // Fetch app settings to get WhatsApp template
  const { data: settingsData } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async (): Promise<any | null> => {
      const res = await authFetch("/api/admin/settings");
      const result = await res.json();
      if (!res.ok) return null;
      return result.item || null;
    },
  });

  useEffect(() => {
    setSettings(settingsData);
  }, [settingsData]);

  // Public settings for brand logo in ID Card
  const { data: publicSettings } = useQuery({
    queryKey: ["public", "settings"],
    queryFn: async () => {
      const res = await fetch("/api/public/settings");
      try {
        const j = await res.json();
        return j || {};
      } catch {
        return {} as any;
      }
    },
  });

  // Clear action error when data changes
  useEffect(() => {
    setActionError(null);
  }, [students]);

  // Allow closing modal with Escape key
  useEffect(() => {
    if (!idCardStudentId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIdCardStudentId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idCardStudentId]);



  // Filters and Pagination
  const [q, setQ] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return students;
    return students.filter((s) =>
      [s.student_name, s.mobile_number, s.mobile_number2, s.address, s.national_id, s.code]
        .map((v) => (v || "").toLowerCase())
        .some((v) => v.includes(term))
    );
  }, [students, q]);

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedStudents = filtered.slice(startIndex, endIndex);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [q]);

  // Add single student
  const [newName, setNewName] = useState("");
  const [newMobile, setNewMobile] = useState("");
  const [newMobile2, setNewMobile2] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newNationalId, setNewNationalId] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState<string>("");
  const [newPhotoError, setNewPhotoError] = useState<string>("");

  function handleNewPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Validate image type
    if (!file.type.startsWith("image/")) {
      setNewPhotoError("Please select a valid image file");
      return;
    }
    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setNewPhotoError("File size exceeds 5MB limit");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setNewPhotoPreview(String(ev.target?.result || ""));
      setNewPhotoFile(file);
      setNewPhotoError("");
    };
    reader.readAsDataURL(file);
  }

  function removeNewPhoto() {
    setNewPhotoFile(null);
    setNewPhotoPreview("");
    setNewPhotoError("");
  }
  
  // Local duplicate detection using existing student data
  const nameDuplicates = useLocalNameDuplicateCheck(newName, students || []);
  const fullDuplicates = useLocalDuplicateCheck({
    mobile_number: newMobile,
    national_id: newNationalId,
  }, students || []);
  const addStudent = useMutation({
    mutationFn: async () => {
      setActionError(null);
      let res: Response;
      if (newPhotoFile) {
        const fd = new FormData();
        fd.append("student_name", newName || "");
        fd.append("mobile_number", newMobile || "");
        fd.append("mobile_number2", newMobile2 || "");
        fd.append("address", newAddress || "");
        fd.append("national_id", newNationalId || "");
        if (newCode) fd.append("code", newCode);
        fd.append("user_photo", newPhotoFile);
        res = await fetch("/api/admin/students", {
          method: "POST",
          body: fd,
          credentials: "include",
        });
      } else {
        const payload = {
          student_name: newName || null,
          mobile_number: newMobile || null,
          mobile_number2: newMobile2 || null,
          address: newAddress || null,
          national_id: newNationalId || null,
          code: newCode || undefined,
        };
        res = await fetch("/api/admin/students", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include",
        });
      }
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Create failed");
      return j.student as Student;
    },
    onSuccess: () => {
      setNewName("");
      setNewMobile("");
      setNewMobile2("");
      setNewAddress("");
      setNewNationalId("");
      setNewCode("");
      setNewPhotoFile(null);
      setNewPhotoPreview("");
      setNewPhotoError("");

      setActionError(null);
      qc.invalidateQueries({ queryKey: ["admin", "students", "global"] });
    },
    onError: (error: any) => {
      setActionError(error?.message || "Failed to add student");
    },
  });

  // Row editing state
  const [edits, setEdits] = useState<Record<string, Partial<Student>>>({});
  function setEdit(id: string, patch: Partial<Student>) {
    setEdits((e) => ({ ...e, [id]: { ...(e[id] || {}), ...patch } }));
  }
  // Expanded rows state for showing detailed editor/actions
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const saveRow = useMutation({
    mutationFn: async ({ id, payload, photoFile, nationalIdPhotoFile }: { id: string; payload: any; photoFile?: File | null; nationalIdPhotoFile?: File | null }) => {
      if (!id || id === 'undefined') {
        throw new Error("Invalid student ID");
      }
      setActionError(null);
      
      let res: Response;
      // If files are included, use FormData
      if (photoFile || nationalIdPhotoFile) {
        const fd = new FormData();
        
        // Always include all text fields to ensure backend sees this as a valid update
        // even if only photos changed
        fd.append("student_name", payload.student_name || "");
        fd.append("mobile_number", payload.mobile_number || "");
        if (payload.mobile_number2) fd.append("mobile_number2", payload.mobile_number2);
        if (payload.address) fd.append("address", payload.address);
        if (payload.national_id) fd.append("national_id", payload.national_id);
        
        // Add photos
        if (photoFile) {
          fd.append("user_photo", photoFile);
        }
        if (nationalIdPhotoFile) {
          fd.append("national_id_photo", nationalIdPhotoFile);
        }
        
        res = await fetch(`/api/admin/students/${id}`, {
          method: "PATCH",
          body: fd,
          credentials: "include",
        });
      } else {
        res = await authFetch(`/api/admin/students/${id}`, { 
          method: "PATCH", 
          body: JSON.stringify(payload) 
        });
      }
      
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Update failed");
      return j.student as Student;
    },
    onSuccess: (_item, vars) => {
      setEdits((e) => ({ ...e, [vars.id]: {} }));
      setActionError(null);
      qc.invalidateQueries({ queryKey: ["admin", "students", "global"] });
    },
    onError: (error: any) => {
      setActionError(error?.message || "Failed to save student");
    },
  });

  const deleteRow = useMutation({
    mutationFn: async (id: string) => {
      if (!id || id === 'undefined') {
        throw new Error("Invalid student ID");
      }
      setActionError(null);
      const res = await authFetch(`/api/admin/students/${id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Delete failed");
      return j as { success: boolean; deleted_attempts?: number };
    },
    onSuccess: (j) => {
      setActionError(null);
      qc.invalidateQueries({ queryKey: ["admin", "students", "global"] });
      const n = Number(j?.deleted_attempts ?? 0);
      alert(`Deleted student and ${n} attempt(s)`);
    },
    onError: (error: any) => {
      setActionError(error?.message || "Failed to delete student");
    },
  });

  // Import
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<any[]>([]);

  async function handleFile(file: File) {
    setImportErrors([]);
    setPreview([]);
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith(".csv")) {
        const txt = await file.text();
        const rows = await parseCsv(txt);
        const mapped = mapRows(rows);
        setPreview(mapped);
      } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const buf = await file.arrayBuffer();
        const rows = await parseXlsx(buf);
        const mapped = mapRows(rows);
        setPreview(mapped);
      } else {
        setImportErrors(["Unsupported file type. Use CSV or XLSX."]);
      }
    } catch (e: any) {
      setImportErrors([e?.message || "Import failed"]);
    }
  }

  function mapRows(rows: any[][]) {
    // header: student_name,mobile_number,code,(optional) mobile_number2,address,national_id
    const [header, ...dataRows] = rows;
    if (!header) throw new Error("Empty file");
    const idx = (name: string) => header.findIndex((h: string) => String(h).trim().toLowerCase() === name);
    const ni = idx("student_name");
    const mi = idx("mobile_number");
    const ci = idx("code");
    const m2i = idx("mobile_number2");
    const ai = idx("address");
    const nidi = idx("national_id");
    if (mi < 0) throw new Error("Missing header: mobile_number");
    const out = [] as any[];
    for (const r of dataRows) {
      const student_name = ni >= 0 ? String(r[ni] ?? "").trim() || null : null;
      const mobile_number = String(r[mi] ?? "").trim();
      if (!mobile_number) continue;
      const code = ci >= 0 ? String(r[ci] ?? "").trim() || undefined : undefined;
      const mobile_number2 = m2i >= 0 ? String(r[m2i] ?? "").trim() || null : null;
      const address = ai >= 0 ? String(r[ai] ?? "").trim() || null : null;
      const national_id = nidi >= 0 ? String(r[nidi] ?? "").trim() || null : null;
      out.push({ student_name, mobile_number, code, mobile_number2, address, national_id });
    }
    return out;
  }

  async function commitImport() {
    if (!preview.length) return;
    const res = await authFetch("/api/admin/students/bulk", { 
      method: "POST", 
      body: JSON.stringify({ students: preview }) 
    });
    const j = await res.json();
    if (!res.ok) {
      setImportErrors([j?.error || "Bulk import failed"]);
      return;
    }
    setPreview([]);
    qc.invalidateQueries({ queryKey: ["admin", "students", "global"] });
    alert(`Imported ${j.created_count} students`);
  }

  async function parseCsv(text: string): Promise<any[][]> {
    try {
      const Papa = (await import("papaparse")).default;
      const res = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
      return [res.data[0] as any, ...res.data.slice(1)];
    } catch {
      const lines = text.split(/\r?\n/).filter(Boolean);
      const rows = lines.map((l) => l.split(","));
      return rows;
    }
  }

  async function parseXlsx(buf: ArrayBuffer): Promise<any[][]> {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      return rows;
    } catch (e) {
      throw new Error("Install 'xlsx' to import Excel files");
    }
  }

  if (isLoading) return (
    <div className="p-8 text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      <p className="mt-4 text-gray-600 font-medium">Loading students...</p>
    </div>
  );
  
  if (error) return (
    <div className="p-6">
      <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-6 shadow-sm">
        <div className="flex items-center">
          <svg className="w-6 h-6 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-red-800 font-semibold text-lg">Error loading students: {(error as any).message}</span>
        </div>
        <p className="text-red-700 mt-4 pl-9">
          Make sure you have run the database migration first. Check the RUN_MIGRATION_FIRST.md file for instructions.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <style jsx>{spinnerStyle}</style>
      
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Student 
              </h1></div>
            <div className="flex items-center gap-4">
              <Link 
                href="/admin/requests"
                className="flex items-center gap-2 px-4 py-2 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span className="text-sm font-medium text-orange-700">
                  View Requests
                </span>
              </Link>
              
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Action Error Display */}
        {actionError && (
          <div className="bg-red-50/90 backdrop-blur-sm border border-red-200/50 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-red-800 font-medium">Action Failed</p>
                  <p className="text-red-700 text-sm">{actionError}</p>
                </div>
              </div>
              <button 
                onClick={() => setActionError(null)}
                className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Search & Import Controls */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h2 className="text-lg font-semibold text-gray-800">Search & Import</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Students</label>
              <div className="relative">
                <input 
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-500" 
                  placeholder="Search by name, mobile, or code..." 
                  value={q} 
                  onChange={(e) => setQ(e.target.value)} 
                />
                {q && (
                  <button 
                    onClick={() => setQ("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            
            {/* Import */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Import File</label>
              <div className="relative">
                <input 
                  type="file" 
                  accept=".csv,.xlsx,.xls" 
                  onChange={(e) => e.target.files && handleFile(e.target.files[0])}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">CSV/XLSX</p>
            </div>
            
            
          </div>
          
          {importErrors.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-red-800">Import Errors</span>
              </div>
              <ul className="text-sm text-red-700 list-disc pl-5 space-y-1">
                {importErrors.map((er, i) => <li key={i}>{er}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* Add Student */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg overflow-visible">
          <div 
            className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100 cursor-pointer hover:from-green-100 hover:to-emerald-100 transition-colors"
            onClick={() => setIsAddStudentExpanded(!isAddStudentExpanded)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <h2 className="text-lg font-semibold text-gray-800">Add New Student</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  {isAddStudentExpanded ? 'Click to collapse' : 'Click to expand'}
                </span>
                <svg 
                  className={`w-5 h-5 text-gray-600 transition-transform duration-200 ${isAddStudentExpanded ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          
          {isAddStudentExpanded && (
            <div className="p-6 space-y-6 overflow-visible">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 overflow-visible">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
              <input 
                className={`w-full px-3 py-2 bg-gray-50 border rounded-lg focus:ring-2 focus:border-transparent transition-all ${
                  nameDuplicates.some(d => d.matchType === 'exact')
                    ? 'border-red-300 focus:ring-red-500' 
                    : nameDuplicates.length > 0
                    ? 'border-yellow-300 focus:ring-yellow-500'
                    : 'border-gray-200 focus:ring-green-500'
                }`}
                value={newName} 
                onChange={(e) => setNewName(e.target.value)} 
                placeholder="Student name"
              />
              
              {/* Floating Name Duplicates Dropdown */}
              {nameDuplicates.length > 0 && (
                <NameDuplicatesDropdown 
                  duplicates={nameDuplicates}
                  isLoading={false}
                  onSelectName={(selectedName) => setNewName(selectedName)}
                />
              )}
              
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">Mobile *</label>
              <input 
                className={`w-full px-3 py-2 bg-gray-50 border rounded-lg focus:ring-2 focus:border-transparent transition-all ${
                  fullDuplicates.some(d => d.reasons.some(r => r.includes('number'))) 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-200 focus:ring-green-500'
                }`}
                value={newMobile} 
                onChange={(e) => setNewMobile(e.target.value)} 
                placeholder="Mobile number"
                type="tel"
              />
              
              {/* Floating Mobile Duplicates Dropdown */}
              {fullDuplicates.some(d => d.reasons.some(r => r.includes('number'))) && (
                <MobileDuplicatesDropdown 
                  duplicates={fullDuplicates.filter(d => d.reasons.some(r => r.includes('number')))}
                  onSelectMobile={(selectedMobile) => setNewMobile(selectedMobile)}
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mobile 2</label>
              <input 
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" 
                value={newMobile2} 
                onChange={(e) => setNewMobile2(e.target.value)} 
                placeholder="Alternative mobile"
                type="tel"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
              <input 
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" 
                value={newAddress} 
                onChange={(e) => setNewAddress(e.target.value)} 
                placeholder="Address"
              />
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">National ID</label>
              <input 
                className={`w-full px-3 py-2 bg-gray-50 border rounded-lg focus:ring-2 focus:border-transparent transition-all ${
                  fullDuplicates.some(d => d.reasons.some(r => r.includes('national'))) 
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-200 focus:ring-green-500'
                }`}
                value={newNationalId} 
                onChange={(e) => setNewNationalId(e.target.value)} 
                placeholder="National ID"
              />
              
              {/* Floating National ID Duplicates Dropdown */}
              {fullDuplicates.some(d => d.reasons.some(r => r.includes('national'))) && (
                <NationalIdDuplicatesDropdown 
                  duplicates={fullDuplicates.filter(d => d.reasons.some(r => r.includes('national')))}
                  onSelectNationalId={(selectedId) => setNewNationalId(selectedId)}
                />
              )}
            </div>
            {/* Photo Upload */}
            <div className="xl:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Photo</label>
              <div className={`space-y-3 ${newPhotoError ? 'border border-red-300 rounded-xl p-3 bg-red-50' : ''}`}>
                {newPhotoPreview ? (
                  <div className="relative">
                    <img 
                      src={newPhotoPreview} 
                      alt="Photo preview" 
                      className="w-32 h-32 object-cover rounded-xl border-2 border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={removeNewPhoto}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-sm transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center">
                    <div className="text-center">
                      <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <p className="text-xs text-gray-500">No photo</p>
                    </div>
                  </div>
                )}
                <div>
                  <input
                    type="file"
                    id="new_user_photo"
                    accept="image/*"
                    onChange={handleNewPhotoChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="new_user_photo"
                    className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg font-medium transition-colors text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Upload Photo
                  </label>
                </div>
                {newPhotoError && (
                  <p className="text-red-600 text-sm font-medium">{newPhotoError}</p>
                )}
                <p className={`text-xs ${newPhotoError ? 'text-red-600' : 'text-gray-500'}`}>Max 5MB. JPG, PNG, GIF supported.</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Code</label>
              <div className="flex gap-2">
                <input 
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" 
                  value={newCode} 
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setNewCode(value);
                  }}
                  placeholder="1234"
                  maxLength={4}
                  inputMode="numeric"
                />
                <button 
                  className={`px-4 py-2 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                    (nameDuplicates.some(d => d.matchType === 'exact') || 
                     fullDuplicates.some(d => d.matchType === 'exact'))
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                  onClick={() => {
                    if (!newMobile.trim()) {
                      setActionError("Mobile number is required");
                      return;
                    }
                    const hasExactDuplicate = nameDuplicates.some(d => d.matchType === 'exact') ||
                                             fullDuplicates.some(d => d.matchType === 'exact');
                    if (hasExactDuplicate) {
                      if (!confirm("Exact duplicate found! Are you sure you want to add this student?")) {
                        return;
                      }
                    }
                    addStudent.mutate();
                  }} 
                  disabled={addStudent.isPending}
                >
                  {addStudent.isPending ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Adding...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {(nameDuplicates.some(d => d.matchType === 'exact') || 
                       fullDuplicates.some(d => d.matchType === 'exact')) ? 'Add Anyway' : 'Add'}
                    </>
                  )}
                </button>
              </div>
            </div>
              </div>
              
            </div>
          )}
        </div>

        {/* Students Table */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h2 className="text-lg font-semibold text-gray-800">Directory</h2>
              </div>
              <div className="flex items-center gap-3">
                
                {filtered.length > 0 && (
                  <div className="text-xs text-gray-500">
                     {startIndex + 1}-{Math.min(endIndex, filtered.length)} of {filtered.length}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Card Grid Layout */}
          <div className="p-4">
            {paginatedStudents.length === 0 && filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <p className="text-xl font-semibold text-gray-900 mb-2">No students found</p>
                <p className="text-sm text-gray-500">{q ? "Try a different search term" : "Add students to get started"}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {paginatedStudents.map((s) => {
                  const studentId = s.student_id;
                  return (
                    <div
                      key={studentId}
                      className="group bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all duration-300 overflow-hidden"
                    >
                      {/* Avatar Section */}
                      <div className="relative bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 px-6 pt-6 pb-4">
                        {/* Code Badge - Top Right */}
                        <div className="absolute top-3 right-3 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200">
                          <span className="text-sm font-bold text-gray-800 font-mono">#{s.code}</span>
                        </div>
                        
                        {/* Avatar - Centered & Clickable */}
                        <div className="flex justify-center">
                          {s.photo_url ? (
                            <button
                              type="button"
                              className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg hover:scale-110 hover:border-blue-400 transition-all duration-300 cursor-pointer"
                              onClick={() => setFullScreenImage({ url: s.photo_url as string, title: s.student_name || "Student Photo" })}
                              title="Click to view full size"
                            >
                              <img 
                                src={s.photo_url} 
                                alt={s.student_name || "Student"} 
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ) : (
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-200 to-indigo-300 border-4 border-white shadow-lg flex items-center justify-center">
                              <span className="text-3xl font-bold text-white">
                                {((s.student_name || "?").trim()[0] || "?").toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Content Section */}
                      <div className="px-4 py-4 space-y-3">
                        {/* Name */}
                        <div className="text-center">
                          <h3 className="font-semibold text-gray-900 text-base line-clamp-2 min-h-[3rem] flex items-center justify-center">
                            {s.student_name || "Unnamed Student"}
                          </h3>
                        </div>

                        {/* Info Toggle Button */}
                        <button
                          onClick={() => toggleCardExpansion(studentId)}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          <svg 
                            className={`w-4 h-4 transition-transform duration-200 ${expandedCards.has(studentId) ? 'rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          <span className="font-medium">
                            {expandedCards.has(studentId) ? 'Hide Details' : 'Show Details'}
                          </span>
                        </button>

                        {/* Collapsible Details Section */}
                        {expandedCards.has(studentId) && (
                          <div className="bg-gray-50 rounded-xl p-3 space-y-2 text-sm border border-gray-200">
                            {s.mobile_number && (
                              <div className="flex items-start gap-2">
                                <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-gray-500 mb-0.5">Mobile</p>
                                  <p className="text-gray-900 font-medium break-all">{s.mobile_number}</p>
                                </div>
                              </div>
                            )}
                            {s.mobile_number2 && (
                              <div className="flex items-start gap-2">
                                <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-gray-500 mb-0.5">Mobile 2</p>
                                  <p className="text-gray-900 font-medium break-all">{s.mobile_number2}</p>
                                </div>
                              </div>
                            )}
                            {s.address && (
                              <div className="flex items-start gap-2">
                                <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-gray-500 mb-0.5">Address</p>
                                  <p className="text-gray-900 font-medium break-words">{s.address}</p>
                                </div>
                              </div>
                            )}
                            {s.national_id && (
                              <div className="flex items-start gap-2">
                                <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                                </svg>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-gray-500 mb-0.5">National ID</p>
                                  <p className="text-gray-900 font-medium break-all">{s.national_id}</p>
                                </div>
                              </div>
                            )}
                            {s.student_created_at && (
                              <div className="flex items-start gap-2">
                                <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-gray-500 mb-0.5">Created</p>
                                  <p className="text-gray-900 font-medium">{new Date(s.student_created_at).toLocaleDateString()}</p>
                                </div>
                              </div>
                            )}
                            {(((s.total_exams_attempted ?? 0) > 0) || ((s.completed_exams ?? 0) > 0) || ((s.in_progress_exams ?? 0) > 0)) && (
                              <div className="flex items-start gap-2">
                                <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-gray-500 mb-0.5">Exam Stats</p>
                                  <div className="flex flex-wrap gap-2">
                                    {((s.total_exams_attempted ?? 0) > 0) && (
                                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                        {s.total_exams_attempted} Total
                                      </span>
                                    )}
                                    {((s.completed_exams ?? 0) > 0) && (
                                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                                        {s.completed_exams} Done
                                      </span>
                                    )}
                                    {((s.in_progress_exams ?? 0) > 0) && (
                                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                                        {s.in_progress_exams} In Progress
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                            {!s.mobile_number && !s.mobile_number2 && !s.address && !s.national_id && (
                              <p className="text-center text-gray-500 text-xs py-2">No additional details available</p>
                            )}
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2">
                          <button
                            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                            onClick={() => sendWhatsApp(s)}
                            disabled={!s.mobile_number}
                            title={s.mobile_number ? "Send code via WhatsApp" : "No mobile number"}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            WhatsApp
                          </button>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg text-white bg-purple-600 hover:bg-purple-700 transition-colors shadow-sm"
                              onClick={() => setIdCardStudentId(studentId)}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-4 4v-4H5a2 2 0 0 1-2-2V5zm2 0v10h14V5H5zm2 2h6v2H7V7zm0 4h10v2H7v-2z"/>
                              </svg>
                              ID Card
                            </button>
                            <button
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
                              onClick={() => setEditModalStudent(s)}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Show:</label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-sm text-gray-600">per page</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Edit Student Modal */}
        {editModalStudent && (
          <EditStudentModal
            student={editModalStudent}
            onClose={() => {
              setEditModalStudent(null);
              setEdits({}); // Clear any pending edits
            }}
            onSave={(studentId, payload, photoFile, nationalIdPhotoFile) => {
              saveRow.mutate({ id: studentId, payload, photoFile, nationalIdPhotoFile });
              setEditModalStudent(null);
            }}
            onResetAttempts={(studentId) => {
              const total = editModalStudent.total_exams_attempted || 0;
              if (total === 0) return;
              if (confirm(`Reset attempts for student ${editModalStudent.code}? This removes per-exam attempt links so they can retake. Historical submissions remain.`)) {
                resetAttempts.mutate({ id: studentId });
              }
            }}
            onDelete={(studentId) => {
              if (confirm(`Delete student ${editModalStudent.code}? This will PERMANENTLY delete all their attempts, results, activity logs and extra scores. This cannot be undone.`)) {
                deleteRow.mutate(studentId);
                setEditModalStudent(null);
              }
            }}
            onImageClick={(url, title) => setFullScreenImage({ url, title })}
            isSaving={saveRow.isPending}
            isResetting={resetAttempts.isPending}
            isDeleting={deleteRow.isPending}
          />
        )}

        {/* Full-Screen Image Viewer */}
        {fullScreenImage && (
          <FullScreenImageViewer
            url={fullScreenImage.url}
            title={fullScreenImage.title}
            onClose={() => setFullScreenImage(null)}
          />
        )}

        {/* ID Card Modal (inline, no iframe) */}
        {idCardStudentId && selectedStudent && (
          <IdCardModal
            student={selectedStudent}
            brandLogoUrl={(publicSettings as any)?.brand_logo_url}
            publicSettings={publicSettings}
            onClose={() => setIdCardStudentId(null)}
          />
        )}
      </div>
    </div>
  );
}

// Full-Screen Image Viewer Component
function FullScreenImageViewer({ 
  url, 
  title, 
  onClose 
}: { 
  url: string; 
  title: string; 
  onClose: () => void; 
}) {
  return (
    <div className="fixed inset-0 bg-black z-[60] flex items-center justify-center">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent z-10 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-white text-lg sm:text-xl font-semibold truncate mr-4">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 sm:p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors touch-manipulation"
          >
            <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Image */}
      <div className="w-full h-full flex items-center justify-center p-4 sm:p-8">
        <img
          src={url}
          alt={title}
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          onClick={onClose}
        />
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full text-sm">
        Tap to close
      </div>
    </div>
  );
}

// Edit Student Modal Component - Sidebar Split Layout (Option 2)
function EditStudentModal({
  student,
  onClose,
  onSave,
  onResetAttempts,
  onDelete,
  onImageClick,
  isSaving,
  isResetting,
  isDeleting,
}: {
  student: Student;
  onClose: () => void;
  onSave: (studentId: string, payload: Partial<Student>, photoFile: File | null, nationalIdPhotoFile: File | null) => void;
  onResetAttempts: (studentId: string) => void;
  onDelete: (studentId: string) => void;
  onImageClick: (url: string, title: string) => void;
  isSaving: boolean;
  isResetting: boolean;
  isDeleting: boolean;
}) {
  const [formData, setFormData] = useState({
    student_name: student.student_name || "",
    mobile_number: student.mobile_number || "",
    mobile_number2: student.mobile_number2 || "",
    address: student.address || "",
    national_id: student.national_id || "",
  });
  
  const [photoPreview, setPhotoPreview] = useState<string | null>(student.photo_url || null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [nationalIdPhotoPreview, setNationalIdPhotoPreview] = useState<string | null>(student.national_id_photo_url || null);
  const [nationalIdPhotoFile, setNationalIdPhotoFile] = useState<File | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Track changes
  useEffect(() => {
    const originalData = {
      student_name: student.student_name || "",
      mobile_number: student.mobile_number || "",
      mobile_number2: student.mobile_number2 || "",
      address: student.address || "",
      national_id: student.national_id || "",
    };
    
    const dataChanged = JSON.stringify(formData) !== JSON.stringify(originalData);
    const photoChanged = photoFile !== null;
    const nationalIdChanged = nationalIdPhotoFile !== null;
    
    setHasChanges(dataChanged || photoChanged || nationalIdChanged);
  }, [formData, photoFile, nationalIdPhotoFile, student]);

  const handleChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Photo must be less than 5MB");
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNationalIdPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Photo must be less than 5MB");
        return;
      }
      setNationalIdPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setNationalIdPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (hasChanges) {
      onSave(student.student_id, formData, photoFile, nationalIdPhotoFile);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] overflow-hidden shadow-2xl flex flex-col md:flex-row">
        
        {/* LEFT SIDEBAR */}
        <div className="w-full md:w-80 bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50 border-r border-gray-200 flex flex-col overflow-y-auto">
          
          {/* Close Button - Top Right */}
          <div className="absolute top-4 right-4 md:relative md:top-0 md:right-0 md:flex md:justify-end md:p-4 z-10">
            <button 
              onClick={onClose}
              className="p-2 bg-white/80 hover:bg-white rounded-lg transition-colors shadow-md"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Photo Section */}
          <div className="p-6 flex flex-col items-center space-y-4">
            {/* Student Photo */}
            <div className="relative">
              {photoPreview ? (
                <button
                  onClick={() => photoPreview && onImageClick(photoPreview, student.student_name || "Student Photo")}
                  className="w-32 h-32 rounded-2xl overflow-hidden border-4 border-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                >
                  <img 
                    src={photoPreview} 
                    alt={student.student_name || "Student"} 
                    className="w-full h-full object-cover"
                  />
                </button>
              ) : (
                <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center border-4 border-white shadow-lg">
                  <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
              {/* Photo Upload Button */}
              <label 
                htmlFor="photo-upload"
                className="absolute bottom-0 right-0 bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-full shadow-lg cursor-pointer transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* Student Code */}
            <div className="text-center">
              <span className="px-4 py-2 bg-white rounded-xl font-mono font-bold text-xl text-indigo-700 shadow-md">
                #{student.code}
              </span>
            </div>
            
            {/* Student Name */}
            <h3 className="text-xl font-bold text-gray-900 text-center">
              {student.student_name || "No Name"}
            </h3>
          </div>

          {/* Stats Section */}
          <div className="px-6 py-4 bg-white/50 border-y border-gray-200">
            <h4 className="text-sm font-semibold text-gray-600 mb-3">Quick Stats</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total</span>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
                  {student.total_exams_attempted || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Completed</span>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                  {student.completed_exams || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">In Progress</span>
                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium">
                  {student.in_progress_exams || 0}
                </span>
              </div>
            </div>
          </div>

          {/* National ID Photo Section */}
          <div className="px-6 py-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">🆔 National ID Card Photo</h4>
            <div className="relative">
              {nationalIdPhotoPreview ? (
                <button
                  onClick={() => nationalIdPhotoPreview && onImageClick(nationalIdPhotoPreview, "National ID Card")}
                  className="w-full h-32 rounded-xl overflow-hidden border-2 border-gray-200 shadow hover:shadow-lg transition-all"
                >
                  <img 
                    src={nationalIdPhotoPreview} 
                    alt="National ID" 
                    className="w-full h-full object-cover"
                  />
                </button>
              ) : (
                <div className="w-full h-32 rounded-xl bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
                  <div className="text-center">
                    <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                    </svg>
                    <p className="text-xs text-gray-500">No ID card photo</p>
                  </div>
                </div>
              )}
              <label 
                htmlFor="national-id-upload"
                className="absolute bottom-2 right-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-sm font-medium shadow"
              >
                Upload
                <input
                  id="national-id-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleNationalIdPhotoChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-6 mt-auto space-y-2">
            <button
              onClick={() => onResetAttempts(student.student_id)}
              disabled={isResetting || (student.total_exams_attempted || 0) === 0}
              className="w-full px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
              title={(student.total_exams_attempted || 0) === 0 ? "No attempts to reset" : "Reset attempts"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {isResetting ? "Resetting..." : "Reset Attempts"}
            </button>
            
            <button
              onClick={() => onDelete(student.student_id)}
              disabled={isDeleting}
              className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {isDeleting ? "Deleting..." : "Delete Student"}
            </button>
          </div>
        </div>

        {/* RIGHT MAIN CONTENT */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-2xl font-bold text-gray-900">Edit Student Information</h2>
            <p className="text-sm text-gray-600 mt-1">Update student details below</p>
          </div>

          {/* Form Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-5">
              {/* Student Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Student Name *
                </label>
                <input
                  type="text"
                  value={formData.student_name}
                  onChange={handleChange('student_name')}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="Enter student's full name"
                />
              </div>

              {/* Mobile Numbers Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    value={formData.mobile_number}
                    onChange={handleChange('mobile_number')}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="Primary mobile"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Alternative Mobile
                  </label>
                  <input
                    type="tel"
                    value={formData.mobile_number2}
                    onChange={handleChange('mobile_number2')}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="Alternative mobile"
                  />
                </div>
              </div>

              {/* National ID & Address Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    National ID
                  </label>
                  <input
                    type="text"
                    value={formData.national_id}
                    onChange={handleChange('national_id')}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="National ID number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={handleChange('address')}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="Student's address"
                  />
                </div>
              </div>

              
            </div>
          </div>

          {/* Footer - Save/Cancel */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-6 py-2.5 text-gray-700 hover:text-gray-900 font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {hasChanges ? "Save Changes" : "No Changes"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function IdCardModal({ student, brandLogoUrl, publicSettings, onClose }: { student: {
  student_id: string;
  code: string;
  student_name: string | null;
  mobile_number: string | null;
  photo_url?: string | null;
}; brandLogoUrl?: string | null; publicSettings?: any; onClose: () => void }) {
  const cardRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);

  const fullName = student?.student_name || "";
  const code = student?.code || "";
  const brandName = publicSettings?.brand_name || "";

  const download = () => {
    if (!cardRef.current) return;
    const url = cardRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(fullName || "student").replace(/\s+/g, "_")}_${code || "id"}.png`;
    a.click();
  };

  const sendId = () => {
    if (!cardRef.current || !student) return;
    
    // Download the ID card image
    const url = cardRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(fullName || "student").replace(/\s+/g, "_")}_${code || "id"}.png`;
    a.click();
    
    // Open WhatsApp if mobile number is available
    if (student.mobile_number) {
      const cleanNumber = student.mobile_number.replace(/\D/g, '');
      const mobileNumber = cleanNumber.startsWith('0') 
        ? cleanNumber.substring(1) 
        : cleanNumber;
      
      const message = `اغابي ${fullName || ''}! دا الكرت بتاعك اللي هتحضر به، خليه ديما معاك: ${code}`;
      const whatsappUrl = `https://wa.me/${mobileNumber}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
    }
  };

  // modal UI
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Student ID Card"
        className="relative bg-white rounded-lg shadow-xl w-[95vw] max-w-[860px] h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
          <h3 className="text-sm font-semibold">Student ID Card</h3>
          <div className="flex items-center gap-2">
            <button className="btn" onClick={download} disabled={!ready}>Download PNG</button>
            <button className="btn btn-primary" onClick={sendId} disabled={!ready || !student?.mobile_number}>
              Send ID
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-gray-200 focus:outline-none"
              aria-label="Close"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div ref={(el) => { if (el) cardRef.current = el.querySelector('canvas'); }}>
            <IdCardCanvas
              fullName={fullName}
              code={code}
              brandLogoUrl={brandLogoUrl}
              brandName={brandName}
              photoUrl={student?.photo_url || null}
              onReady={() => setReady(true)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Fast floating dropdown for mobile duplicates
function MobileDuplicatesDropdown({ 
  duplicates, 
  onSelectMobile 
}: { 
  duplicates: DuplicateStudent[];
  onSelectMobile: (mobile: string) => void;
}) {
  return (
    <div className="absolute top-full left-0 right-0 z-[99999] mt-1 bg-white border-2 border-red-300 rounded-lg shadow-2xl max-h-60 overflow-y-auto min-w-[300px]" 
         style={{ boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' }}>
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-100 bg-red-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-gray-700">
            Duplicate Mobile Numbers ({duplicates.length})
          </span>
        </div>
      </div>

      {/* Duplicate entries */}
      <div className="py-1">
        {duplicates.map((dup, idx) => (
          <button
            key={idx}
            onClick={() => onSelectMobile(dup.student.mobile_number || '')}
            className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors border-b border-gray-100 last:border-b-0"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded font-mono text-xs">
                  {dup.student.code}
                </span>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {dup.student.student_name || 'No Name'}
                  </p>
                  <p className="text-xs text-red-600 font-medium">
                    {dup.student.mobile_number || 'No Mobile'}
                  </p>
                </div>
              </div>
              <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 rounded-b-lg">
        <p className="text-xs text-gray-500">
          Click to use existing mobile number
        </p>
      </div>
    </div>
  );
}

// Fast floating dropdown for national ID duplicates
function NationalIdDuplicatesDropdown({ 
  duplicates, 
  onSelectNationalId 
}: { 
  duplicates: DuplicateStudent[];
  onSelectNationalId: (nationalId: string) => void;
}) {
  return (
    <div className="absolute bottom-full left-0 right-0 z-[99999] mb-1 bg-white border-2 border-red-300 rounded-lg shadow-2xl max-h-60 overflow-y-auto min-w-[300px]" 
         style={{ boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' }}>
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-100 bg-red-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-gray-700">
            Duplicate National IDs ({duplicates.length})
          </span>
        </div>
      </div>

      {/* Duplicate entries */}
      <div className="py-1">
        {duplicates.map((dup, idx) => (
          <button
            key={idx}
            onClick={() => onSelectNationalId(dup.student.national_id || '')}
            className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors border-b border-gray-100 last:border-b-0"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded font-mono text-xs">
                  {dup.student.code}
                </span>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {dup.student.student_name || 'No Name'}
                  </p>
                  <p className="text-xs text-red-600 font-medium">
                    {dup.student.national_id || 'No National ID'}
                  </p>
                </div>
              </div>
              <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 rounded-b-lg">
        <p className="text-xs text-gray-500">
          Click to use existing national ID
        </p>
      </div>
    </div>
  );
}

// Fast floating dropdown for name duplicates
function NameDuplicatesDropdown({ 
  duplicates, 
  isLoading, 
  onSelectName 
}: { 
  duplicates: DuplicateStudent[];
  isLoading: boolean;
  onSelectName: (name: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
        <div className="flex items-center gap-2 text-gray-500">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm">Searching...</span>
        </div>
      </div>
    );
  }

  if (duplicates.length === 0) return null;

  return (
    <div className="absolute top-full left-0 right-0 z-[99999] mt-1 bg-white border-2 border-yellow-300 rounded-lg shadow-2xl max-h-60 overflow-y-auto min-w-[300px]" 
         style={{ boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' }}>
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-100 bg-yellow-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-gray-700">
            Similar Names ({duplicates.length})
          </span>
        </div>
      </div>

      {/* Duplicate entries */}
      <div className="py-1">
        {duplicates.map((dup, idx) => (
          <button
            key={idx}
            onClick={() => onSelectName(dup.student.student_name || '')}
            className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors border-b border-gray-100 last:border-b-0"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded font-mono text-xs">
                  {dup.student.code}
                </span>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {dup.student.student_name || 'No Name'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {dup.student.mobile_number || 'No Mobile'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  dup.matchType === 'exact' ? 'bg-red-100 text-red-800' :
                  dup.matchType === 'high' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {dup.score}%
                </span>
                <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
            </div>
            
            {/* Reasons */}
            {dup.reasons.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {dup.reasons.map((reason, ridx) => (
                  <span key={ridx} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                    {reason}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 rounded-b-lg">
        <p className="text-xs text-gray-500">
          Click to select existing name
        </p>
      </div>
    </div>
  );
}

// Duplicate Warning Section Component
function DuplicateWarningSection({ duplicates }: { duplicates: DuplicateStudent[] }) {
  const exactMatches = duplicates.filter(d => d.matchType === 'exact');
  const highMatches = duplicates.filter(d => d.matchType === 'high');
  const mediumMatches = duplicates.filter(d => d.matchType === 'medium');

  return (
    <div className="space-y-4">
      {exactMatches.length > 0 && (
        <div className="bg-red-50/90 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-red-800">Exact Duplicate Found!</h3>
              <p className="text-sm text-red-700">These students match exactly with your input</p>
            </div>
          </div>
          <div className="space-y-2">
            {exactMatches.map((dup, idx) => (
              <DuplicateStudentCard key={idx} duplicate={dup} />
            ))}
          </div>
        </div>
      )}

      {highMatches.length > 0 && (
        <div className="bg-yellow-50/90 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-yellow-800">Similar Students Found</h3>
              <p className="text-sm text-yellow-700">These students have high similarity to your input</p>
            </div>
          </div>
          <div className="space-y-2">
            {highMatches.map((dup, idx) => (
              <DuplicateStudentCard key={idx} duplicate={dup} />
            ))}
          </div>
        </div>
      )}

      {mediumMatches.length > 0 && (
        <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-blue-800">Possible Matches</h3>
              <p className="text-sm text-blue-700">These students might be related to your input</p>
            </div>
          </div>
          <div className="space-y-2">
            {mediumMatches.map((dup, idx) => (
              <DuplicateStudentCard key={idx} duplicate={dup} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Individual Duplicate Student Card
function DuplicateStudentCard({ duplicate }: { duplicate: DuplicateStudent }) {
  const { student, score, reasons, matchType } = duplicate;
  
  const matchTypeColors = {
    exact: 'bg-red-100 text-red-800',
    high: 'bg-yellow-100 text-yellow-800',
    medium: 'bg-blue-100 text-blue-800'
  };

  return (
    <div className="bg-white/70 border border-gray-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded font-mono text-sm">
            {student.code}
          </span>
          <div>
            <p className="font-medium text-gray-900">{student.student_name || 'No Name'}</p>
            <p className="text-sm text-gray-600">{student.mobile_number || 'No Mobile'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-xs font-medium ${matchTypeColors[matchType]}`}>
            {score}% Match
          </span>
        </div>
      </div>
      
      {reasons.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {reasons.map((reason, idx) => (
            <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs">
              {reason}
            </span>
          ))}
        </div>
      )}

      {student.national_id && (
        <p className="text-xs text-gray-500">
          National ID: {student.national_id}
        </p>
      )}
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}