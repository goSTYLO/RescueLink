-- Role ID lookup. users.role stays as the denormalized code; role_id is the source of truth.

CREATE TABLE IF NOT EXISTS roles (
  role_id SMALLINT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL
);

INSERT INTO roles (role_id, code, name) VALUES
  (1, 'admin', 'Admin'),
  (2, 'dispatcher', 'Dispatcher'),
  (3, 'supervisor', 'Supervisor'),
  (4, 'department-admin', 'Department Admin'),
  (5, 'department-head', 'Department Head'),
  (6, 'responder', 'Responder'),
  (7, 'volunteer', 'Volunteer'),
  (8, 'user', 'User')
ON CONFLICT (role_id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name;

ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id SMALLINT REFERENCES roles(role_id);

UPDATE users SET role_id = 1
WHERE role_id IS NULL AND LOWER(TRIM(role)) IN ('admin', 'super-admin', 'superadmin', 'super admin');

UPDATE users u SET role_id = r.role_id
FROM roles r
WHERE u.role_id IS NULL AND LOWER(TRIM(u.role)) = r.code;

DO $$
DECLARE leftover INTEGER;
BEGIN
  SELECT COUNT(*) INTO leftover FROM users WHERE role_id IS NULL;
  IF leftover > 0 THEN
    RAISE EXCEPTION 'add_roles_lookup: % users have unknown role strings; fix before migrating', leftover;
  END IF;
END $$;

ALTER TABLE users ALTER COLUMN role_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);

CREATE OR REPLACE FUNCTION sync_user_role()
RETURNS trigger AS $$
DECLARE resolved_id SMALLINT;
  resolved_code VARCHAR(50);
  incoming TEXT;
BEGIN
  IF NEW.role_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.role_id IS DISTINCT FROM OLD.role_id) THEN
    SELECT code INTO resolved_code FROM roles WHERE role_id = NEW.role_id;
    IF resolved_code IS NULL THEN
      RETURN NEW;
    END IF;
    NEW.role := resolved_code;
    RETURN NEW;
  END IF;

  incoming := LOWER(TRIM(COALESCE(NEW.role, '')));
  IF incoming IN ('super-admin', 'superadmin', 'super admin') THEN
    incoming := 'admin';
  ELSIF incoming IN ('department admin', 'dept admin') THEN
    incoming := 'department-admin';
  ELSIF incoming IN ('department head') THEN
    incoming := 'department-head';
  END IF;

  IF incoming <> '' THEN
    SELECT role_id, code INTO resolved_id, resolved_code FROM roles WHERE code = incoming;
    IF resolved_id IS NOT NULL THEN
      NEW.role_id := resolved_id;
      NEW.role := resolved_code;
      RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.role_id IS NULL THEN
    NEW.role_id := 8;
    NEW.role := 'user';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_user_role ON users;
CREATE TRIGGER trg_sync_user_role
  BEFORE INSERT OR UPDATE OF role, role_id ON users
  FOR EACH ROW
  EXECUTE PROCEDURE sync_user_role();
