import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/presentation/components/ui/Dialog';
import { Button } from '@/presentation/components/ui/Button';
import { Siren, CheckCircle2 } from 'lucide-react';

const TARGET_LABELS = {
  cdrrmo: 'CDRRMO / official units',
  nearby_responders: 'Nearby volunteers',
  both: 'CDRRMO + nearby volunteers',
};

export function BackupRequestDialog({
  open,
  onOpenChange,
  incidentId,
  onAcknowledge,
  onDispatch,
  onAssignTeam,
  acknowledging = false,
  target = null,
  broadcastCount = null,
  backupVolunteers = [],
  openBackupStatus = 'pending',
  canAcknowledge = false,
  canNotifyDepartment = false,
  canAssignTeam = false,
}) {
  const targetLabel = target ? (TARGET_LABELS[target] || target) : null;
  const joinedVolunteers = (backupVolunteers || []).filter((v) => v?.status !== 'declined');
  const isAcknowledged = String(openBackupStatus || '').toLowerCase() === 'acknowledged';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isAcknowledged ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" />
            ) : (
              <Siren className="h-5 w-5 text-amber-500" aria-hidden="true" />
            )}
            {isAcknowledged ? 'Backup acknowledged' : 'Backup requested'}
          </DialogTitle>
          <DialogDescription>
            {isAcknowledged
              ? `Backup for Incident #${incidentId} was acknowledged. Notify a department or assign an official backup team.`
              : `A volunteer responder requested backup for Incident #${incidentId}. Acknowledge when seen, or dispatch official units.`}
          </DialogDescription>
        </DialogHeader>

        {(targetLabel || broadcastCount != null) && (
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted">
            {targetLabel && <p><span className="font-medium text-foreground">Target:</span> {targetLabel}</p>}
            {broadcastCount != null && Number(broadcastCount) >= 0 && (
              <p className="mt-1"><span className="font-medium text-foreground">Nearby alerted:</span> {broadcastCount} volunteer(s)</p>
            )}
          </div>
        )}

        {joinedVolunteers.length > 0 && (
          <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">Backup volunteers joined</p>
            <ul className="mt-2 space-y-1 text-sm">
              {joinedVolunteers.map((vol) => (
                <li key={vol.user_id || vol.name} className="flex items-center justify-between gap-2">
                  <span>{vol.name || 'Volunteer'}</span>
                  <span className="text-xs text-muted">{vol.responder_status || 'Assigned'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={acknowledging}
          >
            Cancel
          </Button>
          {canAcknowledge && !isAcknowledged && (
            <Button
              type="button"
              variant="secondary"
              onClick={onAcknowledge}
              disabled={acknowledging}
            >
              {acknowledging ? 'Acknowledging…' : 'Acknowledge'}
            </Button>
          )}
          {canNotifyDepartment && (
            <Button
              type="button"
              className="bg-[#134178] hover:bg-[#0f3256]"
              onClick={onDispatch}
              disabled={acknowledging}
            >
              Notify Department
            </Button>
          )}
          {canAssignTeam && (
            <Button
              type="button"
              className="bg-[#134178] hover:bg-[#0f3256]"
              onClick={onAssignTeam}
              disabled={acknowledging}
            >
              Assign Team
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
