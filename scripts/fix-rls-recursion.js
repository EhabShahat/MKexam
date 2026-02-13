#!/usr/bin/env node

/**
 * Fix RLS Infinite Recursion
 * 
 * This script fixes the circular dependency in RLS policies that causes
 * "infinite recursion detected in policy for relation 'exam_attempts'" error.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables!');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Check your .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixRLSRecursion() {
  console.log('🔧 Fixing RLS Infinite Recursion\n');
  console.log('📋 Issue: Circular dependency between exam_attempts and exam_results policies');
  console.log('🎯 Solution: Remove circular reference from exam_attempts policy\n');

  // Read the SQL fix file
  const sqlPath = path.join(__dirname, '..', 'db', 'fix_rls_infinite_recursion.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('📝 Applying SQL fix...\n');

  try {
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error('❌ Error applying fix:', error.message);
      console.error('\n📋 Manual fix required:');
      console.error('   1. Go to Supabase Dashboard → SQL Editor');
      console.error('   2. Copy contents of db/fix_rls_infinite_recursion.sql');
      console.error('   3. Paste and run the SQL');
      process.exit(1);
    }

    console.log('✅ RLS policies fixed successfully!\n');

    // Verify the fix
    console.log('🔍 Verifying fix...');
    const { data: policies, error: verifyError } = await supabase
      .from('pg_policies')
      .select('tablename, policyname')
      .in('tablename', ['exam_attempts', 'exam_results']);

    if (verifyError) {
      console.warn('⚠️  Could not verify policies (this is OK)');
    } else {
      console.log('✅ Policies verified:');
      policies?.forEach(p => {
        console.log(`   - ${p.tablename}.${p.policyname}`);
      });
    }

    console.log('\n🎉 Fix applied successfully!');
    console.log('📋 Next steps:');
    console.log('   1. Reload your application');
    console.log('   2. Check browser console - error should be gone');
    console.log('   3. Navigate to admin results page');
    console.log('   4. Verify data loads correctly\n');

  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    console.error('\n📋 Manual fix required:');
    console.error('   1. Go to Supabase Dashboard → SQL Editor');
    console.error('   2. Copy contents of db/fix_rls_infinite_recursion.sql');
    console.error('   3. Paste and run the SQL');
    process.exit(1);
  }
}

// Run the fix
fixRLSRecursion().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
