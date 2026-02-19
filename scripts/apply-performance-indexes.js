#!/usr/bin/env node

/**
 * Apply Performance Optimization Indexes
 * 
 * This script applies the optimized database indexes defined in
 * db/performance_optimizations.sql to improve query performance
 * and reduce Supabase egress costs.
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
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyIndexes() {
  console.log('🚀 Applying performance optimization indexes...\n');

  try {
    // Read the SQL file
    const sqlPath = join(__dirname, '..', 'db', 'performance_optimizations.sql');
    const sql = readFileSync(sqlPath, 'utf8');

    // Split into individual statements (simple split by semicolon)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Extract index name for better logging
      const indexMatch = statement.match(/idx_\w+/);
      const indexName = indexMatch ? indexMatch[0] : `statement ${i + 1}`;

      try {
        console.log(`⏳ Creating index: ${indexName}...`);
        
        const { error } = await supabase.rpc('exec_sql', { 
          sql_query: statement + ';' 
        });

        if (error) {
          // Try direct execution if RPC fails
          const { error: directError } = await supabase
            .from('_sql_exec')
            .insert({ query: statement + ';' });

          if (directError) {
            console.error(`❌ Failed to create ${indexName}:`, error.message);
            continue;
          }
        }

        console.log(`✅ Successfully created: ${indexName}\n`);
      } catch (err) {
        console.error(`❌ Error creating ${indexName}:`, err.message, '\n');
      }
    }

    console.log('\n🎉 Index creation process completed!');
    console.log('\n📊 To verify index usage, run:');
    console.log('   EXPLAIN ANALYZE SELECT ... FROM table WHERE ...;');
    console.log('\n📈 To check index statistics:');
    console.log('   SELECT * FROM pg_stat_user_indexes WHERE schemaname = \'public\';');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
applyIndexes().catch(console.error);
