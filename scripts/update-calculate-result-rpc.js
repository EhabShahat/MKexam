#!/usr/bin/env node

/**
 * Update calculate_result_for_attempt RPC function
 * Fixes the "cannot extract elements from a scalar" error
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateRPC() {
  console.log('🔄 Updating calculate_result_for_attempt RPC function...');

  try {
    const sqlPath = path.join(__dirname, '..', 'db', 'rpc_functions.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Extract the calculate_result_for_attempt function
    const startMarker = 'CREATE OR REPLACE FUNCTION public.calculate_result_for_attempt';
    const startIndex = sql.indexOf(startMarker);
    
    if (startIndex === -1) {
      console.error('❌ Could not find function in SQL file');
      process.exit(1);
    }

    // Find the end - look for the second $function$; 
    let endIndex = startIndex;
    let dollarCount = 0;
    
    for (let i = startIndex; i < sql.length; i++) {
      if (sql.substr(i, 10) === '$function$') {
        dollarCount++;
        if (dollarCount === 2) {
          endIndex = sql.indexOf(';', i) + 1;
          break;
        }
      }
    }

    const functionSQL = sql.substring(startIndex, endIndex);
    
    console.log('📝 Executing SQL update...');
    console.log('SQL length:', functionSQL.length, 'characters');

    // Use the REST API directly to execute SQL
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ sql: functionSQL })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Failed to update RPC function:', error);
      console.log('\n💡 You may need to run this SQL manually in the Supabase SQL editor');
      console.log('📋 SQL to execute:');
      console.log(functionSQL);
      process.exit(1);
    }

    console.log('✅ RPC function updated successfully');
  } catch (error) {
    console.error('❌ Update failed:', error.message);
    process.exit(1);
  }
}

updateRPC();
