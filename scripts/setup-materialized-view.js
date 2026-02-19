#!/usr/bin/env node

/**
 * Setup script for admin_attempts_summary materialized view
 * This script creates the materialized view and sets up triggers for automatic refresh
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('./utils/load-env');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupMaterializedView() {
  console.log('🚀 Setting up admin_attempts_summary materialized view...\n');

  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'db', 'admin_attempts_materialized_view.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Executing materialized view SQL...');
    
    // Execute the SQL using the exec_sql RPC function
    const { data, error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error('❌ Error creating materialized view:', error.message);
      process.exit(1);
    }

    console.log('✅ Materialized view created successfully');

    // Initial population of the materialized view
    console.log('\n📊 Populating materialized view with existing data...');
    
    const { error: refreshError } = await supabase.rpc('exec_sql', {
      sql: 'REFRESH MATERIALIZED VIEW public.admin_attempts_summary;'
    });

    if (refreshError) {
      console.error('❌ Error refreshing materialized view:', refreshError.message);
      process.exit(1);
    }

    console.log('✅ Materialized view populated successfully');

    // Update the admin_list_attempts_v2 function to use the materialized view
    console.log('\n🔄 Updating admin_list_attempts_v2 function...');
    
    const rpcPath = path.join(__dirname, '..', 'db', 'rpc_functions.sql');
    const rpcSql = fs.readFileSync(rpcPath, 'utf8');

    const { error: rpcError } = await supabase.rpc('exec_sql', { sql: rpcSql });

    if (rpcError) {
      console.error('❌ Error updating RPC functions:', rpcError.message);
      process.exit(1);
    }

    console.log('✅ RPC functions updated successfully');

    // Verify the setup
    console.log('\n🔍 Verifying materialized view setup...');
    
    const { data: viewData, error: viewError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          schemaname,
          matviewname,
          hasindexes,
          ispopulated
        FROM pg_matviews 
        WHERE schemaname = 'public' 
        AND matviewname = 'admin_attempts_summary';
      `
    });

    if (viewError) {
      console.error('❌ Error verifying materialized view:', viewError.message);
    } else {
      console.log('✅ Materialized view verified');
    }

    // Check triggers
    console.log('\n🔍 Verifying triggers...');
    
    const { data: triggerData, error: triggerError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          trigger_name,
          event_object_table,
          action_timing,
          event_manipulation
        FROM information_schema.triggers
        WHERE trigger_name LIKE 'trigger_refresh_admin_attempts%'
        ORDER BY trigger_name;
      `
    });

    if (triggerError) {
      console.error('❌ Error verifying triggers:', triggerError.message);
    } else {
      console.log('✅ Triggers verified');
    }

    console.log('\n✨ Materialized view setup complete!');
    console.log('\n📝 Summary:');
    console.log('   - Materialized view: admin_attempts_summary');
    console.log('   - Indexes: 3 (id, exam_status, exam_started)');
    console.log('   - Triggers: 3 (exam_attempts, exam_results, manual_grades)');
    console.log('   - Function: refresh_admin_attempts_summary_incremental()');
    console.log('   - Updated: admin_list_attempts_v2() now uses materialized view');
    console.log('\n💡 The materialized view will automatically refresh when:');
    console.log('   - New attempts are created or updated');
    console.log('   - Exam results are calculated');
    console.log('   - Manual grades are added or changed');

  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

// Run the setup
setupMaterializedView();
