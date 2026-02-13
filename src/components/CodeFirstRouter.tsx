"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useStudentCode } from "@/hooks/useStudentCode";
import MultiExamEntry from "@/components/public/MultiExamEntry";
import PublicHome from "@/components/public/PublicHome";
import ErrorBoundary from "@/components/ErrorBoundary";
import { logSystemError } from "@/lib/errorLogger";
import { 
  trackNavigationTransition, 
  resetFlowPerformance, 
  logFlowPerformanceSummary,
  useRenderPerformance 
} from "@/lib/reorderedFlowPerformance";
import React from "react";

interface CodeFirstRouterProps {
  mode: "exam" | "results" | "disabled";
  disabledMessage: string | null;
  showExams: boolean;
  showResults: boolean;
  showRegister: boolean;
  showIdCard: boolean;
}

interface CodeFirstRouterState {
  hasValidCode: boolean;
  isLoading: boolean;
}

/**
 * CodeFirstRouter orchestrates the code-first flow with three stages:
 * 
 * Flow:
 * 1. Check for stored code on mount
 * 2. If no valid stored code -> show MultiExamEntry (code input only)
 * 3. If valid stored code exists -> show PublicHome (buttons: Results/Exams)
 * 4. When user clicks "Exams" -> show available exams for that code
 */
export default function CodeFirstRouter(props: CodeFirstRouterProps) {
  const { mode, disabledMessage, showExams, showResults, showRegister, showIdCard } = props;
  const { storedCode, isValidating, hasValidCode, clearCode } = useStudentCode();
  
  const [state, setState] = useState<CodeFirstRouterState>({
    hasValidCode: false,
    isLoading: true,
  });

  // Performance tracking
  const transitionStartTime = useRef<number>(0);
  const componentMountTime = useRef<number>(performance.now());
  
  // Track render performance for this component
  useRenderPerformance('CodeFirstRouter');

  // Reset flow performance tracking on mount
  useEffect(() => {
    resetFlowPerformance();
    componentMountTime.current = performance.now();
    
    // Log performance summary when component unmounts
    return () => {
      logFlowPerformanceSummary();
    };
  }, []);

  // Check stored code validity on mount
  useEffect(() => {
    async function checkStoredCode() {
      const checkStartTime = performance.now();
      
      try {
        if (isValidating) {
          setState(prev => ({ ...prev, isLoading: true }));
          return;
        }

        if (!storedCode) {
          // No stored code, show code input
          setState({
            hasValidCode: false,
            isLoading: false,
          });
          
          // Track navigation to code input
          trackNavigationTransition(
            'initial_load',
            componentMountTime.current,
            performance.now(),
            { destination: 'code_input', hasStoredCode: false }
          );
          return;
        }

        // Use the hasValidCode from the hook directly
        setState({
          hasValidCode: hasValidCode,
          isLoading: false,
        });
        
        // Track navigation based on code validity
        const destination = hasValidCode ? 'main_page' : 'code_input';
        trackNavigationTransition(
          'initial_load',
          componentMountTime.current,
          performance.now(),
          { destination, hasStoredCode: true, codeValid: hasValidCode }
        );
      } catch (error) {
        // Log error and show code input as fallback
        logSystemError(
          'code_validation_check',
          error instanceof Error ? error : 'Failed to check stored code',
          {
            component: 'CodeFirstRouter',
          }
        );
        
        // Fallback to code input on error
        setState({
          hasValidCode: false,
          isLoading: false,
        });
        
        // Track error recovery navigation
        trackNavigationTransition(
          'error_recovery',
          checkStartTime,
          performance.now(),
          { error: 'code_validation_check_failed', destination: 'code_input' }
        );
      }
    }

    checkStoredCode();
  }, [storedCode, isValidating, hasValidCode]);

  // Handle code clearing from main page
  const handleCodeClear = useCallback(() => {
    const clearStartTime = performance.now();
    transitionStartTime.current = clearStartTime;
    
    try {
      clearCode();
      setState({
        hasValidCode: false,
        isLoading: false,
      });
      
      // Track navigation from main page to code input
      trackNavigationTransition(
        'main_to_code',
        clearStartTime,
        performance.now(),
        { trigger: 'manual_clear', success: true }
      );
    } catch (error) {
      // Log error but still attempt to clear state
      logSystemError(
        'code_clear_error',
        error instanceof Error ? error : 'Failed to clear code',
        {
          component: 'CodeFirstRouter',
        }
      );
      
      // Still update state to show code input
      setState({
        hasValidCode: false,
        isLoading: false,
      });
      
      // Track error recovery navigation
      trackNavigationTransition(
        'error_recovery',
        clearStartTime,
        performance.now(),
        { error: 'code_clear_failed', destination: 'code_input' }
      );
    }
  }, [clearCode]);

  // Show loading state while validating
  if (state.isLoading || isValidating) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-lg backdrop-blur-sm">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Checking your access...</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // If system is disabled, always show PublicHome with disabled state
  if (mode === "disabled") {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-xl">
          <PublicHome
            mode={mode}
            disabledMessage={disabledMessage}
            showExams={showExams}
            showResults={showResults}
            showRegister={showRegister}
          />
        </div>
      </main>
    );
  }

  // If has valid code, show main page with code management
  if (state.hasValidCode && storedCode) {
    // Determine responsive layout based on how many cards are visible
    const visibleCount = (showExams ? 1 : 0) + (showResults ? 1 : 0) + (showRegister ? 1 : 0) + 1; // +1 for Public ID
    const containerMaxW = visibleCount === 1
      ? "max-w-md"
      : visibleCount === 2
        ? "max-w-2xl"
        : visibleCount === 3
          ? "max-w-3xl"
          : "max-w-4xl";

    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className={`w-full ${containerMaxW}`}>
          <ErrorBoundary
            fallback={<PublicHomeFallback onRetry={() => window.location.reload()} />}
            onError={(error, errorInfo) => {
              logSystemError(
                'public_home_error',
                error,
                {
                  component: 'PublicHome',
                }
              );
            }}
          >
            <PublicHome
              mode={mode}
              disabledMessage={disabledMessage}
              showExams={showExams}
              showResults={showResults}
              showRegister={showRegister}
              currentCode={storedCode}
              onCodeClear={handleCodeClear}
            />
          </ErrorBoundary>
        </div>
      </main>
    );
  }

  // No valid code, show code input interface
  return (
    <ErrorBoundary
      fallback={<MultiExamEntryFallback onRetry={() => window.location.reload()} />}
      onError={(error, errorInfo) => {
        logSystemError(
          'multi_exam_entry_error',
          error,
          {
            component: 'MultiExamEntry',
          }
        );
      }}
    >
      <MultiExamEntry 
        showExams={showExams}
        showResults={showResults}
        showRegister={showRegister}
        showIdCard={showIdCard}
      />
    </ErrorBoundary>
  );
}

/**
 * Fallback UI for PublicHome component failures
 */
function PublicHomeFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-lg backdrop-blur-sm">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-6 bg-orange-100 rounded-full flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-600">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
            <path d="M12 9v4"/>
            <path d="m12 17 .01 0"/>
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Main Page Error
        </h2>
        <p className="text-gray-600 mb-6">
          We're having trouble loading the main page. You can try refreshing or go directly to exams.
        </p>
        <div className="space-y-3">
          <button
            onClick={onRetry}
            className="w-full btn btn-primary"
          >
            Refresh Page
          </button>
          <a href="/exams" className="block w-full btn btn-secondary">
            Go to Exams
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Fallback UI for MultiExamEntry component failures
 */
function MultiExamEntryFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-lg backdrop-blur-sm">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-6 bg-orange-100 rounded-full flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-600">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                <path d="M12 9v4"/>
                <path d="m12 17 .01 0"/>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Code Entry Error
            </h2>
            <p className="text-gray-600 mb-6">
              We're having trouble loading the code entry form. Please try refreshing the page.
            </p>
            <div className="space-y-3">
              <button
                onClick={onRetry}
                className="w-full btn btn-primary"
              >
                Refresh Page
              </button>
              <a href="/exams" className="block w-full btn btn-secondary">
                Go to Exams
              </a>
            </div>
            <div className="mt-6 text-sm text-gray-500">
              If you have a student code, you can try entering it directly in the URL: /exam/[your-code]
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}