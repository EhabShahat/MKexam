#!/usr/bin/env node

/**
 * Apply JSONB Optimization Functions
 * 
 * This script applies the new RPC functions for JSONB optimization:
 * - save_attempt_v2: Supports answer deltas for incremental updates
 * - start_attempt_v3: Optimizes device_info before storage
 * 
 * Usage: node scripts/apply-jsonb-optimization.js
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

async function applyJSONBOptimization() {
  console.log('🚀 Applying JSONB Optimization Functions...\n');

  try {
    // Read the RPC functions file
    const sqlPath = path.join(__dirname, '..', 'db', 'rpc_functions.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Extract save_attempt_v2 function
    const saveAttemptV2Match = sqlContent.match(
      /CREATE OR REPLACE FUNCTION public\.save_attempt_v2[\s\S]*?\$function\$;/
    );
    
    // Extract start_attempt_v3 function
    const startAttemptV3Match = sqlContent.match(
      /CREATE OR REPLACE FUNCTION public\.start_attempt_v3[\s\S]*?\$function\$;/
    );

    if (!saveAttemptV2Match || !startAttemptV3Match) {
      throw new Error('Could not find JSONB optimization functions in rpc_functions.sql');
    }

    console.log('📝 Found JSONB optimization functions');
    console.log('   - save_attempt_v2 (answer delta support)');
    console.log('   - start_attempt_v3 (device_info optimization)\n');

    // Apply save_attempt_v2
    console.log('⚙️  Creating save_attempt_v2 function...');
    const { error: saveError } = await supabase.rpc('exec_sql', {
      sql: saveAttemptV2Match[0]
    });

    if (saveError) {
      throw new Error(`Failed to create save_attempt_v2: ${saveError.message}`);
    }
    console.log('✅ save_attempt_v2 created successfully\n');

    // Apply grants for save_attempt_v2
    console.log('⚙️  Granting permissions for save_attempt_v2...');
    const grantSaveSQL = `
      GRANT EXECUTE ON FUNCTION public.save_attempt_v2(uuid, jsonb, jsonb, integer, boolean) TO service_role;
      GRANT EXECUTE ON FUNCTION public.save_attempt_v2(uuid, jsonb, jsonb, integer, boolean) TO anon;
      GRANT EXECUTE ON FUNCTION public.save_attempt_v2(uuid, jsonb, jsonb, integer, boolean) TO authenticated;
    `;
    
    const { error: grantSaveError } = await supabase.rpc('exec_sql', {
      sql: grantSaveSQL
    });

    if (grantSaveError) {
      console.warn('⚠️  Warning: Could not grant permissions for save_attempt_v2:', grantSaveError.message);
    } else {
      console.log('✅ Permissions granted for save_attempt_v2\n');
    }

    // Apply start_attempt_v3
    console.log('⚙️  Creating start_attempt_v3 function...');
    const { error: startError } = await supabase.rpc('exec_sql', {
      sql: startAttemptV3Match[0]
    });

    if (startError) {
      throw new Error(`Failed to create start_attempt_v3: ${startError.message}`);
    }
    console.log('✅ start_attempt_v3 created successfully\n');

    // Apply grants for start_attempt_v3
    console.log('⚙️  Granting permissions for start_attempt_v3...');
    const grantStartSQL = `
      GRANT EXECUTE ON FUNCTION public.start_attempt_v3(uuid, text, text, inet, jsonb) TO service_role;
      GRANT EXECUTE ON FUNCTION public.start_attempt_v3(uuid, text, text, inet, jsonb) TO anon;
      GRANT EXECUTE ON FUNCTION public.start_attempt_v3(uuid, text, text, inet, jsonb) TO authenticated;
    `;
    
    const { error: grantStartError } = await supabase.rpc('exec_sql', {
      sql: grantStartSQL
    });

    if (grantStartError) {
      console.warn('⚠️  Warning: Could not grant permissions for start_attempt_v3:', grantStartError.message);
    } else {
      console.log('✅ Permissions granted for start_attempt_v3\n');
    }

    console.log('✅ JSONB Optimization Functions Applied Successfully!\n');
    console.log('📋 Summary:');
    console.log('   ✓ save_attempt_v2: Supports answer deltas for incremental updates');
    console.log('   ✓ start_attempt_v3: Deduplicates IP arrays in device_info');
    console.log('\n💡 Next Steps:');
    console.log('   1. Update frontend code to use save_attempt_v2 with delta mode');
    console.log('   2. Update frontend code to use start_attempt_v3 with device_info');
    console.log('   3. Test answer delta functionality');
    console.log('   4. Test device_info IP deduplication');

  } catch (error) {
    console.error('\n❌ Error applying JSONB optimization:', error.message);
    process.exit(1);
  }
}

// Run the script
applyJSONBOptimization();
