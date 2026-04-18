-- StillPoint CIS — Incremental migrations for existing databases
-- Idempotent: safe to re-run. Each block checks for prior state before applying.
-- Use this if you deployed an earlier schema; otherwise run schema.sql from scratch.

-- ============================================
-- NEW ENUMS (idempotent)
-- ============================================

DO $$ BEGIN
  CREATE TYPE lead_source AS ENUM (
    'referral', 'inbound', 'networking', 'cold_outreach', 'existing_client', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE delivery_type AS ENUM ('project', 'retainer', 'advisory');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE revenue_type AS ENUM ('one_time', 'recurring');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- COMPANIES (new table in v4)
-- ============================================

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  industry text,
  website text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  CREATE TRIGGER companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_companies_user ON companies(user_id);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(user_id, name);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can manage their own companies"
    ON companies FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- OFFERS (new table in v4)
-- ============================================

CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_from numeric NOT NULL DEFAULT 0,
  price_to numeric,
  delivery_type delivery_type NOT NULL DEFAULT 'project',
  revenue_type revenue_type NOT NULL DEFAULT 'one_time',
  typical_duration_months integer,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  CREATE TRIGGER offers_updated_at
    BEFORE UPDATE ON offers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_offers_user_active ON offers(user_id, is_active, sort_order);

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can manage their own offers"
    ON offers FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- YEAR PLANS (new table in v2+)
-- ============================================

CREATE TABLE IF NOT EXISTS year_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year integer NOT NULL,
  revenue_target numeric NOT NULL DEFAULT 0,
  avg_deal_size numeric NOT NULL DEFAULT 0,
  target_new_clients integer NOT NULL DEFAULT 0,
  target_upsells integer NOT NULL DEFAULT 0,
  pct_revenue_existing numeric NOT NULL DEFAULT 0,
  pct_revenue_new numeric NOT NULL DEFAULT 0,
  offer_targets jsonb NOT NULL DEFAULT '[]'::jsonb,
  conversions_cold jsonb NOT NULL DEFAULT '{}'::jsonb,
  conversions_warm jsonb NOT NULL DEFAULT '{}'::jsonb,
  conversions_existing jsonb NOT NULL DEFAULT '{}'::jsonb,
  quarterly_weights jsonb NOT NULL DEFAULT '[25,25,25,25]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, year)
);

DO $$ BEGIN
  CREATE TRIGGER year_plans_updated_at
    BEFORE UPDATE ON year_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_year_plans_user ON year_plans(user_id, year);

ALTER TABLE year_plans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can manage their own year plans"
    ON year_plans FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- CONTACTS: v2+ additions (lead_source, referred_by, company_id)
-- ============================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS lead_source lead_source NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_source ON contacts(user_id, lead_source);

-- ============================================
-- OPPORTUNITIES: v3/v4/v5 additions
-- ============================================

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS stage_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES offers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS monthly_value numeric,
  ADD COLUMN IF NOT EXISTS revenue_type revenue_type NOT NULL DEFAULT 'one_time',
  ADD COLUMN IF NOT EXISTS expected_close_date date,
  ADD COLUMN IF NOT EXISTS decision_maker_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS next_step text,
  ADD COLUMN IF NOT EXISTS next_step_date date,
  ADD COLUMN IF NOT EXISTS proposal_sent_date date,
  ADD COLUMN IF NOT EXISTS proposal_value numeric,
  ADD COLUMN IF NOT EXISTS win_reason text,
  ADD COLUMN IF NOT EXISTS loss_reason text;

CREATE INDEX IF NOT EXISTS idx_opportunities_company ON opportunities(company_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_offer ON opportunities(offer_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_expected_close ON opportunities(user_id, expected_close_date);

-- Backfill stage_history for rows that still have empty history
UPDATE opportunities
SET stage_history = jsonb_build_array(
  jsonb_build_object('stage', stage::text, 'entered_at', to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
)
WHERE stage_history = '[]'::jsonb;
