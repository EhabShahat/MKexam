#!/usr/bin/env node

/**
 * Apply fix for student_exam_attempts status
 * Run this with: node scripts/apply-student-attempts-fix.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load environment variables from .env.local
const envFile = readFileSync('.env.local', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables. Make sure .env.local has:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🔧 Fixing student_exam_attempts status for submitted exams...\n');

  try {
    // Step 1: Check current state
    console.log('📊 Checking current state...');
    const { data: beforeData, error: beforeError } = await supabase
      .from('student_exam_attempts')
      .select('status, attempt_id, exam_attempts!inner(completion_status, submitted_at)')
      .eq('exam_attempts.completion_status', 'submitted')
      .eq('status', 'in_progress');

    if (beforeError) {
      console.error('❌ Error checking state:', beforeError.message);
      process.exit(1);
    }

    const needsFixCount = beforeData?.length || 0;
    console.log(`   Found ${needsFixCount} submitted attempts still marked as 'in_progress'\n`);

    if (needsFixCount === 0) {
      console.log('✅ No fixes needed! All submitted attempts are already marked as completed.');
      return;
    }

    // Step 2: Fix the data
    console.log('🔄 Updating student_exam_attempts status...');
    
    for (const row of beforeData) {
      const { error: updateError } = await supabase
        .from('student_exam_attempts')
        .update({ 
          status: 'completed',
          completed_at: row.exam_attempts.submitted_at 
        })
        .eq('attempt_id', row.attempt_id);

      if (updateError) {
        console.error(`   ❌ Error updating attempt ${row.attempt_id}:`, updateError.message);
      }
    }

    console.log(`   ✅ Updated ${needsFixCount} records\n`);

    // Step 3: Verify the fix
    console.log('🔍 Verifying fix...');
    const { data: afterData, error: afterError } = await supabase
      .from('student_exam_attempts')
      .select('status, exam_attempts!inner(completion_status)')
      .eq('exam_attempts.completion_status', 'submitted')
      .eq('status', 'in_progress');

    if (afterError) {
      console.error('❌ Error verifying:', afterError.message);
    } else {
      const stillBroken = afterData?.length || 0;
      if (stillBroken > 0) {
        console.log(`   ⚠️  Still ${stillBroken} mismatched records`);
      } else {
        console.log('   ✅ All submitted attempts are now marked as completed!\n');
      }
    }

    console.log('✅ Fix completed!');
    console.log('\n📋 Next steps:');
    console.log('   1. Apply the SQL fix to update the submit_attempt function:');
    console.log('      Run the SQL in db/fix_student_exam_attempts_status.sql in Supabase SQL Editor');
    console.log('   2. Refresh your exam list page to see "Attempted" instead of "Continue"');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

main();
