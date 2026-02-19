import { supabaseServer } from "@/lib/supabase/server";
import PublicLocaleProvider from "@/components/public/PublicLocaleProvider";
import CodeFirstRouter from "@/components/CodeFirstRouter";
import ErrorBoundary from "@/components/ErrorBoundary";
import { logSystemError } from "@/lib/errorLogger";
import Link from "next/link";

//

 export const dynamic = "force-dynamic";
 export const revalidate = 0;

 export default async function Home() {
  let svc;
  try {
    svc = supabaseServer();
  } catch (error) {
    // Log database connection error
    logSystemError(
      'database_connection',
      error instanceof Error ? error : 'Database connection failed',
      {
        component: 'Home',
        environment: process.env.NODE_ENV,
      }
    );
    return <ErrorPage message="Database connection failed" />;
  }

  // Read system mode and optional home button toggles
  let cfg;
  try {
    const result = await svc
      .from("app_config")
      .select("key, value")
      .in("key", [
        "system_mode",
        "system_disabled",
        "system_disabled_message",
        "home_button_exams",
        "home_button_results",
        "home_button_register",
        "home_button_id",
      ]);
    cfg = result.data;
    
    if (result.error) {
      throw result.error;
    }
  } catch (error) {
    // Log configuration loading error
    logSystemError(
      'config_loading',
      error instanceof Error ? error : 'Failed to load configuration',
      {
        component: 'Home',
      }
    );
    return <ErrorPage message="Configuration loading failed" />;
  }

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
  const idToggle = cfgMap.get("home_button_id");
  const showExams = mode === "disabled"
    ? false
    : (examsToggle != null ? examsToggle === "true" : mode === "exam");
  const showResults = mode === "disabled"
    ? false
    : (resultsToggle != null ? resultsToggle === "true" : mode === "results");
  const showRegister = mode === "disabled"
    ? false
    : (registerToggle === "true");
  const showIdCard = mode === "disabled"
    ? false
    : (idToggle === "true");

  // Determine responsive layout based on how many cards are visible
  const visibleCount = (showExams ? 1 : 0) + (showResults ? 1 : 0) + (showRegister ? 1 : 0) + (mode === "disabled" ? 0 : 1); // +1 for Public ID when not disabled

  return (
    <PublicLocaleProvider>
      <ErrorBoundary
        fallback={<CodeFirstRouterFallback />}
      >
        <CodeFirstRouter
          mode={mode}
          disabledMessage={disabledMessage}
          showExams={showExams}
          showResults={showResults}
          showRegister={showRegister}
          showIdCard={showIdCard}
        />
      </ErrorBoundary>
    </PublicLocaleProvider>
  );
 }

 // Legacy inline pages removed in favor of a unified landing page

/**
 * Fallback UI for CodeFirstRouter component failures
 * Provides a graceful degradation with recovery options
 */
function CodeFirstRouterFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md mx-auto text-center">
        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-lg backdrop-blur-sm">
          <div className="w-16 h-16 mx-auto mb-6 bg-orange-100 rounded-full flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-600">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <path d="M12 9v4"/>
              <path d="m12 17 .01 0"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">
            Loading Issue
          </h1>
          <p className="text-gray-600 mb-6 leading-relaxed">
            We're having trouble loading the application. This might be a temporary issue.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full btn btn-primary"
            >
              Refresh Page
            </button>
            <Link href="/exams" className="block w-full btn btn-secondary">
              Go to Exams
            </Link>
          </div>
          <div className="mt-6 text-sm text-gray-500">
            If the problem persists, please contact your administrator.
          </div>
        </div>
      </div>
    </div>
  );
}

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
