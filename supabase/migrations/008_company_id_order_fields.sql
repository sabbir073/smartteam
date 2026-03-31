-- ============================================================
-- Add company_id to users and new fields to orders
-- ============================================================

-- 1. Add company_id to users table
ALTER TABLE users ADD COLUMN company_id TEXT;
CREATE INDEX idx_users_company_id ON users(company_id);

-- 2. Add new fields to orders table
ALTER TABLE orders ADD COLUMN employee_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN profile_name TEXT;
ALTER TABLE orders ADD COLUMN order_link TEXT;
ALTER TABLE orders ADD COLUMN instruction_sheet_link TEXT;
ALTER TABLE orders ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN department_id UUID REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN delivery_time TIMESTAMPTZ;

-- 3. Indexes for new foreign keys
CREATE INDEX idx_orders_employee ON orders(employee_id);
CREATE INDEX idx_orders_team ON orders(team_id);
CREATE INDEX idx_orders_department ON orders(department_id);
