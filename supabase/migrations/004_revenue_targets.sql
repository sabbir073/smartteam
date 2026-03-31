-- ============================================================
-- Revenue & Targets Tables
-- ============================================================

CREATE TABLE revenue_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_mode TEXT NOT NULL DEFAULT 'operations'
    CHECK (attribution_mode IN ('sales', 'operations', 'split')),
  sales_split_percentage DECIMAL(5,2) DEFAULT 50,
  operations_split_percentage DECIMAL(5,2) DEFAULT 50,
  cost_entry_role_ids JSONB DEFAULT '[]',
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE marketing_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  cost_date DATE NOT NULL DEFAULT CURRENT_DATE,
  added_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  target_amount DECIMAL(12,2) NOT NULL,
  set_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, period_type, period_start)
);

CREATE TABLE target_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
  old_amount DECIMAL(12,2),
  new_amount DECIMAL(12,2) NOT NULL,
  changed_by UUID NOT NULL REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_marketing_costs_order ON marketing_costs(order_id);
CREATE INDEX idx_marketing_costs_date ON marketing_costs(cost_date);
CREATE INDEX idx_targets_user ON targets(user_id);
CREATE INDEX idx_targets_period ON targets(period_type, period_start);
