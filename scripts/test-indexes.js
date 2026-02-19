#!/usr/bin/env node

/**
 * Test Performance Optimization Indexes
 * 
 * This script verifies that the performance optimization indexes
 * have been created successfully and checks their usage statistics.
 */

import { createClient } from '@supabase/supabase-js';

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Expected indexes from performance_optimizations.sql
const expectedIndexes = [
  'idx_attempts_exam_status_started',
  'idx_questions_exam_order_covering',
  'idx_audit_logs_created_brin',
  'idx_attempts_device_fingerprint',
  'idx_activity_events_recent',
  'idx_students_code_with_name'
];

async function testIndexes() {
  console.log('🔍 Testing performance optimization indexes...\n');

  try {
    // Query to check if indexes exist
    const { data: indexes, error } = await supabase
      .rpc('exec_sql', {
        sql_query: `
          SELECT 
            indexname,
            tablename,
            indexdef
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname IN (${expectedIndexes.map(idx => `'${idx}'`).join(', ')})
          ORDER BY indexname;
        `
      });

    if (error) {
      console.error('❌ Error querying indexes:', error.message);
      
      // Fallback: Try to query pg_stat_user_indexes
      console.log('\n🔄 Trying alternative query method...\n');
      
      const { data: statsData, error: statsError } = await supabase
        .rpc('exec_sql', {
          sql_query: `
            SELECT 
              schemaname,
              tablename,
              indexname,
              idx_scan,
              idx_tup_read,
              idx_tup_fetch
            FROM pg_stat_user_indexes
            WHERE schemaname = 'public'
              AND indexname IN (${expectedIndexes.map(idx => `'${idx}'`).join(', ')})
            ORDER BY indexname;
          `
        });

      if (statsError) {
        console.error('❌ Alternative query also failed:', statsError.message);
        console.log('\n💡 Manual verification required. Run this SQL in Supabase SQL Editor:');
        console.log(`
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (${expectedIndexes.map(idx => `'${idx}'`).join(', ')})
ORDER BY indexname;
        `);
        return;
      }

      if (statsData && statsData.length > 0) {
        console.log('✅ Found indexes via statistics:\n');
        statsData.forEach(idx => {
          console.log(`   📌 ${idx.indexname} on ${idx.tablename}`);
          console.log(`      Scans: ${idx.idx_scan}, Tuples read: ${idx.idx_tup_read}`);
        });
      }
      return;
    }

    if (!indexes || indexes.length === 0) {
      console.log('⚠️  No indexes found. They may need to be created.\n');
      console.log('Run: node scripts/apply-performance-indexes.js');
      return;
    }

    console.log(`✅ Found ${indexes.length} of ${expectedIndexes.length} expected indexes:\n`);

    // Check each expected index
    const foundIndexNames = indexes.map(idx => idx.indexname);
    
    expectedIndexes.forEach(expectedIdx => {
      if (foundIndexNames.includes(expectedIdx)) {
        const idx = indexes.find(i => i.indexname === expectedIdx);
        console.log(`   ✅ ${expectedIdx}`);
        console.log(`      Table: ${idx.tablename}`);
        console.log(`      Definition: ${idx.indexdef.substring(0, 80)}...`);
        console.log('');
      } else {
        console.log(`   ❌ ${expectedIdx} - NOT FOUND`);
        console.log('');
      }
    });

    // Summary
    const missingCount = expectedIndexes.length - foundIndexNames.length;
    if (missingCount === 0) {
      console.log('🎉 All performance optimization indexes are in place!\n');
    } else {
      console.log(`⚠️  ${missingCount} index(es) missing. Run apply-performance-indexes.js to create them.\n`);
    }

    // Additional statistics
    console.log('📊 To view detailed index statistics, run:');
    console.log('   SELECT * FROM pg_stat_user_indexes WHERE schemaname = \'public\';');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the test
testIndexes().catch(console.error);
