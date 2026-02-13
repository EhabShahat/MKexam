#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const { loadEnv } = require('./utils/load-env');

loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async function() {
  console.log('Checking attendance sessions...\n');
  
  const { data, error } = await supabase
    .from('attendance_records')
    .select('session_date')
    .order('session_date');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  const uniqueDates = [...new Set(data.map(r => r.session_date))].sort();
  
  console.log(`Total unique session dates: ${uniqueDates.length}`);
  console.log('\nSession dates:');
  uniqueDates.forEach((date, idx) => {
    console.log(`  ${idx + 1}. ${date}`);
  });
  
  console.log(`\nTotal attendance records: ${data.length}`);
})();
