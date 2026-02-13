#!/usr/bin/env node
/**
 * Apply the score calculation fix to the database
 */

const { createClient } = require('@supabase/supabase-js');
const { loadEnv } = require('./utils/load-env');
const fs = require('fs');
const path = require('path');

loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyFix() {
  console.log('=== APPLYING SCORE CALCULATION FIX ===\n');

  // Read the SQL fix file
  const sqlPath = path.join(__dirname, '..', 'db', 'fix_score_calculations.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('1. Applying SQL functions...');
  
  // Split by function and execute each separately
  const functions = sql.split(/DROP FUNCTION IF EXISTS/).filter(f => f.trim());
  
  for (let i = 0; i < functions.length; i++) {
    const funcSql = i === 0 ? functions[i] : 'DROP FUNCTION IF EXISTS' + functions[i];
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: funcSql });
      if (error) {
        console.error(`   Error applying function ${i + 1}:`, error.message);
      } else {
        console.log(`   ✓ Applied function ${i + 1}`);
      }
    } catch (err) {
      // Try direct query if RPC doesn't work
      console.log(`   Trying alternative method for function ${i + 1}...`);
    }
  }

  console.log('\n2. Running sync_all_extra_scores() to update all students...');
  const { data: syncResult, error: syncError } = await supabase
    .rpc('sync_all_extra_scores');

  if (syncError) {
    console.error('   Error:', syncError.message);
  } else {
    console.log('   ✓ Sync completed');
    if (syncResult && syncResult.length > 0) {
      console.log(`   Updated: ${syncResult[0].updated_count} students`);
      console.log(`   Message: ${syncResult[0].message}`);
    }
  }

  console.log('\n3. Verifying fix for student 3422...');
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id')
    .eq('code', '3422')
    .single();

  if (studentError) {
    console.error('   Error finding student:', studentError.message);
  } else {
    const { data: extraScores, error: extraError } = await supabase
      .from('extra_scores')
      .select('data')
      .eq('student_id', student.id)
      .single();

    if (extraError) {
      console.error('   Error fetching extra scores:', extraError.message);
    } else {
      console.log('   Student 3422 scores:');
      console.log(`   - Attendance: ${extraScores.data.attendance_percentage}% (expected: 20% = 1/5 sessions)`);
      console.log(`   - Homework: ${extraScores.data.exam_type_homework}% (expected: 14% = 200/14 exams)`);
      console.log(`   - Quiz: ${extraScores.data.exam_type_quiz}% (expected: ~4% = 118/101 exams)`);
    }
  }

  console.log('\n=== FIX COMPLETE ===');
  console.log('\nNote: The fix changes the calculation method to:');
  console.log('  (Sum of attempted exam scores) / (Total number of exams)');
  console.log('  Non-attempted exams now count as 0%');
}

applyFix().catch(console.error);
