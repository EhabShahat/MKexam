#!/usr/bin/env node
/**
 * Investigation script for attendance and exam score issues
 */

const { createClient } = require('@supabase/supabase-js');
const { loadEnv } = require('./utils/load-env');

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigate() {
  console.log('=== INVESTIGATING SCORE CALCULATION ISSUES ===\n');

  // 1. Check total unique session dates in attendance_records
  console.log('1. Checking attendance records...');
  const { data: sessionDates, error: sessionError } = await supabase
    .rpc('execute_sql', {
      query: 'SELECT DISTINCT session_date FROM attendance_records ORDER BY session_date'
    });
  
  if (sessionError) {
    console.error('Error fetching session dates:', sessionError);
  } else {
    console.log(`   Total unique session dates: ${sessionDates?.length || 0}`);
    if (sessionDates && sessionDates.length > 0) {
      console.log('   Session dates:', sessionDates.map(d => d.session_date).join(', '));
    }
  }

  // 2. Check student 3422 homework attempts
  console.log('\n2. Checking student 3422 (ehab) homework scores...');
  const { data: student3422, error: studentError } = await supabase
    .from('students')
    .select('id, code, student_name')
    .eq('code', '3422')
    .single();

  if (studentError) {
    console.error('Error fetching student 3422:', studentError);
  } else if (student3422) {
    console.log(`   Student: ${student3422.student_name} (${student3422.code})`);
    
    // Get homework attempts
    const { data: homeworkAttempts, error: hwError } = await supabase
      .from('exam_attempts')
      .select(`
        id,
        exam_id,
        completion_status,
        submitted_at,
        exams!inner(id, title, exam_type, status),
        exam_results(score_percentage, final_score_percentage)
      `)
      .eq('student_id', student3422.id)
      .eq('exams.exam_type', 'homework')
      .eq('exams.status', 'done')
      .eq('completion_status', 'submitted');

    if (hwError) {
      console.error('Error fetching homework attempts:', hwError);
    } else {
      console.log(`   Total homework attempts: ${homeworkAttempts?.length || 0}`);
      if (homeworkAttempts && homeworkAttempts.length > 0) {
        homeworkAttempts.forEach((attempt, idx) => {
          const result = Array.isArray(attempt.exam_results) ? attempt.exam_results[0] : attempt.exam_results;
          const score = result?.final_score_percentage ?? result?.score_percentage ?? 0;
          console.log(`   ${idx + 1}. ${attempt.exams.title}: ${score}%`);
        });
        
        const scores = homeworkAttempts.map(a => {
          const result = Array.isArray(a.exam_results) ? a.exam_results[0] : a.exam_results;
          return result?.final_score_percentage ?? result?.score_percentage ?? 0;
        });
        const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        console.log(`   Average: ${Math.round(avg)}%`);
      }
    }

    // Get quiz attempts
    const { data: quizAttempts, error: qzError } = await supabase
      .from('exam_attempts')
      .select(`
        id,
        exam_id,
        completion_status,
        submitted_at,
        exams!inner(id, title, exam_type, status),
        exam_results(score_percentage, final_score_percentage)
      `)
      .eq('student_id', student3422.id)
      .eq('exams.exam_type', 'quiz')
      .eq('exams.status', 'done')
      .eq('completion_status', 'submitted');

    if (qzError) {
      console.error('Error fetching quiz attempts:', qzError);
    } else {
      console.log(`\n   Total quiz attempts: ${quizAttempts?.length || 0}`);
      if (quizAttempts && quizAttempts.length > 0) {
        quizAttempts.forEach((attempt, idx) => {
          const result = Array.isArray(attempt.exam_results) ? attempt.exam_results[0] : attempt.exam_results;
          const score = result?.final_score_percentage ?? result?.score_percentage ?? 0;
          console.log(`   ${idx + 1}. ${attempt.exams.title}: ${score}%`);
        });
        
        const scores = quizAttempts.map(a => {
          const result = Array.isArray(a.exam_results) ? a.exam_results[0] : a.exam_results;
          return result?.final_score_percentage ?? result?.score_percentage ?? 0;
        });
        const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        console.log(`   Average: ${Math.round(avg)}%`);
      }
    }

    // Check attendance
    const { data: attendance, error: attError } = await supabase
      .from('attendance_records')
      .select('session_date')
      .eq('student_id', student3422.id)
      .order('session_date');

    if (attError) {
      console.error('Error fetching attendance:', attError);
    } else {
      const uniqueDates = [...new Set(attendance?.map(a => a.session_date) || [])];
      console.log(`\n   Attendance: ${uniqueDates.length} sessions attended`);
      if (uniqueDates.length > 0) {
        console.log(`   Dates: ${uniqueDates.join(', ')}`);
      }
    }

    // Check current extra_scores
    const { data: extraScores, error: extraError } = await supabase
      .from('extra_scores')
      .select('data')
      .eq('student_id', student3422.id)
      .single();

    if (extraError && extraError.code !== 'PGRST116') {
      console.error('Error fetching extra scores:', extraError);
    } else if (extraScores) {
      console.log('\n   Current extra_scores data:', JSON.stringify(extraScores.data, null, 2));
    }
  }

  // 3. Check all homework and quiz exams
  console.log('\n3. Checking all homework exams...');
  const { data: allHomework, error: allHwError } = await supabase
    .from('exams')
    .select('id, title, exam_type, status')
    .eq('exam_type', 'homework')
    .eq('status', 'done')
    .order('created_at');

  if (allHwError) {
    console.error('Error fetching homework exams:', allHwError);
  } else {
    console.log(`   Total homework exams: ${allHomework?.length || 0}`);
  }

  console.log('\n4. Checking all quiz exams...');
  const { data: allQuiz, error: allQzError } = await supabase
    .from('exams')
    .select('id, title, exam_type, status')
    .eq('exam_type', 'quiz')
    .eq('status', 'done')
    .order('created_at');

  if (allQzError) {
    console.error('Error fetching quiz exams:', allQzError);
  } else {
    console.log(`   Total quiz exams: ${allQuiz?.length || 0}`);
  }

  console.log('\n=== INVESTIGATION COMPLETE ===');
}

investigate().catch(console.error);
