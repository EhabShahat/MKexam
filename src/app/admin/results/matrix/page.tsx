"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/components/ToastProvider";
import { downloadArabicCSV, getBilingualHeader, formatArabicNumber } from "@/lib/exportUtils";
import SearchInput from "@/components/admin/SearchInput";
import ActionButton from "@/components/admin/ActionButton";
import { ExamTypeMicroBadge } from "@/components/admin/ExamTypeSelector";

interface Exam {
  id: string;
  title: string;
  status: string;
  exam_type?: 'exam' | 'homework' | 'quiz';
}

interface Student {
  student_id: string;
  student_name: string;
  code: string;
}

interface Attempt {
  id: string;
  exam_id: string;
  student_id?: string;
  student_name: string | null;
  code?: string | null;
  score_percentage: number | null;
  final_score_percentage?: number | null;
  completion_status: string | null;
}

export default function ResultsMatrixPage() {
  const [studentSearch, setStudentSearch] = useState("");
  const [examSearch, setExamSearch] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [showStudentPanel, setShowStudentPanel] = useState(true);
  const toast = useToast();

  // Load all exams
  const examsQuery = useQuery({
    queryKey: ["admin", "exams", "all"],
    queryFn: async () => {
      const res = await authFetch(`/api/admin/exams`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Load exams failed");
      return (j.items as Exam[])?.sort((a, b) => a.title.localeCompare(b.title));
    },
  });

  // Load all students
  const studentsQuery = useQuery({
    queryKey: ["admin", "students"],
    queryFn: async () => {
      const res = await authFetch(`/api/admin/students`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Load students failed");
      return (j.students as Student[])?.sort((a, b) => 
        a.student_name.localeCompare(b.student_name)
      );
    },
  });

  // Load all attempts for all exams
  const attemptsQuery = useQuery({
    queryKey: ["admin", "attempts", "bulk-matrix"],
    staleTime: 2 * 60 * 1000,  // Cache for 2 minutes
    gcTime: 5 * 60 * 1000,      // Keep in memory for 5 minutes
    queryFn: async () => {
      // ✅ OPTIMIZED: Single bulk API call instead of 130+ individual calls
      const res = await authFetch('/api/admin/attempts/bulk');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Load failed");
      
      // allAttempts already includes exam_id from the bulk API
      return json.allAttempts as Attempt[];
    },
    enabled: !!examsQuery.data && examsQuery.data.length > 0,
  });

  // Filter students based on search
  const filteredStudents = useMemo(() => {
    const students = studentsQuery.data ?? [];
    if (!studentSearch.trim()) return students;
    
    const term = studentSearch.toLowerCase().trim();
    return students.filter((s) => 
      s.student_name.toLowerCase().includes(term) || 
      s.code.toLowerCase().includes(term)
    );
  }, [studentsQuery.data, studentSearch]);

  // Build matrix data structure
  const matrixData = useMemo(() => {
    const allExams = examsQuery.data ?? [];
    const attempts = attemptsQuery.data ?? [];
    const students = studentsQuery.data ?? [];
    
    // Filter exams by search
    const exams = examSearch.trim() 
      ? allExams.filter(e => e.title.toLowerCase().includes(examSearch.toLowerCase().trim()))
      : allExams;
    
    // Create a map of student_id -> student info
    const studentMap = new Map<string, Student>();
    students.forEach(s => studentMap.set(s.student_id, s));
    
    // Create a map of exam_id -> student_id -> best attempt
    const examStudentMap = new Map<string, Map<string, Attempt>>();
    
    attempts.forEach(attempt => {
      if (!attempt.exam_id) return;
      
      // Find student_id from attempt or lookup by code/name
      let studentId = attempt.student_id;
      if (!studentId && attempt.code) {
        const student = students.find(s => s.code === attempt.code);
        studentId = student?.student_id;
      }
      if (!studentId && attempt.student_name) {
        const student = students.find(s => s.student_name === attempt.student_name);
        studentId = student?.student_id;
      }
      
      if (!studentId) return;
      
      if (!examStudentMap.has(attempt.exam_id)) {
        examStudentMap.set(attempt.exam_id, new Map());
      }
      
      const studentAttempts = examStudentMap.get(attempt.exam_id)!;
      const existing = studentAttempts.get(studentId);
      
      const score = attempt.final_score_percentage ?? attempt.score_percentage ?? 0;
      const existingScore = existing?.final_score_percentage ?? existing?.score_percentage ?? 0;
      
      if (!existing || score > existingScore) {
        studentAttempts.set(studentId, attempt);
      }
    });
    
    return { exams, examStudentMap, studentMap };
  }, [examsQuery.data, attemptsQuery.data, studentsQuery.data, examSearch]);

  const toggleStudent = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const addAllFiltered = () => {
    const studentIds = filteredStudents.map(s => s.student_id);
    setSelectedStudents(prev => {
      const newSet = new Set([...prev, ...studentIds]);
      return Array.from(newSet);
    });
    toast.success({ 
      title: "Students Added", 
      message: `Added ${studentIds.length} students to the matrix` 
    });
  };

  const clearAll = () => {
    setSelectedStudents([]);
    toast.success({ title: "Cleared", message: "All students removed from matrix" });
  };

  const displayedStudents = useMemo(() => {
    return selectedStudents
      .map(id => matrixData.studentMap.get(id))
      .filter((s): s is Student => !!s);
  }, [selectedStudents, matrixData.studentMap]);

  // Calculate attempt counts for each student
  const studentAttemptCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const totalExams = matrixData.exams.length;
    
    displayedStudents.forEach(student => {
      let attemptedCount = 0;
      matrixData.exams.forEach(exam => {
        const attempt = matrixData.examStudentMap.get(exam.id)?.get(student.student_id);
        if (attempt) {
          attemptedCount++;
        }
      });
      counts.set(student.student_id, attemptedCount);
    });
    
    return { counts, totalExams };
  }, [displayedStudents, matrixData.exams, matrixData.examStudentMap]);

  const getCellData = (examId: string, studentId: string) => {
    const attempt = matrixData.examStudentMap.get(examId)?.get(studentId);
    if (!attempt) return null;
    
    const score = attempt.final_score_percentage ?? attempt.score_percentage;
    return {
      score,
      attemptId: attempt.id,
      status: attempt.completion_status,
    };
  };

  const handleExportCsv = () => {
    if (displayedStudents.length === 0) {
      toast.error({ title: "Export Failed", message: "Please select at least one student" });
      return;
    }

    setExportingCsv(true);
    try {
      const headers = [
        getBilingualHeader("Exam"),
        getBilingualHeader("Type"),
        ...displayedStudents.map(s => `${s.student_name} (${s.code})`),
      ];

      const data = matrixData.exams.map(exam => {
        const row = [
          exam.title,
          exam.exam_type || 'exam',
          ...displayedStudents.map(student => {
            const cellData = getCellData(exam.id, student.student_id);
            if (!cellData) return 'X';
            if (cellData.score === null || cellData.score === undefined) return '-';
            return formatArabicNumber(cellData.score);
          }),
        ];
        return row;
      });

      downloadArabicCSV({
        filename: "results_matrix",
        headers,
        data,
        includeTimestamp: true,
        rtlSupport: true,
      });

      toast.success({ title: "Export Complete", message: "CSV file downloaded successfully" });
    } catch (error) {
      toast.error({ 
        title: "Export Failed", 
        message: error instanceof Error ? error.message : "Unknown error" 
      });
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportXlsx = async () => {
    if (displayedStudents.length === 0) {
      toast.error({ title: "Export Failed", message: "Please select at least one student" });
      return;
    }

    setExportingXlsx(true);
    try {
      const XLSX = await import("xlsx");
      
      const rows = matrixData.exams.map(exam => {
        const row: Record<string, any> = {
          Exam: exam.title,
          Type: exam.exam_type || 'exam',
        };
        
        displayedStudents.forEach(student => {
          const cellData = getCellData(exam.id, student.student_id);
          const key = `${student.student_name} (${student.code})`;
          
          if (!cellData) {
            row[key] = 'X';
          } else if (cellData.score === null || cellData.score === undefined) {
            row[key] = '-';
          } else {
            row[key] = Number(cellData.score).toFixed(2);
          }
        });
        
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Results Matrix");
      XLSX.writeFile(wb, `results_matrix.xlsx`);

      toast.success({ title: "Export Complete", message: "XLSX file downloaded successfully" });
    } catch (error) {
      toast.error({ 
        title: "Export Failed", 
        message: error instanceof Error ? error.message : "Unknown error" 
      });
    } finally {
      setExportingXlsx(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card/80 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-[95vw] mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/admin/results">
                <ActionButton variant="secondary" size="sm">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Results
                </ActionButton>
              </Link>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Results Matrix
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[95vw] mx-auto px-4 py-6 space-y-6">
        <div className={`grid ${showStudentPanel ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'} gap-6 transition-all duration-300`}>
          {/* Student Selection Panel */}
          {showStudentPanel && (
            <div className="lg:col-span-1">
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg p-6 sticky top-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">Select Students</h2>
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                      {selectedStudents.length} selected
                    </div>
                    <button
                      onClick={() => setShowStudentPanel(false)}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                      title="Hide panel"
                    >
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              
                <div className="space-y-4">
                <SearchInput 
                  placeholder="Search students..." 
                  value={studentSearch} 
                  onChange={setStudentSearch} 
                />
                
                <div className="flex gap-2">
                  <ActionButton 
                    variant="secondary" 
                    size="sm" 
                    onClick={addAllFiltered}
                    disabled={filteredStudents.length === 0}
                  >
                    Add All ({filteredStudents.length})
                  </ActionButton>
                  <ActionButton 
                    variant="secondary" 
                    size="sm" 
                    onClick={clearAll}
                    disabled={selectedStudents.length === 0}
                  >
                    Clear All
                  </ActionButton>
                </div>
                
                <div className="max-h-[60vh] overflow-y-auto space-y-2">
                  {studentsQuery.isLoading ? (
                    <div className="text-center py-8 text-gray-500">Loading students...</div>
                  ) : filteredStudents.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No students found</div>
                  ) : (
                    filteredStudents.map((student) => (
                      <button
                        key={student.student_id}
                        onClick={() => toggleStudent(student.student_id)}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                          selectedStudents.includes(student.student_id)
                            ? 'bg-blue-50 border-blue-500 shadow-sm'
                            : 'bg-white border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="font-medium text-gray-900">{student.student_name}</div>
                        <div className="text-xs text-gray-500">{student.code}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Matrix Display */}
          <div className={showStudentPanel ? 'lg:col-span-2' : 'lg:col-span-1'}>
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-800">Score Matrix</h2>
                    {selectedStudents.length > 0 && (
                      <div className="flex gap-2">
                        <ActionButton 
                          variant="secondary" 
                          size="sm"
                          onClick={handleExportCsv}
                          loading={exportingCsv}
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          CSV
                        </ActionButton>
                        <ActionButton 
                          variant="secondary" 
                          size="sm"
                          onClick={handleExportXlsx}
                          loading={exportingXlsx}
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          XLSX
                        </ActionButton>
                      </div>
                    )}
                  </div>
                  {selectedStudents.length > 0 && (
                    <div className="max-w-md">
                      <SearchInput 
                        placeholder="Filter exams..." 
                        value={examSearch} 
                        onChange={setExamSearch} 
                      />
                    </div>
                  )}
                </div>
              </div>
              
              {selectedStudents.length === 0 ? (
                <div className="p-12 text-center">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-gray-500 text-lg">Select students from the left panel to view their scores</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-r border-gray-200 bg-gray-100 sticky left-0 z-20 min-w-[200px]">
                          Exam
                        </th>
                        {!showStudentPanel && (
                          <th className="px-4 py-3 text-center border-b border-gray-200 bg-blue-50 w-16">
                            <button
                              onClick={() => setShowStudentPanel(true)}
                              className="w-8 h-8 flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors mx-auto"
                              title="Add students"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                          </th>
                        )}
                        {displayedStudents.map((student) => {
                          const attemptedCount = studentAttemptCounts.counts.get(student.student_id) || 0;
                          const totalCount = studentAttemptCounts.totalExams;
                          
                          return (
                            <th 
                              key={student.student_id} 
                              className="px-4 py-3 text-center text-xs font-medium text-gray-700 border-b border-gray-200 min-w-[120px]"
                            >
                              <div className="font-semibold">{student.student_name}</div>
                              <div className="text-gray-500 font-normal">{student.code}</div>
                              <div className="text-xs text-gray-400 font-normal mt-1">
                                {attemptedCount} of {totalCount}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {examsQuery.isLoading || attemptsQuery.isLoading ? (
                        <tr>
                          <td colSpan={displayedStudents.length + 1} className="px-4 py-8 text-center text-gray-500">
                            Loading matrix data...
                          </td>
                        </tr>
                      ) : matrixData.exams.length === 0 ? (
                        <tr>
                          <td colSpan={displayedStudents.length + 1} className="px-4 py-8 text-center text-gray-500">
                            No exams found
                          </td>
                        </tr>
                      ) : (
                        matrixData.exams.map((exam) => (
                          <tr key={exam.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 border-r border-gray-200 bg-gray-50 sticky left-0 z-10">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">{exam.title}</span>
                                <ExamTypeMicroBadge type={exam.exam_type || "exam"} />
                              </div>
                            </td>
                            {!showStudentPanel && (
                              <td className="px-4 py-3 text-center border-l border-gray-100 bg-blue-50/30">
                              </td>
                            )}
                            {displayedStudents.map((student) => {
                              const cellData = getCellData(exam.id, student.student_id);
                              
                              return (
                                <td 
                                  key={student.student_id} 
                                  className="px-4 py-3 text-center border-l border-gray-100"
                                >
                                  {cellData ? (
                                    <Link 
                                      href={`/admin/results/${cellData.attemptId}`}
                                      className="block hover:bg-blue-50 rounded p-1 transition-colors"
                                    >
                                      {cellData.score !== null && cellData.score !== undefined ? (
                                        <span className={`font-semibold ${
                                          cellData.score >= 80 ? 'text-green-600' :
                                          cellData.score >= 60 ? 'text-yellow-600' : 
                                          'text-red-600'
                                        }`}>
                                          {Number(cellData.score).toFixed(1)}%
                                        </span>
                                      ) : (
                                        <span className="text-gray-400">-</span>
                                      )}
                                    </Link>
                                  ) : (
                                    <div className="flex items-center justify-center">
                                      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
