-- Migration: 20260119_create_ledger_table.sql
-- Order: SAA-EO-2026-01-19-01
-- Run: ZT3G-056
-- Purpose: Create financial ledger table for B2B fee tracking

BEGIN;

-- Create ledger table with IF NOT EXISTS guard
CREATE TABLE IF NOT EXISTS financial_ledger (
  id SERIAL PRIMARY KEY,
  event_id UUID NOT NULL UNIQUE,
  event_type VARCHAR(64) NOT NULL,
  provider_id UUID NOT NULL,
  scholarship_id UUID,
  amount_cents BIGINT NOT NULL,
  fee_cents BIGINT NOT NULL DEFAULT 0,
  fee_rate DECIMAL(5,4) NOT NULL DEFAULT 0.03,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  stripe_charge_id VARCHAR(255),
  stripe_transfer_id VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  posted_at TIMESTAMP WITH TIME ZONE,
  reconciled_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_amount CHECK (amount_cents >= 0),
  CONSTRAINT valid_fee CHECK (fee_cents >= 0),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'posted', 'reconciled', 'disputed', 'refunded'))
);

-- Create indexes idempotently
CREATE INDEX IF NOT EXISTS idx_ledger_provider_id ON financial_ledger(provider_id);
CREATE INDEX IF NOT EXISTS idx_ledger_event_type ON financial_ledger(event_type);
CREATE INDEX IF NOT EXISTS idx_ledger_status ON financial_ledger(status);
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON financial_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_scholarship_id ON financial_ledger(scholarship_id);

-- Add comment for documentation
COMMENT ON TABLE financial_ledger IS 'B2B fee capture ledger for AwardDisbursed events - 3% platform fee';

COMMIT;
