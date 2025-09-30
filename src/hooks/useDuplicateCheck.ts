import { useState, useEffect } from "react";
import { authFetch } from "@/lib/authFetch";

export interface DuplicateStudent {
  student: {
    id: string;
    code: string;
    student_name: string | null;
    mobile_number: string | null;
    mobile_number2: string | null;
    national_id: string | null;
    created_at: string;
  };
  score: number;
  reasons: string[];
  matchType: 'exact' | 'high' | 'medium';
}

export interface DuplicateCheckResult {
  duplicates: DuplicateStudent[];
  isLoading: boolean;
  error: string | null;
}

interface CheckParams {
  student_name?: string;
  mobile_number?: string;
  national_id?: string;
}

// Fast name-only duplicate check hook
export function useNameDuplicateCheck(
  name: string,
  debounceMs: number = 300
): DuplicateCheckResult {
  const [result, setResult] = useState<DuplicateCheckResult>({
    duplicates: [],
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    // Don't check if name is empty or too short
    const trimmedName = name?.trim() || '';
    if (trimmedName.length < 2) {
      setResult({
        duplicates: [],
        isLoading: false,
        error: null,
      });
      return;
    }

    // Debounce the API call
    const timeoutId = setTimeout(async () => {
      setResult(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await authFetch("/api/admin/students/check-duplicates", {
          method: "POST",
          body: JSON.stringify({ student_name: trimmedName }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "Failed to check duplicates");
        }

        setResult({
          duplicates: data.duplicates || [],
          isLoading: false,
          error: null,
        });
      } catch (error: any) {
        setResult({
          duplicates: [],
          isLoading: false,
          error: error?.message || "Failed to check duplicates",
        });
      }
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [name, debounceMs]);

  return result;
}

// Original full duplicate check hook (kept for backward compatibility)
export function useDuplicateCheck(
  params: CheckParams,
  debounceMs: number = 500
): DuplicateCheckResult {
  const [result, setResult] = useState<DuplicateCheckResult>({
    duplicates: [],
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    // Don't check if all fields are empty or too short
    const hasValidName = params.student_name && params.student_name.trim().length >= 2;
    const hasValidMobile = params.mobile_number && params.mobile_number.replace(/\D/g, '').length >= 8;
    const hasValidNationalId = params.national_id && params.national_id.trim().length >= 5;

    if (!hasValidName && !hasValidMobile && !hasValidNationalId) {
      setResult({
        duplicates: [],
        isLoading: false,
        error: null,
      });
      return;
    }

    // Debounce the API call
    const timeoutId = setTimeout(async () => {
      setResult(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const cleanParams: CheckParams = {};
        
        // Only include valid values
        if (hasValidName) {
          cleanParams.student_name = params.student_name!.trim();
        }
        if (hasValidMobile) {
          cleanParams.mobile_number = params.mobile_number!.trim();
        }
        if (hasValidNationalId) {
          cleanParams.national_id = params.national_id!.trim();
        }

        const response = await authFetch("/api/admin/students/check-duplicates", {
          method: "POST",
          body: JSON.stringify(cleanParams),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "Failed to check duplicates");
        }

        setResult({
          duplicates: data.duplicates || [],
          isLoading: false,
          error: null,
        });
      } catch (error: any) {
        setResult({
          duplicates: [],
          isLoading: false,
          error: error?.message || "Failed to check duplicates",
        });
      }
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [params.student_name, params.mobile_number, params.national_id, debounceMs]);

  return result;
}

export default useDuplicateCheck;
