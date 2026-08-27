/**
 * IncidentEscalationSection
 *
 * Renders the Escalation tab contents on the Incident Details page:
 *   - Active escalation alert badge (for pending/accepted)
 *   - Historical list of all escalation records
 *   - Action buttons: Accept, Decline (with notes), Resolve, Cancel
 */
import { useState } from 'react';
import { Badge } from '@/presentation/components/ui/Badge';
import { Button } from '@/presentation/components/ui/Button';
import { Textarea } from '@/presentation/components/ui/Textarea';
import { Label } from '@/presentation/components/ui/Label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/presentation/components/ui/Dialog';
import { Loader2, CheckCircle, XCircle, Flag, Ban, AlertTriangle, HandHelping, Clock } from 'lucide-react';

const URGENCY_CONFIG = {
  low:      { label: 'Low',      classes: 'bg-green-500/10 text-green-400 border-green-500/30' },
  medium:   { label: 'Medium',   classes: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
  high:     { label: 'High',     classes: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
  critical: { label: 'Critical', classes: 'bg-red-500/10 text-red-400 border-red-500/30' },
};

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   classes: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30', icon: Clock },
  accepted:  { label: 'Accepted',  classes: 'bg-blue-500/10 text-blue-400 border-blue-500/30',   icon: CheckCircle },
  declined:  { label: 'Declined',  classes: 'bg-red-500/10 text-red-400 border-red-500/30',     icon: XCircle },
  resolved:  { label: 'Resolved',  classes: 'bg-green-500/10 text-green-400 border-green-500/30', icon: Flag },
  cancelled: { label: 'Cancelled', classes: 'bg-gray-500/10 text-gray-400 border-gray-500/30',  icon: Ban },
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
      closeAction();
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
        <div className="flex items-start gap-3 p-4 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-300">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div className="text-sm">
            {pending.length > 0 && (
              <p className="font-semibold">
                {pending.length} pending assistance request{pending.length > 1 ? 's' : ''} awaiting response
              </p>
            )}
            {active.length > 0 && (
              <p>{active.length} active assistance request{active.length > 1 ? 's' : ''} in progress</p>
            )}
          </div>
        </div>
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
              <div key={esc.id} className="p-4 rounded-xl border border-border bg-card/40 space-y-3">
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
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${urgencyCfg.classes}`}>
                      {urgencyCfg.label}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${statusCfg.classes}`}>
                      <StatusIcon size={11} />
                      {statusCfg.label}
                    </span>
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
                      <Button size="sm" variant="default" className="gap-1 text-xs" onClick={() => openAction(esc.id, 'accepted')}>
                        <CheckCircle size={12} /> Accept
                      </Button>
                    )}
                    {caps.decline && (
                      <Button size="sm" variant="outline" className="gap-1 text-xs text-red-400 border-red-500/40 hover:bg-red-500/10" onClick={() => openAction(esc.id, 'declined')}>
                        <XCircle size={12} /> Decline
                      </Button>
                    )}
                    {caps.resolve && (
                      <Button size="sm" variant="outline" className="gap-1 text-xs text-green-400 border-green-500/40 hover:bg-green-500/10" onClick={() => openAction(esc.id, 'resolved')}>
                        <Flag size={12} /> Mark Resolved
                      </Button>
                    )}
                    {caps.cancel && (
                      <Button size="sm" variant="ghost" className="gap-1 text-xs text-muted" onClick={() => openAction(esc.id, 'cancelled')}>
                        <Ban size={12} /> Cancel
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Action confirmation dialog */}
      <Dialog open={!!actionState.escalationId} onOpenChange={closeAction}>
        <DialogContent className="max-w-md bg-card border border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {actionState.action === 'accepted'  && '✅ Accept Assistance Request'}
              {actionState.action === 'declined'  && '❌ Decline Assistance Request'}
              {actionState.action === 'resolved'  && '🏁 Mark Assistance as Resolved'}
              {actionState.action === 'cancelled' && '🚫 Cancel Assistance Request'}
            </DialogTitle>
            <DialogDescription className="text-muted text-sm">
              {needsNotes
                ? 'Please provide a reason (optional but helpful for the requesting department).'
                : 'Add optional response notes before confirming.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="action-response-notes" className="text-foreground text-sm">
                Response Notes {needsNotes ? <span className="text-muted font-normal">(optional)</span> : <span className="text-muted font-normal">(optional)</span>}
              </Label>
              <Textarea
                id="action-response-notes"
                rows={3}
                placeholder="Add notes for the other department..."
                value={responseNotes}
                onChange={(e) => setResponseNotes(e.target.value)}
                maxLength={500}
                disabled={submitting}
                className="resize-none"
              />
            </div>
            {actionError && (
              <p className="text-sm text-red-400">{actionError}</p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeAction} disabled={submitting}>Cancel</Button>
            <Button onClick={handleActionSubmit} disabled={submitting} className="gap-2">
              {submitting ? <><Loader2 size={13} className="animate-spin" /> Processing...</> : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
