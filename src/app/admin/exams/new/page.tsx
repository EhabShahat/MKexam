"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/components/ToastProvider";
import ModernCard from "@/components/admin/ModernCard";
import ActionButton from "@/components/admin/ActionButton";
import ExamTypeSelector from "@/components/admin/ExamTypeSelector";
import QuestionsSection from "@/components/admin/QuestionsSection";

export default function AdminNewExamPage() {
  const router = useRouter();
  const toast = useToast();
  
  const [form, setForm] = useState({
    title: "",
    description: "",
    exam_type: "exam",
    start_time: "",
    end_time: "",
    duration_minutes: 60,
    status: "draft",
    access_type: "open",
    settings: {
      attempt_limit: 1,
      ip_restriction: "",
      randomize_questions: false,
      randomize_options: false,
      display_mode: "full",
      auto_save_interval: 10,
      pass_percentage: 60,
    },
  });
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionsCollapsed, setQuestionsCollapsed] = useState(true);
  const [createdExamId, setCreatedExamId] = useState<string | null>(null);

  async function onSave() {
    try {
      setSaving(true);
      setError(null);
      
      if (!form.title.trim()) {
        throw new Error("Title is required");
      }
      
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        exam_type: form.exam_type,
        start_time: form.start_time ? new Date(form.start_time).toISOString() : null,
        end_time: form.end_time ? new Date(form.end_time).toISOString() : null,
        duration_minutes: Number(form.duration_minutes) || null,
        status: form.status,
        access_type: form.access_type,
        settings: form.settings,
      };
      
      const res = await authFetch("/api/admin/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create exam");
      
      setCreatedExamId(data.item.id);
      toast.success({ 
        title: "Exam Created Successfully!", 
        message: "You can now add questions to your exam below." 
      });
      
      // Expand questions section after creation
      setQuestionsCollapsed(false);
    } catch (e: any) {
      setError(e?.message || "Save failed");
      toast.error({ 
        title: "Create Failed", 
        message: e?.message || "Unknown error" 
      });
    } finally {
      setSaving(false);
    }
  }

  function setSetting(key: string, value: any) {
    setForm((f) => ({ 
      ...f, 
      settings: { ...f.settings, [key]: value } 
    }));
  }

  function updateForm(updates: Partial<typeof form>) {
    setForm(f => ({ ...f, ...updates }));
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        {/* Enhanced Header with Breadcrumbs */}
        <div className="mb-6 sm:mb-8">
          {/* Breadcrumbs */}
          <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
            <button onClick={() => router.push("/admin")} className="hover:text-gray-700 transition-colors">
              Dashboard
            </button>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <button onClick={() => router.push("/admin/exams")} className="hover:text-gray-700 transition-colors">
              Exams
            </button>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-gray-900 font-medium">Create New</span>
          </nav>
          
        </div>

        {/* Main Content */}
        <div className="space-y-6 lg:space-y-8">

          {/* Enhanced Basic Information Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            {/* Card Header */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Basic Information</h2>
                  <p className="text-gray-600 text-xs sm:text-sm">Configure the essential details of your assessment</p>
                </div>
              </div>
            </div>
            
            {/* Card Content */}
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="sm:col-span-2 group">
                  <label className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-blue-600 transition-colors">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a.997.997 0 01-1.414 0l-7-7A1.997 1.997 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      Exam Title <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white shadow-sm hover:shadow-md ${
                      !form.title.trim() ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter a descriptive title for your exam..."
                    value={form.title}
                    onChange={(e) => updateForm({ title: e.target.value })}
                  />
                  {!form.title.trim() && (
                    <p className="text-red-600 text-xs mt-1">Title is required</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">This will be displayed to students when they access the exam</p>
                </div>

                <div className="sm:col-span-2 group">
                  <label className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-blue-600 transition-colors">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                      </svg>
                      Description
                    </span>
                  </label>
                  <textarea
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white shadow-sm hover:shadow-md resize-none"
                    rows={3}
                    placeholder="Provide instructions, context, or additional information for students..."
                    value={form.description}
                    onChange={(e) => updateForm({ description: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">Optional: Add context or instructions that students will see before starting</p>
                </div>

                <div className="group">
                  <label className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-blue-600 transition-colors">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
                      </svg>
                      Assessment Type <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <ExamTypeSelector
                    value={form.exam_type as "exam" | "homework" | "quiz"}
                    onChange={(type) => updateForm({ exam_type: type })}
                  />
                  <p className="text-xs text-gray-500 mt-1">Choose the type of assessment you're creating</p>
                </div>

                <div className="group">
                  <label className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-blue-600 transition-colors">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Access Control <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <select
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white shadow-sm hover:shadow-md appearance-none cursor-pointer"
                    value={form.access_type}
                    onChange={(e) => updateForm({ access_type: e.target.value })}
                  >
                    <option value="open">🌐 Open Access - Anyone with link</option>
                    <option value="code_based">🔑 Code Based - Requires access code</option>
                    <option value="ip_restricted">🏢 IP Restricted - Specific networks only</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Schedule & Duration Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Schedule & Duration</h2>
                  <p className="text-gray-600 text-xs sm:text-sm">Set when your assessment is available and time limits</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="group">
                  <label className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-blue-600 transition-colors">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Start Time
                    </span>
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white shadow-sm hover:shadow-md"
                    value={form.start_time}
                    onChange={(e) => updateForm({ start_time: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">When students can start taking the exam</p>
                </div>

                <div className="group">
                  <label className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-blue-600 transition-colors">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      End Time
                    </span>
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white shadow-sm hover:shadow-md"
                    value={form.end_time}
                    onChange={(e) => updateForm({ end_time: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">When the exam becomes unavailable</p>
                </div>

                <div className="group">
                  <label className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-blue-600 transition-colors">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Duration (minutes)
                    </span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="600"
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white shadow-sm hover:shadow-md"
                    value={form.duration_minutes}
                    onChange={(e) => updateForm({ duration_minutes: Number(e.target.value) })}
                  />
                  <p className="text-xs text-gray-500 mt-1">How long each student has to complete the exam</p>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Advanced Settings Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-indigo-100 rounded-lg">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Advanced Settings</h2>
                  <p className="text-gray-600 text-xs sm:text-sm">Configure exam behavior and restrictions</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="group">
                  <label className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-blue-600 transition-colors">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h2m5 0h2a2 2 0 002-2V7a2 2 0 00-2-2h-2m-5 4h4" />
                      </svg>
                      Attempt Limit
                    </span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white shadow-sm hover:shadow-md"
                    value={form.settings.attempt_limit}
                    onChange={(e) => setSetting("attempt_limit", Number(e.target.value))}
                  />
                  <p className="text-xs text-gray-500 mt-1">How many times a student can attempt the exam</p>
                </div>

                <div className="group">
                  <label className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-blue-600 transition-colors">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                      Display Mode
                    </span>
                  </label>
                  <select
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white shadow-sm hover:shadow-md appearance-none cursor-pointer"
                    value={form.settings.display_mode}
                    onChange={(e) => setSetting("display_mode", e.target.value)}
                  >
                    <option value="full">Full Exam - Show all questions at once</option>
                    <option value="per_question">Per Question - Show one question at a time</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">How questions are presented to students</p>
                </div>

                <div className="group">
                  <label className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-blue-600 transition-colors">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      Pass Percentage
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white shadow-sm hover:shadow-md pr-12"
                      value={form.settings.pass_percentage ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSetting("pass_percentage", val === "" ? null : Math.max(0, Math.min(100, Number(val))));
                      }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Minimum percentage required to pass</p>
                </div>

                <div className="group sm:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2 group-focus-within:text-blue-600 transition-colors">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      IP Restrictions
                    </span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white shadow-sm hover:shadow-md"
                    placeholder="e.g. 10.0.0.0/8, 192.168.1.0/24"
                    value={form.settings.ip_restriction}
                    onChange={(e) => setSetting("ip_restriction", e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">Comma-separated IP addresses or CIDR ranges</p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4 sm:pt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3 sm:mb-4">Randomization Options</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="randomize-questions"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={form.settings.randomize_questions}
                      onChange={(e) => setSetting("randomize_questions", e.target.checked)}
                    />
                    <label htmlFor="randomize-questions" className="text-sm font-medium text-gray-700">
                      Randomize Questions
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 ml-6">Shuffle the order of questions for each student</p>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="randomize-options"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={form.settings.randomize_options}
                      onChange={(e) => setSetting("randomize_options", e.target.checked)}
                    />
                    <label htmlFor="randomize-options" className="text-sm font-medium text-gray-700">
                      Randomize Options
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 ml-6">Shuffle the order of multiple choice options</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Main Header */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Create New Exam</h1>
                    <p className="text-gray-600">Set up a new assessment with questions and advanced settings</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <ActionButton
                  variant="secondary"
                  onClick={() => router.back()}
                  className="shadow-md hover:shadow-lg transition-all duration-200"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Cancel
                </ActionButton>
                
                {!createdExamId && (
                  <ActionButton
                    variant="primary"
                    onClick={onSave}
                    loading={saving}
                    disabled={!form.title.trim()}
                    className="shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Create Exam
                  </ActionButton>
                )}
                
                {createdExamId && (
                  <ActionButton
                    variant="success"
                    onClick={() => router.push(`/admin/exams/${createdExamId}/edit`)}
                    className="shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Go to Editor
                  </ActionButton>
                )}
              </div>
            </div>
          </div>
          {/* Error Display */}
          {error && (
            <div className="bg-white rounded-2xl shadow-lg border border-red-200 overflow-hidden">
              <div className="bg-red-50 p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-red-800">Error Creating Exam</h3>
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Questions Management Section */}
          {createdExamId && (
            <QuestionsSection
              examId={createdExamId}
              isCollapsed={questionsCollapsed}
              onToggle={() => setQuestionsCollapsed(!questionsCollapsed)}
            />
          )}

          {/* Success Message */}
          {createdExamId && (
            <div className="bg-white rounded-2xl shadow-lg border border-green-200 overflow-hidden">
              <div className="bg-green-50 p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-green-800">Exam Created Successfully!</h3>
                    <p className="text-green-700 text-sm">You can now add questions above or go to the full editor.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}