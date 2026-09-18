import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  MapPin,
  Printer,
  RotateCcw,
  Search,
  TrendingDown,
  TrendingUp,
  Truck,
  Zap,
} from 'lucide-react';
import { Layout } from '@/presentation/components/layout/Layout';
import { Breadcrumb } from '@/presentation/components/common/Breadcrumb';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/presentation/components/ui/Tabs';
import {
  ChartCard,
  ClockMatrix,
  DayHourHeatmap,
  DonutChart,
  EscalationFunnelSteps,
  ExceptionBreakdownCard,
  RankedBarChart,
  SlaMetricCard,
  TypeProgressList,
  UtilizationStackedBar,
  VolumeAreaChart,
} from '@/presentation/components/insights/ChartCard';
import {
  CARD_CHROME,
  KPI_HOVER,
  channelColor,
  departmentColor,
  incidentTypeColor,
  kpiAccentClass,
  outcomeColor,
} from '@/presentation/components/insights/insightsColors';
import { MetricHelp } from '@/presentation/components/insights/MetricHelp';
import { BarangayChoropleth } from '@/presentation/components/insights/BarangayChoropleth';
import { BarangayTypesCell } from '@/presentation/components/insights/BarangayTypesCell';
import { getAnalyticsIncidents, getAnalyticsOverview, downloadAnalyticsCsv } from '@/data/api/analytics.api';
import { getDepartments } from '@/data/api/departments.api';
import { getStoredUser } from '@/core/auth/session';
import { isDepartmentAdmin, isSuperAdmin, normalizeRole, getDefaultRouteByRole } from '@/core/constants';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';
import { useIncidentWebSocketStatus } from '@/presentation/context/IncidentWebSocketContext';
import {
  createIncidentUpdatedScheduler,
  INSIGHTS_POLLING_INTERVAL_MS,
  INSIGHTS_POLLING_WHEN_WS_CONNECTED_MS,
} from '@/core/utils/insightsRealtime';

const PRESETS = [
  { id: '24h', label: 'Last 24h', ms: 24 * 60 * 60 * 1000 },
  { id: '7d', label: 'Last 7d', ms: 7 * 24 * 60 * 60 * 1000 },
  { id: '30d', label: 'Last 30d', ms: 30 * 24 * 60 * 60 * 1000 },
  { id: 'month', label: 'This month' },
  { id: 'custom', label: 'Custom' },
];

function rangeFromPreset(preset) {
  const now = new Date();
  if (preset === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: from.toISOString(), to: now.toISOString() };
  }
  const found = PRESETS.find((p) => p.id === preset && p.ms);
  const ms = found?.ms || 30 * 24 * 60 * 60 * 1000;
  return { from: new Date(now.getTime() - ms).toISOString(), to: now.toISOString() };
}

function formatClock(seconds) {
  if (seconds == null) return '—';
  const s = Math.round(Number(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatWhen(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function toDatetimeLocalValue(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function isoFromDatetimeLocal(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function optionKeys(current, rows) {
  const keys = [];
  if (current) keys.push(current);
  for (const row of rows || []) {
    const key = row?.key;
    if (key && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

function titleCase(value) {
  const s = String(value || '').replace(/_/g, ' ').trim();
  if (!s) return 'Unknown';
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function Delta({ value }) {
  if (value == null) return null;
  const up = value > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  const label = `${value > 0 ? '+' : ''}${value}% vs prior`;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${up ? 'text-amber-600' : value < 0 ? 'text-emerald-600' : 'text-muted'}`}>
      <Icon className="w-3.5 h-3.5" aria-hidden />
      {label}
    </span>
  );
}

function Sparkline({ data }) {
  const values = (data || []).map((row) => Number(row.current) || 0);
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const w = 88;
  const h = 28;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * (h - 2) - 1;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} className="text-primary mt-1" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={pts} />
    </svg>
  );
}

const KPI_ICON = {
  incidents: Activity,
  critical: AlertTriangle,
  first_action: Zap,
  dispatch: Truck,
  arrival: MapPin,
  resolve: CheckCircle,
};

function KpiCard({ metricId, label, value, hint, delta, extra, headline }) {
  const Icon = KPI_ICON[metricId];
  return (
    <div className={`${CARD_CHROME} p-4 ${KPI_HOVER} ${kpiAccentClass(metricId)} ${headline ? 'py-5' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted flex items-center gap-0.5">
          <span>{label}</span>
          <MetricHelp metricId={metricId} />
        </p>
        {Icon ? <Icon className="w-5 h-5 shrink-0 text-primary/80" aria-hidden /> : null}
      </div>
      <p className={`font-semibold mt-1 ${headline ? 'text-3xl' : 'text-2xl'}`}>{value}</p>
      {hint ? <p className="text-xs text-muted mt-1">{hint}</p> : null}
      <Delta value={delta} />
      {extra}
    </div>
  );
}

function EmptyNote() {
  return <p className="text-sm text-muted">No incidents in this range. Widen the dates.</p>;
}

function BarangayDemandTable({ rows, patchParams }) {
  if (!rows?.length) return <EmptyNote />;
  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted">
            <th className="py-1">Barangay</th>
            <th>Count</th>
            <th>%</th>
            <th>Critical</th>
            <th className="min-w-[140px]">Types</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="py-1">
                <button type="button" className="underline-offset-2 hover:underline" onClick={() => patchParams({ barangay: row.key })}>
                  {row.key}
                </button>
              </td>
              <td>{row.count}</td>
              <td>{row.pct}%</td>
              <td>{row.critical_count}</td>
              <td className="py-1">
                <BarangayTypesCell
                  types={row.types}
                  titleCase={titleCase}
                  onTypeClick={(key) => patchParams({ incident_type: key })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InsightsPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [searchParams, setSearchParams] = useSearchParams();
  const user = getStoredUser();
  const role = normalizeRole(user.role);
  const superAdmin = isSuperAdmin(role);
  const deptAdmin = isDepartmentAdmin(role);

  const preset = searchParams.get('preset') || '30d';
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const range = useMemo(() => {
    if (preset === 'custom' && fromParam && toParam) {
      return { from: fromParam, to: toParam };
    }
    return rangeFromPreset(preset);
  }, [preset, fromParam, toParam]);
  const from = range.from;
  const to = range.to;
  const departmentId = superAdmin ? (searchParams.get('department_id') || '') : '';
  const incidentType = searchParams.get('incident_type') || '';
  const severity = searchParams.get('severity_level') || '';
  const status = searchParams.get('status') || '';
  const barangay = searchParams.get('barangay') || '';
  const search = searchParams.get('search') || '';
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const includeArchived = searchParams.get('include_archived') !== 'false';
  const excludeDuplicates = searchParams.get('exclude_duplicates') === 'true';
  const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
  const pageSizeParam = Number(searchParams.get('page_size') || 10);
  const pageSize = PAGE_SIZE_OPTIONS.includes(pageSizeParam) ? pageSizeParam : 10;

  const [overview, setOverview] = useState(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [departments, setDepartments] = useState([]);
  const [inactiveDepartments, setInactiveDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const overviewFetchId = useRef(0);
  const incidentsFetchId = useRef(0);
  const { status: wsStatus, isConnected: wsConnected } = useIncidentWebSocketStatus();
  const insightsAuthorized = superAdmin || deptAdmin;

  const filterParams = useMemo(() => ({
    from,
    to,
    department_id: departmentId || undefined,
    incident_type: incidentType || undefined,
    severity_level: severity || undefined,
    status: status || undefined,
    barangay: barangay || undefined,
    include_archived: includeArchived,
    exclude_duplicates: excludeDuplicates,
  }), [from, to, departmentId, incidentType, severity, status, barangay, includeArchived, excludeDuplicates]);

  const patchParams = useCallback((patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '' || value === false) next.delete(key);
      else next.set(key, String(value));
    });
    if (!('page' in patch)) next.delete('page');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!superAdmin && !deptAdmin) {
      navigate(getDefaultRouteByRole(role), { replace: true });
    }
  }, [superAdmin, deptAdmin, navigate, role]);

  useEffect(() => {
    if (!superAdmin) return undefined;
    let cancelled = false;
    getDepartments()
      .then((list) => {
        if (cancelled) return;
        const next = Array.isArray(list) ? list : [];
        setDepartments(next.filter((d) => String(d.status || 'active').toLowerCase() !== 'inactive'));
        setInactiveDepartments(next.filter((d) => String(d.status || 'active').toLowerCase() === 'inactive'));
      })
      .catch(() => {
        if (!cancelled) {
          setDepartments([]);
          setInactiveDepartments([]);
        }
      });
    return () => { cancelled = true; };
  }, [superAdmin]);

  const fetchOverview = useCallback(async (isSilent = false) => {
    const id = ++overviewFetchId.current;
    if (!isSilent) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await getAnalyticsOverview(filterParams);
      if (id !== overviewFetchId.current) return;
      setOverview(data);
      setLastRefreshedAt(new Date());
    } catch (err) {
      if (id !== overviewFetchId.current) return;
      if (!isSilent) setError(err.message || 'Failed to load insights');
    } finally {
      if (id !== overviewFetchId.current) return;
      if (!isSilent) setLoading(false);
    }
  }, [filterParams]);

  const fetchIncidentsTable = useCallback(async (isSilent = false) => {
    const id = ++incidentsFetchId.current;
    if (!isSilent) setTableLoading(true);
    try {
      const data = await getAnalyticsIncidents({
        ...filterParams,
        search: search || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      if (id !== incidentsFetchId.current) return;
      setRows(data.items || []);
      setTotal(data.total || 0);
    } catch {
      if (id !== incidentsFetchId.current) return;
      if (!isSilent) {
        setRows([]);
        setTotal(0);
      }
    } finally {
      if (id !== incidentsFetchId.current) return;
      if (!isSilent) setTableLoading(false);
    }
  }, [filterParams, search, page, pageSize]);

  useEffect(() => {
    fetchOverview(false);
  }, [fetchOverview]);

  useEffect(() => {
    fetchIncidentsTable(false);
  }, [fetchIncidentsTable]);

  useEffect(() => {
    if (!insightsAuthorized) return undefined;
    const intervalMs = wsConnected ? INSIGHTS_POLLING_WHEN_WS_CONNECTED_MS : INSIGHTS_POLLING_INTERVAL_MS;
    const silentRefresh = () => {
      fetchOverview(true);
      fetchIncidentsTable(true);
    };
    const intervalId = setInterval(silentRefresh, intervalMs);
    const scheduler = createIncidentUpdatedScheduler(silentRefresh);
    const handleUpdated = () => scheduler.handle();
    window.addEventListener('incident:updated', handleUpdated);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('incident:updated', handleUpdated);
      scheduler.cancel();
    };
  }, [insightsAuthorized, wsConnected, fetchOverview, fetchIncidentsTable]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const kpis = overview?.kpis || {};
  const clocks = overview?.clocks || {};
  const demand = overview?.demand || { types: [], barangays: [], type_barangay: [], channels: [] };
  const departmentLabel = overview?.department?.name || (superAdmin ? 'All departments' : (user.department || 'Department'));
  const volumeData = (overview?.timeseries || []).map((row) => ({
    label: formatWhen(row.bucket).replace(/,?\s*\d{1,2}:\d{2}.*/, ''),
    current: row.current,
    previous: row.previous,
  }));
  const cityWide = superAdmin && !departmentId;
  const chartAnimKey = useMemo(
    () => [from, to, departmentId, incidentType, severity, status, barangay, excludeDuplicates, includeArchived].join('|'),
    [from, to, departmentId, incidentType, severity, status, barangay, excludeDuplicates, includeArchived]
  );
  const exceptionSlices = [
    { key: 'reassignment', label: 'Reassignment', count: overview?.exceptions?.reassignment || 0 },
    { key: 'auto_assign_mismatch', label: 'Auto-assign mismatch', count: overview?.exceptions?.auto_assign_mismatch || 0 },
    { key: 'backup_requested', label: 'Backup requested', count: overview?.exceptions?.backup_requested || 0 },
    { key: 'escalation_declined', label: 'Escalation declined', count: overview?.exceptions?.escalation_declined || 0 },
  ];
  const funnel = overview?.escalation_funnel || {};
  const funnelRows = [
    { label: 'Escalated', count: funnel.escalated || 0, pct: funnel.escalated ? 100 : 0 },
    { label: 'Accepted', count: funnel.accepted || 0, pct: funnel.accepted_pct || 0 },
    { label: 'Dispatched', count: funnel.dispatched || 0, pct: funnel.dispatched_pct || 0 },
    { label: 'Arrived', count: funnel.arrived || 0, pct: funnel.arrived_pct || 0 },
  ];

  async function onExportCsv() {
    setExporting(true);
    try {
      await downloadAnalyticsCsv(filterParams);
    } catch (err) {
      setError(err.message || 'CSV export failed');
    } finally {
      setExporting(false);
    }
  }

  const filterControls = (
    <>
      <label className="text-xs text-muted">
        Range
        <Select value={preset} onValueChange={(value) => patchParams({ preset: value, from: undefined, to: undefined })}>
          <SelectTrigger className="mt-1 min-w-[140px]"><SelectValue options={PRESETS.map((p) => ({ value: p.id, label: p.label }))} /></SelectTrigger>
          <SelectContent>
            {PRESETS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </label>
      {preset === 'custom' && (
        <>
          <label className="text-xs text-muted">From
            <Input
              type="datetime-local"
              className="mt-1 py-2"
              value={toDatetimeLocalValue(from)}
              onChange={(e) => {
                const iso = isoFromDatetimeLocal(e.target.value);
                if (iso) patchParams({ from: iso, to, preset: 'custom' });
              }}
            />
          </label>
          <label className="text-xs text-muted">To
            <Input
              type="datetime-local"
              className="mt-1 py-2"
              value={toDatetimeLocalValue(to)}
              onChange={(e) => {
                const iso = isoFromDatetimeLocal(e.target.value);
                if (iso) patchParams({ from, to: iso, preset: 'custom' });
              }}
            />
          </label>
        </>
      )}
      {superAdmin && (
        <label className="text-xs text-muted">
          Department
          <Select value={departmentId || 'all'} onValueChange={(value) => patchParams({ department_id: value === 'all' ? '' : value })}>
            <SelectTrigger className="mt-1 min-w-[180px]">
              <SelectValue options={[
                { value: 'all', label: 'All departments' },
                { value: 'volunteers', label: 'Volunteers' },
                ...departments.map((d) => ({ value: String(d.department_id), label: d.name })),
                ...inactiveDepartments.map((d) => ({ value: String(d.department_id), label: `${d.name} (inactive)` })),
              ]} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              <SelectItem value="volunteers">Volunteers</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.department_id} value={String(d.department_id)}>{d.name}</SelectItem>
              ))}
              {inactiveDepartments.map((d) => (
                <SelectItem key={d.department_id} value={String(d.department_id)}>{d.name} (inactive)</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      )}
      <label className="text-xs text-muted">Type
        <Select value={incidentType || 'all'} onValueChange={(value) => patchParams({ incident_type: value === 'all' ? '' : value })}>
          <SelectTrigger className="mt-1 min-w-[140px]">
            <SelectValue options={[{ value: 'all', label: 'Any' }, ...optionKeys(incidentType, demand.types).map((k) => ({ value: k, label: titleCase(k) }))]} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any</SelectItem>
            {optionKeys(incidentType, demand.types).map((k) => <SelectItem key={k} value={k}>{titleCase(k)}</SelectItem>)}
          </SelectContent>
        </Select>
      </label>
      <label className="text-xs text-muted">Severity
        <Select value={severity || 'all'} onValueChange={(value) => patchParams({ severity_level: value === 'all' ? '' : value })}>
          <SelectTrigger className="mt-1 min-w-[140px]">
            <SelectValue options={[{ value: 'all', label: 'Any' }, ...optionKeys(severity, overview?.breakdowns?.severity).map((k) => ({ value: k, label: titleCase(k) }))]} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any</SelectItem>
            {optionKeys(severity, overview?.breakdowns?.severity).map((k) => <SelectItem key={k} value={k}>{titleCase(k)}</SelectItem>)}
          </SelectContent>
        </Select>
      </label>
      <label className="text-xs text-muted">Status
        <Select value={status || 'all'} onValueChange={(value) => patchParams({ status: value === 'all' ? '' : value })}>
          <SelectTrigger className="mt-1 min-w-[140px]">
            <SelectValue options={[{ value: 'all', label: 'Any' }, ...optionKeys(status, overview?.breakdowns?.status).map((k) => ({ value: k, label: titleCase(k) }))]} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any</SelectItem>
            {optionKeys(status, overview?.breakdowns?.status).map((k) => <SelectItem key={k} value={k}>{titleCase(k)}</SelectItem>)}
          </SelectContent>
        </Select>
      </label>
      <label className="text-xs text-muted">Barangay
        <Select value={barangay || 'all'} onValueChange={(value) => patchParams({ barangay: value === 'all' ? '' : value })}>
          <SelectTrigger className="mt-1 min-w-[160px]">
            <SelectValue options={[{ value: 'all', label: 'Any' }, ...optionKeys(barangay, demand.barangays).map((k) => ({ value: k, label: k }))]} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any</SelectItem>
            {optionKeys(barangay, demand.barangays).map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
          </SelectContent>
        </Select>
      </label>
      <label className="text-xs text-muted inline-flex items-center gap-2 pb-2">
        <input type="checkbox" checked={includeArchived} onChange={(e) => patchParams({ include_archived: e.target.checked ? undefined : 'false' })} />
        Include archived
      </label>
      <label className="text-xs text-muted inline-flex items-center gap-2 pb-2">
        <input type="checkbox" checked={excludeDuplicates} onChange={(e) => patchParams({ exclude_duplicates: e.target.checked || undefined })} />
        Exclude duplicates
      </label>
      <Button variant="ghost" size="sm" className="gap-1" onClick={() => setSearchParams(new URLSearchParams({ preset: '30d' }), { replace: true })}>
        <RotateCcw className="w-4 h-4" aria-hidden /> Reset
      </Button>
    </>
  );

  return (
    <Layout>
      <div className="insights-root p-6 space-y-10">
        <Breadcrumb items={[{ label: 'Home', path: '/dashboard' }, { label: 'Insights' }]} />
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="w-6 h-6" aria-hidden />
              Insights · {departmentLabel}
            </h1>
            <p className="text-sm text-muted mt-1">
              {formatWhen(from)} – {formatWhen(to)}
              {overview?.generated_at ? ` · snapshot ${formatWhen(overview.generated_at)}` : ''}
            </p>
            <p
              className="text-xs text-muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 print:hidden"
              aria-live="polite"
            >
              {wsConnected ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
                  Live
                </span>
              ) : wsStatus === 'reconnecting' ? (
                <span className="text-amber-600 dark:text-amber-400">Reconnecting…</span>
              ) : (
                <span>Offline — backup refresh every {INSIGHTS_POLLING_INTERVAL_MS / 1000}s</span>
              )}
              {lastRefreshedAt ? (
                <span>Updated {lastRefreshedAt.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              ) : null}
            </p>
            <div className="hidden print:block text-xs text-foreground mt-2 space-y-0.5">
              <p>RescueLink · Dagupan City</p>
              <p>Department: {departmentLabel}</p>
              <p>Range: {from} – {to}</p>
              <p>Generated by: {user.name || user.username || user.email || 'unknown'}</p>
              {overview?.generated_at ? <p>Generated at: {overview.generated_at}</p> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
              <Printer className="w-4 h-4" aria-hidden /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={onExportCsv} disabled={exporting} className="gap-2">
              <Download className="w-4 h-4" aria-hidden /> CSV
            </Button>
          </div>
        </header>

        <div className="insights-filters sticky top-0 z-20 bg-background/95 backdrop-blur border border-[rgba(19,65,120,0.35)] rounded-xl p-3 print:static">
          <details className="md:hidden">
            <summary className="cursor-pointer text-sm font-medium py-1">Filters</summary>
            <div className="flex flex-wrap gap-2 items-end pt-2">{filterControls}</div>
          </details>
          <div className="hidden md:flex flex-wrap gap-2 items-end">{filterControls}</div>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs print:hidden">
          {superAdmin && departmentId ? (
            <button
              type="button"
              className="rounded-full border border-[rgba(19,65,120,0.35)] px-2 py-1 text-muted hover:text-foreground"
              onClick={() => patchParams({ department_id: '' })}
            >
              Department: {overview?.department?.name || (departmentId === 'volunteers' ? 'Volunteers' : departmentId)} ×
            </button>
          ) : null}
          {[[incidentType, 'incident_type', 'Type'], [severity, 'severity_level', 'Severity'], [status, 'status', 'Status'], [barangay, 'barangay', 'Barangay']].map(([value, key, label]) => (
            value ? (
              <button
                key={key}
                type="button"
                className="rounded-full border border-[rgba(19,65,120,0.35)] px-2 py-1 text-muted hover:text-foreground"
                onClick={() => patchParams({ [key]: '' })}
              >
                {label}: {titleCase(value)} ×
              </button>
            ) : null
          ))}
          {excludeDuplicates ? (
            <button type="button" className="rounded-full border border-[rgba(19,65,120,0.35)] px-2 py-1 text-muted" onClick={() => patchParams({ exclude_duplicates: undefined })}>
              Exclude duplicates ×
            </button>
          ) : null}
          {!includeArchived ? (
            <button type="button" className="rounded-full border border-[rgba(19,65,120,0.35)] px-2 py-1 text-muted" onClick={() => patchParams({ include_archived: undefined })}>
              Archives hidden ×
            </button>
          ) : null}
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-500">{error}</p>
        )}
        {loading && <p className="text-muted text-sm">Loading snapshot…</p>}

        {!loading && overview && (
          <>
            <section id="insights-kpis" className="scroll-mt-24 space-y-4">
              <h2 className="text-lg font-semibold">Headline</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                <KpiCard
                  headline
                  metricId="incidents"
                  label="Total incidents"
                  value={kpis.incidents ?? '—'}
                  delta={kpis.incidents_delta_pct}
                  hint={cityWide && kpis.volunteer_share != null ? `${kpis.volunteer_share}% volunteer-accepted (primary acceptor)` : undefined}
                  extra={<Sparkline data={volumeData} />}
                />
                <KpiCard headline metricId="critical" label="Critical incidents" value={kpis.critical ?? '—'} delta={kpis.critical_delta_pct} />
                <KpiCard
                  headline
                  metricId="first_action"
                  label="First action time"
                  value={formatClock(clocks.first_action?.p50_seconds)}
                  hint={`p90 ${formatClock(clocks.first_action?.p90_seconds)} · p95 ${formatClock(clocks.first_action?.p95_seconds)} · n=${clocks.first_action?.n || 0}`}
                />
                <KpiCard
                  headline
                  metricId="dispatch"
                  label="Dispatch time"
                  value={formatClock(clocks.dispatch?.p50_seconds)}
                  hint={`p90 ${formatClock(clocks.dispatch?.p90_seconds)} · p95 ${formatClock(clocks.dispatch?.p95_seconds)} · n=${clocks.dispatch?.n || 0}`}
                />
                <KpiCard
                  headline
                  metricId="arrival"
                  label="Arrival time"
                  value={clocks.arrival?.n ? formatClock(clocks.arrival.p50_seconds) : '—'}
                  hint={clocks.arrival?.n
                    ? `p90 ${formatClock(clocks.arrival.p90_seconds)} · p95 ${formatClock(clocks.arrival.p95_seconds)} · n=${clocks.arrival.n}`
                    : 'No on-scene stamps in range'}
                />
                <KpiCard
                  headline
                  metricId="resolve"
                  label="Resolution time"
                  value={clocks.resolve?.n ? formatClock(clocks.resolve.p50_seconds) : '—'}
                  hint={clocks.resolve?.n
                    ? `p90 ${formatClock(clocks.resolve.p90_seconds)} · p95 ${formatClock(clocks.resolve.p95_seconds)} · n=${clocks.resolve.n}`
                    : 'No resolve/close timestamps in range'}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                <SlaMetricCard
                  metricId="dispatch_sla"
                  label="Dispatch SLA"
                  value={`${kpis.dispatch_sla ?? 0}%`}
                  pct={kpis.dispatch_sla}
                  barLabel="≤ 8 min (internal, not NFPA)"
                />
                <SlaMetricCard
                  metricId="arrival_sla"
                  label="Arrival SLA"
                  value={`${kpis.arrival_sla ?? 0}%`}
                  pct={kpis.arrival_sla}
                  barLabel="≤ 10 min (internal, not NFPA)"
                />
                <SlaMetricCard
                  metricId="unserved"
                  label="Unserved"
                  value={`${kpis.unserved_pct ?? 0}%`}
                  pct={kpis.unserved_pct}
                  hint={`${kpis.unserved ?? 0} incidents`}
                  barLabel="Share unserved"
                />
                <SlaMetricCard
                  metricId="overdue"
                  label="Overdue"
                  value={`${kpis.overdue_pct ?? 0}%`}
                  pct={kpis.overdue_pct}
                  hint={`${kpis.overdue ?? 0} still open > 30 min`}
                  barLabel="Open > 30 min"
                />
                <SlaMetricCard
                  metricId="duplicate_rate"
                  label="Duplicate rate"
                  value={`${kpis.duplicate_rate ?? 0}%`}
                  pct={kpis.duplicate_rate}
                  barLabel="Marked duplicate"
                />
              </div>
            </section>

            <section id="insights-performance" className="scroll-mt-24 space-y-4">
              <h2 className="text-lg font-semibold">Response performance</h2>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <ChartCard title="Response matrix" metricId="response_matrix" footer="Cells are p50 / p90 / p95. Null clocks excluded.">
                  <ClockMatrix overall={clocks} bySeverity={overview.breakdowns?.severity_clocks} formatClock={formatClock} />
                </ChartCard>
                <div className="space-y-4">
                  <ChartCard title="Volume" metricId="volume">
                    <VolumeAreaChart data={volumeData} isLight={isLight} animKey={`vol-${chartAnimKey}`} />
                  </ChartCard>
                  <ChartCard title="Peak demand" metricId="peak_demand">
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>Busiest weekday<br /><strong>{overview.peak?.busiest_weekday || '—'}</strong></div>
                      <div>Peak hour<br /><strong>{overview.peak?.peak_hour_band || '—'}</strong></div>
                      <div>Peak volume<br /><strong>{overview.peak?.peak_volume ?? 0}</strong></div>
                      <div>Max concurrent open<br /><strong>{overview.peak?.max_concurrent ?? 0}</strong>
                        <span className="block text-xs text-muted">avg {overview.peak?.avg_concurrent ?? 0} · {overview.concurrent?.granularity || 'hour'}</span>
                      </div>
                    </dl>
                    <div className="mt-3">
                      <DayHourHeatmap cells={overview.heatmap || []} animKey={`heat-${chartAnimKey}`} />
                    </div>
                  </ChartCard>
                </div>
              </div>
            </section>

            <section id="insights-demand" className="scroll-mt-24 space-y-4">
              <h2 className="text-lg font-semibold">What &amp; where</h2>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 min-w-0">
                <ChartCard className="min-w-0 overflow-hidden relative z-0" title="Barangay map" metricId="barangay_map" footer="Click a barangay to filter. Unknown names are not on the map.">
                  <BarangayChoropleth
                    barangays={demand.barangays}
                    selected={barangay}
                    isLight={isLight}
                    onSelect={(name) => patchParams({ barangay: name })}
                  />
                </ChartCard>
                <ChartCard className="min-w-0" title="Barangay table" metricId="barangay_map">
                  <BarangayDemandTable rows={demand.barangays} patchParams={patchParams} />
                </ChartCard>
              </div>
              <ChartCard title="Demand" metricId="demand_types">
                <Tabs defaultValue="types">
                  <TabsList className="mb-3 w-full justify-start overflow-x-auto">
                    <TabsTrigger value="types">Incident types</TabsTrigger>
                    <TabsTrigger value="barangays">Barangay table</TabsTrigger>
                    <TabsTrigger value="matrix">Type × barangay</TabsTrigger>
                    <TabsTrigger value="channels">Channels</TabsTrigger>
                  </TabsList>
                  <TabsContent value="types">
                    <TypeProgressList
                      key={`types-${chartAnimKey}`}
                      data={(demand.types || []).map((row) => ({ ...row, label: titleCase(row.key) }))}
                      onRowClick={(row) => patchParams({ incident_type: row?.key })}
                    />
                  </TabsContent>
                  <TabsContent value="barangays">
                    <BarangayDemandTable rows={demand.barangays} patchParams={patchParams} />
                  </TabsContent>
                  <TabsContent value="matrix">
                    {(demand.type_barangay || []).length ? (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-muted">
                            <th className="py-1">Type</th>
                            <th>Barangay</th>
                            <th>Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {demand.type_barangay.map((row) => (
                            <tr key={`${row.incident_type}-${row.barangay}`}>
                              <td className="py-1">
                                <button type="button" className="hover:underline inline-flex items-center gap-2" onClick={() => patchParams({ incident_type: row.incident_type })}>
                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: incidentTypeColor(row.incident_type) }} aria-hidden />
                                  {titleCase(row.incident_type)}
                                </button>
                              </td>
                              <td>
                                <button type="button" className="hover:underline" onClick={() => patchParams({ barangay: row.barangay })}>
                                  {row.barangay}
                                </button>
                              </td>
                              <td>{row.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <EmptyNote />}
                  </TabsContent>
                  <TabsContent value="channels">
                    <DonutChart
                      isLight={isLight}
                      animKey={`ch-${chartAnimKey}`}
                      data={(demand.channels || []).map((row) => ({ ...row, label: titleCase(row.key) }))}
                      getSliceFill={(entry) => channelColor(entry.key || entry.name)}
                    />
                  </TabsContent>
                </Tabs>
              </ChartCard>
            </section>

            <section id="insights-ops" className="scroll-mt-24 space-y-4">
              <h2 className="text-lg font-semibold">Operations</h2>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <ChartCard
                  title="Dispatch exceptions"
                  metricId="exceptions"
                  footer="Counts are incidents with at least one recorded exception type."
                >
                  <ExceptionBreakdownCard anyPct={overview.exceptions?.any_pct} slices={exceptionSlices} />
                </ChartCard>
                <ChartCard
                  title="Escalation funnel"
                  metricId="escalation_funnel"
                  footer={`Processing p50 ${formatClock(funnel.processing_p50_seconds)} (accepted/declined). Rates are % of escalated.`}
                >
                  {funnel.escalated ? (
                    <div>
                      <p className="text-3xl font-semibold mb-3 tabular-nums">{funnel.escalated} <span className="text-base font-normal text-muted">escalated</span></p>
                      <EscalationFunnelSteps rows={funnelRows} animKey={`fun-${chartAnimKey}`} />
                    </div>
                  ) : <p className="text-sm text-muted">No escalations in this range.</p>}
                </ChartCard>
                <ChartCard title="Resource utilization" metricId="utilization" footer="Deployment duration is not stored (no release time on unit usage).">
                  <dl className="grid grid-cols-2 gap-3 text-sm mb-4">
                    <div>Units used<br /><strong>{overview.utilization?.units_used ?? 0}</strong></div>
                    <div>Dispatches<br /><strong>{overview.utilization?.dispatch_count ?? 0}</strong></div>
                  </dl>
                  {overview.units ? (
                    <>
                      <UtilizationStackedBar
                        available={overview.units.available_units}
                        total={overview.units.total_units}
                      />
                      <p className="text-xs text-muted mt-2">{overview.units.personnel_count ?? 0} personnel · live snapshot</p>
                    </>
                  ) : (
                    <p className="text-xs text-muted">Pick a department for current available/total units.</p>
                  )}
                </ChartCard>
                <ChartCard title="Resolution outcomes" metricId="outcomes">
                  <DonutChart
                    isLight={isLight}
                    animKey={`out-${chartAnimKey}`}
                    data={(overview.outcomes || []).map((row) => ({ ...row, label: row.key }))}
                    getSliceFill={(entry) => outcomeColor(entry.key || entry.name)}
                  />
                </ChartCard>
              </div>
            </section>

            {cityWide && (
              <section id="insights-departments" className="scroll-mt-24 space-y-3">
                <h2 className="text-lg font-semibold">Department comparison</h2>
                <ChartCard
                  title="By department"
                  metricId="department_clocks"
                  footer="Chart may double-count multi-department incidents. Unique headline KPIs do not. Primary = first dispatch department; supporting = later dispatch or escalation-only."
                >
                  <RankedBarChart
                    isLight={isLight}
                    animKey={`dept-${chartAnimKey}`}
                    data={(overview.breakdowns?.department || []).map((row) => ({ ...row, label: row.key }))}
                    getBarFill={(row) => departmentColor(row.key || row.label)}
                  />
                  {(overview.breakdowns?.department_clocks || []).length ? (
                    <table className="w-full text-sm mt-4">
                      <thead>
                        <tr className="text-left text-muted">
                          <th className="py-1">Department</th>
                          <th>Dispatch p50</th>
                          <th>Arrival p50</th>
                          <th>n</th>
                          <th>Primary</th>
                          <th>Supporting</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.breakdowns.department_clocks.map((row) => (
                          <tr key={row.key}>
                            <td className="py-1">{row.key}</td>
                            <td>{formatClock(row.dispatch_p50_seconds)}</td>
                            <td>{formatClock(row.arrival_p50_seconds)}</td>
                            <td>{row.n}</td>
                            <td>{row.primary_n}</td>
                            <td>{row.supporting_n}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <EmptyNote />}
                </ChartCard>
              </section>
            )}
          </>
        )}

        {!loading && !overview && !error && <EmptyNote />}

        <section id="insights-table" className="scroll-mt-24 bg-card rounded-xl border border-[rgba(19,65,120,0.35)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-base font-semibold flex items-center gap-0.5">
              Incidents ({total})
              <MetricHelp metricId="incidents_table" />
            </h2>
            <label className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
              <Input
                className="pl-9 py-2 min-w-[220px]"
                placeholder="Search barangay or report ID"
                defaultValue={search}
                onBlur={(e) => patchParams({ search: e.target.value.trim() })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') patchParams({ search: e.currentTarget.value.trim() });
                }}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-sm print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-muted">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page <= 1 || tableLoading} onClick={() => patchParams({ page: page - 1 })}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages || tableLoading} onClick={() => patchParams({ page: page + 1 })}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <label className="text-xs text-muted flex items-center gap-2">
              Rows per page
              <Select
                value={String(pageSize)}
                onValueChange={(value) => patchParams({ page_size: value, page: 1 })}
              >
                <SelectTrigger className="h-8 w-[72px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b border-[rgba(19,65,120,0.35)]">
                  <th className="py-2">ID</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Barangay</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {tableLoading && <tr><td colSpan={6} className="py-4 text-muted">Loading…</td></tr>}
                {!tableLoading && rows.map((row) => (
                  <tr
                    key={row.report_id}
                    className="border-b border-[rgba(19,65,120,0.15)] cursor-pointer hover:bg-primary/5"
                    onClick={() => navigate(`/incidents/${row.report_id}`)}
                  >
                    <td className="py-2">#{row.report_id}</td>
                    <td>{titleCase(row.incident_type)}</td>
                    <td>{titleCase(row.severity_level)}</td>
                    <td>{titleCase(row.status)}</td>
                    <td>{row.barangay || 'Unknown'}</td>
                    <td>{formatWhen(row.created_at)}</td>
                  </tr>
                ))}
                {!tableLoading && rows.length === 0 && (
                  <tr><td colSpan={6} className="py-4 text-muted">No incidents in this range. Widen the dates or clear filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted mt-2 print:hidden">Print/PDF includes this page of the table. Use CSV for the full filtered set.</p>
        </section>
      </div>
    </Layout>
  );
}
