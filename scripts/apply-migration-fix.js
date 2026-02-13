#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const { loadEnv } = require('./utils/load-env');
const fs = require('fs');
const path = require('path');

loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration() {
  console.log('=== APPLYING SCORE CALCULATION FIX ===\n');

  const migrationPath = path.join(__dirname, '..', 'db', 'fix_score_calc_migration.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('1. Applying migration via Supabase...');
  console.log('   (This will recreate the score calculation functions)\n');

  // Use PostgREST to execute the SQL directly
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ sql })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('   ✗ Error applying migration:', error);
    console.log('\n   Trying alternative method...\n');
    
    // Alternative: Try to apply via psql command if available
    console.log('   Please run this command manually:');
    console.log(`   psql "${process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', 'postgresql://postgres:YOUR_PASSWORD@').replace('.supabase.co', '.supabase.co:5432/postgres')}" < db/fix_score_calc_migration.sql`);
    console.log('\n   Or copy the contents of db/fix_score_calc_migration.sql');
    console.log('   and run it in the Supabase SQL Editor.\n');
    return;
  }

  console.log('   ✓ Migration applied successfully\n');

  console.log('2. Running sync_all_extra_scores() to update all students...');
  const { data, error } = await supabase.rpc('sync_all_extra_scores');

  if (error) {
    console.error('   ✗ Error:', error.message);
    return;
  }

  console.log('   ✓ Sync completed');
  if (data && data.length > 0) {
    console.log(`   Updated: ${data[0].updated_count} students\n`);
  }

  console.log('3. Verifying fix for student 3422...');
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
      console.log(`   Attendance: ${scores.data.attendance_percentage}% (expected: 20% = 1/5 sessions)`);
      console.log(`   Homework: ${scores.data.exam_type_homework}% (expected: 14% = 200/14 exams)`);
      console.log(`   Quiz: ${scores.data.exam_type_quiz}% (expected: ~1% = 118/101 exams)`);
    }
  }

  console.log('\n=== FIX COMPLETE ===');
  console.log('\nThe calculation method has been changed to:');
  console.log('  (Sum of attempted exam scores) / (Total number of exams)');
  console.log('  Non-attempted exams now count as 0%\n');
}

applyMigration().catch(console.error);
