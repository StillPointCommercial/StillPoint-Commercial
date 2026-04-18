-- StillPoint CIS — Database Schema (v5 — matches Dexie v5)
-- Run this in the Supabase SQL Editor to set up all tables from scratch.
-- For incremental updates to an existing DB, see supabase/migrations.sql.

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE relationship_status AS ENUM (
  'dormant', 'warming', 'active', 'client', 'past_client'
);

CREATE TYPE icp_fit AS ENUM (
  'strong', 'moderate', 'weak', 'not_assessed'
);

CREATE TYPE entry_type AS ENUM (
  'note', 'meeting', 'call', 'email', 'transcript'
);

CREATE TYPE opportunity_stage AS ENUM (
  'lead', 'warming', 'discovery', 'proposal', 'active_client', 'paused', 'lost'
);

CREATE TYPE confidence_level AS ENUM (
  'low', 'medium', 'high'
);

CREATE TYPE lead_source AS ENUM (
  'referral', 'inbound', 'networking', 'cold_outreach', 'existing_client', 'other'
);

CREATE TYPE delivery_type AS ENUM (
  'project', 'retainer', 'advisory'
);

CREATE TYPE revenue_type AS ENUM (
  'one_time', 'recurring'
);

-- ============================================
-- HELPER: auto-update updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMPANIES
-- ============================================

CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  industry text,
  website text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_companies_user ON companies(user_id);
CREATE INDEX idx_companies_name ON companies(user_id, name);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own companies"
  ON companies FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- CONTACTS
-- ============================================

CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text,
  company text,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  role text,
  phone text,
  email text,
  linkedin_url text,
  relationship_status relationship_status NOT NULL DEFAULT 'dormant',
  icp_fit icp_fit NOT NULL DEFAULT 'not_assessed',
  lead_source lead_source NOT NULL DEFAULT 'other',
  referred_by uuid REFERENCES contacts(id) ON DELETE SET NULL,
  tags text[] DEFAULT '{}',
  general_notes text,
  last_contact_date date,
  next_action text,
  next_action_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_contacts_relationship_status ON contacts(user_id, relationship_status);
CREATE INDEX idx_contacts_next_action_date ON contacts(user_id, next_action_date);
CREATE INDEX idx_contacts_last_contact_date ON contacts(user_id, last_contact_date);
CREATE INDEX idx_contacts_company_id ON contacts(company_id);
CREATE INDEX idx_contacts_lead_source ON contacts(user_id, lead_source);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own contacts"
  ON contacts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- TIMELINE ENTRIES
-- ============================================

CREATE TABLE timeline_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  entry_type entry_type NOT NULL DEFAULT 'note',
  title text,
  content text,
  ai_summary text,
  outcome text,
  next_step text,
  next_step_date date,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_timeline_contact ON timeline_entries(contact_id, entry_date DESC);
CREATE INDEX idx_timeline_user ON timeline_entries(user_id, entry_date DESC);

ALTER TABLE timeline_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own timeline entries"
  ON timeline_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- OFFERS
-- ============================================

CREATE TABLE offers (
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

CREATE TRIGGER offers_updated_at
  BEFORE UPDATE ON offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_offers_user_active ON offers(user_id, is_active, sort_order);

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own offers"
  ON offers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- OPPORTUNITIES
-- ============================================

CREATE TABLE opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  company text,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  title text NOT NULL,
  offer_id uuid REFERENCES offers(id) ON DELETE SET NULL,
  stage opportunity_stage NOT NULL DEFAULT 'lead',
  stage_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimated_value numeric NOT NULL DEFAULT 0,
  monthly_value numeric,
  revenue_type revenue_type NOT NULL DEFAULT 'one_time',
  confidence confidence_level NOT NULL DEFAULT 'low',
  expected_close_date date,
  decision_maker_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  next_step text,
  next_step_date date,
  proposal_sent_date date,
  proposal_value numeric,
  win_reason text,
  loss_reason text,
  notes text,
  khalsa_pain_identified boolean NOT NULL DEFAULT false,
  khalsa_decision_process_clear boolean NOT NULL DEFAULT false,
  khalsa_resources_confirmed boolean NOT NULL DEFAULT false,
  khalsa_champion_identified boolean NOT NULL DEFAULT false,
  khalsa_yellow_lights text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER opportunities_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_opportunities_user_stage ON opportunities(user_id, stage);
CREATE INDEX idx_opportunities_contact ON opportunities(contact_id);
CREATE INDEX idx_opportunities_company ON opportunities(company_id);
CREATE INDEX idx_opportunities_offer ON opportunities(offer_id);
CREATE INDEX idx_opportunities_expected_close ON opportunities(user_id, expected_close_date);

ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own opportunities"
  ON opportunities FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- YEAR PLANS
-- ============================================

CREATE TABLE year_plans (
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

CREATE TRIGGER year_plans_updated_at
  BEFORE UPDATE ON year_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_year_plans_user ON year_plans(user_id, year);

ALTER TABLE year_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own year plans"
  ON year_plans FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- HELPER: auto-update last_contact_date on timeline insert
-- ============================================

CREATE OR REPLACE FUNCTION update_last_contact_date()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE contacts
  SET last_contact_date = NEW.entry_date
  WHERE id = NEW.contact_id
    AND (last_contact_date IS NULL OR last_contact_date < NEW.entry_date);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER timeline_update_last_contact
  AFTER INSERT ON timeline_entries
  FOR EACH ROW EXECUTE FUNCTION update_last_contact_date();
