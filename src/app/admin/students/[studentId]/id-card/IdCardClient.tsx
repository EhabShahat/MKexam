"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/authFetch";
import IdCardCanvas from "@/components/IdCard/IdCardCanvas";

interface StudentSummary {
  student_id: string;
  code: string;
  student_name: string | null;
  mobile_number: string | null;
  photo_url?: string | null;
}

export default function StudentIdCardClient({ studentId }: { studentId: string }) {
  const { data: student } = useQuery({
    queryKey: ["admin", "student", studentId],
    queryFn: async (): Promise<StudentSummary | null> => {
      const res = await authFetch(`/api/admin/students/${studentId}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to load student");
      return j.student as StudentSummary;
    },
  });

  const { data: publicSettings } = useQuery({
    queryKey: ["public", "settings"],
    queryFn: async () => {
      const res = await fetch("/api/public/settings");
      try {
        const j = await res.json();
        return j || {};
      } catch {
        return {};
      }
    },
  });

  const brandLogoUrl = (publicSettings?.brand_logo_url as string) || null;
  const brandName = (publicSettings?.brand_name as string) || "";
  const fullName = student?.student_name || "";
  const code = student?.code || "";

  const cardRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);

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

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Student ID Card</h1>
        <div className="flex gap-2">
          <button className="btn" onClick={download} disabled={!ready}>Download PNG</button>
          <button className="btn btn-primary" onClick={sendId} disabled={!ready || !student?.mobile_number}>
            Send ID
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center">
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
      <p className="text-sm text-gray-500 mt-4 text-center">QR contains the student's code. Logo is embedded at the center.</p>
    </div>
  );
}
