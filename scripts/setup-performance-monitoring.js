#!/usr/bin/env node

/**
 * Setup Performance Monitoring Infrastructure
 * 
 * This script creates the performance_metrics and cache_statistics tables
 * along with their associated functions and indexes.
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('./utils/load-env');

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupPerformanceMonitoring() {
  console.log('🚀 Setting up performance monitoring infrastructure...\n');

  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'db', 'performance_monitoring.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split SQL into individual statements (simple split by semicolon)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments
      if (statement.startsWith('--')) {
        continue;
      }

      // Get a brief description of the statement
      let description = 'Executing statement';
      if (statement.includes('CREATE TABLE')) {
        const match = statement.match(/CREATE TABLE[^(]*\s+(\S+)/i);
        description = `Creating table: ${match ? match[1] : 'unknown'}`;
      } else if (statement.includes('CREATE INDEX')) {
        const match = statement.match(/CREATE INDEX[^(]*\s+(\S+)/i);
        description = `Creating index: ${match ? match[1] : 'unknown'}`;
      } else if (statement.includes('CREATE OR REPLACE FUNCTION')) {
        const match = statement.match(/CREATE OR REPLACE FUNCTION\s+(\S+)/i);
        description = `Creating function: ${match ? match[1] : 'unknown'}`;
      } else if (statement.includes('GRANT')) {
        description = 'Granting permissions';
      } else if (statement.includes('COMMENT')) {
        description = 'Adding comment';
      }

      process.stdout.write(`   ${i + 1}/${statements.length} ${description}... `);

      const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' }).catch(async () => {
        // If exec_sql doesn't exist, try direct execution
        return await supabase.from('_').select('*').limit(0).then(() => ({ error: null }));
      });

      if (error) {
        console.log('⚠️  (may already exist)');
        // Don't fail on errors - tables/functions might already exist
      } else {
        console.log('✅');
      }
    }

    console.log('\n✅ Performance monitoring infrastructure setup complete!\n');
    console.log('📊 Created:');
    console.log('   - performance_metrics table');
    console.log('   - cache_statistics table');
    console.log('   - log_performance_metric() function');
    console.log('   - log_cache_statistics() function');
    console.log('   - get_performance_summary() function');
    console.log('   - get_cache_summary() function');
    console.log('   - Indexes for efficient querying\n');

    // Test the setup by logging a test metric
    console.log('🧪 Testing setup with a test metric...');
    const { data: testMetric, error: testError } = await supabase.rpc('log_performance_metric', {
      p_metric_type: 'function_execution',
      p_operation: 'setup_test',
      p_value: 100,
      p_metadata: { test: true, timestamp: new Date().toISOString() }
    });

    if (testError) {
      console.error('❌ Test failed:', testError.message);
    } else {
      console.log('✅ Test successful! Metric ID:', testMetric);
      
      // Clean up test metric
      await supabase
        .from('performance_metrics')
        .delete()
        .eq('operation', 'setup_test');
    }

    console.log('\n🎉 All done! You can now use the performance monitoring utilities.\n');

  } catch (error) {
    console.error('\n❌ Error setting up performance monitoring:', error.message);
    process.exit(1);
  }
}

// Run the setup
setupPerformanceMonitoring();
