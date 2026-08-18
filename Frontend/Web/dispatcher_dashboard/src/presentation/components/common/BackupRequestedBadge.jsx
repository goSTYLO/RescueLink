import { Badge } from '@/presentation/components/ui/Badge';
import { Siren } from 'lucide-react';

/**
 * Clickable backup badge for incident list rows (icon + text, not color-only).
 */
export function BackupRequestedBadge({ onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`inline-flex items-center gap-1 rounded-lg border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 dark:text-amber-300 ${className}`}
      title="Volunteer requested backup — click to acknowledge or dispatch"
      aria-label="Backup requested — open actions"
    >
      <Siren className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>BACKUP REQUESTED</span>
    </button>
  );
}

export function BackupRequestedBadgeStatic({ className = '' }) {
  return (
    <Badge
      className={`inline-flex items-center gap-1 rounded-lg border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 ${className}`}
    >
      <Siren className="h-3 w-3 shrink-0" aria-hidden="true" />
      BACKUP REQUESTED
    </Badge>
  );
}
