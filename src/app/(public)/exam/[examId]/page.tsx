"use client";

import { useState, useEffect } from "react";
import ExamEntry from "@/components/public/ExamEntry";

export default function ExamEntryPage({ params }: { params: Promise<{ examId: string }> }) {
  const [examId, setExamId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const p = await params;
        if (mounted && p?.examId) setExamId(p.examId);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [params]);

  if (!examId) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <div className="space-y-2">
            <p className="text-gray-700 font-medium">Loading exam…</p>
            <p className="text-gray-500 text-sm">Please wait</p>
          </div>
        </div>
      </main>
    );
  }

  return <ExamEntry examId={examId} />;
}
