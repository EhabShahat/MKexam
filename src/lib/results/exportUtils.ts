/**
 * Export Utilities for Results Page
 * 
 * Provides CSV and XLSX export functionality with bilingual headers (English/Arabic)
 * and proper encoding for international text.
 * 
 * Requirements: 8.1-8.11, 13.6, 14.6
 */

import type {
  Attempt,
  Exam,
  StudentSummary,
  ExtraField,
  CalculationResult,
} from './types';
import { parseDeviceInfo } from './deviceParser';

/**
 * Sanitize filename to remove invalid filesystem characters
 * Replaces special characters with underscores
 * 
 * @param filename - Original filename
 * @returns Sanitized filename safe for filesystem
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_') // Keep alphanumeric, Arabic, underscore, hyphen
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
}

/**
 * Format date to Cairo timezone string
 * 
 * @param dateString - ISO date string
 * @returns Formatted date string in Cairo timezone
 */
function formatDateCairo(dateString: string | null): string {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '-';
  }
}

/**
 * Calculate attempt duration in minutes
 * 
 * @param startedAt - Start timestamp
 * @param submittedAt - Submit timestamp
 * @returns Duration in minutes or '-'
 */
function calculateDuration(startedAt: string | null, submittedAt: string | null): string {
  if (!startedAt || !submittedAt) return '-';
  
  try {
    const start = new Date(startedAt).getTime();
    const end = new Date(submittedAt).getTime();
    const durationMinutes = Math.round((end - start) / 60000);
    return durationMinutes.toString();
  } catch {
    return '-';
  }
}

/**
 * Get display score for attempt (handles manual grading)
 * 
 * @param attempt - Attempt record
 * @returns Score percentage or '-'
 */
function getDisplayScore(attempt: Attempt): string {
  if (attempt.manual_pending_count === 0 && attempt.manual_total_count > 0) {
    return attempt.final_score_percentage?.toFixed(2) ?? '-';
  }
  return attempt.score_percentage?.toFixed(2) ?? '-';
}

/**
 * Export individual exam attempts to CSV format
 * Includes bilingual headers and all visible columns
 * 
 * Requirements: 8.1, 8.5, 8.6, 8.7, 8.9, 8.10, 8.11
 * 
 * @param attempts - Array of attempts to export
 * @param exam - Exam information
 * @param deviceUsageMap - Map of device fingerprints to usage counts
 */
export function exportAttemptsToCsv(
  attempts: Attempt[],
  exam: Exam,
  deviceUsageMap: Map<string, number>
): void {
  // Bilingual headers (English / Arabic)
  const headers = [
    'Student Name / اسم الطالب',
    'Student Code / كود الطالب',
    'Score / الدرجة',
    'Status / الحالة',
    'Started At / وقت البدء',
    'Submitted At / وقت التسليم',
    'Duration (min) / المدة (دقيقة)',
    'Device Type / نوع الجهاز',
    'Device Model / موديل الجهاز',
    'Local IP / IP المحلي',
    'Server IP / IP الخادم',
    'Automation Risk / خطر الأتمتة',
    'Device Usage Count / عدد استخدام الجهاز',
    'Manual Grading Status / حالة التصحيح اليدوي',
  ];

  // Build CSV rows
  const rows = attempts.map((attempt) => {
    const deviceInfo = parseDeviceInfo(attempt.device_info);
    const deviceFingerprint = `${deviceInfo.type}-${deviceInfo.model}-${deviceInfo.local_ip}`;
    const usageCount = deviceUsageMap.get(deviceFingerprint) ?? 1;
    
    // Manual grading status
    let manualStatus = '-';
    if (attempt.manual_total_count > 0) {
      if (attempt.manual_pending_count > 0) {
        manualStatus = `Pending: ${attempt.manual_pending_count}/${attempt.manual_total_count}`;
      } else {
        manualStatus = 'Completed';
      }
    }

    return [
      attempt.student_name ?? '-',
      attempt.code ?? '-',
      getDisplayScore(attempt),
      attempt.completion_status,
      formatDateCairo(attempt.started_at),
      formatDateCairo(attempt.submitted_at),
      calculateDuration(attempt.started_at, attempt.submitted_at),
      deviceInfo.type,
      deviceInfo.model,
      deviceInfo.local_ip,
      deviceInfo.server_ip,
      deviceInfo.automation_risk ? 'Yes' : 'No',
      usageCount.toString(),
      manualStatus,
    ];
  });

  // Generate CSV content with UTF-8 BOM for Excel compatibility
  const csvContent = [
    '\uFEFF', // UTF-8 BOM for proper Arabic encoding in Excel
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  // Create and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${sanitizeFilename(exam.title)}_attempts.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export individual exam attempts to XLSX format
 * Includes bilingual headers, formatting, and stage progress data
 * 
 * Requirements: 8.2, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 13.6
 * 
 * @param attempts - Array of attempts to export
 * @param exam - Exam information
 * @param deviceUsageMap - Map of device fingerprints to usage counts
 * @param stageProgress - Optional stage progress data per attempt
 */
export async function exportAttemptsToXlsx(
  attempts: Attempt[],
  exam: Exam,
  deviceUsageMap: Map<string, number>,
  stageProgress?: Map<string, any[]>
): Promise<void> {
  // Dynamic import to reduce initial bundle size
  const XLSX = await import('xlsx');

  // Bilingual headers
  const headers = [
    'Student Name / اسم الطالب',
    'Student Code / كود الطالب',
    'Score / الدرجة',
    'Status / الحالة',
    'Started At / وقت البدء',
    'Submitted At / وقت التسليم',
    'Duration (min) / المدة (دقيقة)',
    'Device Type / نوع الجهاز',
    'Device Model / موديل الجهاز',
    'Local IP / IP المحلي',
    'Server IP / IP الخادم',
    'Automation Risk / خطر الأتمتة',
    'Device Usage Count / عدد استخدام الجهاز',
    'Manual Grading Status / حالة التصحيح اليدوي',
  ];

  // Build data rows
  const data = attempts.map((attempt) => {
    const deviceInfo = parseDeviceInfo(attempt.device_info);
    const deviceFingerprint = `${deviceInfo.type}-${deviceInfo.model}-${deviceInfo.local_ip}`;
    const usageCount = deviceUsageMap.get(deviceFingerprint) ?? 1;
    
    let manualStatus = '-';
    if (attempt.manual_total_count > 0) {
      if (attempt.manual_pending_count > 0) {
        manualStatus = `Pending: ${attempt.manual_pending_count}/${attempt.manual_total_count}`;
      } else {
        manualStatus = 'Completed';
      }
    }

    return [
      attempt.student_name ?? '-',
      attempt.code ?? '-',
      getDisplayScore(attempt),
      attempt.completion_status,
      formatDateCairo(attempt.started_at),
      formatDateCairo(attempt.submitted_at),
      calculateDuration(attempt.started_at, attempt.submitted_at),
      deviceInfo.type,
      deviceInfo.model,
      deviceInfo.local_ip,
      deviceInfo.server_ip,
      deviceInfo.automation_risk ? 'Yes' : 'No',
      usageCount.toString(),
      manualStatus,
    ];
  });

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

  // Apply formatting
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  
  // Bold headers
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!ws[cellAddress]) continue;
    ws[cellAddress].s = {
      font: { bold: true },
      alignment: { horizontal: 'center' },
    };
  }

  // Set column widths
  ws['!cols'] = [
    { wch: 25 }, // Student Name
    { wch: 15 }, // Student Code
    { wch: 10 }, // Score
    { wch: 12 }, // Status
    { wch: 20 }, // Started At
    { wch: 20 }, // Submitted At
    { wch: 15 }, // Duration
    { wch: 12 }, // Device Type
    { wch: 20 }, // Device Model
    { wch: 15 }, // Local IP
    { wch: 15 }, // Server IP
    { wch: 15 }, // Automation Risk
    { wch: 18 }, // Device Usage Count
    { wch: 25 }, // Manual Grading Status
  ];

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Attempts');

  // Add stage progress sheet if available
  if (stageProgress && stageProgress.size > 0) {
    const stageHeaders = [
      'Student Name / اسم الطالب',
      'Stage Type / نوع المرحلة',
      'Completion / الإكمال',
      'Time Spent (min) / الوقت المستغرق',
      'Watch Percentage / نسبة المشاهدة',
      'Answered Count / عدد الإجابات',
    ];

    const stageData: any[][] = [];
    attempts.forEach((attempt) => {
      const stages = stageProgress.get(attempt.id);
      if (stages && stages.length > 0) {
        stages.forEach((stage: any) => {
          stageData.push([
            attempt.student_name ?? '-',
            stage.type ?? '-',
            stage.completion ?? '-',
            stage.time_spent ? Math.round(stage.time_spent / 60).toString() : '-',
            stage.watch_percentage ? `${stage.watch_percentage}%` : '-',
            stage.answered_count?.toString() ?? '-',
          ]);
        });
      }
    });

    if (stageData.length > 0) {
      const stageWs = XLSX.utils.aoa_to_sheet([stageHeaders, ...stageData]);
      
      // Bold headers
      const stageRange = XLSX.utils.decode_range(stageWs['!ref'] || 'A1');
      for (let col = stageRange.s.c; col <= stageRange.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!stageWs[cellAddress]) continue;
        stageWs[cellAddress].s = {
          font: { bold: true },
          alignment: { horizontal: 'center' },
        };
      }

      stageWs['!cols'] = [
        { wch: 25 },
        { wch: 20 },
        { wch: 15 },
        { wch: 20 },
        { wch: 20 },
        { wch: 18 },
      ];

      XLSX.utils.book_append_sheet(wb, stageWs, 'Stage Progress');
    }
  }

  // Generate and download file
  XLSX.writeFile(wb, `${sanitizeFilename(exam.title)}_attempts.xlsx`);
}

/**
 * Export all exams aggregated data to CSV format
 * Includes student info, exam scores, extra fields, components, and final score
 * 
 * Requirements: 8.3, 8.5, 8.6, 8.9, 8.10, 8.11
 * 
 * @param summaries - Array of student summaries
 * @param exams - Array of exams
 * @param extraFields - Array of visible extra fields
 * @param calculations - Map of student ID to calculation result
 * @param extraData - Map of student ID to extra field data
 */
export function exportAllExamsToCsv(
  summaries: StudentSummary[],
  exams: Exam[],
  extraFields: ExtraField[],
  calculations: Map<string, CalculationResult>,
  extraData: Map<string, Record<string, any>>
): void {
  // Build headers dynamically
  const headers = [
    'Student Name / اسم الطالب',
    'Student Code / كود الطالب',
  ];

  // Add exam columns
  exams.forEach((exam) => {
    headers.push(`${exam.title} (${exam.exam_type})`);
  });

  // Add extra field columns
  extraFields.forEach((field) => {
    headers.push(field.label);
  });

  // Add component and final score columns
  headers.push(
    'Exam Component / مكون الامتحان',
    'Extra Component / المكون الإضافي',
    'Final Score / الدرجة النهائية',
    'Pass/Fail / نجح/رسب'
  );

  // Build data rows
  const rows = summaries.map((summary) => {
    const calculation = calculations.get(summary.student_id);
    const studentExtra = extraData.get(summary.student_id) ?? {};

    const row = [
      summary.student_name,
      summary.code ?? '-',
    ];

    // Add exam scores
    exams.forEach((exam) => {
      const score = summary.scores[exam.id];
      row.push(score !== null && score !== undefined ? score.toFixed(2) : '-');
    });

    // Add extra field values
    extraFields.forEach((field) => {
      const value = studentExtra[field.key];
      row.push(value !== null && value !== undefined ? String(value) : '-');
    });

    // Add calculated scores
    if (calculation) {
      row.push(
        calculation.exam_component.score.toFixed(2),
        calculation.extra_component.score.toFixed(2),
        calculation.final_score.toFixed(2),
        calculation.passed ? 'Pass / نجح' : 'Fail / رسب'
      );
    } else {
      row.push('-', '-', '-', '-');
    }

    return row;
  });

  // Generate CSV content with UTF-8 BOM
  const csvContent = [
    '\uFEFF',
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  // Create and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', 'all_exams.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export all exams aggregated data to XLSX format
 * Includes formatting, conditional formatting for pass/fail, and optional breakdown sheet
 * 
 * Requirements: 8.4, 8.5, 8.6, 8.9, 8.10, 8.11, 13.6
 * 
 * @param summaries - Array of student summaries
 * @param exams - Array of exams
 * @param extraFields - Array of visible extra fields
 * @param calculations - Map of student ID to calculation result
 * @param extraData - Map of student ID to extra field data
 */
export async function exportAllExamsToXlsx(
  summaries: StudentSummary[],
  exams: Exam[],
  extraFields: ExtraField[],
  calculations: Map<string, CalculationResult>,
  extraData: Map<string, Record<string, any>>
): Promise<void> {
  // Dynamic import
  const XLSX = await import('xlsx');

  // Build headers
  const headers = [
    'Student Name / اسم الطالب',
    'Student Code / كود الطالب',
  ];

  exams.forEach((exam) => {
    headers.push(`${exam.title} (${exam.exam_type})`);
  });

  extraFields.forEach((field) => {
    headers.push(field.label);
  });

  headers.push(
    'Exam Component / مكون الامتحان',
    'Extra Component / المكون الإضافي',
    'Final Score / الدرجة النهائية',
    'Pass/Fail / نجح/رسب'
  );

  // Build data rows
  const data = summaries.map((summary) => {
    const calculation = calculations.get(summary.student_id);
    const studentExtra = extraData.get(summary.student_id) ?? {};

    const row: any[] = [
      summary.student_name,
      summary.code ?? '-',
    ];

    exams.forEach((exam) => {
      const score = summary.scores[exam.id];
      row.push(score !== null && score !== undefined ? score.toFixed(2) : '-');
    });

    extraFields.forEach((field) => {
      const value = studentExtra[field.key];
      row.push(value !== null && value !== undefined ? String(value) : '-');
    });

    if (calculation) {
      row.push(
        calculation.exam_component.score.toFixed(2),
        calculation.extra_component.score.toFixed(2),
        calculation.final_score.toFixed(2),
        calculation.passed ? 'Pass / نجح' : 'Fail / رسب'
      );
    } else {
      row.push('-', '-', '-', '-');
    }

    return row;
  });

  // Create main worksheet
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

  // Apply formatting
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  
  // Bold headers
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!ws[cellAddress]) continue;
    ws[cellAddress].s = {
      font: { bold: true },
      alignment: { horizontal: 'center' },
      fill: { fgColor: { rgb: 'E0E0E0' } },
    };
  }

  // Apply conditional formatting for pass/fail column
  const passFailCol = headers.length - 1;
  for (let row = 1; row <= data.length; row++) {
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: passFailCol });
    if (!ws[cellAddress]) continue;
    
    const cellValue = ws[cellAddress].v;
    if (cellValue && cellValue.toString().startsWith('Pass')) {
      ws[cellAddress].s = {
        fill: { fgColor: { rgb: 'C6EFCE' } },
        font: { color: { rgb: '006100' } },
      };
    } else if (cellValue && cellValue.toString().startsWith('Fail')) {
      ws[cellAddress].s = {
        fill: { fgColor: { rgb: 'FFC7CE' } },
        font: { color: { rgb: '9C0006' } },
      };
    }
  }

  // Set column widths
  const colWidths = [
    { wch: 25 }, // Student Name
    { wch: 15 }, // Student Code
  ];
  exams.forEach(() => colWidths.push({ wch: 15 }));
  extraFields.forEach(() => colWidths.push({ wch: 15 }));
  colWidths.push(
    { wch: 18 }, // Exam Component
    { wch: 18 }, // Extra Component
    { wch: 18 }, // Final Score
    { wch: 15 }  // Pass/Fail
  );
  ws['!cols'] = colWidths;

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'All Exams');

  // Add calculation breakdown sheet (optional)
  const breakdownData: any[][] = [];
  summaries.forEach((summary) => {
    const calculation = calculations.get(summary.student_id);
    if (!calculation) return;

    breakdownData.push([
      summary.student_name,
      'Exam Component Details',
      '',
      '',
      '',
    ]);

    calculation.exam_component.details.forEach((detail) => {
      breakdownData.push([
        '',
        detail.exam_title,
        detail.score?.toFixed(2) ?? '-',
        detail.passed ? 'Pass' : 'Fail',
        `Threshold: ${detail.pass_threshold}`,
      ]);
    });

    breakdownData.push([
      '',
      'Extra Component Details',
      '',
      '',
      '',
    ]);

    calculation.extra_component.details.forEach((detail) => {
      breakdownData.push([
        '',
        detail.field_label,
        detail.raw_value,
        detail.normalized_score.toFixed(2),
        detail.weighted_contribution.toFixed(2),
      ]);
    });

    breakdownData.push(['', '', '', '', '']); // Empty row separator
  });

  if (breakdownData.length > 0) {
    const breakdownHeaders = [
      'Student Name',
      'Component/Field',
      'Value/Score',
      'Status/Normalized',
      'Notes/Contribution',
    ];

    const breakdownWs = XLSX.utils.aoa_to_sheet([breakdownHeaders, ...breakdownData]);
    
    // Bold headers
    const breakdownRange = XLSX.utils.decode_range(breakdownWs['!ref'] || 'A1');
    for (let col = breakdownRange.s.c; col <= breakdownRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!breakdownWs[cellAddress]) continue;
      breakdownWs[cellAddress].s = {
        font: { bold: true },
        alignment: { horizontal: 'center' },
      };
    }

    breakdownWs['!cols'] = [
      { wch: 25 },
      { wch: 30 },
      { wch: 15 },
      { wch: 20 },
      { wch: 25 },
    ];

    XLSX.utils.book_append_sheet(wb, breakdownWs, 'Calculation Breakdown');
  }

  // Generate and download file
  XLSX.writeFile(wb, 'all_exams.xlsx');
}
