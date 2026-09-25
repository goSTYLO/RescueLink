import { Badge } from '@/presentation/components/ui/Badge';
import { formatIncidentTypeLabel, getTypeBadgeClass } from '@/core/utils/incidentDisplay';

export function IncidentTypeChips({
  incidentTypes = [],
  fallbackType,
  compact = false,
  className = '',
}) {
  let types = (incidentTypes || []).filter(Boolean);
  if (types.length === 0 && fallbackType) {
    types = [fallbackType];
  }
  if (types.length === 0) return null;

  const visible = compact ? types.slice(0, 2) : types;
  const overflow = compact ? Math.max(0, types.length - visible.length) : 0;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {visible.map((type, index) => (
        <Badge
          key={`${type}-${index}`}
          variant={index === 0 ? 'default' : 'outline'}
          className={`rounded-sm ${getTypeBadgeClass(type)} ${index === 0 ? 'font-semibold' : ''}`}
        >
          {formatIncidentTypeLabel(type)}
        </Badge>
      ))}
      {overflow > 0 && (
        <Badge
          variant="outline"
          className="rounded-sm bg-slate-500/10 text-slate-600 border-slate-500/30 dark:text-slate-400"
        >
          +{overflow}
        </Badge>
      )}
    </div>
  );
}
