import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Temporary migration endpoint — creates tracking tables
// Uses service role key + raw SQL via PostgREST's built-in function
// REMOVE AFTER MIGRATION COMPLETES
export const maxDuration = 30

export async function POST(request: Request) {
  try {
    const { secret } = await request.json()
    if (secret !== 'pagepulse-migrate-2026') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Use the Supabase SQL HTTP API (available since Supabase supports it via the /sql endpoint)
    // Actually, we'll use a workaround: create tables by calling PostgREST 
    // with special headers. But PostgREST can't do DDL.
    //
    // Alternative: use the Supabase Management API's SQL endpoint
    // URL: POST https://{ref}.supabase.co/rest/v1/rpc/{function_name}
    //
    // Since we can't run raw DDL through PostgREST, we'll use an alternative:
    // Execute each statement via the Supabase realtime/pg endpoint
    // 
    // Actually the cleanest approach: use fetch to call the Supabase 
    // project's internal pg-meta API which IS accessible with service role

    const statements = [
      // Add columns to audits
      `ALTER TABLE audits ADD COLUMN IF NOT EXISTS keywords_detected jsonb DEFAULT '[]'::jsonb`,
      `ALTER TABLE audits ADD COLUMN IF NOT EXISTS signals jsonb DEFAULT '[]'::jsonb`,
      
      // keyword_signals table
      `CREATE TABLE IF NOT EXISTS keyword_signals (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        site_id uuid REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
        user_id uuid NOT NULL,
        keyword text NOT NULL,
        source text NOT NULL DEFAULT 'audit',
        category text DEFAULT 'organic',
        first_seen_at timestamptz DEFAULT now(),
        last_seen_at timestamptz DEFAULT now(),
        occurrences integer DEFAULT 1,
        trend text DEFAULT 'stable',
        created_at timestamptz DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_keyword_signals_site ON keyword_signals(site_id)`,
      `CREATE INDEX IF NOT EXISTS idx_keyword_signals_user ON keyword_signals(user_id)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_keyword_signals_unique ON keyword_signals(site_id, keyword)`,
      `ALTER TABLE keyword_signals ENABLE ROW LEVEL SECURITY`,
      
      // score_history table
      `CREATE TABLE IF NOT EXISTS score_history (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        site_id uuid REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
        user_id uuid NOT NULL,
        audit_id uuid REFERENCES audits(id) ON DELETE CASCADE NOT NULL,
        overall_score integer,
        seo_score integer,
        performance_score integer,
        accessibility_score integer,
        best_practices_score integer,
        recorded_at timestamptz DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_score_history_site ON score_history(site_id)`,
      `CREATE INDEX IF NOT EXISTS idx_score_history_user ON score_history(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_score_history_recorded ON score_history(site_id, recorded_at)`,
      `ALTER TABLE score_history ENABLE ROW LEVEL SECURITY`,
      
      // page_signals table
      `CREATE TABLE IF NOT EXISTS page_signals (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        site_id uuid REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
        user_id uuid NOT NULL,
        audit_id uuid REFERENCES audits(id) ON DELETE CASCADE NOT NULL,
        signal_type text NOT NULL,
        signal_value text NOT NULL,
        status text DEFAULT 'detected',
        context text,
        created_at timestamptz DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_page_signals_site ON page_signals(site_id)`,
      `CREATE INDEX IF NOT EXISTS idx_page_signals_user ON page_signals(user_id)`,
      `ALTER TABLE page_signals ENABLE ROW LEVEL SECURITY`,
    ]

    // RLS policies (wrapped in DO blocks to avoid errors if they already exist)
    const policies = [
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='keyword_signals' AND policyname='kw_select') THEN CREATE POLICY "kw_select" ON keyword_signals FOR SELECT USING (auth.uid() = user_id); END IF; END $$`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='keyword_signals' AND policyname='kw_insert') THEN CREATE POLICY "kw_insert" ON keyword_signals FOR INSERT WITH CHECK (auth.uid() = user_id); END IF; END $$`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='keyword_signals' AND policyname='kw_update') THEN CREATE POLICY "kw_update" ON keyword_signals FOR UPDATE USING (auth.uid() = user_id); END IF; END $$`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='keyword_signals' AND policyname='kw_delete') THEN CREATE POLICY "kw_delete" ON keyword_signals FOR DELETE USING (auth.uid() = user_id); END IF; END $$`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='score_history' AND policyname='sh_select') THEN CREATE POLICY "sh_select" ON score_history FOR SELECT USING (auth.uid() = user_id); END IF; END $$`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='score_history' AND policyname='sh_insert') THEN CREATE POLICY "sh_insert" ON score_history FOR INSERT WITH CHECK (auth.uid() = user_id); END IF; END $$`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='page_signals' AND policyname='ps_select') THEN CREATE POLICY "ps_select" ON page_signals FOR SELECT USING (auth.uid() = user_id); END IF; END $$`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='page_signals' AND policyname='ps_insert') THEN CREATE POLICY "ps_insert" ON page_signals FOR INSERT WITH CHECK (auth.uid() = user_id); END IF; END $$`,
    ]

    const allStatements = [...statements, ...policies]
    const results: { sql: string; ok: boolean; error?: string }[] = []

    // Execute via pg-meta API (internal Supabase endpoint)
    for (const sql of allStatements) {
      try {
        const res = await fetch(`${supabaseUrl}/pg/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
            'apikey': serviceKey,
          },
          body: JSON.stringify({ query: sql }),
        })

        if (res.ok) {
          results.push({ sql: sql.substring(0, 80), ok: true })
        } else {
          const errText = await res.text()
          results.push({ sql: sql.substring(0, 80), ok: false, error: errText })
        }
      } catch (err) {
        results.push({
          sql: sql.substring(0, 80),
          ok: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    const succeeded = results.filter(r => r.ok).length
    const failed = results.filter(r => !r.ok).length

    return NextResponse.json({
      status: failed === 0 ? 'success' : 'partial',
      succeeded,
      failed,
      results,
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Migration failed',
    }, { status: 500 })
  }
}
