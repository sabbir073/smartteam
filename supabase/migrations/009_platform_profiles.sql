-- ============================================================
-- Platform Profiles
-- ============================================================

CREATE TABLE platform_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  profile_url TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_platform_profiles_platform ON platform_profiles(platform_id);
CREATE INDEX idx_platform_profiles_active ON platform_profiles(is_active);

-- Update orders to reference platform_profiles instead of text
ALTER TABLE orders ADD COLUMN platform_profile_id UUID REFERENCES platform_profiles(id) ON DELETE SET NULL;
CREATE INDEX idx_orders_platform_profile ON orders(platform_profile_id);
