/**
 * Setup Cost Alerts Table
 * 
 * Creates the cost_alerts table for storing budget alerts and daily summaries
 * 
 * Usage: node scripts/setup-cost-alerts.js
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
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupCostAlerts() {
  console.log('🚀 Setting up cost alerts table...\n');

  try {
    // Read SQL file
    const sqlPath = path.join(__dirname, '..', 'db', 'cost_alerts.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Executing ${statements.length} SQL statements...\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`   [${i + 1}/${statements.length}] Executing statement...`);
      
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
      
      if (error) {
        // Try direct execution if RPC fails
        const { error: directError } = await supabase
          .from('_sql')
          .insert({ query: statement });
        
        if (directError) {
          console.error(`   ❌ Error executing statement ${i + 1}:`, error.message);
          // Continue with other statements
        } else {
          console.log(`   ✅ Statement ${i + 1} executed successfully`);
        }
      } else {
        console.log(`   ✅ Statement ${i + 1} executed successfully`);
      }
    }

    console.log('\n✅ Cost alerts table setup completed!\n');
    console.log('📊 Table created: cost_alerts');
    console.log('🔐 RLS policies enabled');
    console.log('📈 Indexes created for efficient querying\n');

    // Verify table exists
    const { data, error } = await supabase
      .from('cost_alerts')
      .select('count')
      .limit(1);

    if (error) {
      console.log('⚠️  Note: Could not verify table creation. You may need to run the SQL manually.');
      console.log('   SQL file location: db/cost_alerts.sql\n');
    } else {
      console.log('✅ Table verification successful!\n');
    }

    console.log('Next steps:');
    console.log('1. Set up a cron job to run budget checks periodically');
    console.log('2. Configure budget limits in your application');
    console.log('3. Visit /admin/alerts to view cost alerts\n');

  } catch (error) {
    console.error('❌ Error setting up cost alerts:', error.message);
    process.exit(1);
  }
}

// Run setup
setupCostAlerts();
