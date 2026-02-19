#!/usr/bin/env node

/**
 * Test batch processing RPC functions
 * 
 * This script tests:
 * 1. batch_calculate_results with various batch sizes
 * 2. cleanup_expired_attempts batch processing
 * 3. regrade_exam batch processing
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testBatchCalculateResults() {
  console.log('🧪 Testing batch_calculate_results...\n');

  try {
    // Get some submitted attempts to test with
    const { data: attempts, error: fetchError } = await supabase
      .from('exam_attempts')
      .select('id')
      .eq('completion_status', 'submitted')
      .limit(10);

    if (fetchError) {
      console.error('❌ Error fetching attempts:', fetchError.message);
      return false;
    }

    if (!attempts || attempts.length === 0) {
      console.log('⚠️  No submitted attempts found to test with');
      return true;
    }

    const attemptIds = attempts.map(a => a.id);
    console.log(`📊 Testing with ${attemptIds.length} attempts`);

    // Test batch_calculate_results
    const startTime = Date.now();
    const { data, error } = await supabase.rpc('batch_calculate_results', {
      p_attempt_ids: attemptIds
    });

    const duration = Date.now() - startTime;

    if (error) {
      console.error('❌ Error calling batch_calculate_results:', error.message);
      return false;
    }

    console.log(`✅ batch_calculate_results completed in ${duration}ms`);
    console.log(`   Processed ${data?.length || 0} attempts`);
    
    if (data && data.length > 0) {
      console.log(`   Sample result:`, {
        attempt_id: data[0].attempt_id,
        total_questions: data[0].total_questions,
        correct_count: data[0].correct_count,
        score_percentage: data[0].score_percentage
      });
    }

    return true;
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

async function testBatchSizeLimits() {
  console.log('\n🧪 Testing batch size limits...\n');

  try {
    // Test with empty array
    console.log('📊 Testing with empty array...');
    const { data: emptyData, error: emptyError } = await supabase.rpc('batch_calculate_results', {
      p_attempt_ids: []
    });

    if (emptyError) {
      console.error('❌ Error with empty array:', emptyError.message);
      return false;
    }

    console.log('✅ Empty array handled correctly');

    // Test with single item
    const { data: attempts, error: fetchError } = await supabase
      .from('exam_attempts')
      .select('id')
      .eq('completion_status', 'submitted')
      .limit(1)
      .single();

    if (fetchError || !attempts) {
      console.log('⚠️  No attempts found for single-item test');
      return true;
    }

    console.log('📊 Testing with single attempt...');
    const { data: singleData, error: singleError } = await supabase.rpc('batch_calculate_results', {
      p_attempt_ids: [attempts.id]
    });

    if (singleError) {
      console.error('❌ Error with single item:', singleError.message);
      return false;
    }

    console.log('✅ Single item handled correctly');
    console.log(`   Result count: ${singleData?.length || 0}`);

    return true;
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

async function testCleanupExpiredAttempts() {
  console.log('\n🧪 Testing cleanup_expired_attempts...\n');

  try {
    console.log('📊 Running cleanup_expired_attempts...');
    const startTime = Date.now();
    
    const { data, error } = await supabase.rpc('cleanup_expired_attempts');
    
    const duration = Date.now() - startTime;

    if (error) {
      console.error('❌ Error calling cleanup_expired_attempts:', error.message);
      return false;
    }

    console.log(`✅ cleanup_expired_attempts completed in ${duration}ms`);
    console.log(`   Auto-submitted ${data || 0} expired attempts`);

    return true;
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

async function testRegradeExam() {
  console.log('\n🧪 Testing regrade_exam batch processing...\n');

  try {
    // Find an exam with some attempts
    const { data: exams, error: examError } = await supabase
      .from('exams')
      .select('id, title')
      .limit(1);

    if (examError || !exams || exams.length === 0) {
      console.log('⚠️  No exams found to test with');
      return true;
    }

    const exam = exams[0];
    
    // Check how many attempts this exam has
    const { count, error: countError } = await supabase
      .from('exam_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('exam_id', exam.id);

    if (countError) {
      console.error('❌ Error counting attempts:', countError.message);
      return false;
    }

    console.log(`📊 Testing regrade_exam on exam "${exam.title}"`);
    console.log(`   Exam has ${count || 0} attempts`);

    if (count === 0) {
      console.log('⚠️  No attempts to regrade');
      return true;
    }

    const startTime = Date.now();
    const { data, error } = await supabase.rpc('regrade_exam', {
      p_exam_id: exam.id
    });

    const duration = Date.now() - startTime;

    if (error) {
      console.error('❌ Error calling regrade_exam:', error.message);
      return false;
    }

    console.log(`✅ regrade_exam completed in ${duration}ms`);
    console.log(`   Regraded ${data || 0} attempts`);
    console.log(`   Average time per attempt: ${((duration / (data || 1))).toFixed(2)}ms`);

    return true;
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Testing Batch Processing RPC Functions\n');
  console.log('=' .repeat(60) + '\n');

  const results = {
    batchCalculate: await testBatchCalculateResults(),
    batchSizeLimits: await testBatchSizeLimits(),
    cleanup: await testCleanupExpiredAttempts(),
    regrade: await testRegradeExam()
  };

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Summary:\n');
  console.log(`   batch_calculate_results: ${results.batchCalculate ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Batch size limits: ${results.batchSizeLimits ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   cleanup_expired_attempts: ${results.cleanup ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   regrade_exam: ${results.regrade ? '✅ PASS' : '❌ FAIL'}`);

  const allPassed = Object.values(results).every(r => r);
  console.log(`\n${allPassed ? '✅ All tests passed!' : '❌ Some tests failed'}\n`);

  process.exit(allPassed ? 0 : 1);
}

// Run the tests
runTests();
