-- StillPoint CIS — Database Schema
-- Run this in the Supabase SQL Editor to set up all tables

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
-- CONTACTS
-- ============================================

CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text,
  company text,
  role text,
  phone text,
  email text,
  linkedin_url text,
  relationship_status relationship_status NOT NULL DEFAULT 'dormant',
  icp_fit icp_fit NOT NULL DEFAULT 'not_assessed',
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
-- OPPORTUNITIES
-- ============================================

CREATE TABLE opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  company text,
  title text NOT NULL,
  stage opportunity_stage NOT NULL DEFAULT 'lead',
  estimated_value numeric DEFAULT 0,
  confidence confidence_level NOT NULL DEFAULT 'low',
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

ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own opportunities"
  ON opportunities FOR ALL
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
