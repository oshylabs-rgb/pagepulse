# Supabase Setup for PagePulse

## 1. Create Supabase Project

Go to [supabase.com](https://supabase.com) and create a new project called `pagepulse`.

## 2. Database Tables

Run this SQL in the Supabase SQL Editor:

```sql
-- Sites table
CREATE TABLE sites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, url)
);

-- Audits table
CREATE TABLE audits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  overall_score INTEGER,
  performance_score INTEGER,
  seo_score INTEGER,
  accessibility_score INTEGER,
  best_practices_score INTEGER,
  issues JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Subscriptions table
CREATE TABLE subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'agency')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Monitoring alerts table
CREATE TABLE monitoring_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('score_drop', 'issue_detected', 'site_down', 'ssl_expiry')),
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('critical', 'warning', 'info')),
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_sites_user_id ON sites(user_id);
CREATE INDEX idx_audits_site_id ON audits(site_id);
CREATE INDEX idx_audits_user_id ON audits(user_id);
CREATE INDEX idx_audits_created_at ON audits(created_at DESC);
CREATE INDEX idx_monitoring_alerts_user_id ON monitoring_alerts(user_id);
CREATE INDEX idx_monitoring_alerts_read ON monitoring_alerts(user_id, read);
```

## 3. Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_alerts ENABLE ROW LEVEL SECURITY;

-- Sites policies
CREATE POLICY "Users can view own sites" ON sites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sites" ON sites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sites" ON sites FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sites" ON sites FOR DELETE USING (auth.uid() = user_id);

-- Audits policies
CREATE POLICY "Users can view own audits" ON audits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own audits" ON audits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own audits" ON audits FOR UPDATE USING (auth.uid() = user_id);

-- Subscriptions policies
CREATE POLICY "Users can view own subscription" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Monitoring alerts policies
CREATE POLICY "Users can view own alerts" ON monitoring_alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own alerts" ON monitoring_alerts FOR UPDATE USING (auth.uid() = user_id);
```

## 4. Auth Configuration

In Supabase Dashboard → Authentication → URL Configuration:
- Site URL: `https://pagepulse.io` (or `http://localhost:3000` for dev)
- Redirect URLs: add `http://localhost:3000/auth/callback`, `https://pagepulse.io/auth/callback`

## 5. Environment Variables

Copy from the Supabase Dashboard → Settings → API:
- `NEXT_PUBLIC_SUPABASE_URL` → Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `anon` public key
- `SUPABASE_SERVICE_ROLE_KEY` → `service_role` key (keep secret)
