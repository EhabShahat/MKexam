"use client";

import { useState, useEffect, useRef } from "react";
import BrandLogo from "@/components/BrandLogo";
import { useStudentLocale } from "@/components/public/PublicLocaleProvider";
import { t } from "@/i18n/student";
import IdCardCanvas from "@/components/IdCard/IdCardCanvas";

interface StudentSummary {
  student_id: string;
  code: string;
  student_name: string | null;
  photo_url?: string | null;
}

interface PublicSettings {
  brand_logo_url?: string | null;
}

export default function PublicIdPage() {
  const { locale, dir } = useStudentLocale();
  const [nationalId, setNationalId] = useState("");
  const [student, setStudent] = useState<StudentSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<PublicSettings>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/public/settings");
        if (res.ok) {
          const data = await res.json();
          setSettings(data || {});
        }
      } catch {}
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = nationalId.trim();
    if (!n) {
      setError(t(locale, "enter_national_id_error"));
      return;
    }
    setError(null);
    setLoading(true);
    setStudent(null);
    try {
      const res = await fetch(`/api/public/students/by-national?national_id=${encodeURIComponent(n)}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.error || t(locale, "not_found_error"));
        return;
      }
      const s = j?.student as StudentSummary | null;
      if (!s) {
        setError(t(locale, "not_found_error"));
        return;
      }
      setStudent(s);
    } catch (err: any) {
      setError(err?.message || t(locale, "search_failed_error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50" dir={dir} lang={locale}>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex flex-col items-center mb-8">
          <BrandLogo useAppSettings={true} size="lg" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">{t(locale, "public_id_title")}</h1>
          <p className="mt-2 text-gray-600">{t(locale, "enter_national_number")}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="national-id" className="block text-sm font-semibold text-gray-700 mb-2">{t(locale, "national_number_label")}</label>
              <input
                id="national-id"
                type="text"
                inputMode="numeric"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value.replace(/[^0-9]/g, ""))}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 bg-gray-50 focus:bg-white"
                placeholder="00000000000000"
                maxLength={20}
                autoComplete="off"
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm">{error}</div>
            )}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 disabled:cursor-not-allowed shadow-lg"
              disabled={loading || nationalId.trim().length === 0}
            >
              {loading ? t(locale, "searching_button") : t(locale, "find_id_button")}
            </button>
          </form>
        </div>

        {/* Show card when loaded */}
        {student && (
          <div className="mt-8 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
            <IdCardWithDownload
              student={student}
              brandLogoUrl={(settings?.brand_logo_url as string) || null}
              settings={settings}
              locale={locale}
            />
          </div>
        )}
      </div>
    </main>
  );
}

function IdCardWithDownload({ student, brandLogoUrl, settings, locale }: { 
  student: StudentSummary; 
  brandLogoUrl: string | null; 
  settings: any; 
  locale: any 
}) {
  const cardRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);

  function download() {
    if (!cardRef.current) return;
    const url = cardRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    const fullName = student.student_name || "student";
    a.download = `${fullName.replace(/\s+/g, "_")}_${student.code || "id"}.png`;
    a.click();
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
        <h3 className="text-sm font-semibold">{t(locale, "id_card_title")}</h3>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={download} disabled={!ready}>{t(locale, "download_png_button")}</button>
        </div>
      </div>
      <div className="flex items-center justify-center p-4">
        <div ref={(el) => { if (el) cardRef.current = el.querySelector('canvas'); }}>
          <IdCardCanvas
            fullName={student.student_name || ""}
            code={student.code}
            brandLogoUrl={brandLogoUrl}
            brandName={settings?.brand_name || ""}
            photoUrl={student.photo_url || null}
            onReady={() => {
              setReady(true);
              if (cardRef.current) {
                // Canvas is now ready for download
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
