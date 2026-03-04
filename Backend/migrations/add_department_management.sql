-- Department management domain: departments, units, personnel, and user linkage

CREATE TABLE IF NOT EXISTS departments (
  department_id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL,
  color VARCHAR(30) DEFAULT 'gray',
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS department_units (
  unit_id SERIAL PRIMARY KEY,
  department_id INTEGER NOT NULL REFERENCES departments(department_id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  type VARCHAR(100),
  status VARCHAR(50) DEFAULT 'Available',
  maintenance_status VARCHAR(50) DEFAULT 'Operational',
  last_maintenance DATE,
  next_maintenance DATE,
  maintenance_notes TEXT,
  active_task_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS department_personnel (
  personnel_id SERIAL PRIMARY KEY,
  department_id INTEGER NOT NULL REFERENCES departments(department_id) ON DELETE CASCADE,
  unit_id INTEGER REFERENCES department_units(unit_id) ON DELETE SET NULL,
  name VARCHAR(150) NOT NULL,
  role VARCHAR(100),
  status VARCHAR(50) DEFAULT 'Available',
  special_skills TEXT[] DEFAULT ARRAY[]::TEXT[],
  certifications JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(department_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_departments_code ON departments(code);
CREATE INDEX IF NOT EXISTS idx_departments_type ON departments(type);
CREATE INDEX IF NOT EXISTS idx_department_units_department_id ON department_units(department_id);
CREATE INDEX IF NOT EXISTS idx_department_personnel_department_id ON department_personnel(department_id);
CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id);
