-- ============================================================
-- Tech Requisition & Inventory Tables
-- ============================================================

CREATE TABLE tech_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES users(id),
  item_description TEXT NOT NULL,
  purpose TEXT NOT NULL,
  estimated_cost DECIMAL(12,2),
  urgency TEXT NOT NULL DEFAULT 'medium'
    CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'fulfilled')),
  reviewer_id UUID REFERENCES users(id),
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  fulfilled_by UUID REFERENCES users(id),
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tech_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  assigned_to UUID REFERENCES users(id),
  purchase_date DATE,
  cost DECIMAL(12,2),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'retired', 'under_repair')),
  serial_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_tech_requisitions_requester ON tech_requisitions(requester_id);
CREATE INDEX idx_tech_requisitions_status ON tech_requisitions(status);
CREATE INDEX idx_tech_inventory_status ON tech_inventory(status);
CREATE INDEX idx_tech_inventory_assigned ON tech_inventory(assigned_to);
