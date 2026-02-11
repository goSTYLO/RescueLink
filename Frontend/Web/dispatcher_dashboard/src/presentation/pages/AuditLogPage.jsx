import { Layout } from '@/presentation/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/Card';
import { Badge } from '@/presentation/components/ui/Badge';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/Select';
import { Blocks, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAuditLogs } from '@/data/api/auditLog.api';
import { useState, useEffect, useCallback } from 'react';

const ROWS_PER_PAGE = 10;

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'dispatcher_login', label: 'Login' },
  { value: 'dispatcher_signup', label: 'Signup' },
  { value: 'dispatcher_logout', label: 'Logout' },
  { value: 'password_change', label: 'Password change' },
  { value: 'password_reset', label: 'Password reset' },
  { value: 'dispatch_create', label: 'Dispatch created' },
  { value: 'dispatch_update', label: 'Dispatch updated' },
  { value: 'dispatch_delete', label: 'Dispatch deleted' },
];

const RESOURCE_OPTIONS = [
  { value: '', label: 'All Resources' },
  { value: 'auth', label: 'Auth' },
  { value: 'dispatch', label: 'Dispatch' },
  { value: 'incident', label: 'Incident' },
];

function formatTimestamp(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function formatActionLabel(action) {
  const opt = ACTION_OPTIONS.find((o) => o.value === action);
  return opt ? opt.label : (action || '—').replace(/_/g, ' ');
}

export function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterAction, setFilterAction] = useState('');
  const [filterResourceType, setFilterResourceType] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectStates, setSelectStates] = useState({ action: false, resource: false });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fromParam = filterFrom ? new Date(filterFrom).toISOString() : undefined;
      const toParam = filterTo ? new Date(filterTo + 'T23:59:59.999Z').toISOString() : undefined;
      const data = await getAuditLogs({
        limit: 100,
        offset: 0,
        action: filterAction || undefined,
        resource_type: filterResourceType || undefined,
        from: fromParam,
        to: toParam,
      });
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load audit logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [filterAction, filterResourceType, filterFrom, filterTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(logs.length / ROWS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const paginatedLogs = logs.slice(startIndex, startIndex + ROWS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterAction, filterResourceType, filterFrom, filterTo]);

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-foreground">Dispatcher Audit Log</h1>
          <p className="text-muted mt-1">Trail of dispatcher actions for authenticity and reference</p>
        </div>

        <Card hover={false} className="mb-6 bg-secondary/20 border-[rgba(19,65,120,0.35)]">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-secondary/30 flex items-center justify-center">
                <Blocks className="w-6 h-6 text-secondary-light" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Activity trail</p>
                <p className="text-sm text-muted mt-1">
                  Logins, password changes, and dispatch actions are recorded here for accountability and audit.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <Card hover={false} className="border border-[rgba(19,65,120,0.35)]">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-muted">Total records</p>
              <p className="text-2xl font-bold text-foreground mt-1">{logs.length}</p>
            </CardContent>
          </Card>
          <Card hover={false} className="border border-[rgba(19,65,120,0.35)]">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-muted">Auth actions</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {logs.filter((l) => l.resource_type === 'auth').length}
              </p>
            </CardContent>
          </Card>
          <Card hover={false} className="border border-[rgba(19,65,120,0.35)]">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-muted">Dispatch actions</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {logs.filter((l) => l.resource_type === 'dispatch').length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-2 text-muted">
            <Filter className="w-5 h-5" />
            <span className="text-sm font-medium">Filters</span>
          </div>
          <Select value={filterAction} onValueChange={setFilterAction}>
            {({ value }) => (
              <>
                <SelectTrigger
                  isOpen={selectStates.action}
                  onClick={() => setSelectStates((s) => ({ ...s, action: !s.action }))}
                  className="min-w-[160px]"
                >
                  <SelectValue placeholder="Action" value={value} options={ACTION_OPTIONS} />
                </SelectTrigger>
                <SelectContent isOpen={selectStates.action}>
                  {ACTION_OPTIONS.map((opt) => (
                    <SelectItem
                      key={opt.value || 'all'}
                      value={opt.value}
                      onSelect={(v) => {
                        setFilterAction(v);
                        setSelectStates((s) => ({ ...s, action: false }));
                      }}
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </>
            )}
          </Select>
          <Select value={filterResourceType} onValueChange={setFilterResourceType}>
            {({ value }) => (
              <>
                <SelectTrigger
                  isOpen={selectStates.resource}
                  onClick={() => setSelectStates((s) => ({ ...s, resource: !s.resource }))}
                  className="min-w-[140px]"
                >
                  <SelectValue placeholder="Resource" value={value} options={RESOURCE_OPTIONS} />
                </SelectTrigger>
                <SelectContent isOpen={selectStates.resource}>
                  {RESOURCE_OPTIONS.map((opt) => (
                    <SelectItem
                      key={opt.value || 'all'}
                      value={opt.value}
                      onSelect={(v) => {
                        setFilterResourceType(v);
                        setSelectStates((s) => ({ ...s, resource: false }));
                      }}
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </>
            )}
          </Select>
          <Input
            type="date"
            placeholder="From"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="max-w-[160px]"
          />
          <Input
            type="date"
            placeholder="To"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="max-w-[160px]"
          />
          <Button variant="outline" size="sm" onClick={() => fetchLogs()}>
            Refresh
          </Button>
        </div>

        {/* Table */}
        <Card hover={false}>
          <CardHeader>
            <CardTitle>Activity log ({logs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 rounded bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}
            {loading ? (
              <div className="py-8 text-center text-muted">Loading audit logs...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[rgba(19,65,120,0.35)]">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted">Time</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted">User</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted">Action</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted">Resource</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted">Resource ID</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted">
                          No audit log entries found.
                        </td>
                      </tr>
                    ) : (
                      paginatedLogs.map((log) => (
                        <tr
                          key={log.id}
                          className="border-b border-[rgba(19,65,120,0.2)] hover:bg-card transition-colors"
                        >
                          <td className="py-4 px-4 text-sm text-muted whitespace-nowrap">
                            {formatTimestamp(log.created_at)}
                          </td>
                          <td className="py-4 px-4 text-sm text-foreground">
                            {log.user_email || ([log.user_first_name, log.user_last_name].filter(Boolean).join(' ') || (log.user_id != null ? `User #${log.user_id}` : '—'))}
                          </td>
                          <td className="py-4 px-4">
                            <Badge variant="outline" className="border-[rgba(19,65,120,0.35)]">
                              {formatActionLabel(log.action)}
                            </Badge>
                          </td>
                          <td className="py-4 px-4 text-sm text-foreground">{log.resource_type || '—'}</td>
                          <td className="py-4 px-4 text-sm font-mono text-muted">
                            {log.resource_id != null ? log.resource_id : '—'}
                          </td>
                          <td className="py-4 px-4 text-sm text-muted max-w-[200px] truncate" title={log.details ? JSON.stringify(log.details) : ''}>
                            {log.details && typeof log.details === 'object'
                              ? Object.entries(log.details)
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(', ') || '—'
                              : log.details != null ? String(log.details) : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && logs.length > 0 && (
              <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-[rgba(19,65,120,0.35)]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted">
                  Page {currentPage} of {totalPages}
                  {logs.length > ROWS_PER_PAGE &&
                    ` (${startIndex + 1}-${Math.min(startIndex + ROWS_PER_PAGE, logs.length)} of ${logs.length})`}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
