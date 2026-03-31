-- ============================================================
-- Seed Data
-- ============================================================

-- 1. Create System Admin Role
INSERT INTO roles (id, name, description, level, is_system_role)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'System Admin',
  'Full system access administrator',
  0,
  true
);

-- 2. Seed all permissions (14 modules x 4 actions x 4 data_scopes = 224 permissions)
DO $$
DECLARE
  m TEXT;
  a TEXT;
  s TEXT;
  modules TEXT[] := ARRAY['dashboard', 'orders', 'users', 'roles', 'teams', 'services', 'platforms', 'targets', 'revenue', 'reports', 'requisitions', 'inventory', 'audit-logs', 'settings'];
  actions TEXT[] := ARRAY['view', 'create', 'edit', 'delete'];
  scopes TEXT[] := ARRAY['own', 'team', 'department', 'all'];
BEGIN
  FOREACH m IN ARRAY modules LOOP
    FOREACH a IN ARRAY actions LOOP
      FOREACH s IN ARRAY scopes LOOP
        INSERT INTO permissions (module, action, data_scope, description)
        VALUES (m, a, s, m || ':' || a || ':' || s)
        ON CONFLICT (module, action, data_scope) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- 3. Assign ALL permissions to System Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000001', id
FROM permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. Create Admin User (password: Admin@123)
-- bcrypt hash for 'Admin@123'
INSERT INTO users (id, email, password_hash, name, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'admin@smartlab.com',
  '$2a$12$LJ3aSC07fv2V7sW8VZzXXeXfV6X.ZUvY5N5Rv1tRqHdJy5Q8oT1xS',
  'System Admin',
  true
);

-- 5. Assign Admin role to Admin user
INSERT INTO user_roles (user_id, role_id)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001'
);

-- 6. Default Order Statuses
INSERT INTO order_statuses (name, color, sort_order, is_default, is_terminal) VALUES
  ('New', '#3b82f6', 1, true, false),
  ('In Progress', '#f59e0b', 2, false, false),
  ('Under Review', '#8b5cf6', 3, false, false),
  ('Revision', '#ef4444', 4, false, false),
  ('Completed', '#22c55e', 5, false, true),
  ('Cancelled', '#6b7280', 6, false, true);

-- 7. Default Platforms
INSERT INTO platforms (name, charge_percentage) VALUES
  ('Fiverr', 20.00),
  ('Upwork', 10.00);

-- 8. Revenue Settings
INSERT INTO revenue_settings (attribution_mode, sales_split_percentage, operations_split_percentage)
VALUES ('operations', 50.00, 50.00);

-- 9. System Settings
INSERT INTO system_settings (key, value) VALUES
  ('audit_retention_days', '365'),
  ('app_name', '"SmartTeam"');
