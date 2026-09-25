/** Semantic colors + chrome for Insights CAD/EOC dashboard (hex for charts, Tailwind for UI). */

export const CARD_CHROME = 'bg-card rounded-md border border-[rgba(19,65,120,0.35)]';
export const KPI_HOVER = 'hover:shadow-md hover:shadow-primary/10 transition-shadow';

const DEPT_PALETTE = ['#134178', '#0ea5e9', '#14b8a6', '#6366f1', '#d97706', '#16a34a', '#dc2626', '#7c3aed'];

function norm(value) {
  return String(value || '').trim().toLowerCase();
}

function hashStr(value) {
  let h = 0;
  const s = norm(value);
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Match incidentDisplay.getTypeBadgeClass semantics. */
export function incidentTypeColor(type) {
  const n = norm(type);
  if (!n) return '#64748b';
  if (n.includes('fire')) return '#ea580c';
  if (n.includes('medical') || n.includes('health') || n.includes('accident')) return '#db2777';
  if (n.includes('police') || n.includes('crime')) return '#2563eb';
  if (n.includes('disaster') || n.includes('flood')) return '#0284c7';
  return '#64748b';
}

export function severityColor(severity) {
  const n = norm(severity);
  if (n === 'critical' || n === 'high') return '#dc2626';
  if (n === 'medium') return '#d97706';
  if (n === 'low') return '#16a34a';
  return '#64748b';
}

export function channelColor(channel) {
  const n = norm(channel);
  if (n.includes('app') || n.includes('mobile')) return '#134178';
  if (n.includes('phone') || n.includes('call')) return '#0ea5e9';
  if (n.includes('web')) return '#6366f1';
  if (n.includes('sms')) return '#14b8a6';
  return DEPT_PALETTE[hashStr(n) % DEPT_PALETTE.length];
}

export function outcomeColor(outcome) {
  const n = norm(outcome);
  if (n.includes('resolved')) return '#16a34a';
  if (n.includes('closed')) return '#64748b';
  if (n.includes('cancel')) return '#d97706';
  if (n.includes('duplicate')) return '#7c3aed';
  return DEPT_PALETTE[hashStr(n) % DEPT_PALETTE.length];
}

export function exceptionColor(key) {
  const map = {
    reassignment: '#d97706',
    auto_assign_mismatch: '#dc2626',
    backup_requested: '#7c3aed',
    escalation_declined: '#64748b',
  };
  return map[norm(key)] || '#134178';
}

export function departmentColor(name) {
  if (norm(name) === 'volunteers') return '#059669';
  return DEPT_PALETTE[hashStr(name) % DEPT_PALETTE.length];
}

/** p50 / p90 / p95 text accents in ClockMatrix. */
export function percentileHex(kind) {
  if (kind === 'p50') return '#2563eb';
  if (kind === 'p90') return '#0d9488';
  if (kind === 'p95') return '#7c3aed';
  return '#64748b';
}

export function percentileTextClass(kind) {
  if (kind === 'p50') return 'text-blue-600 dark:text-blue-400';
  if (kind === 'p90') return 'text-teal-600 dark:text-teal-400';
  if (kind === 'p95') return 'text-violet-600 dark:text-violet-400';
  return 'text-muted';
}

/** Bottom bar on compact SLA row cards. */
export function slaRowBarColor(metricId) {
  const id = norm(metricId);
  if (id.includes('dispatch')) return '#2563eb';
  if (id.includes('arrival')) return '#0d9488';
  if (id.includes('unserved')) return '#ea580c';
  if (id.includes('overdue')) return '#dc2626';
  if (id.includes('duplicate')) return '#7c3aed';
  return '#134178';
}

export function slaHealthColor(pct) {
  const v = Number(pct) || 0;
  if (v >= 90) return '#16a34a';
  if (v >= 75) return '#2563eb';
  if (v >= 50) return '#d97706';
  return '#dc2626';
}

export function kpiAccentClass(metricId) {
  const map = {
    incidents: 'border-l-4 border-l-blue-600',
    total_assigned: 'border-l-4 border-l-blue-600',
    critical: 'border-l-4 border-l-red-600',
    first_action: 'border-l-4 border-l-amber-500',
    awaiting_action: 'border-l-4 border-l-amber-500',
    dispatch: 'border-l-4 border-l-sky-600',
    in_progress: 'border-l-4 border-l-sky-600',
    arrival: 'border-l-4 border-l-teal-600',
    resolve: 'border-l-4 border-l-emerald-600',
    resolved: 'border-l-4 border-l-emerald-600',
  };
  return map[norm(metricId)] || '';
}

/** Ant Design Tag colors for dashboard incident overview KPIs. */
export function kpiTagColor(metricId) {
  const map = {
    total_assigned: 'blue',
    awaiting_action: 'gold',
    in_progress: 'geekblue',
    resolved: 'green',
    incidents: 'blue',
    critical: 'red',
    first_action: 'gold',
    dispatch: 'cyan',
    resolve: 'green',
  };
  return map[norm(metricId)] || 'default';
}

/** Choropleth fill rgba; stronger ramp than legacy local helper. */
export function choroplethFill(count, max, isLight = true) {
  if (!count) return isLight ? 'rgba(19, 65, 120, 0.06)' : 'rgba(125, 211, 252, 0.08)';
  const t = Math.min(1, count / Math.max(max, 1));
  if (isLight) return `rgba(19, 65, 120, ${0.22 + t * 0.78})`;
  return `rgba(56, 189, 248, ${0.2 + t * 0.75})`;
}

export function sliceFillForRow(row, index, resolver) {
  const key = row?.key ?? row?.label ?? row?.name;
  if (typeof resolver === 'function' && key != null) return resolver(key);
  return DEPT_PALETTE[index % DEPT_PALETTE.length];
}
