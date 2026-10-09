-- Prefer users.role_id as source of truth; unknown ids fall through to the FK.
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
