/**
 * Utility functions for exporting data with Arabic language support
 */

export interface ExportOptions {
  filename: string;
  headers: string[];
  data: (string | number | boolean | null | undefined)[][];
  includeTimestamp?: boolean;
  rtlSupport?: boolean;
}

/**
 * Creates a CSV blob with proper Arabic/RTL support
 * Uses UTF-8 BOM to ensure proper encoding in Excel and other applications
 */
export function createArabicCompatibleCSV(options: ExportOptions): Blob {
  const { headers, data, rtlSupport = true } = options;
  
  // UTF-8 BOM (Byte Order Mark) for proper Arabic display in Excel
  const BOM = '\uFEFF';
  
  // Escape CSV values properly for Arabic text
  const escapeCSVValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    
    const stringValue = String(value);
    
    // If the value contains commas, quotes, newlines, or Arabic characters, wrap in quotes
    if (stringValue.includes(',') || 
        stringValue.includes('"') || 
        stringValue.includes('\n') || 
        stringValue.includes('\r') ||
        /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(stringValue)) {
      // Escape existing quotes by doubling them
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
  };
  
  // Build CSV content
  const csvLines: string[] = [];
  
  // Add headers
  csvLines.push(headers.map(escapeCSVValue).join(','));
  
  // Add data rows
  data.forEach(row => {
    csvLines.push(row.map(escapeCSVValue).join(','));
  });
  
  // Join with proper line endings
  const csvContent = BOM + csvLines.join('\r\n');
  
  // Create blob with proper MIME type and encoding
  return new Blob([csvContent], { 
    type: 'text/csv;charset=utf-8' 
  });
}

/**
 * Downloads a CSV file with Arabic support
 */
export function downloadArabicCSV(options: ExportOptions): void {
  const { filename, includeTimestamp = true } = options;
  
  try {
    const blob = createArabicCompatibleCSV(options);
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const link = document.createElement('a');
    link.href = url;
    
    // Generate filename with timestamp if requested
    const timestamp = includeTimestamp 
      ? new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')
      : '';
    
    const finalFilename = includeTimestamp && timestamp
      ? `${filename}-${timestamp}.csv`
      : `${filename}.csv`;
    
    link.download = finalFilename;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to download CSV:', error);
    throw new Error('فشل في تحميل الملف / Failed to download file');
  }
}

/**
 * Arabic-friendly date formatting
 */
export function formatArabicDate(date: Date | string | null): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return '';
  
  // Format in Arabic locale with both Arabic and English
  const arabicDate = dateObj.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
  
  const englishDate = dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  return `${arabicDate} (${englishDate})`;
}

/**
 * Arabic-friendly time formatting
 */
export function formatArabicTime(date: Date | string | null): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return '';
  
  return dateObj.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

/**
 * Arabic-friendly number formatting
 */
export function formatArabicNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return '';
  
  // Format with Arabic numerals and proper decimal separator
  return num.toLocaleString('ar-EG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

/**
 * Convert boolean to Arabic text
 */
export function formatArabicBoolean(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value ? 'نعم / Yes' : 'لا / No';
}

/**
 * Arabic translations for common export terms
 */
export const ARABIC_TRANSLATIONS = {
  // Common headers
  'Question #': 'رقم السؤال',
  'Type': 'النوع',
  'Question Text': 'نص السؤال',
  'Options': 'الخيارات',
  'Correct Answer': 'الإجابة الصحيحة',
  'Points': 'النقاط',
  'Required': 'مطلوب',
  'Student Name': 'اسم الطالب',
  'Email': 'البريد الإلكتروني',
  'Score': 'الدرجة',
  'Total': 'المجموع',
  'Percentage': 'النسبة المئوية',
  'Status': 'الحالة',
  'Date': 'التاريخ',
  'Time': 'الوقت',
  'Duration': 'المدة',
  'Exam Title': 'عنوان الامتحان',
  'Submitted At': 'تاريخ التسليم',
  'Grade': 'الدرجة',
  'Passed': 'نجح',
  'Failed': 'رسب',
  'In Progress': 'قيد التقدم',
  'Not Started': 'لم يبدأ',
  
  // Question types
  'true_false': 'صح أم خطأ',
  'single_choice': 'اختيار واحد',
  'multiple_choice': 'اختيار متعدد',
  'multi_select': 'اختيار متعدد (صناديق)',
  'paragraph': 'مقال/فقرة',
  'photo_upload': 'رفع صورة',
  
  // Common values
  'Yes': 'نعم',
  'No': 'لا',
  'True': 'صحيح',
  'False': 'خطأ',
  'Active': 'نشط',
  'Inactive': 'غير نشط',
  'Published': 'منشور',
  'Draft': 'مسودة',
  'Archived': 'مؤرشف'
} as const;

/**
 * Get bilingual header (Arabic + English)
 */
export function getBilingualHeader(englishText: string): string {
  const arabic = ARABIC_TRANSLATIONS[englishText as keyof typeof ARABIC_TRANSLATIONS];
  return arabic ? `${arabic} / ${englishText}` : englishText;
}

/**
 * Get bilingual value for common terms
 */
export function getBilingualValue(englishValue: string): string {
  const arabic = ARABIC_TRANSLATIONS[englishValue as keyof typeof ARABIC_TRANSLATIONS];
  return arabic ? `${arabic} / ${englishValue}` : englishValue;
}
