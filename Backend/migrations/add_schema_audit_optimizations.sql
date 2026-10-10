-- Schema audit (RescueLink DB Singapore): indexes, dedupe, search_path, integrity, RLS backstop.
-- Safe to re-run: IF NOT EXISTS / IF EXISTS guards throughout.

ANALYZE;

-- Unindexed foreign keys
CREATE INDEX IF NOT EXISTS idx_archived_incident_reports_parent_report_id
  ON public.archived_incident_reports (parent_report_id);
CREATE INDEX IF NOT EXISTS idx_backup_requests_acknowledged_by
  ON public.backup_requests (acknowledged_by_user_id);
CREATE INDEX IF NOT EXISTS idx_department_personnel_unit_id
  ON public.department_personnel (unit_id);
CREATE INDEX IF NOT EXISTS idx_dispatcher_login_otp_user_id
  ON public.dispatcher_login_otp (user_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_responder_id
  ON public.dispatches (responder_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_assigned_by_user_id
  ON public.dispatches (assigned_by_user_id);
CREATE INDEX IF NOT EXISTS idx_incident_escalations_from_department_id
  ON public.incident_escalations (from_department_id);
CREATE INDEX IF NOT EXISTS idx_incident_escalations_requested_by
  ON public.incident_escalations (requested_by_user_id);
CREATE INDEX IF NOT EXISTS idx_incident_escalations_responded_by
  ON public.incident_escalations (responded_by_user_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_archived_by
  ON public.incident_reports (archived_by_user_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_reporter_confirmed_by
  ON public.incident_reports (reporter_confirmed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_incident_unit_usage_department_id
  ON public.incident_unit_usage (department_id);
CREATE INDEX IF NOT EXISTS idx_incident_unit_usage_unit_id
  ON public.incident_unit_usage (unit_id);
CREATE INDEX IF NOT EXISTS idx_responder_applications_reviewed_by
  ON public.responder_applications (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_responder_applications_revoked_by
  ON public.responder_applications (revoked_by);

DROP INDEX IF EXISTS public.idx_responder_apps_status;
DROP INDEX IF EXISTS public.idx_responder_apps_user_id;
DROP INDEX IF EXISTS public.idx_users_email;
DROP INDEX IF EXISTS public.idx_departments_code;
DROP INDEX IF EXISTS public.idx_incident_coordination_notes_report_id;
DROP INDEX IF EXISTS public.idx_incident_escalations_report_id;

ALTER FUNCTION public.sync_user_role() SET search_path = public;
ALTER FUNCTION public.update_duplicate_clusters_updated_at() SET search_path = public;

CREATE UNIQUE INDEX IF NOT EXISTS responders_user_id_key
  ON public.responders (user_id) WHERE user_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dispatches_department_code_fkey'
  ) THEN
    ALTER TABLE public.dispatches
      ADD CONSTRAINT dispatches_department_code_fkey
      FOREIGN KEY (department_code) REFERENCES public.departments (code);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'responder_teams_department_code_fkey'
  ) THEN
    ALTER TABLE public.responder_teams
      ADD CONSTRAINT responder_teams_department_code_fkey
      FOREIGN KEY (department_code) REFERENCES public.departments (code);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'archived_incident_reports_user_id_fkey'
  ) THEN
    ALTER TABLE public.archived_incident_reports
      ADD CONSTRAINT archived_incident_reports_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users (user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'archived_incident_reports_archived_by_user_id_fkey'
  ) THEN
    ALTER TABLE public.archived_incident_reports
      ADD CONSTRAINT archived_incident_reports_archived_by_user_id_fkey
      FOREIGN KEY (archived_by_user_id) REFERENCES public.users (user_id) ON DELETE SET NULL;
  END IF;
END $$;

-- RLS backstop: owner role bypasses RLS; no policies until Data API grants exist.
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_confidence_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archived_incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blockchain_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatcher_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatcher_login_otp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duplicate_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_coordination_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_responder_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_unit_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responder_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responder_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responder_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responder_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

ALTER VIEW public.incident_bodies SET (security_invoker = true);
ALTER VIEW public.user_activity_summary SET (security_invoker = true);
