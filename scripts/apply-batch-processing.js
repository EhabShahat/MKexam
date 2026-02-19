#!/usr/bin/env node

/**
 * Apply batch processing optimizations to RPC functions
 * 
 * This script:
 * 1. Creates the batch_calculate_results function
 * 2. Updates cleanup_expired_attempts to use batch size of 100
 * 3. Updates regrade_exam to use batch processing
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyBatchProcessing() {
  console.log('🚀 Applying batch processing optimizations...\n');

  try {
    // Read the RPC functions file
    const sqlPath = path.join(__dirname, '..', 'db', 'rpc_functions.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Extract the batch_calculate_results function
    const batchCalcMatch = sql.match(
      /-- Batch calculate results[\s\S]*?CREATE OR REPLACE FUNCTION public\.batch_calculate_results[\s\S]*?\$function\$;[\s\S]*?GRANT EXECUTE ON FUNCTION public\.batch_calculate_results/
    );

    if (!batchCalcMatch) {
      console.error('❌ Could not find batch_calculate_results function in rpc_functions.sql');
      process.exit(1);
    }

    console.log('📝 Creating batch_calculate_results function...');
    const { error: batchError } = await supabase.rpc('exec_sql', {
      sql: batchCalcMatch[0]
    });

    if (batchError) {
      console.error('❌ Error creating batch_calculate_results:', batchError.message);
      process.exit(1);
    }
    console.log('✅ batch_calculate_results function created\n');

    // Extract the optimized cleanup_expired_attempts function
    const cleanupMatch = sql.match(
      /-- cleanup_expired_attempts[\s\S]*?CREATE OR REPLACE FUNCTION public\.cleanup_expired_attempts[\s\S]*?\$function\$;/
    );

    if (!cleanupMatch) {
      console.error('❌ Could not find cleanup_expired_attempts function in rpc_functions.sql');
      process.exit(1);
    }

    console.log('📝 Updating cleanup_expired_attempts with batch size 100...');
    const { error: cleanupError } = await supabase.rpc('exec_sql', {
      sql: cleanupMatch[0]
    });

    if (cleanupError) {
      console.error('❌ Error updating cleanup_expired_attempts:', cleanupError.message);
      process.exit(1);
    }
    console.log('✅ cleanup_expired_attempts updated\n');

    // Extract the optimized regrade_exam function
    const regradeMatch = sql.match(
      /-- Regrade all attempts for an exam \(admin only\)[\s\S]*?-- Optimized version using batch processing[\s\S]*?CREATE OR REPLACE FUNCTION public\.regrade_exam[\s\S]*?\$function\$;[\s\S]*?GRANT EXECUTE ON FUNCTION public\.regrade_exam/
    );

    if (!regradeMatch) {
      console.error('❌ Could not find regrade_exam function in rpc_functions.sql');
      process.exit(1);
    }

    console.log('📝 Updating regrade_exam with batch processing...');
    const { error: regradeError } = await supabase.rpc('exec_sql', {
      sql: regradeMatch[0]
    });

    if (regradeError) {
      console.error('❌ Error updating regrade_exam:', regradeError.message);
      process.exit(1);
    }
    console.log('✅ regrade_exam updated\n');

    console.log('✅ All batch processing optimizations applied successfully!\n');
    console.log('📊 Summary:');
    console.log('   • batch_calculate_results: Processes up to 100 attempts per batch');
    console.log('   • cleanup_expired_attempts: Batch size increased to 100');
    console.log('   • regrade_exam: Now uses batch processing instead of one-by-one\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the script
applyBatchProcessing();
