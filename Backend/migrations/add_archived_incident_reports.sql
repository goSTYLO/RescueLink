-- Physical archive: identity table + archived body table.
-- Child FKs retarget to incident_keys so moving a body row does not CASCADE-delete related data.

CREATE TABLE IF NOT EXISTS incident_keys (
  report_id INTEGER PRIMARY KEY
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'incident_reports_report_id_seq') THEN
    ALTER TABLE incident_keys ALTER COLUMN report_id SET DEFAULT nextval('incident_reports_report_id_seq'::regclass);
  ELSE
    CREATE SEQUENCE incident_reports_report_id_seq;
    ALTER TABLE incident_keys ALTER COLUMN report_id SET DEFAULT nextval('incident_reports_report_id_seq'::regclass);
  END IF;
END $$;

INSERT INTO incident_keys (report_id)
SELECT report_id FROM incident_reports
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS archived_incident_reports (
  LIKE incident_reports INCLUDING DEFAULTS INCLUDING COMMENTS
);

ALTER TABLE archived_incident_reports ALTER COLUMN report_id DROP DEFAULT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'archived_incident_reports_pkey'
  ) THEN
    ALTER TABLE archived_incident_reports ADD CONSTRAINT archived_incident_reports_pkey PRIMARY KEY (report_id);
  END IF;
END $$;

-- Retarget every FK that pointed at incident_reports.report_id to incident_keys.
DO $$
DECLARE rec RECORD;
  newdef TEXT;
BEGIN
  FOR rec IN
    SELECT conrelid::regclass AS tbl, conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE contype = 'f'
      AND confrelid = 'public.incident_reports'::regclass
  LOOP
    newdef := replace(rec.def, 'REFERENCES public.incident_reports(', 'REFERENCES incident_keys(');
    newdef := replace(newdef, 'REFERENCES incident_reports(', 'REFERENCES incident_keys(');
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', rec.tbl, rec.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', rec.tbl, rec.conname, newdef);
  END LOOP;
END $$;

ALTER TABLE incident_reports ALTER COLUMN report_id DROP DEFAULT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'incident_reports_report_id_fkey'
  ) THEN
    ALTER TABLE incident_reports
      ADD CONSTRAINT incident_reports_report_id_fkey
      FOREIGN KEY (report_id) REFERENCES incident_keys(report_id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'archived_incident_reports_report_id_fkey'
  ) THEN
    ALTER TABLE archived_incident_reports
      ADD CONSTRAINT archived_incident_reports_report_id_fkey
      FOREIGN KEY (report_id) REFERENCES incident_keys(report_id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'archived_incident_reports_parent_report_id_fkey'
  ) THEN
    ALTER TABLE archived_incident_reports
      ADD CONSTRAINT archived_incident_reports_parent_report_id_fkey
      FOREIGN KEY (parent_report_id) REFERENCES incident_keys(report_id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN undefined_column THEN NULL;
END $$;

ALTER SEQUENCE incident_reports_report_id_seq OWNED BY incident_keys.report_id;

SELECT setval(
  'incident_reports_report_id_seq',
  GREATEST(COALESCE((SELECT MAX(report_id) FROM incident_keys), 1), 1),
  (SELECT EXISTS (SELECT 1 FROM incident_keys))
);

INSERT INTO archived_incident_reports
SELECT * FROM incident_reports WHERE is_archived IS TRUE
ON CONFLICT (report_id) DO NOTHING;

DELETE FROM incident_reports WHERE is_archived IS TRUE;

DROP INDEX IF EXISTS idx_incident_reports_archived;
DROP INDEX IF EXISTS idx_incident_reports_archived_status;

CREATE INDEX IF NOT EXISTS idx_archived_incident_reports_archived_at
  ON archived_incident_reports (archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_archived_incident_reports_status
  ON archived_incident_reports (status, archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_archived_incident_reports_user_id
  ON archived_incident_reports (user_id);

CREATE OR REPLACE VIEW incident_bodies AS
  SELECT * FROM incident_reports
  UNION ALL
  SELECT * FROM archived_incident_reports;
