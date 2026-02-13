#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const { loadEnv } = require('./utils/load-env');

loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    db: { schema: 'public' },
    auth: { persistSession: false }
  }
);

async function applyFunctions() {
  console.log('Applying fixed SQL functions directly...\n');

  // Function 1: sync_homework_and_quiz_scores
  console.log('1. Creating sync_homework_and_quiz_scores()...');
  const func1 = `
CREATE OR REPLACE FUNCTION sync_homework_and_quiz_scores()
RETURNS TABLE(
  student_id uuid,
  student_code text,
  homework_score numeric,
  quiz_score numeric
) AS $func$
BEGIN
  RETURN QUERY
  WITH homework_exams AS (
    SELECT COUNT(*) as total_count
    FROM exams
    WHERE exam_type = 'homework' AND status = 'done'
  ),
  quiz_exams AS (
    SELECT COUNT(*) as total_count
    FROM exams
    WHERE exam_type = 'quiz' AND status = 'done'
  ),
  homework_scores AS (
    SELECT 
      s.id as student_id,
      s.code as student_code,
      COALESCE(SUM(COALESCE(er.final_score_percentage, er.score_percentage)), 0) as total_homework_score,
      (SELECT total_count FROM homework_exams) as total_homework_exams
    FROM students s
    LEFT JOIN exam_attempts ea ON ea.student_id = s.id AND ea.completion_status = 'submitted'
    LEFT JOIN exams e ON e.id = ea.exam_id AND e.exam_type = 'homework' AND e.status = 'done'
    LEFT JOIN exam_results er ON er.attempt_id = ea.id
    GROUP BY s.id, s.code
  ),
  quiz_scores AS (
    SELECT 
      s.id as student_id,
      s.code as student_code,
      COALESCE(SUM(COALESCE(er.final_score_percentage, er.score_percentage)), 0) as total_quiz_score,
      (SELECT total_count FROM quiz_exams) as total_quiz_exams
    FROM students s
    LEFT JOIN exam_attempts ea ON ea.student_id = s.id AND ea.completion_status = 'submitted'
    LEFT JOIN exams e ON e.id = ea.exam_id AND e.exam_type = 'quiz' AND e.status = 'done'
    LEFT JOIN exam_results er ON er.attempt_id = ea.id
    GROUP BY s.id, s.code
  )
  SELECT 
    s.id as student_id,
    s.code as student_code,
    CASE 
      WHEN h.total_homework_exams > 0 THEN ROUND(h.total_homework_score / h.total_homework_exams)
      ELSE 0
    END as homework_score,
    CASE 
      WHEN q.total_quiz_exams > 0 THEN ROUND(q.total_quiz_score / q.total_quiz_exams)
      ELSE 0
    END as quiz_score
  FROM students s
  LEFT JOIN homework_scores h ON h.student_id = s.id
  LEFT JOIN quiz_scores q ON q.student_id = s.id
  ORDER BY s.code;
END;
$func$ LANGUAGE plpgsql;
  `;

  try {
    const { error } = await supabase.rpc('exec_sql', { sql: func1 });
    if (error) throw error;
    console.log('   ✓ Created successfully\n');
  } catch (err) {
    console.error('   ✗ Error:', err.message, '\n');
  }

  // Function 2: sync_all_extra_scores
  console.log('2. Creating sync_all_extra_scores()...');
  const func2 = `
CREATE OR REPLACE FUNCTION sync_all_extra_scores()
RETURNS TABLE(
  updated_count bigint,
  message text
) AS $func$
DECLARE
  update_count bigint := 0;
BEGIN
  WITH attendance_stats AS (
    SELECT 
      s.id as student_id,
      CASE 
        WHEN (SELECT COUNT(DISTINCT session_date) FROM attendance_records) > 0 THEN 
          ROUND((COALESCE(COUNT(DISTINCT ar.session_date), 0)::numeric / (SELECT COUNT(DISTINCT session_date) FROM attendance_records)::numeric) * 100)
        ELSE 0
      END as attendance_percentage
    FROM students s
    LEFT JOIN attendance_records ar ON ar.student_id = s.id
    GROUP BY s.id
  )
  UPDATE extra_scores es
  SET 
    data = jsonb_set(
      COALESCE(es.data, '{}'::jsonb),
      '{attendance_percentage}',
      to_jsonb(ast.attendance_percentage)
    ),
    updated_at = NOW()
  FROM attendance_stats ast
  WHERE es.student_id = ast.student_id;
  
  GET DIAGNOSTICS update_count = ROW_COUNT;
  
  WITH homework_exams AS (
    SELECT COUNT(*) as total_count
    FROM exams
    WHERE exam_type = 'homework' AND status = 'done'
  ),
  quiz_exams AS (
    SELECT COUNT(*) as total_count
    FROM exams
    WHERE exam_type = 'quiz' AND status = 'done'
  ),
  homework_scores AS (
    SELECT 
      s.id as student_id,
      COALESCE(SUM(COALESCE(er.final_score_percentage, er.score_percentage)), 0) as total_homework_score,
      (SELECT total_count FROM homework_exams) as total_homework_exams
    FROM students s
    LEFT JOIN exam_attempts ea ON ea.student_id = s.id AND ea.completion_status = 'submitted'
    LEFT JOIN exams e ON e.id = ea.exam_id AND e.exam_type = 'homework' AND e.status = 'done'
    LEFT JOIN exam_results er ON er.attempt_id = ea.id
    GROUP BY s.id
  ),
  quiz_scores AS (
    SELECT 
      s.id as student_id,
      COALESCE(SUM(COALESCE(er.final_score_percentage, er.score_percentage)), 0) as total_quiz_score,
      (SELECT total_count FROM quiz_exams) as total_quiz_exams
    FROM students s
    LEFT JOIN exam_attempts ea ON ea.student_id = s.id AND ea.completion_status = 'submitted'
    LEFT JOIN exams e ON e.id = ea.exam_id AND e.exam_type = 'quiz' AND e.status = 'done'
    LEFT JOIN exam_results er ON er.attempt_id = ea.id
    GROUP BY s.id
  ),
  combined_scores AS (
    SELECT 
      s.id as student_id,
      CASE 
        WHEN h.total_homework_exams > 0 THEN ROUND(h.total_homework_score / h.total_homework_exams)
        ELSE 0
      END as homework_score,
      CASE 
        WHEN q.total_quiz_exams > 0 THEN ROUND(q.total_quiz_score / q.total_quiz_exams)
        ELSE 0
      END as quiz_score
    FROM students s
    LEFT JOIN homework_scores h ON h.student_id = s.id
    LEFT JOIN quiz_scores q ON q.student_id = s.id
  )
  UPDATE extra_scores es
  SET 
    data = jsonb_set(
      jsonb_set(
        COALESCE(es.data, '{}'::jsonb),
        '{exam_type_homework}',
        to_jsonb(cs.homework_score)
      ),
      '{exam_type_quiz}',
      to_jsonb(cs.quiz_score)
    ),
    updated_at = NOW()
  FROM combined_scores cs
  WHERE es.student_id = cs.student_id;
  
  RETURN QUERY SELECT update_count, 'Successfully synced attendance, homework, and quiz scores for all students'::text;
END;
$func$ LANGUAGE plpgsql;
  `;

  try {
    const { error } = await supabase.rpc('exec_sql', { sql: func2 });
    if (error) throw error;
    console.log('   ✓ Created successfully\n');
  } catch (err) {
    console.error('   ✗ Error:', err.message, '\n');
  }

  // Now run the sync
  console.log('3. Running sync_all_extra_scores()...');
  try {
    const { data, error } = await supabase.rpc('sync_all_extra_scores');
    if (error) throw error;
    console.log('   ✓ Sync completed');
    if (data && data.length > 0) {
      console.log(`   Updated: ${data[0].updated_count} students\n`);
    }
  } catch (err) {
    console.error('   ✗ Error:', err.message, '\n');
  }

  // Verify
  console.log('4. Verifying student 3422...');
  const { data: student } = await supabase
    .from('students')
    .select('id')
    .eq('code', '3422')
    .single();

  if (student) {
    const { data: scores } = await supabase
      .from('extra_scores')
      .select('data')
      .eq('student_id', student.id)
      .single();

    if (scores) {
      console.log(`   Attendance: ${scores.data.attendance_percentage}% (expected: 20%)`);
      console.log(`   Homework: ${scores.data.exam_type_homework}% (expected: 14%)`);
      console.log(`   Quiz: ${scores.data.exam_type_quiz}% (expected: ~1%)`);
    }
  }

  console.log('\n✓ Done!');
}

applyFunctions().catch(console.error);
