/**
 * Utility functions for exporting data with Arabic language support
 */

import * as XLSX from 'xlsx';

export interface ExportOptions {
  filename: string;
  headers: string[];
  data: (string | number | boolean | null | undefined)[][];
  includeTimestamp?: boolean;
  rtlSupport?: boolean;
}

export interface XLSXExportOptions extends ExportOptions {
  sheetName?: string;
  metadata?: {
    title?: string;
    description?: string;
    calculationSettings?: Record<string, any>;
    exportDate?: Date;
  };
  formatting?: {
    headerStyle?: any; // XLSX cell style object
    numberFormat?: string;
    percentageFormat?: string;
  };
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
  'Student Code': 'كود الطالب',
  'Email': 'البريد الإلكتروني',
  'Score': 'الدرجة',
  'Total': 'المجموع',
  'Percentage': 'النسبة المئوية',
  'Status': 'الحالة',
  'Date': 'التاريخ',
  'Time': 'الوقت',
  'Duration': 'المدة',
  'Exam Title': 'عنوان الامتحان',
  'Exam': 'امتحان',
  'Extra': 'إضافي',
  'Submitted At': 'تاريخ التسليم',
  'Grade': 'الدرجة',
  'Passed': 'نجح',
  'Failed': 'رسب',
  'In Progress': 'قيد التقدم',
  'Not Started': 'لم يبدأ',
  'Final Score': 'الدرجة النهائية',
  'Exam Component Score': 'درجة مكون الامتحان',
  'Exam Calculation Mode': 'طريقة حساب الامتحان',
  'Exams Included': 'الامتحانات المشمولة',
  'Exams Passed': 'الامتحانات المجتازة',
  'Extra Component Score': 'درجة المكون الإضافي',
  'Extra Total Weight': 'الوزن الإجمالي الإضافي',
  'Normalized': 'مُعدّل',
  'Weight': 'الوزن',
  'Contribution': 'المساهمة',
  'Best': 'الأفضل',
  'Average': 'المتوسط',
  'Error': 'خطأ',
  'Student Summaries': 'ملخصات الطلاب',
  'Detailed score breakdown for': 'تفصيل الدرجات لـ',
  'students': 'طلاب',
  'Metadata': 'البيانات الوصفية',
  'Export Information': 'معلومات التصدير',
  'Export Date': 'تاريخ التصدير',
  'Title': 'العنوان',
  'Description': 'الوصف',
  'Calculation Settings': 'إعدادات الحساب',
  'Pass Calculation Mode': 'طريقة حساب النجاح',
  'Overall Pass Threshold': 'حد النجاح الإجمالي',
  'Exam Weight': 'وزن الامتحان',
  'Exam Score Source': 'مصدر درجة الامتحان',
  'Fail on Any Exam': 'الرسوب في أي امتحان',
  
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

/**
 * Sanitizes sheet names for Excel compatibility
 * Excel sheet names cannot contain: : \ / ? * [ ]
 * Excel sheet names cannot exceed 31 characters
 */
function sanitizeSheetName(name: string): string {
  // Remove invalid characters
  let sanitized = name.replace(/[:\\/\?\*\[\]]/g, '-');
  
  // Truncate to 31 characters if needed
  if (sanitized.length > 31) {
    sanitized = sanitized.substring(0, 31);
  }
  
  // Ensure it's not empty
  if (sanitized.trim().length === 0) {
    sanitized = 'Sheet1';
  }
  
  return sanitized.trim();
}

/**
 * Creates an XLSX workbook with proper Arabic/RTL support and formatting
 */
export function createArabicCompatibleXLSX(options: XLSXExportOptions): ArrayBuffer {
  const { 
    headers, 
    data, 
    sheetName = 'Data',
    metadata,
    formatting = {}
  } = options;
  
  // Create a new workbook
  const workbook = XLSX.utils.book_new();
  
  // Sanitize sheet name for Excel compatibility
  const sanitizedSheetName = sanitizeSheetName(sheetName);
  
  // Default formatting
  const defaultHeaderStyle: any = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "366092" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }
  };
  
  const headerStyle = { ...defaultHeaderStyle, ...formatting.headerStyle };
  const numberFormat = formatting.numberFormat || "0.00";
  const percentageFormat = formatting.percentageFormat || "0.00%";
  
  // Create main data worksheet
  const worksheetData: any[][] = [];
  
  // Add headers
  worksheetData.push(headers);
  
  // Add data rows
  data.forEach(row => {
    const processedRow = row.map(cell => {
      if (cell === null || cell === undefined) return '';
      return cell;
    });
    worksheetData.push(processedRow);
  });
  
  // Create worksheet from data
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  
  // Apply formatting to headers
  const headerRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!worksheet[cellAddress]) continue;
    
    worksheet[cellAddress].s = headerStyle;
  }
  
  // Apply number formatting to numeric columns
  for (let row = 1; row <= headerRange.e.r; row++) {
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[cellAddress];
      
      if (!cell || typeof cell.v !== 'number') continue;
      
      // Determine format based on header content
      const header = headers[col]?.toLowerCase() || '';
      if (header.includes('score') || header.includes('درجة') || 
          header.includes('percentage') || header.includes('نسبة') ||
          header.includes('contribution') || header.includes('مساهمة')) {
        cell.z = numberFormat;
      } else if (header.includes('weight') || header.includes('وزن')) {
        cell.z = numberFormat;
      }
      
      // Add border to data cells
      cell.s = {
        border: {
          top: { style: "thin", color: { rgb: "CCCCCC" } },
          bottom: { style: "thin", color: { rgb: "CCCCCC" } },
          left: { style: "thin", color: { rgb: "CCCCCC" } },
          right: { style: "thin", color: { rgb: "CCCCCC" } }
        },
        numFmt: cell.z
      };
    }
  }
  
  // Set column widths for better readability
  const columnWidths: XLSX.ColInfo[] = headers.map((header, index) => {
    const maxLength = Math.max(
      header.length,
      ...data.map(row => String(row[index] || '').length)
    );
    return { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
  });
  
  worksheet['!cols'] = columnWidths;
  
  // Add the main worksheet
  XLSX.utils.book_append_sheet(workbook, worksheet, sanitizedSheetName);
  
  // Create metadata sheet if provided
  if (metadata) {
    const metadataData: any[][] = [
      [getBilingualHeader('Export Information'), ''],
      ['', ''],
      [getBilingualHeader('Export Date'), formatArabicDate(metadata.exportDate || new Date())],
      [getBilingualHeader('Title'), metadata.title || ''],
      [getBilingualHeader('Description'), metadata.description || ''],
      ['', '']
    ];
    
    // Add calculation settings if provided
    if (metadata.calculationSettings) {
      metadataData.push([getBilingualHeader('Calculation Settings'), '']);
      metadataData.push(['', '']);
      
      Object.entries(metadata.calculationSettings).forEach(([key, value]) => {
        const translatedKey = getBilingualHeader(key);
        const translatedValue = typeof value === 'boolean' ? 
          formatArabicBoolean(value) : 
          String(value);
        metadataData.push([translatedKey, translatedValue]);
      });
    }
    
    const metadataWorksheet = XLSX.utils.aoa_to_sheet(metadataData);
    
    // Style the metadata sheet
    const metadataRange = XLSX.utils.decode_range(metadataWorksheet['!ref'] || 'A1');
    
    // Style headers in metadata
    for (let row = 0; row <= metadataRange.e.r; row++) {
      const cellA = metadataWorksheet[XLSX.utils.encode_cell({ r: row, c: 0 })];
      if (cellA && cellA.v && String(cellA.v).includes('/')) {
        cellA.s = {
          font: { bold: true, color: { rgb: "366092" } },
          alignment: { horizontal: "left" }
        };
      }
    }
    
    // Set column widths for metadata
    metadataWorksheet['!cols'] = [
      { wch: 30 }, // Key column
      { wch: 50 }  // Value column
    ];
    
    XLSX.utils.book_append_sheet(workbook, metadataWorksheet, sanitizeSheetName(getBilingualHeader('Metadata')));
  }
  
  // Write workbook to buffer
  const buffer = XLSX.write(workbook, { 
    type: 'array', 
    bookType: 'xlsx',
    compression: true
  });
  
  return buffer;
}

/**
 * Downloads an XLSX file with Arabic support and formatting
 */
export function downloadArabicXLSX(options: XLSXExportOptions): void {
  const { filename, includeTimestamp = true } = options;
  
  try {
    const buffer = createArabicCompatibleXLSX(options);
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const link = document.createElement('a');
    link.href = url;
    
    // Generate filename with timestamp if requested
    const timestamp = includeTimestamp 
      ? new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')
      : '';
    
    const finalFilename = includeTimestamp && timestamp
      ? `${filename}-${timestamp}.xlsx`
      : `${filename}.xlsx`;
    
    link.download = finalFilename;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to download XLSX:', error);
    throw new Error('فشل في تحميل الملف / Failed to download file');
  }
}
