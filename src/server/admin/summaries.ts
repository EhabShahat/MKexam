import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { BatchProcessor } from "@/lib/batchProcessor";
import type { CalculationResult } from "@/lib/scoreCalculator.types";
import { 
  createArabicCompatibleCSV, 
  createArabicCompatibleXLSX,
  getBilingualHeader, 
  formatArabicNumber, 
  formatArabicBoolean,
  formatArabicDate,
  type XLSXExportOptions
} from "@/lib/exportUtils";

function parseCodes(url: URL): string[] {
  const out = new Set<string>();
  const add = (s?: string | null) => {
    if (!s) return;
    for (const part of s.split(",")) {
      const v = part.trim();
      if (v) out.add(v);
    }
  };
  add(url.searchParams.get("codes"));
  // Accept repeated codes[]= and code=
  url.searchParams.getAll("codes[]").forEach(add);
  url.searchParams.getAll("code").forEach(add);
  return Array.from(out);
}

/**
 * Admin Summaries API - GET endpoint
 * 
 * Fetches score summaries for multiple students using the centralized
 * Score Calculator and BatchProcessor for optimal performance.
 * 
 * Query parameters:
 * - codes: Comma-separated list of student codes
 * - codes[]: Array of student codes (repeated parameter)
 * - code: Individual student code (repeated parameter)
 * 
 * Response format:
 * - items: Array of student summaries with calculation results
 * - cached: Whether results were served from cache
 * - calculation_time_ms: Time taken for calculations
 */
export async function adminSummariesGET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    await requireAdmin(req);
    const svc = supabaseServer();
    const url = new URL(req.url);
    const codes = parseCodes(url);
    
    if (!codes.length) {
      return NextResponse.json({ 
        items: [],
        cached: false,
        calculation_time_ms: 0
      });
    }

    // Use BatchProcessor for efficient bulk calculation
    const processor = new BatchProcessor({ 
      batchSize: 200,
      cacheResults: true 
    });
    
    // Track which results came from cache
    const cachedCodes = codes.filter(code => processor.isCached(code));
    const cached = cachedCodes.length === codes.length;
    
    // Process all student codes
    const calculationResults = await processor.processStudents(codes, svc);
    
    // Fetch student names for the response
    const { data: studentsData } = await svc
      .from('students')
      .select('code, student_name')
      .in('code', codes);
    
    const studentNames = new Map<string, string | null>();
    for (const student of studentsData || []) {
      studentNames.set(student.code, student.student_name);
    }
    
    // Build response items
    const items = codes.map(code => {
      const calculation = calculationResults.get(code);
      const studentName = studentNames.get(code) || null;
      
      if (!calculation) {
        // Student not found - return minimal response
        return {
          code,
          student_name: studentName,
          calculation: {
            success: false,
            error: `Student with code ${code} not found`,
            examComponent: {
              score: null,
              mode: 'best' as const,
              examsIncluded: 0,
              examsTotal: 0,
              examsPassed: 0,
              details: [],
            },
            extraComponent: {
              score: null,
              totalWeight: 0,
              details: [],
            },
            finalScore: null,
            passed: null,
            passThreshold: 50,
            failedDueToExam: false,
          },
          extras: [],
          pass_summary: {
            overall_score: null,
            passed: null,
          },
        };
      }
      
      // Build legacy extras format for backward compatibility
      const extras = calculation.extraComponent.details.map(detail => ({
        key: detail.fieldKey,
        value: detail.rawValue,
      }));
      
      // Build legacy pass_summary format for backward compatibility
      const pass_summary = {
        overall_score: calculation.finalScore,
        passed: calculation.passed,
      };
      
      return {
        code,
        student_name: studentName,
        calculation,
        extras,
        pass_summary,
      };
    });
    
    const calculationTime = Date.now() - startTime;
    
    return NextResponse.json({
      items,
      cached,
      calculation_time_ms: calculationTime
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ 
      error: e?.message || "unexpected_error"
    }, { status: 500 });
  }
}

/**
 * Admin Summaries Export API - GET endpoint
 * 
 * Exports detailed score breakdowns for multiple students in CSV format
 * with Arabic language support and comprehensive score component details.
 * 
 * Query parameters:
 * - codes: Comma-separated list of student codes
 * - codes[]: Array of student codes (repeated parameter)
 * - code: Individual student code (repeated parameter)
 * 
 * Response: CSV file with detailed score breakdown
 */
export async function adminSummariesExportGET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const svc = supabaseServer();
    const url = new URL(req.url);
    const codes = parseCodes(url);
    
    if (!codes.length) {
      return NextResponse.json({ 
        error: "No student codes provided" 
      }, { status: 400 });
    }

    // Use BatchProcessor for efficient bulk calculation
    const processor = new BatchProcessor({ 
      batchSize: 200,
      cacheResults: true 
    });
    
    // Process all student codes
    const calculationResults = await processor.processStudents(codes, svc);
    
    // Fetch student names for the response
    const { data: studentsData } = await svc
      .from('students')
      .select('code, student_name')
      .in('code', codes);
    
    const studentNames = new Map<string, string | null>();
    for (const student of studentsData || []) {
      studentNames.set(student.code, student.student_name);
    }

    // Fetch extra fields for column headers
    const { data: extraFieldsData } = await svc
      .from('extra_score_fields')
      .select('*')
      .eq('include_in_pass', true)
      .order('created_at');
    
    const extraFields = extraFieldsData || [];
    
    // Build CSV headers with bilingual support
    const headers = [
      getBilingualHeader('Student Code'),
      getBilingualHeader('Student Name'),
      getBilingualHeader('Final Score'),
      getBilingualHeader('Status'),
      getBilingualHeader('Exam Component Score'),
      getBilingualHeader('Exam Calculation Mode'),
      getBilingualHeader('Exams Included'),
      getBilingualHeader('Exams Passed'),
      getBilingualHeader('Extra Component Score'),
      getBilingualHeader('Extra Total Weight'),
    ];
    
    // Add individual exam score columns
    const allExamIds = new Set<string>();
    const examTitles = new Map<string, string>();
    
    for (const [code, calculation] of calculationResults) {
      if (calculation?.success && calculation.examComponent.details) {
        for (const exam of calculation.examComponent.details) {
          allExamIds.add(exam.examId);
          examTitles.set(exam.examId, exam.examTitle);
        }
      }
    }
    
    // Add exam columns
    for (const examId of Array.from(allExamIds).sort()) {
      const title = examTitles.get(examId) || examId;
      headers.push(`${getBilingualHeader('Exam')}: ${title}`);
      headers.push(`${getBilingualHeader('Exam')}: ${title} (${getBilingualHeader('Passed')})`);
    }
    
    // Add extra field columns
    for (const field of extraFields) {
      headers.push(`${getBilingualHeader('Extra')}: ${field.label}`);
      headers.push(`${getBilingualHeader('Extra')}: ${field.label} (${getBilingualHeader('Normalized')})`);
      headers.push(`${getBilingualHeader('Extra')}: ${field.label} (${getBilingualHeader('Weight')})`);
      headers.push(`${getBilingualHeader('Extra')}: ${field.label} (${getBilingualHeader('Contribution')})`);
    }
    
    // Build data rows
    const rows: (string | number | null)[][] = [];
    
    for (const code of codes) {
      const calculation = calculationResults.get(code);
      const studentName = studentNames.get(code) || '';
      
      if (!calculation || !calculation.success) {
        // Student not found or calculation failed
        const row = [
          code,
          studentName,
          '', // Final Score
          getBilingualHeader('Error'),
          '', // Exam Component Score
          '', // Exam Calculation Mode
          '', // Exams Included
          '', // Exams Passed
          '', // Extra Component Score
          '', // Extra Total Weight
        ];
        
        // Fill exam columns with empty values
        for (const examId of Array.from(allExamIds).sort()) {
          row.push('', ''); // Score and Passed status
        }
        
        // Fill extra field columns with empty values
        for (const field of extraFields) {
          row.push('', '', '', ''); // Raw, Normalized, Weight, Contribution
        }
        
        rows.push(row);
        continue;
      }
      
      // Build main row data
      const row = [
        code,
        studentName,
        calculation.finalScore !== null ? formatArabicNumber(calculation.finalScore) : '',
        calculation.passed === true ? getBilingualHeader('Passed') : 
        calculation.passed === false ? getBilingualHeader('Failed') : '',
        calculation.examComponent.score !== null ? formatArabicNumber(calculation.examComponent.score) : '',
        calculation.examComponent.mode === 'best' ? getBilingualHeader('Best') : getBilingualHeader('Average'),
        formatArabicNumber(calculation.examComponent.examsIncluded),
        formatArabicNumber(calculation.examComponent.examsPassed),
        calculation.extraComponent.score !== null ? formatArabicNumber(calculation.extraComponent.score) : '',
        formatArabicNumber(calculation.extraComponent.totalWeight),
      ];
      
      // Add exam scores
      const examScores = new Map<string, { score: number; passed: boolean | null }>();
      for (const exam of calculation.examComponent.details) {
        examScores.set(exam.examId, { score: exam.score, passed: exam.passed });
      }
      
      for (const examId of Array.from(allExamIds).sort()) {
        const examData = examScores.get(examId);
        if (examData) {
          row.push(formatArabicNumber(examData.score));
          row.push(examData.passed === true ? getBilingualHeader('Yes') : 
                  examData.passed === false ? getBilingualHeader('No') : '');
        } else {
          row.push('', ''); // No attempt for this exam
        }
      }
      
      // Add extra field values
      const extraValues = new Map<string, any>();
      for (const extra of calculation.extraComponent.details) {
        extraValues.set(extra.fieldKey, {
          raw: extra.rawValue,
          normalized: extra.normalizedScore,
          weight: extra.weight,
          contribution: extra.weightedContribution
        });
      }
      
      for (const field of extraFields) {
        const extraData = extraValues.get(field.key);
        if (extraData) {
          // Format raw value based on field type
          let rawValue = '';
          if (field.type === 'boolean') {
            rawValue = formatArabicBoolean(extraData.raw);
          } else if (field.type === 'number') {
            rawValue = formatArabicNumber(extraData.raw);
          } else {
            rawValue = String(extraData.raw || '');
          }
          
          row.push(rawValue);
          row.push(formatArabicNumber(extraData.normalized));
          row.push(formatArabicNumber(extraData.weight));
          row.push(formatArabicNumber(extraData.contribution));
        } else {
          row.push('', '', '', ''); // No data for this field
        }
      }
      
      rows.push(row);
    }
    
    // Generate timestamp for filename
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const filename = `student-summaries-${timestamp}`;
    
    // Create CSV with Arabic support
    const csvBlob = createArabicCompatibleCSV({
      filename,
      headers,
      data: rows,
      includeTimestamp: false, // Already included in filename
      rtlSupport: true
    });
    
    // Convert blob to string for response
    const csvContent = await csvBlob.text();
    
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"; filename*=UTF-8''${encodeURIComponent(filename + '.csv')}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ 
      error: e?.message || "unexpected_error"
    }, { status: 500 });
  }
}

/**
 * Admin Summaries XLSX Export API - GET endpoint
 * 
 * Exports detailed score breakdowns for multiple students in XLSX format
 * with Arabic language support, proper formatting, and metadata sheet.
 * 
 * Query parameters:
 * - codes: Comma-separated list of student codes
 * - codes[]: Array of student codes (repeated parameter)
 * - code: Individual student code (repeated parameter)
 * 
 * Response: XLSX file with detailed score breakdown and metadata
 */
export async function adminSummariesExportXLSXGET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const svc = supabaseServer();
    const url = new URL(req.url);
    const codes = parseCodes(url);
    
    if (!codes.length) {
      return NextResponse.json({ 
        error: "No student codes provided" 
      }, { status: 400 });
    }

    // Use BatchProcessor for efficient bulk calculation
    const processor = new BatchProcessor({ 
      batchSize: 200,
      cacheResults: true 
    });
    
    // Process all student codes
    const calculationResults = await processor.processStudents(codes, svc);
    
    // Fetch student names for the response
    const { data: studentsData } = await svc
      .from('students')
      .select('code, student_name')
      .in('code', codes);
    
    const studentNames = new Map<string, string | null>();
    for (const student of studentsData || []) {
      studentNames.set(student.code, student.student_name);
    }

    // Fetch extra fields for column headers
    const { data: extraFieldsData } = await svc
      .from('extra_score_fields')
      .select('*')
      .eq('include_in_pass', true)
      .order('created_at');
    
    const extraFields = extraFieldsData || [];
    
    // Fetch calculation settings for metadata
    const { data: settingsData } = await svc
      .from('app_config')
      .select('key, value')
      .in('key', [
        'pass_calc_mode',
        'overall_pass_threshold', 
        'exam_weight',
        'exam_score_source',
        'result_fail_on_any_exam'
      ]);
    
    const settings: Record<string, any> = {};
    for (const setting of settingsData || []) {
      settings[setting.key] = setting.value;
    }
    
    // Build CSV headers with bilingual support (same as CSV export)
    const headers = [
      getBilingualHeader('Student Code'),
      getBilingualHeader('Student Name'),
      getBilingualHeader('Final Score'),
      getBilingualHeader('Status'),
      getBilingualHeader('Exam Component Score'),
      getBilingualHeader('Exam Calculation Mode'),
      getBilingualHeader('Exams Included'),
      getBilingualHeader('Exams Passed'),
      getBilingualHeader('Extra Component Score'),
      getBilingualHeader('Extra Total Weight'),
    ];
    
    // Add individual exam score columns
    const allExamIds = new Set<string>();
    const examTitles = new Map<string, string>();
    
    for (const [code, calculation] of calculationResults) {
      if (calculation?.success && calculation.examComponent.details) {
        for (const exam of calculation.examComponent.details) {
          allExamIds.add(exam.examId);
          examTitles.set(exam.examId, exam.examTitle);
        }
      }
    }
    
    // Add exam columns
    for (const examId of Array.from(allExamIds).sort()) {
      const title = examTitles.get(examId) || examId;
      headers.push(`${getBilingualHeader('Exam')}: ${title}`);
      headers.push(`${getBilingualHeader('Exam')}: ${title} (${getBilingualHeader('Passed')})`);
    }
    
    // Add extra field columns
    for (const field of extraFields) {
      headers.push(`${getBilingualHeader('Extra')}: ${field.label}`);
      headers.push(`${getBilingualHeader('Extra')}: ${field.label} (${getBilingualHeader('Normalized')})`);
      headers.push(`${getBilingualHeader('Extra')}: ${field.label} (${getBilingualHeader('Weight')})`);
      headers.push(`${getBilingualHeader('Extra')}: ${field.label} (${getBilingualHeader('Contribution')})`);
    }
    
    // Build data rows (same logic as CSV export)
    const rows: (string | number | null)[][] = [];
    
    for (const code of codes) {
      const calculation = calculationResults.get(code);
      const studentName = studentNames.get(code) || '';
      
      if (!calculation || !calculation.success) {
        // Student not found or calculation failed
        const row = [
          code,
          studentName,
          null, // Final Score
          getBilingualHeader('Error'),
          null, // Exam Component Score
          '', // Exam Calculation Mode
          null, // Exams Included
          null, // Exams Passed
          null, // Extra Component Score
          null, // Extra Total Weight
        ];
        
        // Fill exam columns with empty values
        for (const examId of Array.from(allExamIds).sort()) {
          row.push(null, ''); // Score and Passed status
        }
        
        // Fill extra field columns with empty values
        for (const field of extraFields) {
          row.push('', null, null, null); // Raw, Normalized, Weight, Contribution
        }
        
        rows.push(row);
        continue;
      }
      
      // Build main row data
      const row = [
        code,
        studentName,
        calculation.finalScore,
        calculation.passed === true ? getBilingualHeader('Passed') : 
        calculation.passed === false ? getBilingualHeader('Failed') : '',
        calculation.examComponent.score,
        calculation.examComponent.mode === 'best' ? getBilingualHeader('Best') : getBilingualHeader('Average'),
        calculation.examComponent.examsIncluded,
        calculation.examComponent.examsPassed,
        calculation.extraComponent.score,
        calculation.extraComponent.totalWeight,
      ];
      
      // Add exam scores
      const examScores = new Map<string, { score: number; passed: boolean | null }>();
      for (const exam of calculation.examComponent.details) {
        examScores.set(exam.examId, { score: exam.score, passed: exam.passed });
      }
      
      for (const examId of Array.from(allExamIds).sort()) {
        const examData = examScores.get(examId);
        if (examData) {
          row.push(examData.score);
          row.push(examData.passed === true ? getBilingualHeader('Yes') : 
                  examData.passed === false ? getBilingualHeader('No') : '');
        } else {
          row.push(null, ''); // No attempt for this exam
        }
      }
      
      // Add extra field values
      const extraValues = new Map<string, any>();
      for (const extra of calculation.extraComponent.details) {
        extraValues.set(extra.fieldKey, {
          raw: extra.rawValue,
          normalized: extra.normalizedScore,
          weight: extra.weight,
          contribution: extra.weightedContribution
        });
      }
      
      for (const field of extraFields) {
        const extraData = extraValues.get(field.key);
        if (extraData) {
          // For XLSX, keep raw values as-is for better formatting
          let rawValue: any = extraData.raw;
          if (field.type === 'boolean') {
            rawValue = formatArabicBoolean(extraData.raw);
          }
          
          row.push(rawValue);
          row.push(extraData.normalized);
          row.push(extraData.weight);
          row.push(extraData.contribution);
        } else {
          row.push('', null, null, null); // No data for this field
        }
      }
      
      rows.push(row);
    }
    
    // Generate timestamp for filename
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const filename = `student-summaries-${timestamp}`;
    
    // Create XLSX with Arabic support and metadata
    const xlsxOptions: XLSXExportOptions = {
      filename,
      headers,
      data: rows,
      includeTimestamp: false, // Already included in filename
      rtlSupport: true,
      sheetName: getBilingualHeader('Student Summaries'),
      metadata: {
        title: getBilingualHeader('Student Score Summaries'),
        description: `${getBilingualHeader('Detailed score breakdown for')} ${codes.length} ${getBilingualHeader('students')}`,
        exportDate: new Date(),
        calculationSettings: {
          'Pass Calculation Mode': settings.pass_calc_mode || 'best',
          'Overall Pass Threshold': `${settings.overall_pass_threshold || 50}%`,
          'Exam Weight': settings.exam_weight || 0.7,
          'Exam Score Source': settings.exam_score_source || 'final',
          'Fail on Any Exam': settings.result_fail_on_any_exam || false
        }
      },
      formatting: {
        numberFormat: "0.00",
        percentageFormat: "0.00%"
      }
    };
    
    const buffer = createArabicCompatibleXLSX(xlsxOptions);
    
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"; filename*=UTF-8''${encodeURIComponent(filename + '.xlsx')}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ 
      error: e?.message || "unexpected_error"
    }, { status: 500 });
  }
}
