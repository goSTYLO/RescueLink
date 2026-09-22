/**
 * IncidentEscalationSection
 *
 * Renders the Escalation tab contents on the Incident Details page:
 *   - Active escalation alert badge (for pending/accepted)
 *   - Historical list of all escalation records
 *   - Action buttons: Accept, Decline (with notes), Resolve, Cancel
 */
import { useState } from 'react';
import { Alert, Button, Card, Input, Modal, Tag } from 'antd';
import { Loader2, CheckCircle, XCircle, Flag, Ban, HandHelping, Clock } from 'lucide-react';

const URGENCY_CONFIG = {
  low: { label: 'Low', color: 'green' },
  medium: { label: 'Medium', color: 'gold' },
  high: { label: 'High', color: 'orange' },
  critical: { label: 'Critical', color: 'red' },
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'gold', icon: Clock },
  accepted: { label: 'Accepted', color: 'blue', icon: CheckCircle },
  declined: { label: 'Declined', color: 'red', icon: XCircle },
  resolved: { label: 'Resolved', color: 'green', icon: Flag },
  cancelled: { label: 'Cancelled', color: 'default', icon: Ban },
};

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

/**
 * @param {object}   props
 * @param {Array}    props.escalations            - Escalation records from API
 * @param {boolean}  props.loading                - Fetching indicator
 * @param {string}   [props.currentUserRole]      - Normalized role of current user
 * @param {number}   [props.currentUserDeptId]    - Current user's department_id
 * @param {Function} props.onStatusUpdate         - async (escalationId, status, notes?) => void
 */
export function IncidentEscalationSection({
  escalations = [],
  loading = false,
  currentUserRole = '',
  currentUserDeptId,
  onStatusUpdate,
}) {
  const [actionState, setActionState] = useState({ escalationId: null, action: null });
  const [responseNotes, setResponseNotes]   = useState('');
  const [submitting, setSubmitting]         = useState(false);
  const [actionError, setActionError]       = useState('');

  const normalizedRole = String(currentUserRole).toLowerCase();
  const isSuperOrDispatcher = ['admin', 'super-admin', 'superadmin', 'dispatcher'].includes(normalizedRole);
  const isDeptAdmin = normalizedRole === 'department-admin' || normalizedRole === 'department-head';

  function canActOn(esc) {
    if (!esc || !['pending', 'accepted'].includes(esc.status)) return { accept: false, decline: false, resolve: false, cancel: false };
    if (isSuperOrDispatcher) return { accept: true, decline: true, resolve: true, cancel: true };
    if (isDeptAdmin) {
      const isTargetDept  = String(esc.to_department_id)   === String(currentUserDeptId);
      const isRequestDept = String(esc.from_department_id) === String(currentUserDeptId);
      return {
        accept:  isTargetDept && esc.status === 'pending',
        decline: isTargetDept && esc.status === 'pending',
        resolve: isTargetDept && esc.status === 'accepted',
        cancel:  isRequestDept,
      };
    }
    return { accept: false, decline: false, resolve: false, cancel: false };
  }

  function openAction(escalationId, action) {
    setActionState({ escalationId, action });
    setResponseNotes('');
    setActionError('');
  }

  function closeAction() {
    if (submitting) return;
    setActionState({ escalationId: null, action: null });
    setResponseNotes('');
    setActionError('');
  }

  async function handleActionSubmit() {
    if (submitting) return;
    const { escalationId, action } = actionState;
    setSubmitting(true);
    setActionError('');
    try {
      await onStatusUpdate(escalationId, action, responseNotes.trim() || undefined);
      setActionState({ escalationId: null, action: null });
      setResponseNotes('');
      setActionError('');
    } catch (err) {
      setActionError(err.message || 'Action failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const pending = escalations.filter((e) => e.status === 'pending');
  const active  = escalations.filter((e) => e.status === 'accepted');
  const needsNotes = ['decline', 'cancel'].includes(actionState.action);

  return (
    <div className="space-y-5">
      {/* Active alert banner */}
      {(pending.length > 0 || active.length > 0) && (
        <Alert
          type="warning"
          showIcon
          message={pending.length > 0
            ? `${pending.length} pending assistance request${pending.length > 1 ? 's' : ''} awaiting response`
            : `${active.length} active assistance request${active.length > 1 ? 's' : ''} in progress`}
          description={pending.length > 0 && active.length > 0
            ? `${active.length} active assistance request${active.length > 1 ? 's' : ''} in progress`
            : null}
        />
      )}

      {/* Escalation list */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-muted text-sm">
          <Loader2 size={16} className="animate-spin" />
          Loading escalations...
        </div>
      ) : escalations.length === 0 ? (
        <div className="text-center py-10 text-muted text-sm">
          <HandHelping size={32} className="mx-auto mb-2 opacity-30" />
          No inter-department assistance requests recorded
        </div>
      ) : (
        <div className="space-y-3">
          {escalations.map((esc) => {
            const urgencyCfg = URGENCY_CONFIG[esc.urgency] || URGENCY_CONFIG.medium;
            const statusCfg  = STATUS_CONFIG[esc.status]   || STATUS_CONFIG.pending;
            const StatusIcon = statusCfg.icon;
            const caps = canActOn(esc);

            return (
              <Card key={esc.id} size="small" style={{ marginBottom: 8 }}>
                {/* Header row */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <HandHelping size={14} className="text-primary" />
                      {esc.from_department_name || 'Operations Center'}
                      <span className="text-muted font-normal">→</span>
                      <span className="text-primary">{esc.to_department_name || `Dept #${esc.to_department_id}`}</span>
                    </p>
                    <p className="text-xs text-muted">
                      Requested by {esc.requester_first_name} {esc.requester_last_name} · {formatDate(esc.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag color={urgencyCfg.color}>{urgencyCfg.label}</Tag>
                    <Tag color={statusCfg.color} icon={<StatusIcon size={11} />}>{statusCfg.label}</Tag>
                  </div>
                </div>

                {/* Justification */}
                <p className="text-sm text-foreground/80 bg-background/50 p-2.5 rounded-lg border border-border">
                  {esc.justification_notes}
                </p>

                {/* Response (if any) */}
                {esc.response_notes && (
                  <div className="text-xs text-muted bg-background/30 p-2 rounded-lg border border-border">
                    <span className="font-medium text-foreground">Response: </span>
                    {esc.response_notes}
                    {esc.responder_first_name && (
                      <span className="ml-1">
                        — {esc.responder_first_name} {esc.responder_last_name}, {formatDate(esc.responded_at)}
                      </span>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                {(caps.accept || caps.decline || caps.resolve || caps.cancel) && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {caps.accept && (
                      <Button type="primary" icon={<CheckCircle size={14} />} onClick={() => openAction(esc.id, 'accepted')}>Accept</Button>
                    )}
                    {caps.decline && (
                      <Button danger icon={<XCircle size={14} />} onClick={() => openAction(esc.id, 'declined')}>Decline</Button>
                    )}
                    {caps.resolve && (
                      <Button icon={<Flag size={14} />} onClick={() => openAction(esc.id, 'resolved')}>Mark Resolved</Button>
                    )}
                    {caps.cancel && (
                      <Button type="text" icon={<Ban size={14} />} onClick={() => openAction(esc.id, 'cancelled')}>Cancel</Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Action confirmation dialog */}
      <Modal
        open={!!actionState.escalationId}
        onCancel={closeAction}
        title={
          (actionState.action === 'accepted' && 'Accept Assistance Request')
          || (actionState.action === 'declined' && 'Decline Assistance Request')
          || (actionState.action === 'resolved' && 'Mark Assistance as Resolved')
          || (actionState.action === 'cancelled' && 'Cancel Assistance Request')
          || 'Assistance request'
        }
        okText={submitting ? 'Processing...' : 'Confirm'}
        confirmLoading={submitting}
        onOk={handleActionSubmit}
      >
        <p>
          {needsNotes
            ? 'Please provide a reason (optional but helpful for the requesting department).'
            : 'Add optional response notes before confirming.'}
        </p>
        <label htmlFor="action-response-notes">Response notes (optional)</label>
        <Input.TextArea
          id="action-response-notes"
          rows={3}
          placeholder="Add notes for the other department..."
          value={responseNotes}
          onChange={(e) => setResponseNotes(e.target.value)}
          maxLength={500}
          disabled={submitting}
        />
        {actionError && <Alert type="error" showIcon message={actionError} style={{ marginTop: 8 }} />}
      </Modal>
    </div>
  );
}
