import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area, Legend, PieChart, Pie, Cell } from 'recharts';
import { MetricHelp } from '@/presentation/components/insights/MetricHelp';
import {
  CARD_CHROME,
  channelColor,
  departmentColor,
  exceptionColor,
  incidentTypeColor,
  outcomeColor,
  percentileHex,
  percentileTextClass,
  severityColor,
  slaHealthColor,
  slaRowBarColor,
  sliceFillForRow,
} from '@/presentation/components/insights/insightsColors';

const AXIS = { stroke: 'currentColor', fontSize: 12 };
const RECHART_ANIM = { isAnimationActive: 'auto', animationDuration: 600, animationBegin: 0 };

export function ChartCard({ title, metricId, children, className = '', onClick, footer }) {
  return (
    <section className={`${CARD_CHROME} p-4 ${className}`}>
      {title ? (
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-0.5">
          <span>{title}</span>
          {metricId ? <MetricHelp metricId={metricId} /> : null}
        </h3>
      ) : null}
      <div onClick={onClick}>{children}</div>
      {footer ? <p className="text-xs text-muted mt-2">{footer}</p> : null}
    </section>
  );
}

export function VolumeAreaChart({ data, isLight, animKey = 'volume' }) {
  const stroke = isLight ? '#134178' : '#7dd3fc';
  const prev = isLight ? '#9ca3af' : '#64748b';
  const gradId = `insights-volume-${String(animKey).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  if (!data?.length) {
    return <p className="text-sm text-muted">No data in this range.</p>;
  }
  return (
    <div className="h-64 text-muted">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart key={animKey} data={data} accessibilityLayer>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.45} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.2} />
          <XAxis dataKey="label" tick={AXIS} />
          <YAxis allowDecimals={false} tick={AXIS} />
          <Tooltip />
          <Legend />
          <Area type="monotone" dataKey="current" name="This period" stroke={stroke} fill={`url(#${gradId})`} strokeWidth={2} {...RECHART_ANIM} />
          <Area
            type="monotone"
            dataKey="previous"
            name="Previous period"
            stroke={prev}
            fill={prev}
            fillOpacity={0.08}
            strokeDasharray="6 4"
            strokeWidth={1.5}
            {...RECHART_ANIM}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RankedBarChart({ data, onBarClick, isLight, getBarFill, animKey = 'ranked' }) {
  const fallback = isLight ? '#134178' : '#38bdf8';
  if (!data?.length) {
    return <p className="text-sm text-muted">No data in this range.</p>;
  }
  return (
    <div className="h-72 text-muted">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart key={animKey} data={data} layout="vertical" accessibilityLayer margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.2} />
          <XAxis type="number" allowDecimals={false} tick={AXIS} />
          <YAxis type="category" dataKey="label" width={110} tick={AXIS} />
          <Tooltip />
          <Bar
            dataKey="count"
            radius={[0, 6, 6, 0]}
            cursor="pointer"
            onClick={(entry, index) => onBarClick?.(entry?.payload || data[index])}
            {...RECHART_ANIM}
          >
            {data.map((row, index) => (
              <Cell
                key={row.key || row.label || index}
                fill={getBarFill ? getBarFill(row, index) : fallback}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutChart({ data, isLight, getSliceFill, centerLabel, animKey = 'donut' }) {
  const rows = (data || []).filter((row) => Number(row.count) > 0).map((row) => ({
    name: row.label || row.key,
    key: row.key,
    value: Number(row.count) || 0,
  }));
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  if (!rows.length) {
    return <p className="text-sm text-muted">No data in this range.</p>;
  }
  const stroke = isLight ? '#fff' : '#0f172a';
  return (
    <div className="h-64 text-muted relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart key={animKey} accessibilityLayer>
          <Pie data={rows} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={80} {...RECHART_ANIM}>
            {rows.map((entry, index) => (
              <Cell
                key={entry.name}
                fill={getSliceFill ? getSliceFill(entry, index) : sliceFillForRow(entry, index)}
                stroke={stroke}
              />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel !== false ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-2" aria-hidden>
          <span className="text-2xl font-semibold text-foreground">{total}</span>
          <span className="text-xs text-muted">total</span>
        </div>
      ) : null}
    </div>
  );
}

export function SlaBar({ pct, label, barColor }) {
  const value = Math.max(0, Math.min(100, Number(pct) || 0));
  const fill = barColor || slaHealthColor(value);
  return (
    <div>
      <div className="flex justify-between text-xs text-muted mb-1">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 rounded bg-muted/30 overflow-hidden" aria-hidden>
        <div className="h-2 rounded insights-bar-fill" style={{ width: `${value}%`, backgroundColor: fill }} />
      </div>
    </div>
  );
}

export function SlaMetricCard({ metricId, label, value, hint, pct, barLabel }) {
  const barPct = pct != null ? pct : parseFloat(String(value).replace(/[^\d.]/g, '')) || 0;
  const barColor = slaRowBarColor(metricId);
  return (
    <div className={`${CARD_CHROME} p-3 flex flex-col min-h-[88px]`}>
      <p className="text-xs text-muted flex items-center gap-0.5">
        <span>{label}</span>
        {metricId ? <MetricHelp metricId={metricId} /> : null}
      </p>
      <p className="text-xl font-semibold mt-1">{value}</p>
      {hint ? <p className="text-xs text-muted mt-0.5">{hint}</p> : null}
      <div className="mt-auto pt-2">
        <SlaBar pct={barPct} label={barLabel || ''} barColor={barColor} />
      </div>
    </div>
  );
}

export function TypeProgressList({ data, onRowClick, maxRows = 12 }) {
  const rows = (data || []).slice(0, maxRows);
  const total = rows.reduce((sum, row) => sum + (Number(row.count) || 0), 0) || 1;
  if (!rows.length) {
    return <p className="text-sm text-muted">No data in this range.</p>;
  }
  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const count = Number(row.count) || 0;
        const pct = Math.round((count / total) * 1000) / 10;
        const color = incidentTypeColor(row.key);
        return (
          <li key={row.key}>
            <button
              type="button"
              className="w-full text-left group"
              onClick={() => onRowClick?.(row)}
            >
              <div className="flex items-center gap-2 text-sm mb-1">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} aria-hidden />
                <span className="font-medium flex-1 truncate">{row.label || row.key}</span>
                <span className="text-muted tabular-nums">{count}</span>
                <span className="text-xs text-muted w-12 text-right tabular-nums">{pct}%</span>
              </div>
              <div className="h-2 rounded bg-muted/30 overflow-hidden" aria-hidden>
                <div className="h-2 rounded insights-bar-fill group-hover:opacity-90" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ClockCell({ clock, formatClock }) {
  if (!clock || !clock.n) return '—';
  const parts = [
    { kind: 'p50', v: clock.p50_seconds },
    { kind: 'p90', v: clock.p90_seconds },
    { kind: 'p95', v: clock.p95_seconds },
  ];
  return (
    <span className="tabular-nums">
      {parts.map((part, i) => (
        <span key={part.kind}>
          {i > 0 ? ' / ' : null}
          <span className={percentileTextClass(part.kind)} title={part.kind}>
            {formatClock(part.v)}
          </span>
        </span>
      ))}
    </span>
  );
}

export function ClockMatrix({ overall, bySeverity, formatClock }) {
  const columns = [
    { key: 'overall', label: 'Overall', clocks: overall },
    { key: 'critical', label: 'Critical' },
    { key: 'high', label: 'High' },
    { key: 'medium', label: 'Medium' },
    { key: 'low', label: 'Low' },
  ];
  const lookup = new Map((bySeverity || []).map((row) => [String(row.key || '').toLowerCase(), row]));
  const rows = [
    { key: 'first_action', label: 'First action' },
    { key: 'dispatch', label: 'Dispatch' },
    { key: 'arrival', label: 'Arrival' },
    { key: 'resolve', label: 'Resolution' },
  ];

  function cell(col, metric) {
    const source = col.key === 'overall' ? overall : lookup.get(col.key);
    const clock = source?.[metric];
    return <ClockCell clock={clock} formatClock={formatClock} />;
  }

  if (!overall && !(bySeverity || []).length) {
    return <p className="text-sm text-muted">No clocks in this range.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <p className="text-xs text-muted mb-2 flex flex-wrap gap-3">
        <span><span className={percentileTextClass('p50')}>●</span> p50</span>
        <span><span className={percentileTextClass('p90')}>●</span> p90</span>
        <span><span className={percentileTextClass('p95')}>●</span> p95</span>
      </p>
      <table className="w-full text-xs min-w-[640px]">
        <thead>
          <tr className="text-left text-muted">
            <th className="py-1 pr-2">Clock</th>
            {columns.map((col) => (
              <th key={col.key} className="py-1">
                {col.key === 'overall' ? (
                  col.label
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: severityColor(col.key) }} aria-hidden />
                    {col.label}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-[rgba(19,65,120,0.15)]">
              <td className="py-2 font-medium">{row.label}</td>
              {columns.map((col) => (
                <td key={col.key} className="py-2">{cell(col, row.key)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DayHourHeatmap({ cells, animKey = 'heatmap' }) {
  const max = Math.max(1, ...cells.map((c) => c.count || 0));
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const lookup = new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c.count]));
  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse w-full min-w-[640px]">
        <thead>
          <tr>
            <th className="p-1 text-left text-muted font-medium"> </th>
            {hours.map((h) => (
              <th key={h} className="p-1 text-muted font-normal">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((label, dow) => (
            <tr key={label}>
              <th className="p-1 text-left text-muted font-medium pr-2">{label}</th>
              {hours.map((hour) => {
                const count = lookup.get(`${dow}-${hour}`) || 0;
                const t = count / max;
                return (
                  <td
                    key={`${animKey}-${dow}-${hour}`}
                    title={`${label} ${hour}:00 — ${count}`}
                    className="w-5 h-5 text-center insights-heatmap-cell"
                    style={{ backgroundColor: `rgba(19, 65, 120, ${count ? 0.15 + t * 0.85 : 0.04})`, color: t > 0.55 ? '#fff' : 'inherit' }}
                  >
                    {count || ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const FUNNEL_COLORS = ['#134178', '#2563eb', '#0d9488', '#16a34a'];

export function EscalationFunnelSteps({ rows, animKey = 'funnel' }) {
  const steps = (rows || []).filter((row) => row.count != null);
  if (!steps.length) {
    return <p className="text-sm text-muted">No escalations in this range.</p>;
  }
  return (
    <div className="space-y-2 animate-fade-in" key={animKey}>
      {steps.map((row, index) => {
        const width = Math.max(28, 100 - index * 12);
        const color = FUNNEL_COLORS[index % FUNNEL_COLORS.length];
        return (
          <div key={row.label} className="flex flex-col items-center">
            <div
              className="text-center text-xs text-white py-2 px-3 rounded-sm shadow-sm insights-funnel-step"
              style={{ width: `${width}%`, backgroundColor: color, clipPath: 'polygon(4% 0, 96% 0, 100% 100%, 0 100%)' }}
            >
              <span className="font-semibold block">{row.label}</span>
              <span className="opacity-90">{row.count} · {row.pct ?? 0}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function UtilizationStackedBar({ available, total, inUse }) {
  const t = Math.max(0, Number(total) || 0);
  const avail = Math.max(0, Number(available) || 0);
  const used = inUse != null ? Math.max(0, Number(inUse) || 0) : Math.max(0, t - avail);
  if (!t) {
    return <p className="text-sm text-muted">No unit totals in snapshot.</p>;
  }
  const availPct = Math.min(100, (avail / t) * 100);
  const usedPct = Math.min(100 - availPct, (used / t) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs text-muted mb-1">
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" aria-hidden /> Available {avail}</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-sky-600" aria-hidden /> In use {used}</span>
      </div>
      <div className="h-3 rounded-full bg-muted/30 overflow-hidden flex" aria-hidden>
        <div className="h-full bg-emerald-500 insights-bar-fill" style={{ width: `${availPct}%` }} />
        <div className="h-full bg-sky-600 insights-bar-fill" style={{ width: `${usedPct}%` }} />
      </div>
      <p className="text-xs text-muted mt-1">{Math.round(availPct)}% available · {Math.round(usedPct)}% in use (live snapshot)</p>
    </div>
  );
}

export function ExceptionBreakdownCard({ anyPct, slices }) {
  const rows = (slices || []).filter((row) => Number(row.count) >= 0);
  const big = Math.max(0, Math.min(100, Number(anyPct) || 0));
  if (!rows.length && !big) {
    return <p className="text-sm text-muted">No exceptions in this range.</p>;
  }
  return (
    <div className="flex flex-col sm:flex-row gap-6 items-start animate-fade-in">
      <div className="shrink-0">
        <p className="text-4xl font-semibold tabular-nums">{big}%</p>
        <p className="text-xs text-muted mt-1">with any recorded exception</p>
      </div>
      <ul className="flex-1 space-y-2 text-sm w-full">
        {rows.map((row) => {
          const color = exceptionColor(row.key);
          return (
            <li key={row.key} className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} aria-hidden />
                <span className="truncate">{row.label}</span>
              </span>
              <span className="tabular-nums font-medium">{row.count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// re-export for tests / consumers that need raw percentile hex in charts
export { percentileHex, severityColor, incidentTypeColor, channelColor, outcomeColor };
