import { incidentTypeColor } from '@/presentation/components/insights/insightsColors';

export function formatBarangayTypeSummary(types, titleCase) {
  const rows = types || [];
  if (!rows.length) return '';
  return rows.map((t) => `${titleCase(t.key)} ${t.count}`).join(', ');
}

export function BarangayTypesCell({ types, titleCase, onTypeClick }) {
  const rows = types || [];
  if (!rows.length) {
    return <span className="text-muted text-xs">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-1 max-w-[220px]">
      {rows.map((t) => (
        <button
          key={t.key}
          type="button"
          className="inline-flex items-center gap-1 text-xs hover:underline"
          onClick={() => onTypeClick?.(t.key)}
        >
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: incidentTypeColor(t.key) }} aria-hidden />
          <span className="truncate max-w-[88px]">{titleCase(t.key)}</span>
          <span className="tabular-nums text-muted">{t.count}</span>
        </button>
      ))}
    </div>
  );
}
