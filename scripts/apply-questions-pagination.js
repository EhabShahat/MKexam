#!/usr/bin/env node

/**
 * Apply paginated questions RPC function
 * Creates get_exam_questions_paginated function in Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyPaginatedQuestionsRPC() {
  console.log('📦 Applying paginated questions RPC function...\n');

  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'db', 'get_exam_questions_paginated.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('📄 Executing SQL from get_exam_questions_paginated.sql...');

    // Execute the SQL using the exec_sql RPC
    const { data, error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error('❌ Error executing SQL:', error.message);
      process.exit(1);
    }

    console.log('✅ Successfully created get_exam_questions_paginated function\n');

    // Test the function
    console.log('🧪 Testing the function...');
    
    // Get a sample exam ID to test with
    const { data: exams, error: examError } = await supabase
      .from('exams')
      .select('id')
      .limit(1);

    if (examError || !exams || exams.length === 0) {
      console.log('⚠️  No exams found to test with. Function created but not tested.');
      return;
    }

    const testExamId = exams[0].id;
    console.log(`   Testing with exam ID: ${testExamId}`);

    // Test the paginated questions function
    const { data: result, error: testError } = await supabase.rpc(
      'get_exam_questions_paginated',
      {
        p_exam_id: testExamId,
        p_offset: 0,
        p_limit: 5,
        p_exclude_correct_answers: true
      }
    );

    if (testError) {
      console.error('❌ Error testing function:', testError.message);
      process.exit(1);
    }

    console.log('✅ Function test successful!');
    console.log(`   Total questions: ${result.pagination.total}`);
    console.log(`   Returned: ${result.questions.length} questions`);
    console.log(`   Has more: ${result.pagination.has_more}`);
    
    // Verify correct_answers are excluded
    const hasCorrectAnswers = result.questions.some(q => q.correct_answers !== undefined);
    if (hasCorrectAnswers) {
      console.warn('⚠️  Warning: correct_answers found in response (should be excluded for students)');
    } else {
      console.log('✅ Verified: correct_answers properly excluded for students');
    }

    console.log('\n✅ Paginated questions RPC function applied successfully!');
    console.log('\n📝 Usage:');
    console.log('   API: GET /api/exams/[examId]/questions?offset=0&limit=5');
    console.log('   RPC: supabase.rpc("get_exam_questions_paginated", { p_exam_id, p_offset, p_limit, p_exclude_correct_answers })');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the script
applyPaginatedQuestionsRPC();
