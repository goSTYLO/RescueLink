import { Badge } from '@/presentation/components/ui/Badge';
import { Siren, CheckCircle2 } from 'lucide-react';

/**
 * Clickable backup badge for incident list rows (icon + text, not color-only).
 * @param {'pending'|'acknowledged'} status
 */
export function BackupRequestedBadge({ onClick, className = '', status = 'pending' }) {
  const isAcknowledged = String(status || '').toLowerCase() === 'acknowledged';
  const label = isAcknowledged ? 'BACKUP ACKNOWLEDGED' : 'BACKUP REQUESTED';
  const title = isAcknowledged
    ? 'Backup acknowledged — assign official backup team'
    : 'Volunteer requested backup — click to acknowledge or dispatch';
  const ariaLabel = isAcknowledged
    ? 'Backup acknowledged — open actions'
    : 'Backup requested — open actions';

  const colorClasses = isAcknowledged
    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 focus-visible:outline-emerald-500 dark:text-emerald-300'
    : 'border-amber-500/50 bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 focus-visible:outline-amber-500 dark:text-amber-300';

  const Icon = isAcknowledged ? CheckCircle2 : Siren;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${colorClasses} ${className}`}
      title={title}
      aria-label={ariaLabel}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

export function BackupRequestedBadgeStatic({ className = '', status = 'pending' }) {
  const isAcknowledged = String(status || '').toLowerCase() === 'acknowledged';
  const label = isAcknowledged ? 'BACKUP ACKNOWLEDGED' : 'BACKUP REQUESTED';
  const colorClasses = isAcknowledged
    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
    : 'border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300';
  const Icon = isAcknowledged ? CheckCircle2 : Siren;

  return (
    <Badge
      className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] font-semibold ${colorClasses} ${className}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {label}
    </Badge>
  );
}
