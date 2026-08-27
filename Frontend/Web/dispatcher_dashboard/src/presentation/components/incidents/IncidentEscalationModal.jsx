/**
 * IncidentEscalationModal
 *
 * Renders a dialog for Department Admins / Dispatchers / Super Admins to
 * request inter-department assistance on an active incident.
 */
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/presentation/components/ui/Dialog';
import { Button } from '@/presentation/components/ui/Button';
import { Label } from '@/presentation/components/ui/Label';
import { Textarea } from '@/presentation/components/ui/Textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/presentation/components/ui/Select';
import { AlertTriangle, Loader2, HandHelping } from 'lucide-react';

const URGENCY_OPTIONS = [
  { value: 'low',      label: '🟢 Low',      color: 'text-green-400' },
  { value: 'medium',   label: '🟡 Medium',   color: 'text-yellow-400' },
  { value: 'high',     label: '🟠 High',     color: 'text-orange-400' },
  { value: 'critical', label: '🔴 Critical', color: 'text-red-400' },
];

/**
 * @param {object}   props
 * @param {boolean}  props.open
 * @param {Function} props.onOpenChange
 * @param {Array}    props.departments         - [{department_id, name, type, status}, ...]
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

  const availableDepts = departments.filter(
    (d) => String(d.department_id) !== String(ownDepartmentId) &&
           String(d.status || '').toLowerCase() !== 'inactive'
  );

  const deptOptions = availableDepts.map((d) => ({
    value: String(d.department_id),
    label: `${d.name}${d.type ? ` · ${d.type}` : ''}`,
  }));

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
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-card border border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <HandHelping size={20} className="text-primary" />
            Request Inter-Department Assistance
          </DialogTitle>
          <DialogDescription className="text-muted text-sm">
            Send an assistance request to another department for this incident.
            They will be notified immediately via push notification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Target Department */}
          <div className="space-y-1.5">
            <Label htmlFor="escalation-target-dept" className="text-foreground font-medium">
              Target Department <span className="text-red-400">*</span>
            </Label>
            <Select
              value={toDepartmentId}
              onValueChange={setToDepartmentId}
              disabled={loading}
            >
              <SelectTrigger id="escalation-target-dept" className="w-full">
                <SelectValue placeholder="Select department..." options={deptOptions} />
              </SelectTrigger>
              <SelectContent>
                {availableDepts.length === 0 ? (
                  <SelectItem value="__none" disabled>No other departments available</SelectItem>
                ) : (
                  availableDepts.map((d) => (
                    <SelectItem key={d.department_id} value={String(d.department_id)}>
                      {d.name} {d.type ? `· ${d.type}` : ''}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Urgency */}
          <div className="space-y-1.5">
            <Label htmlFor="escalation-urgency" className="text-foreground font-medium">
              Urgency Level <span className="text-red-400">*</span>
            </Label>
            <Select value={urgency} onValueChange={setUrgency} disabled={loading}>
              <SelectTrigger id="escalation-urgency" className="w-full">
                <SelectValue placeholder="Select urgency..." options={URGENCY_OPTIONS} />
              </SelectTrigger>
              <SelectContent>
                {URGENCY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <span className={o.color}>{o.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Justification Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="escalation-notes" className="text-foreground font-medium">
              Justification / Notes <span className="text-red-400">*</span>
            </Label>
            <Textarea
              id="escalation-notes"
              rows={4}
              placeholder="Describe why assistance is needed (min 5 characters)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              disabled={loading}
              className="resize-none"
            />
            <p className="text-xs text-muted text-right">{notes.length} / 1000</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || loading}
            className="gap-2"
          >
            {loading ? (
              <><Loader2 size={14} className="animate-spin" /> Sending...</>
            ) : (
              <><HandHelping size={14} /> Send Request</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
