import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/presentation/components/ui/Dialog';
import { Button } from '@/presentation/components/ui/Button';
import { Siren } from 'lucide-react';

export function BackupRequestDialog({
  open,
  onOpenChange,
  incidentId,
  onAcknowledge,
  onDispatch,
  acknowledging = false,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Siren className="h-5 w-5 text-amber-500" aria-hidden="true" />
            Backup requested
          </DialogTitle>
          <DialogDescription>
            A volunteer responder requested backup for Incident #{incidentId}. Acknowledge when seen, or dispatch official units from the incident details page.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={acknowledging}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onAcknowledge}
            disabled={acknowledging}
          >
            {acknowledging ? 'Acknowledging…' : 'Acknowledge'}
          </Button>
          <Button
            type="button"
            className="bg-[#134178] hover:bg-[#0f3256]"
            onClick={onDispatch}
            disabled={acknowledging}
          >
            Dispatch units
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
