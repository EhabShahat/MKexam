import { supabaseServer } from "@/lib/supabase/server";
import PublicLocaleProvider from "@/components/public/PublicLocaleProvider";
import PublicHome from "@/components/public/PublicHome";
import Link from "next/link";

//

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
      "home_button_register",
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
  const registerToggle = cfgMap.get("home_button_register");
  const showExams = mode === "disabled"
    ? false
    : (examsToggle != null ? examsToggle === "true" : mode === "exam");
  const showResults = mode === "disabled"
    ? false
    : (resultsToggle != null ? resultsToggle === "true" : mode === "results");
  const showRegister = mode === "disabled"
    ? false
    : (registerToggle === "true");

  // Determine responsive layout based on how many cards are visible
  const visibleCount = (showExams ? 1 : 0) + (showResults ? 1 : 0) + (showRegister ? 1 : 0) + (mode === "disabled" ? 0 : 1); // +1 for Public ID when not disabled
  const containerMaxW = mode === "disabled"
    ? "max-w-xl"
    : visibleCount === 1
      ? "max-w-md"
      : visibleCount === 2
        ? "max-w-2xl"
        : visibleCount === 3
          ? "max-w-3xl"
          : "max-w-4xl";

  return (
    <PublicLocaleProvider>
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className={`w-full ${containerMaxW}`}>
          <PublicHome
            mode={mode}
            disabledMessage={disabledMessage}
            showExams={showExams}
            showResults={showResults}
            showRegister={showRegister}
          />
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
