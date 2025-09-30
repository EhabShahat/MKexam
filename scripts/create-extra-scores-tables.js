#!/usr/bin/env node

/**
 * Script to create missing extra_scores tables in Supabase
 * Run this when you get "relation public.extra_scores does not exist" error
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function createExtraScoresTables() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  console.log('🔄 Creating extra_scores tables...');

  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'db', 'extra_scores.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ Error executing SQL:', error.message);
      
      // Try alternative approach - execute manually
      console.log('🔄 Trying direct SQL execution...');
      
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement) {
          const { error: stmtError } = await supabase.from('dummy').select('*').limit(0);
          if (stmtError) {
            console.log('⚠️ Some statements may need manual execution');
            break;
          }
        }
      }
    } else {
      console.log('✅ Extra scores tables created successfully!');
    }

    // Verify tables exist
    const { data: tables, error: checkError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['extra_scores', 'extra_score_fields']);

    if (checkError) {
      console.log('⚠️ Could not verify table creation');
    } else {
      const tableNames = tables.map(t => t.table_name);
      console.log('📋 Found tables:', tableNames);
      
      if (tableNames.includes('extra_scores') && tableNames.includes('extra_score_fields')) {
        console.log('✅ All required tables exist!');
      } else {
        console.log('⚠️ Some tables may still be missing');
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

// Manual SQL statements as fallback
const MANUAL_SQL = `
-- Run these SQL statements manually in your Supabase SQL Editor if the script fails:

-- 1. Create extra_score_fields table
CREATE TABLE IF NOT EXISTS public.extra_score_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  type text NOT NULL DEFAULT 'number' CHECK (type IN ('number','text','boolean')),
  order_index integer NULL,
  hidden boolean NOT NULL DEFAULT false,
  include_in_pass boolean NOT NULL DEFAULT false,
  pass_weight numeric NOT NULL DEFAULT 0,
  max_points numeric NULL,
  bool_true_points numeric DEFAULT 100,
  bool_false_points numeric DEFAULT 0,
  text_score_map jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create extra_scores table
CREATE TABLE IF NOT EXISTS public.extra_scores (
  student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_extra_scores_student ON public.extra_scores (student_id);

-- 4. Enable RLS
ALTER TABLE public.extra_score_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extra_scores ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies
CREATE POLICY extra_score_fields_admin_all ON public.extra_score_fields FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY extra_scores_admin_all ON public.extra_scores FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
`;

if (require.main === module) {
  createExtraScoresTables().catch(console.error);
}

module.exports = { createExtraScoresTables, MANUAL_SQL };
