import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle,
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
import { Card, Col, ConfigProvider, Input as AntInput, Pagination, Progress, Row, Select as AntSelect, Space, Statistic, Table } from 'antd';
import { buildAntdTheme } from '@/presentation/theme/antdTheme';
import {
  ChartCard,
  DonutChart,
  EscalationFunnelSteps,
  ExceptionBreakdownCard,
  RankedBarChart,
  TypeProgressList,
  UtilizationStackedBar,
  VolumeAreaChart,
} from '@/presentation/components/insights/ChartCard';
import {
  channelColor,
  departmentColor,
  incidentTypeColor,
  kpiAccentClass,
  outcomeColor,
  percentileTextClass,
  severityColor,
  slaRowBarColor,
} from '@/presentation/components/insights/insightsColors';
import { buildTypeBarangayMatrix, matrixCellStyle } from '@/presentation/components/insights/insightsMatrix';
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

const INCIDENTS_PAGE_SIZE_OPTIONS = [
  { value: 5, label: '5' },
  { value: 8, label: '8' },
  { value: 10, label: '10' },
  { value: 15, label: '15' },
  { value: 20, label: '20' },
];

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

const KPI_ICON = {
  incidents: Activity,
  critical: AlertTriangle,
  first_action: Zap,
  dispatch: Truck,
  arrival: MapPin,
  resolve: CheckCircle,
};

const OUTCOME_ORDER = ['resolved', 'closed', 'cancelled', 'duplicate', 'unable to respond', 'other'];

function clockHint(clock, emptyLabel) {
  if (!clock?.n) return emptyLabel;
  return `p90 ${formatClock(clock.p90_seconds)} · p95 ${formatClock(clock.p95_seconds)} · n=${clock.n}`;
}

function ClockPercents({ clock }) {
  if (!clock?.n) return '—';
  const parts = [
    ['p50', clock.p50_seconds],
    ['p90', clock.p90_seconds],
    ['p95', clock.p95_seconds],
  ];
  return (
    <span className="tabular-nums text-xs">
      {parts.map(([kind, value], index) => (
        <span key={kind}>
          {index > 0 ? ' / ' : null}
          <span className={percentileTextClass(kind)}>{formatClock(value)}</span>
        </span>
      ))}
    </span>
  );
}

function InsightStat({ metricId, title, value, hint, delta }) {
  const Icon = KPI_ICON[metricId];
  return (
    <Card size="small" className={`h-full ${kpiAccentClass(metricId)}`} styles={{ body: { padding: 12, height: '100%' } }}>
      <Statistic
        title={(
          <span className="inline-flex items-center gap-0.5">
            {title}
            <MetricHelp metricId={metricId} />
          </span>
        )}
        value={value ?? '—'}
        prefix={Icon ? <Icon className="w-4 h-4" aria-hidden /> : null}
        valueStyle={{ fontSize: 22, lineHeight: 1.2 }}
      />
      {hint ? <p className="text-xs text-muted mt-1">{hint}</p> : null}
      <Delta value={delta} />
    </Card>
  );
}

function SlaStat({ metricId, label, pct, hint, barLabel }) {
  const value = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <Card size="small" className="h-full" styles={{ body: { padding: 12, height: '100%' } }}>
      <p className="text-xs text-muted flex items-center gap-0.5">
        {label}
        <MetricHelp metricId={metricId} />
      </p>
      <p className="text-xl font-semibold mt-1 tabular-nums">{value}%</p>
      {hint ? <p className="text-xs text-muted mt-0.5">{hint}</p> : null}
      <Progress
        percent={value}
        showInfo={false}
        strokeColor={slaRowBarColor(metricId)}
        trailColor="rgba(148,163,184,0.25)"
        size="small"
      />
      <p className="text-[11px] text-muted mt-1">{barLabel}</p>
    </Card>
  );
}

function EmptyNote() {
  return <p className="text-sm text-muted">No incidents in this range. Widen the dates.</p>;
}

function BarangayDemandTable({ rows, patchParams }) {
  if (!rows?.length) return <EmptyNote />;
  const columns = [
    {
      title: 'Barangay',
      dataIndex: 'key',
      render: (key) => (
        <button type="button" className="underline-offset-2 hover:underline" onClick={() => patchParams({ barangay: key })}>
          {key}
        </button>
      ),
    },
    { title: 'Count', dataIndex: 'count' },
    { title: '%', dataIndex: 'pct', render: (pct) => `${pct}%` },
    { title: 'Critical', dataIndex: 'critical_count' },
    {
      title: 'Types',
      dataIndex: 'types',
      width: 140,
      render: (types) => (
        <BarangayTypesCell
          types={types}
          titleCase={titleCase}
          onTypeClick={(key) => patchParams({ incident_type: key })}
        />
      ),
    },
  ];
  return (
    <div className="insights-scroll-panel">
      <Table size="small" pagination={false} rowKey="key" columns={columns} dataSource={rows} />
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
  const pageSizeValues = INCIDENTS_PAGE_SIZE_OPTIONS.map((option) => option.value);
  const pageSizeParam = Number(searchParams.get('page_size') || 10);
  const pageSize = pageSizeValues.includes(pageSizeParam) ? pageSizeParam : 10;

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

  const pageStart = total === 0 ? 0 : ((page - 1) * pageSize) + 1;
  const pageEnd = Math.min(page * pageSize, total);
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
  const severityClocks = useMemo(() => {
    const lookup = new Map((overview?.breakdowns?.severity_clocks || []).map((row) => [String(row.key || '').toLowerCase(), row]));
    const metrics = [
      { key: 'first_action', label: 'First action' },
      { key: 'dispatch', label: 'Dispatch' },
      { key: 'arrival', label: 'Arrival' },
      { key: 'resolve', label: 'Resolution' },
    ];
    return metrics.map((metric) => ({
      key: metric.key,
      clock: metric.label,
      overall: clocks[metric.key],
      critical: lookup.get('critical')?.[metric.key],
      high: lookup.get('high')?.[metric.key],
      medium: lookup.get('medium')?.[metric.key],
      low: lookup.get('low')?.[metric.key],
    }));
  }, [overview, clocks]);
  const typeMatrix = useMemo(
    () => buildTypeBarangayMatrix(demand.type_barangay),
    [demand.type_barangay]
  );
  const outcomeRows = useMemo(() => {
    const rows = (overview?.outcomes || []).filter((row) => Number(row.count) > 0);
    return [...rows].sort((a, b) => {
      const ai = OUTCOME_ORDER.indexOf(String(a.key || '').toLowerCase());
      const bi = OUTCOME_ORDER.indexOf(String(b.key || '').toLowerCase());
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });
  }, [overview]);
  const insightsTheme = useMemo(() => buildAntdTheme(isLight), [isLight]);

  const incidentTableColumns = useMemo(() => [
    { title: 'ID', dataIndex: 'report_id', render: (id) => `#${id}` },
    { title: 'Type', dataIndex: 'incident_type', render: (value) => titleCase(value) },
    { title: 'Severity', dataIndex: 'severity_level', render: (value) => titleCase(value) },
    { title: 'Status', dataIndex: 'status', render: (value) => titleCase(value) },
    { title: 'Barangay', dataIndex: 'barangay', render: (value) => value || 'Unknown' },
    { title: 'Created', dataIndex: 'created_at', render: (value) => formatWhen(value) },
  ], []);

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

  const clockColumn = (key, title) => ({
    title: key === 'overall' ? title : (
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: severityColor(key) }} aria-hidden />
        {title}
      </span>
    ),
    dataIndex: key,
    render: (clock) => <ClockPercents clock={clock} />,
  });

  const matrixColumns = [
    { title: 'Clock', dataIndex: 'clock', fixed: 'left' },
    clockColumn('overall', 'Overall'),
    clockColumn('critical', 'Critical'),
    clockColumn('high', 'High'),
    clockColumn('medium', 'Medium'),
    clockColumn('low', 'Low'),
  ];

  const typeMatrixColumns = [
    {
      title: 'Type',
      dataIndex: 'type',
      fixed: 'left',
      render: (label, record) => (
        <button type="button" className="hover:underline inline-flex items-center gap-2" onClick={() => patchParams({ incident_type: record.typeKey })}>
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: incidentTypeColor(record.typeKey) }} aria-hidden />
          {label}
        </button>
      ),
    },
    ...typeMatrix.barangays.map((name) => ({
      title: (
        <button type="button" className="hover:underline" onClick={() => patchParams({ barangay: name })}>
          {name}
        </button>
      ),
      dataIndex: name,
      align: 'center',
      render: (count, record) => (
        <span
          className="inline-flex min-w-8 justify-center rounded px-1.5 py-0.5 tabular-nums"
          style={matrixCellStyle(count, typeMatrix.max, isLight, incidentTypeColor(record.typeKey))}
        >
          {count || ''}
        </span>
      ),
    })),
  ];

  const typeMatrixRows = typeMatrix.types.map((type) => {
    const record = { key: type, type: titleCase(type), typeKey: type };
    for (const name of typeMatrix.barangays) {
      record[name] = typeMatrix.lookup.get(`${type}|${name}`) || 0;
    }
    return record;
  });

  const showFilterChips = Boolean(
    (superAdmin && departmentId)
    || incidentType
    || severity
    || status
    || barangay
    || excludeDuplicates
    || !includeArchived,
  );

  return (
    <ConfigProvider theme={insightsTheme}>
    <Layout>
      <div className="insights-root p-4 md:p-6 flex flex-col gap-6">
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
                  Live — updates on incident activity
                  <span className="text-muted">
                    (backup every {INSIGHTS_POLLING_WHEN_WS_CONNECTED_MS / 1000}s)
                  </span>
                </span>
              ) : wsStatus === 'reconnecting' ? (
                <span className="text-amber-600 dark:text-amber-400">
                  Connecting live feed… · backup every {INSIGHTS_POLLING_INTERVAL_MS / 1000}s until connected
                </span>
              ) : (
                <span>
                  Live feed offline — backup refresh every {INSIGHTS_POLLING_INTERVAL_MS / 1000}s
                </span>
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

        <div className="space-y-2">
          <Card size="small" className="insights-filters sticky top-0 z-20 print:static">
            <details className="md:hidden">
              <summary className="cursor-pointer text-sm font-medium py-1">Filters</summary>
              <div className="flex flex-wrap gap-2 items-end pt-2">{filterControls}</div>
            </details>
            <div className="hidden md:flex flex-wrap gap-2 items-end">{filterControls}</div>
          </Card>
          {showFilterChips ? (
            <div className="flex flex-wrap gap-1.5 text-xs print:hidden">
              {superAdmin && departmentId ? (
                <button
                  type="button"
                  className="rounded-sm border border-[rgba(19,65,120,0.35)] px-2 py-1 text-muted hover:text-foreground"
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
                    className="rounded-sm border border-[rgba(19,65,120,0.35)] px-2 py-1 text-muted hover:text-foreground"
                    onClick={() => patchParams({ [key]: '' })}
                  >
                    {label}: {titleCase(value)} ×
                  </button>
                ) : null
              ))}
              {excludeDuplicates ? (
                <button type="button" className="rounded-sm border border-[rgba(19,65,120,0.35)] px-2 py-1 text-muted" onClick={() => patchParams({ exclude_duplicates: undefined })}>
                  Exclude duplicates ×
                </button>
              ) : null}
              {!includeArchived ? (
                <button type="button" className="rounded-sm border border-[rgba(19,65,120,0.35)] px-2 py-1 text-muted" onClick={() => patchParams({ include_archived: undefined })}>
                  Archives hidden ×
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-500">{error}</p>
        )}
        {loading && <p className="text-muted text-sm">Loading snapshot…</p>}

        {!loading && overview && (
          <div className="flex flex-col gap-10">
            <section id="insights-kpis" className="scroll-mt-24 space-y-4">
              <h2 className="text-lg font-semibold">Headline</h2>
              <Row gutter={[12, 12]} className="insights-kpi-row">
                <Col xs={24} sm={12} xl={4}>
                  <InsightStat
                    metricId="incidents"
                    title="Total incidents"
                    value={kpis.incidents ?? '—'}
                    delta={kpis.incidents_delta_pct}
                    hint={cityWide && kpis.volunteer_share != null ? `${kpis.volunteer_share}% volunteer-accepted` : undefined}
                  />
                </Col>
                <Col xs={24} sm={12} xl={4}>
                  <InsightStat metricId="critical" title="Critical incidents" value={kpis.critical ?? '—'} delta={kpis.critical_delta_pct} />
                </Col>
                <Col xs={24} sm={12} xl={4}>
                  <InsightStat metricId="first_action" title="First action time" value={formatClock(clocks.first_action?.p50_seconds)} hint={clockHint(clocks.first_action, 'No first-action stamps')} />
                </Col>
                <Col xs={24} sm={12} xl={4}>
                  <InsightStat metricId="dispatch" title="Dispatch time" value={formatClock(clocks.dispatch?.p50_seconds)} hint={clockHint(clocks.dispatch, 'No dispatch stamps')} />
                </Col>
                <Col xs={24} sm={12} xl={4}>
                  <InsightStat metricId="arrival" title="Arrival time" value={clocks.arrival?.n ? formatClock(clocks.arrival.p50_seconds) : '—'} hint={clockHint(clocks.arrival, 'No on-scene stamps')} />
                </Col>
                <Col xs={24} sm={12} xl={4}>
                  <InsightStat metricId="resolve" title="Resolution time" value={clocks.resolve?.n ? formatClock(clocks.resolve.p50_seconds) : '—'} hint={clockHint(clocks.resolve, 'No resolve/close timestamps')} />
                </Col>
              </Row>
              <Row gutter={[12, 12]} className="insights-kpi-row">
                <Col xs={24} sm={12} xl={4}>
                  <SlaStat metricId="dispatch_sla" label="Dispatch SLA" pct={kpis.dispatch_sla} barLabel="≤ 8 min (internal, not NFPA)" />
                </Col>
                <Col xs={24} sm={12} xl={4}>
                  <SlaStat metricId="arrival_sla" label="Arrival SLA" pct={kpis.arrival_sla} barLabel="≤ 10 min (internal, not NFPA)" />
                </Col>
                <Col xs={24} sm={12} xl={5}>
                  <SlaStat metricId="unserved" label="Unserved" pct={kpis.unserved_pct} hint={`${kpis.unserved ?? 0} incidents`} barLabel="Share unserved" />
                </Col>
                <Col xs={24} sm={12} xl={5}>
                  <SlaStat metricId="overdue" label="Overdue" pct={kpis.overdue_pct} hint={`${kpis.overdue ?? 0} still open > 30 min`} barLabel="Open > 30 min" />
                </Col>
                <Col xs={24} sm={12} xl={6}>
                  <SlaStat metricId="duplicate_rate" label="Duplicate rate" pct={kpis.duplicate_rate} barLabel="Marked duplicate" />
                </Col>
              </Row>
            </section>

            <section id="insights-performance" className="scroll-mt-24 space-y-4">
              <h2 className="text-lg font-semibold">Response performance</h2>
              <ChartCard title="Response matrix" metricId="response_matrix" footer="Cells are p50 / p90 / p95. Null clocks excluded.">
                <div className="insights-scroll-panel">
                  <Table
                    size="small"
                    pagination={false}
                    rowKey="key"
                    columns={matrixColumns}
                    dataSource={severityClocks}
                    scroll={{ x: 720 }}
                  />
                </div>
              </ChartCard>
              <Row gutter={[16, 16]} className="insights-row-equal">
                <Col xs={24} xl={14}>
                  <ChartCard title="Incident volume" metricId="volume">
                    <VolumeAreaChart data={volumeData} isLight={isLight} animKey={`vol-${chartAnimKey}`} />
                  </ChartCard>
                </Col>
                <Col xs={24} xl={10}>
                  <ChartCard title="Peak demand" metricId="peak_demand">
                    <dl className="insights-chart-frame grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm content-center">
                      <div>
                        <dt className="text-xs text-muted inline-flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" aria-hidden /> Peak day</dt>
                        <dd className="text-lg font-semibold mt-1">{overview.peak?.busiest_weekday || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted inline-flex items-center gap-1"><Zap className="w-3.5 h-3.5" aria-hidden /> Peak hour</dt>
                        <dd className="text-lg font-semibold mt-1">{overview.peak?.peak_hour_band || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted inline-flex items-center gap-1"><Activity className="w-3.5 h-3.5" aria-hidden /> Peak incident volume</dt>
                        <dd className="text-lg font-semibold mt-1 tabular-nums">{overview.peak?.peak_volume ?? 0}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted inline-flex items-center gap-1"><Truck className="w-3.5 h-3.5" aria-hidden /> Max concurrent</dt>
                        <dd className="text-lg font-semibold mt-1 tabular-nums">{overview.peak?.max_concurrent ?? overview.concurrent?.max ?? 0}</dd>
                        <p className="text-xs text-muted">avg {overview.concurrent?.avg ?? overview.peak?.avg_concurrent ?? 0}</p>
                      </div>
                    </dl>
                  </ChartCard>
                </Col>
              </Row>
            </section>

            <section id="insights-demand" className="scroll-mt-24 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">What &amp; where</h2>
                <p className="text-sm text-muted mt-1">
                  Barangay:{' '}
                  {barangay ? (
                    <button
                      type="button"
                      className="text-foreground hover:underline underline-offset-2"
                      onClick={() => patchParams({ barangay: '' })}
                      title="Clear barangay filter"
                    >
                      {barangay}
                    </button>
                  ) : (
                    <span className="text-foreground">All barangays</span>
                  )}
                </p>
              </div>
              <ChartCard title="Incident types" metricId="demand_types">
                <div className="insights-scroll-panel">
                  <TypeProgressList
                    key={`types-${chartAnimKey}`}
                    data={(demand.types || []).map((row) => ({ ...row, label: titleCase(row.key) }))}
                    onRowClick={(row) => patchParams({ incident_type: row?.key })}
                  />
                </div>
              </ChartCard>
              <Row gutter={[16, 16]} className="insights-row-equal">
                <Col xs={24} xl={12}>
                  <ChartCard className="min-w-0 overflow-hidden relative z-0" title="Geographic demand" metricId="barangay_map" footer="Click a barangay to filter. Unknown names are not on the map.">
                    <BarangayChoropleth
                      barangays={demand.barangays}
                      selected={barangay}
                      isLight={isLight}
                      onSelect={(name) => patchParams({ barangay: name })}
                    />
                  </ChartCard>
                </Col>
                <Col xs={24} xl={12}>
                  <ChartCard className="min-w-0" title="Top barangays" metricId="barangay_map">
                    <BarangayDemandTable rows={demand.barangays} patchParams={patchParams} />
                  </ChartCard>
                </Col>
              </Row>
              <Row gutter={[16, 16]} className="insights-row-equal">
                <Col xs={24} xl={14}>
                  <ChartCard title="Type × barangay" metricId="demand_types">
                    <div className="insights-scroll-panel">
                      {typeMatrixRows.length ? (
                        <Table
                          size="small"
                          pagination={false}
                          rowKey="key"
                          columns={typeMatrixColumns}
                          dataSource={typeMatrixRows}
                          scroll={{ x: 640 }}
                        />
                      ) : <EmptyNote />}
                    </div>
                  </ChartCard>
                </Col>
                <Col xs={24} xl={10}>
                  <ChartCard title="Reporting channels" metricId="demand_types">
                    <DonutChart
                      isLight={isLight}
                      animKey={`ch-${chartAnimKey}`}
                      data={(demand.channels || []).map((row) => ({ ...row, label: titleCase(row.key) }))}
                      getSliceFill={(entry) => channelColor(entry.key || entry.name)}
                    />
                  </ChartCard>
                </Col>
              </Row>
            </section>

            <section id="insights-ops" className="scroll-mt-24 space-y-4">
              <h2 className="text-lg font-semibold">Operations</h2>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 insights-ops-uniform">
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
                    data={outcomeRows.map((row) => ({ ...row, label: row.key }))}
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
                    <Table
                      className="mt-4"
                      size="small"
                      pagination={false}
                      rowKey="key"
                      dataSource={overview.breakdowns.department_clocks}
                      columns={[
                        { title: 'Department', dataIndex: 'key' },
                        { title: 'Dispatch p50', dataIndex: 'dispatch_p50_seconds', render: (value) => formatClock(value) },
                        { title: 'Arrival p50', dataIndex: 'arrival_p50_seconds', render: (value) => formatClock(value) },
                        { title: 'n', dataIndex: 'n' },
                        { title: 'Primary', dataIndex: 'primary_n' },
                        { title: 'Supporting', dataIndex: 'supporting_n' },
                      ]}
                    />
                  ) : <EmptyNote />}
                </ChartCard>
              </section>
            )}
          </div>
        )}

        {!loading && !overview && !error && <EmptyNote />}

        <Card
          id="insights-table"
          size="small"
          className="scroll-mt-24"
          title={(
            <span className="inline-flex items-center gap-0.5">
              Incidents ({total})
              <MetricHelp metricId="incidents_table" />
            </span>
          )}
        >
          <div style={{ marginBottom: 12, width: '100%', maxWidth: 480 }}>
            <AntInput
              prefix={<Search size={14} />}
              placeholder="Search barangay or report ID"
              defaultValue={search}
              onBlur={(e) => patchParams({ search: e.target.value.trim() })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') patchParams({ search: e.currentTarget.value.trim() });
              }}
              allowClear
            />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }} className="print:hidden">
            <Space wrap>
              <span style={{ fontSize: 12, opacity: 0.7 }}>Rows</span>
              <AntSelect
                value={pageSize}
                onChange={(value) => patchParams({ page_size: value, page: 1 })}
                options={INCIDENTS_PAGE_SIZE_OPTIONS}
                style={{ width: 84 }}
              />
              <span style={{ fontSize: 12, opacity: 0.7 }}>Showing {pageStart}-{pageEnd} of {total}</span>
            </Space>
            <Pagination
              current={page}
              total={total}
              pageSize={pageSize}
              onChange={(nextPage) => patchParams({ page: nextPage })}
              showSizeChanger={false}
              size="small"
            />
          </div>
          <Table
            size="small"
            loading={tableLoading}
            rowKey="report_id"
            columns={incidentTableColumns}
            dataSource={rows}
            pagination={false}
            locale={{ emptyText: 'No incidents in this range. Widen the dates or clear filters.' }}
            onRow={(record) => ({
              onClick: () => navigate(`/incidents/${record.report_id}`),
              style: { cursor: 'pointer' },
            })}
          />
          <p className="text-xs text-muted mt-2 print:hidden">Print/PDF includes this page of the table. Use CSV for the full filtered set.</p>
        </Card>
      </div>
    </Layout>
    </ConfigProvider>
  );
}
