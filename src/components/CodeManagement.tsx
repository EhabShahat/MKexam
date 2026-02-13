"use client";

import { useState } from "react";
import { useStudentLocale } from "@/components/public/PublicLocaleProvider";
import { t } from "@/i18n/student";

interface CodeManagementProps {
  currentCode: string;
  onClearCode: () => void;
  onChangeCode: () => void;
  compact?: boolean;
}

/**
 * CodeManagement component provides interface for viewing and managing stored codes
 * Supports both compact and full display modes with confirmation dialogs
 */
export default function CodeManagement({
  currentCode,
  onClearCode,
  onChangeCode,
  compact = false
}: CodeManagementProps) {
  const { locale } = useStudentLocale();
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [showManagement, setShowManagement] = useState(!compact);

  const handleClearCode = () => {
    setShowConfirmClear(false);
    onClearCode();
  };

  const handleChangeCode = () => {
    onChangeCode();
  };

  if (compact) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2m-2-2h-6m6 0v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9a2 2 0 012-2h6z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{t(locale, "current_code")}</p>
              <p className="text-xs text-gray-500 font-mono">{currentCode}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowManagement(!showManagement)}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
              aria-label={showManagement ? t(locale, "hide_code_management") : t(locale, "show_code_management")}
            >
              {showManagement ? t(locale, "hide") : t(locale, "manage")}
            </button>
          </div>
        </div>
        
        {showManagement && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowConfirmClear(true)}
                  className="text-xs bg-red-50 text-red-700 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-200 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                  aria-label={t(locale, "clear_stored_code")}
                >
                  {t(locale, "clear_code")}
                </button>
                <button
                  onClick={handleChangeCode}
                  className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                  aria-label={t(locale, "change_to_different_code")}
                >
                  {t(locale, "change_code")}
                </button>
              </div>
              <p className="text-xs text-gray-500">
                {t(locale, "code_management_help")}
              </p>
            </div>
          </div>
        )}

        {/* Confirmation Dialog for Clear Code */}
        {showConfirmClear && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xl max-w-md w-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{t(locale, "confirm_clear_code")}</h3>
                  <p className="text-sm text-gray-600">{t(locale, "clear_code_warning")}</p>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">{t(locale, "current_code")}:</span>
                  <span className="font-mono ml-2">{currentCode}</span>
                </p>
              </div>
              
              <div className="flex items-center gap-3 justify-end">
                <button
                  onClick={() => setShowConfirmClear(false)}
                  className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
                >
                  {t(locale, "cancel")}
                </button>
                <button
                  onClick={handleClearCode}
                  className="px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                >
                  {t(locale, "clear_code")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full display mode
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2m-2-2h-6m6 0v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9a2 2 0 012-2h6z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{t(locale, "code_management")}</h3>
          <p className="text-sm text-gray-600">{t(locale, "manage_your_stored_code")}</p>
        </div>
      </div>
      
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">{t(locale, "current_code")}</p>
            <p className="text-lg font-mono text-gray-700 mt-1">{currentCode}</p>
          </div>
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleChangeCode}
            className="flex-1 bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-3 rounded-lg border border-blue-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 text-sm font-medium"
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              {t(locale, "change_code")}
            </div>
          </button>
          
          <button
            onClick={() => setShowConfirmClear(true)}
            className="flex-1 bg-red-50 text-red-700 hover:bg-red-100 px-4 py-3 rounded-lg border border-red-200 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 text-sm font-medium"
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {t(locale, "clear_code")}
            </div>
          </button>
        </div>
        
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-xs text-blue-800">
            <span className="font-medium">{t(locale, "note")}:</span> {t(locale, "code_management_note")}
          </p>
        </div>
      </div>

      {/* Confirmation Dialog for Clear Code */}
      {showConfirmClear && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xl max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{t(locale, "confirm_clear_code")}</h3>
                <p className="text-sm text-gray-600">{t(locale, "clear_code_warning")}</p>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-700">
                <span className="font-medium">{t(locale, "current_code")}:</span>
                <span className="font-mono ml-2">{currentCode}</span>
              </p>
            </div>
            
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowConfirmClear(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
              >
                {t(locale, "cancel")}
              </button>
              <button
                onClick={handleClearCode}
                className="px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
              >
                {t(locale, "clear_code")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}