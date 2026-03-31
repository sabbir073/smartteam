-- ============================================================
-- Platforms & Orders Tables
-- ============================================================

CREATE TABLE platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  charge_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE order_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6b7280',
  sort_order INT DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  is_terminal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  external_order_id TEXT,
  client_name TEXT NOT NULL,
  client_profile_url TEXT,
  platform_id UUID NOT NULL REFERENCES platforms(id),
  gross_amount DECIMAL(12,2) NOT NULL,
  platform_charge DECIMAL(12,2) NOT NULL,
  net_amount DECIMAL(12,2) NOT NULL,
  service_category_id UUID REFERENCES service_categories(id),
  service_line_id UUID REFERENCES service_lines(id),
  assigned_to UUID REFERENCES users(id),
  assigned_by UUID REFERENCES users(id),
  status_id UUID NOT NULL REFERENCES order_statuses(id),
  deadline TIMESTAMPTZ,
  instruction_text TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE order_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_key TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status_id UUID REFERENCES order_statuses(id),
  to_status_id UUID NOT NULL REFERENCES order_statuses(id),
  changed_by UUID NOT NULL REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

-- Indexes
CREATE INDEX idx_orders_platform ON orders(platform_id);
CREATE INDEX idx_orders_status ON orders(status_id);
CREATE INDEX idx_orders_assigned_to ON orders(assigned_to);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_service_category ON orders(service_category_id);
CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_order_files_order ON order_files(order_id);
CREATE INDEX idx_order_status_history_order ON order_status_history(order_id);
