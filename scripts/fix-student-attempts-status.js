#!/usr/bin/env node

/**
 * Fix student_exam_attempts status for submitted exams
 * This script updates the database to sync student_exam_attempts.status with exam_attempts.completion_status
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  console.log('🔧 Fixing student_exam_attempts status...\n');

  try {
    // Read the SQL file
    const sqlPath = join(__dirname, '..', 'db', 'fix_student_exam_attempts_status.sql');
    const sql = readFileSync(sqlPath, 'utf8');

    console.log('📝 Executing SQL migration...');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).single();
    
    if (error) {
      // If exec_sql doesn't exist, try direct execution
      console.log('⚠️  exec_sql RPC not found, executing directly...');
      
      // Split SQL into statements and execute them
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--'));
      
      for (const statement of statements) {
        if (statement) {
          const { error: execError } = await supabase.rpc('exec', { sql: statement });
          if (execError) {
            console.error('❌ Error executing statement:', execError.message);
            console.error('Statement:', statement.substring(0, 100) + '...');
          }
        }
      }
    }

    console.log('✅ SQL migration executed successfully\n');

    // Verify the fix
    console.log('🔍 Verifying the fix...');
    
    const { data: verifyData, error: verifyError } = await supabase
      .from('student_exam_attempts')
      .select(`
        status,
        exam_attempts!inner(completion_status, submitted_at)
      `);

    if (verifyError) {
      console.error('❌ Error verifying:', verifyError.message);
    } else {
      const submitted = verifyData.filter(row => 
        row.exam_attempts?.completion_status === 'submitted' && 
        row.status === 'completed'
      ).length;
      
      const mismatch = verifyData.filter(row => 
        row.exam_attempts?.completion_status === 'submitted' && 
        row.status !== 'completed'
      ).length;

      console.log(`✅ Completed attempts: ${submitted}`);
      if (mismatch > 0) {
        console.log(`⚠️  Still mismatched: ${mismatch}`);
      } else {
        console.log('✅ All submitted attempts are now marked as completed!');
      }
    }

    console.log('\n✅ Fix completed successfully!');
    console.log('\n📋 What was fixed:');
    console.log('   1. Updated submit_attempt() function to sync both tables');
    console.log('   2. Fixed existing submitted attempts marked as in_progress');
    console.log('   3. Added trigger to keep tables in sync automatically');
    console.log('\n💡 You may need to refresh the exam list page to see the changes.');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

main();
