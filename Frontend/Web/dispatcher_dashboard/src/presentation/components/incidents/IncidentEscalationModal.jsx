/**
 * IncidentEscalationModal
 *
 * Renders a dialog for Department Admins / Dispatchers / Super Admins to
 * request inter-department assistance on an active incident.
 * Shows available teams and resource capacity for the selected department.
 */
import { useState, useEffect } from 'react';
import { Modal, Button, Select, Input, Tag, Card } from 'antd';
import { AlertTriangle, Loader2, HandHelping, Users, CheckCircle } from 'lucide-react';
import { getResponderTeams } from '@/data/api/responders.api';

const { TextArea } = Input;

const URGENCY_OPTIONS = [
  { value: 'low', label: '🟢 Low' },
  { value: 'medium', label: '🟡 Medium' },
  { value: 'high', label: '🟠 High' },
  { value: 'critical', label: '🔴 Critical' },
];

import { ResponderStatusTag } from '@/presentation/components/common/ResponderStatusTag';

function getTeamStatusBadge(status) {
  return <ResponderStatusTag status={status}>{String(status || 'Off-duty')}</ResponderStatusTag>;
}

/**
 * @param {object}   props
 * @param {boolean}  props.open
 * @param {Function} props.onOpenChange
 * @param {Array}    props.departments         - [{department_id, name, code, type, status}, ...]
 * @param {number}   [props.ownDepartmentId]   - Requesting user's department (excluded from list)
 * @param {string}   [props.defaultUrgency]    - Default urgency level
 * @param {Function} props.onSubmit            - async (payload) => void
 */
export function IncidentEscalationModal({
  open,
  onOpenChange,
  departments = [],
  ownDepartmentId,
  defaultUrgency = 'medium',
  onSubmit,
}) {
  const [toDepartmentId, setToDepartmentId] = useState('');
  const [urgency, setUrgency]               = useState(defaultUrgency);
  const [notes, setNotes]                   = useState('');
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState('');
  const [teams, setTeams]                   = useState([]);
  const [teamsLoading, setTeamsLoading]     = useState(false);

  const availableDepts = departments.filter(
    (d) => String(d.department_id) !== String(ownDepartmentId) &&
           String(d.status || '').toLowerCase() !== 'inactive'
  );

  // Fetch responder teams when modal opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setTeamsLoading(true);
    getResponderTeams({ limit: 200 })
      .then((res) => {
        if (!cancelled) setTeams(Array.isArray(res) ? res : []);
      })
      .catch(() => {
        if (!cancelled) setTeams([]);
      })
      .finally(() => {
        if (!cancelled) setTeamsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const selectedDept = availableDepts.find((d) => String(d.department_id) === String(toDepartmentId));
  const deptCode = String(selectedDept?.code || selectedDept?.name || '').toLowerCase();

  const deptTeams = teams.filter((t) => {
    if (!t) return false;
    const teamCode = String(t.department_code || '').toLowerCase();
    return teamCode === deptCode || (selectedDept?.code && teamCode === String(selectedDept.code).toLowerCase());
  });

  const availableTeams = deptTeams.filter((t) => {
    const s = String(t.team_status || 'available').toLowerCase();
    return s.includes('available') || s.includes('standby');
  });
  const busyTeams = deptTeams.filter((t) => {
    const s = String(t.team_status || '').toLowerCase();
    return s.includes('busy');
  });

  const isValid = toDepartmentId && notes.trim().length >= 5;

  function handleClose() {
    if (loading) return;
    setToDepartmentId('');
    setUrgency(defaultUrgency);
    setNotes('');
    setError('');
    onOpenChange(false);
  }

  async function handleSubmit() {
    if (!isValid || loading) return;
    setError('');
    setLoading(true);
    try {
      await onSubmit({
        to_department_id:   Number(toDepartmentId),
        urgency,
        justification_notes: notes.trim(),
      });
      handleClose();
    } catch (err) {
      setError(err.message || 'Failed to send assistance request. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title={(
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <HandHelping size={20} />
          Request Inter-Department Assistance
        </span>
      )}
      footer={[
        <Button key="cancel" onClick={handleClose} disabled={loading}>
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          onClick={handleSubmit}
          disabled={!isValid || loading}
          loading={loading}
        >
          Send Request
        </Button>,
      ]}
      width={512}
      destroyOnClose
    >
      <p style={{ marginBottom: 16, color: 'var(--ant-color-text-secondary)' }}>
        Send an assistance request to another department for this incident.
        They will be notified immediately via push notification.
      </p>

      <div className="space-y-4 py-2">
        <div className="space-y-1.5">
          <label htmlFor="escalation-target-dept" className="text-foreground font-medium block">
            Target Department <span className="text-red-400">*</span>
          </label>
          <Select
            id="escalation-target-dept"
            className="w-full"
            placeholder="Select department..."
            value={toDepartmentId || undefined}
            onChange={setToDepartmentId}
            disabled={loading}
            options={availableDepts.length === 0
              ? [{ value: '__none', label: 'No other departments available', disabled: true }]
              : availableDepts.map((d) => ({
                  value: String(d.department_id),
                  label: `${d.name}${d.type ? ` · ${d.type}` : ''}`,
                }))}
          />
        </div>

        {toDepartmentId && (
          <div className="space-y-2 p-3.5 rounded-xl border border-border bg-background/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={15} className="text-primary" />
                <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                  {selectedDept?.name} Resources
                </span>
              </div>
              {teamsLoading ? (
                <span className="text-[11px] text-muted flex items-center gap-1">
                  <Loader2 size={11} className="animate-spin" /> Checking teams...
                </span>
              ) : (
                <span className="text-[11px] font-medium text-muted">
                  {deptTeams.length} registered team{deptTeams.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {teamsLoading ? (
              <div className="py-3 flex items-center justify-center text-xs text-muted gap-2">
                <Loader2 size={13} className="animate-spin" /> Loading available teams...
              </div>
            ) : deptTeams.length === 0 ? (
              <p className="text-xs text-muted italic py-1">
                ℹ️ No registered responder teams found for this department. Requests will route to the department operations head.
              </p>
            ) : (
              <div className="space-y-2">
                <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
                  availableTeams.length > 0
                    ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                    : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                }`}>
                  {availableTeams.length > 0 ? (
                    <>
                      <CheckCircle size={14} className="shrink-0" />
                      <span>
                        <strong>{availableTeams.length} available team{availableTeams.length !== 1 ? 's' : ''}</strong> ready to respond
                        {busyTeams.length > 0 ? ` (${busyTeams.length} currently busy)` : ''}.
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={14} className="shrink-0" />
                      <span>
                        <strong>Limited capacity:</strong> All {deptTeams.length} team{deptTeams.length !== 1 ? 's are' : ' is'} currently busy or off-duty.
                      </span>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                  {deptTeams.map((team) => (
                    <Card key={team.team_id} size="small">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-medium text-foreground truncate" title={team.team_name}>
                          {team.team_name}
                        </span>
                        {getTeamStatusBadge(team.team_status)}
                      </div>
                      {Array.isArray(team.supported_incident_types) && team.supported_incident_types.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {team.supported_incident_types.map((type) => (
                            <Tag key={type} style={{ fontSize: 10, margin: 0 }}>{String(type).toUpperCase()}</Tag>
                          ))}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="escalation-urgency" className="text-foreground font-medium block">
            Urgency Level <span className="text-red-400">*</span>
          </label>
          <Select
            id="escalation-urgency"
            className="w-full"
            placeholder="Select urgency..."
            value={urgency}
            onChange={setUrgency}
            disabled={loading}
            options={URGENCY_OPTIONS}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="escalation-notes" className="text-foreground font-medium block">
            Justification / Notes <span className="text-red-400">*</span>
          </label>
          <TextArea
            id="escalation-notes"
            rows={4}
            placeholder="Describe why assistance is needed (min 5 characters)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            disabled={loading}
            showCount
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
