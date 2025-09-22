import { supabaseServer } from "@/lib/supabase/server";
import PublicLocaleProvider from "@/components/public/PublicLocaleProvider";
import BrandLogo from "@/components/BrandLogo";
import Link from "next/link";
import { t } from "@/i18n/student";

type MinimalExam = {
  id: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  access_type: "open" | "code_based" | "ip_restricted";
};

 export const dynamic = "force-dynamic";
 export const revalidate = 0;

 export default async function Home() {
  let svc;
  try {
    svc = supabaseServer();
  } catch (error) {
    return <ErrorPage message="Database connection failed" />;
  }

  // Read system mode and optional home button toggles
  const { data: cfg } = await svc
    .from("app_config")
    .select("key, value")
    .in("key", [
      "system_mode",
      "system_disabled",
      "system_disabled_message",
      "home_button_exams",
      "home_button_results",
    ]);

  type AppConfigRow = { key: string; value: string | null };
  const cfgMap = new Map<string, string | null>();
  for (const row of cfg || []) {
    const r = row as AppConfigRow;
    cfgMap.set(r.key, r.value);
  }
  const legacyDisabled = cfgMap.get("system_disabled") === "true";
  const mode = (cfgMap.get("system_mode") as "exam" | "results" | "disabled" | undefined) || (legacyDisabled ? "disabled" : "exam");
  const disabledMessage = cfgMap.get("system_disabled_message") || null;

  // Prefer explicit toggles when present; otherwise infer from mode
  const examsToggle = cfgMap.get("home_button_exams");
  const resultsToggle = cfgMap.get("home_button_results");
  const showExams = mode === "disabled"
    ? false
    : (examsToggle != null ? examsToggle === "true" : mode === "exam");
  const showResults = mode === "disabled"
    ? false
    : (resultsToggle != null ? resultsToggle === "true" : mode === "results");

  // Determine responsive layout based on how many buttons are visible
  const visibleCount = (showExams ? 1 : 0) + (showResults ? 1 : 0) + 1; // +1 for Public ID
  const gridColsSm = visibleCount === 1 ? "sm:grid-cols-1" : visibleCount === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";
  const containerMaxW = visibleCount === 1 ? "max-w-md" : visibleCount === 2 ? "max-w-2xl" : "max-w-3xl";

  return (
    <PublicLocaleProvider>
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className={`w-full ${containerMaxW}`}>
          {/* Banner for disabled mode */}
          {mode === "disabled" && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{disabledMessage || "No exams are currently available. Please check back later."}</span>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-xl">
            {/* Logo */}
            <div className="mb-8 text-center">
              <BrandLogo useAppSettings={true} size="lg" />
            </div>

            {/* Buttons */}
            <div className={`grid grid-cols-1 ${gridColsSm} gap-4`}>
              {showExams && (
                <Link href="/exams" className="group">
                  <div className="h-full rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors p-6 text-center shadow-sm">
                    <div className=" h-12 mx-auto mb-3 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
                      </svg>
                    </div>
                    <div className="font-semibold text-blue-900 text-lg text-center">{t("en", "exams")}</div>
                    <p className="text-sm text-blue-800/80 mt-1">Browse available exams</p>
                  </div>
                </Link>
              )}

              {showResults && (
                <Link href="/results" className="group">
                  <div className="h-full rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition-colors p-6 text-center shadow-sm">
                    <div className=" h-12 mx-auto mb-3 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="font-semibold text-indigo-900 text-lg text-center">Results</div>
                    <p className="text-sm text-indigo-800/80 mt-1">Search your exam results</p>
                  </div>
                </Link>
              )}

              {/* Public ID is always visible */}
              <Link href="/id" className="group">
                <div className="h-full rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors p-6 text-center shadow-sm">
                  <div className=" h-12 mx-auto mb-3 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H9l-4 4v-4H5a2 2 0 01-2-2V5zm2 0v10h14V5H5zm2 2h6v2H7V7zm0 4h10v2H7v-2z" />
                    </svg>
                  </div>
                  <div className="font-semibold text-emerald-900 text-lg text-center">Public ID</div>
                  <p className="text-sm text-emerald-800/80 mt-1">View your ID card</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </PublicLocaleProvider>
  );
 }

 // Legacy inline pages removed in favor of a unified landing page

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="max-w-md mx-auto text-center p-8">
        <div className="w-16 h-16 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-4">
          Service Unavailable
        </h1>
        <p className="text-[var(--muted-foreground)] mb-6 leading-relaxed">
          {message}. Please try again later.
        </p>
        <div className="text-sm text-[var(--muted-foreground)]">
          Please refresh the page or contact your administrator.
        </div>
        <div className="mt-4">
          <Link href="/" className="btn btn-primary btn-sm">
            Try Again
          </Link>
        </div>
      </div>
    </div>
  );
}
