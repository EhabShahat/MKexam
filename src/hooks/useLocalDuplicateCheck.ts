import { useMemo, useState, useEffect } from "react";

export interface DuplicateStudent {
  student: {
    id: string;
    code: string;
    student_name: string | null;
    mobile_number: string | null;
    mobile_number2?: string | null;
    national_id?: string | null;
    created_at: string;
  };
  score: number;
  reasons: string[];
  matchType: 'exact' | 'high' | 'medium';
}

interface Student {
  student_id: string;
  code: string;
  student_name: string | null;
  mobile_number: string | null;
  mobile_number2?: string | null;
  address?: string | null;
  national_id?: string | null;
  student_created_at: string;
}

// Normalize Arabic text for better matching
function normalizeArabicText(text: string): string {
  return text
    .toLowerCase()
    // Normalize Arabic Alif variations
    .replace(/[أإآا]/g, 'ا')
    // Normalize Arabic Yaa variations  
    .replace(/[ىئي]/g, 'ي')
    // Normalize Arabic Haa variations
    .replace(/[هة]/g, 'ه')
    // Normalize Arabic Taa Marbouta
    .replace(/ة/g, 'ه')
    // Remove diacritics (Tashkeel)
    .replace(/[\u064B-\u0652]/g, '')
    // Remove extra spaces
    .replace(/\s+/g, ' ')
    .trim();
}

// Fast string similarity calculation optimized for names
function calculateStringSimilarity(str1: string, str2: string): number {
  const normalized1 = normalizeArabicText(str1);
  const normalized2 = normalizeArabicText(str2);
  
  // Quick exact match check
  if (normalized1 === normalized2) return 1.0;
  
  // Quick length difference check - if very different lengths, likely not similar
  const lengthRatio = Math.min(normalized1.length, normalized2.length) / Math.max(normalized1.length, normalized2.length);
  if (lengthRatio < 0.5) return 0;
  
  // Check if one contains the other (common for names)
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return lengthRatio * 0.9; // High similarity for containment
  }
  
  // Word-based similarity for multi-word names
  const words1 = normalized1.split(' ').filter(w => w.length > 1);
  const words2 = normalized2.split(' ').filter(w => w.length > 1);
  
  if (words1.length > 1 || words2.length > 1) {
    let matchingWords = 0;
    for (const word1 of words1) {
      for (const word2 of words2) {
        if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
          matchingWords++;
          break;
        }
      }
    }
    const wordSimilarity = matchingWords / Math.max(words1.length, words2.length);
    if (wordSimilarity > 0.5) return wordSimilarity;
  }
  
  // Fallback to character-based similarity for short names
  const set1 = new Set(normalized1.split(''));
  const set2 = new Set(normalized2.split(''));
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
}

// Fast and optimized name duplicate check with debouncing
export function useLocalNameDuplicateCheck(
  name: string,
  students: Student[]
): DuplicateStudent[] {
  const [debouncedName, setDebouncedName] = useState('');
  const [duplicates, setDuplicates] = useState<DuplicateStudent[]>([]);

  // Debounce the name input to reduce lag
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedName(name);
    }, 300); // Wait 300ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [name]);

  // Process duplicates when debounced name changes
  useEffect(() => {
    const trimmedName = debouncedName?.trim() || '';
    if (trimmedName.length < 2) {
      setDuplicates([]);
      return;
    }

    // Fast, simple matching - prioritize performance
    const inputLower = normalizeArabicText(trimmedName);
    const results: DuplicateStudent[] = [];
    
    // Early exit after finding enough matches
    for (let i = 0; i < students.length && results.length < 5; i++) {
      const student = students[i];
      if (!student.student_name) continue;

      const dbLower = normalizeArabicText(student.student_name);
      let score = 0;
      let reasons: string[] = [];

      // Quick exact match check
      if (inputLower === dbLower) {
        score = 100;
        reasons.push("Exact name match");
      }
      // Simple contains check (fast)
      else if (inputLower.length >= 3 && dbLower.includes(inputLower)) {
        score = 80;
        reasons.push("Name contains input");
      }
      else if (dbLower.length >= 3 && inputLower.includes(dbLower)) {
        score = 75;
        reasons.push("Input contains name");
      }
      // Quick character overlap check (faster than full similarity)
      else if (inputLower.length >= 3) {
        let commonChars = 0;
        for (const char of inputLower) {
          if (dbLower.includes(char)) commonChars++;
        }
        const overlap = commonChars / inputLower.length;
        if (overlap >= 0.6) {
          score = Math.floor(overlap * 50);
          reasons.push("Similar name");
        }
      }

      if (score >= 30) {
        results.push({
          student: {
            id: student.student_id,
            code: student.code,
            student_name: student.student_name,
            mobile_number: student.mobile_number,
            mobile_number2: student.mobile_number2,
            national_id: student.national_id,
            created_at: student.student_created_at,
          },
          score,
          reasons,
          matchType: score >= 95 ? 'exact' as const : score >= 60 ? 'high' as const : 'medium' as const
        });
      }
    }

    setDuplicates(results.sort((a, b) => b.score - a.score));
  }, [debouncedName, students]);

  return duplicates;
}

// Optimized duplicate check for mobile/national ID
export function useLocalDuplicateCheck(
  params: {
    mobile_number?: string;
    national_id?: string;
  },
  students: Student[]
): DuplicateStudent[] {
  return useMemo(() => {
    // Don't check if all fields are empty or too short
    const hasValidMobile = params.mobile_number && params.mobile_number.replace(/\D/g, '').length >= 8;
    const hasValidNationalId = params.national_id && params.national_id.trim().length >= 5;
    
    if (!hasValidMobile && !hasValidNationalId) {
      return [];
    }

    const results: DuplicateStudent[] = [];
    const cleanInput = hasValidMobile ? params.mobile_number!.replace(/\D/g, '') : '';
    const nationalInput = hasValidNationalId ? params.national_id!.trim() : '';

    // Early exit loop for performance
    for (let i = 0; i < students.length && results.length < 3; i++) {
      const student = students[i];
      let score = 0;
      let reasons: string[] = [];
      
      // Fast mobile number check
      if (hasValidMobile) {
        const cleanDb1 = (student.mobile_number || '').replace(/\D/g, '');
        const cleanDb2 = (student.mobile_number2 || '').replace(/\D/g, '');
        
        if (cleanDb1 === cleanInput || cleanDb2 === cleanInput) {
          score = 100;
          reasons.push("Same mobile number");
        }
      }
      
      // Fast national ID check
      if (hasValidNationalId && student.national_id && 
          student.national_id.trim() === nationalInput) {
        score = 100;
        reasons.push("Same national ID");
      }
      
      if (score >= 100) {
        results.push({
          student: {
            id: student.student_id,
            code: student.code,
            student_name: student.student_name,
            mobile_number: student.mobile_number,
            mobile_number2: student.mobile_number2,
            national_id: student.national_id,
            created_at: student.student_created_at,
          },
          score,
          reasons,
          matchType: 'exact' as const
        });
      }
    }

    return results;
  }, [params.mobile_number, params.national_id, students]);
}

export default useLocalNameDuplicateCheck;
