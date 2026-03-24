import { NextResponse } from 'next/server'
import { Pool } from 'pg'

// Temporary migration endpoint — creates tracking tables via direct PG connection
// REMOVE AFTER MIGRATION COMPLETES
export const maxDuration = 30

export async function POST(request: Request) {
  try {
    const { secret } = await request.json()
    if (secret !== 'pagepulse-migrate-2026') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Try multiple connection methods
    const connectionStrings = [
      process.env.DATABASE_URL,
      process.env.POSTGRES_URL,
      process.env.POSTGRES_URL_NON_POOLING,
      process.env.SUPABASE_DB_URL,
    ].filter(Boolean)

    if (connectionStrings.length === 0) {
      return NextResponse.json({
        error: 'No database connection string found. Set DATABASE_URL env var in Vercel.',
        hint: 'Go to Supabase Dashboard > Project Settings > Database > Connection String (URI) and add it as DATABASE_URL in Vercel env vars.',
        envChecked: ['DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_URL_NON_POOLING', 'SUPABASE_DB_URL'],
      }, { status: 500 })
    }

    let pool: Pool | null = null
    let connectedWith = ''

    for (const cs of connectionStrings) {
      try {
        const testPool = new Pool({
          connectionString: cs,
          max: 1,
          connectionTimeoutMillis: 10000,
          ssl: { rejectUnauthorized: false },
        })
        await testPool.query('SELECT 1')
        pool = testPool
        connectedWith = cs!.substring(0, 30) + '...'
        break
      } catch {
        continue
      }
    }

    if (!pool) {
      return NextResponse.json({
        error: 'Could not connect with any available connection string',
        triedCount: connectionStrings.length,
      }, { status: 500 })
    }

    const results: { step: string; ok: boolean; error?: string }[] = []

    const statements: { label: string; sql: string }[] = [
      {
        label: 'Add keywords_detected column to audits',
        sql: `ALTER TABLE audits ADD COLUMN IF NOT EXISTS keywords_detected jsonb DEFAULT '[]'::jsonb`,
      },
      {
        label: 'Add signals column to audits',
        sql: `ALTER TABLE audits ADD COLUMN IF NOT EXISTS signals jsonb DEFAULT '[]'::jsonb`,
      },
      {
        label: 'Create keyword_signals table',
        sql: `CREATE TABLE IF NOT EXISTS keyword_signals (
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
      },
      {
        label: 'Create keyword_signals indexes',
        sql: `CREATE INDEX IF NOT EXISTS idx_keyword_signals_site ON keyword_signals(site_id);
              CREATE INDEX IF NOT EXISTS idx_keyword_signals_user ON keyword_signals(user_id);
              CREATE UNIQUE INDEX IF NOT EXISTS idx_keyword_signals_unique ON keyword_signals(site_id, keyword)`,
      },
      {
        label: 'Enable RLS on keyword_signals',
        sql: `ALTER TABLE keyword_signals ENABLE ROW LEVEL SECURITY`,
      },
      {
        label: 'Create score_history table',
        sql: `CREATE TABLE IF NOT EXISTS score_history (
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
      },
      {
        label: 'Create score_history indexes',
        sql: `CREATE INDEX IF NOT EXISTS idx_score_history_site ON score_history(site_id);
              CREATE INDEX IF NOT EXISTS idx_score_history_user ON score_history(user_id);
              CREATE INDEX IF NOT EXISTS idx_score_history_recorded ON score_history(site_id, recorded_at)`,
      },
      {
        label: 'Enable RLS on score_history',
        sql: `ALTER TABLE score_history ENABLE ROW LEVEL SECURITY`,
      },
      {
        label: 'Create page_signals table',
        sql: `CREATE TABLE IF NOT EXISTS page_signals (
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
      },
      {
        label: 'Create page_signals indexes',
        sql: `CREATE INDEX IF NOT EXISTS idx_page_signals_site ON page_signals(site_id);
              CREATE INDEX IF NOT EXISTS idx_page_signals_user ON page_signals(user_id)`,
      },
      {
        label: 'Enable RLS on page_signals',
        sql: `ALTER TABLE page_signals ENABLE ROW LEVEL SECURITY`,
      },
      {
        label: 'RLS policies for keyword_signals',
        sql: `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='keyword_signals' AND policyname='kw_select') THEN
            CREATE POLICY "kw_select" ON keyword_signals FOR SELECT USING (auth.uid() = user_id);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='keyword_signals' AND policyname='kw_insert') THEN
            CREATE POLICY "kw_insert" ON keyword_signals FOR INSERT WITH CHECK (auth.uid() = user_id);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='keyword_signals' AND policyname='kw_update') THEN
            CREATE POLICY "kw_update" ON keyword_signals FOR UPDATE USING (auth.uid() = user_id);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='keyword_signals' AND policyname='kw_delete') THEN
            CREATE POLICY "kw_delete" ON keyword_signals FOR DELETE USING (auth.uid() = user_id);
          END IF;
        END $$`,
      },
      {
        label: 'RLS policies for score_history',
        sql: `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='score_history' AND policyname='sh_select') THEN
            CREATE POLICY "sh_select" ON score_history FOR SELECT USING (auth.uid() = user_id);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='score_history' AND policyname='sh_insert') THEN
            CREATE POLICY "sh_insert" ON score_history FOR INSERT WITH CHECK (auth.uid() = user_id);
          END IF;
        END $$`,
      },
      {
        label: 'RLS policies for page_signals',
        sql: `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='page_signals' AND policyname='ps_select') THEN
            CREATE POLICY "ps_select" ON page_signals FOR SELECT USING (auth.uid() = user_id);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='page_signals' AND policyname='ps_insert') THEN
            CREATE POLICY "ps_insert" ON page_signals FOR INSERT WITH CHECK (auth.uid() = user_id);
          END IF;
        END $$`,
      },
      {
        label: 'Service role bypass for keyword_signals',
        sql: `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='keyword_signals' AND policyname='kw_service_all') THEN
            CREATE POLICY "kw_service_all" ON keyword_signals FOR ALL USING (
              current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
            );
          END IF;
        END $$`,
      },
      {
        label: 'Service role bypass for score_history',
        sql: `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='score_history' AND policyname='sh_service_all') THEN
            CREATE POLICY "sh_service_all" ON score_history FOR ALL USING (
              current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
            );
          END IF;
        END $$`,
      },
      {
        label: 'Service role bypass for page_signals',
        sql: `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='page_signals' AND policyname='ps_service_all') THEN
            CREATE POLICY "ps_service_all" ON page_signals FOR ALL USING (
              current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
            );
          END IF;
        END $$`,
      },
    ]

    for (const { label, sql } of statements) {
      try {
        await pool.query(sql)
        results.push({ step: label, ok: true })
      } catch (err) {
        results.push({
          step: label,
          ok: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    await pool.end()

    const succeeded = results.filter(r => r.ok).length
    const failed = results.filter(r => !r.ok).length

    return NextResponse.json({
      status: failed === 0 ? 'success' : 'partial',
      connectedWith,
      succeeded,
      failed,
      total: results.length,
      results,
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Migration failed',
    }, { status: 500 })
  }
}
