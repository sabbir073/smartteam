-- ============================================================
-- Special Orders (fake orders for reviews - tracked separately)
-- NOT included in revenue calculations
-- ============================================================

CREATE TABLE special_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Platform & Profile
  platform_id UUID NOT NULL REFERENCES platforms(id),
  platform_profile_id UUID REFERENCES platform_profiles(id) ON DELETE SET NULL,
  -- Client
  client_name TEXT NOT NULL,
  external_order_id TEXT,
  order_link TEXT,
  -- Amounts
  gross_amount DECIMAL(12,2) NOT NULL,
  platform_charge DECIMAL(12,2) NOT NULL,
  net_amount DECIMAL(12,2) NOT NULL,
  -- Status & Timing
  status_id UUID NOT NULL REFERENCES order_statuses(id),
  deadline TIMESTAMPTZ,
  delivery_time TIMESTAMPTZ,
  -- Notes (purpose of the special order)
  notes TEXT,
  -- Meta
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE special_order_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  special_order_id UUID NOT NULL REFERENCES special_orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_key TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE special_order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  special_order_id UUID NOT NULL REFERENCES special_orders(id) ON DELETE CASCADE,
  from_status_id UUID REFERENCES order_statuses(id),
  to_status_id UUID NOT NULL REFERENCES order_statuses(id),
  changed_by UUID NOT NULL REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

-- Indexes
CREATE INDEX idx_special_orders_platform ON special_orders(platform_id);
CREATE INDEX idx_special_orders_status ON special_orders(status_id);
CREATE INDEX idx_special_orders_profile ON special_orders(platform_profile_id);
CREATE INDEX idx_special_orders_created_at ON special_orders(created_at);
CREATE INDEX idx_special_order_files_order ON special_order_files(special_order_id);
CREATE INDEX idx_special_order_history_order ON special_order_status_history(special_order_id);
