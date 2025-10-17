"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminNewExamPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to the unified create/edit page
    router.replace("/admin/exams/new/edit");
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}