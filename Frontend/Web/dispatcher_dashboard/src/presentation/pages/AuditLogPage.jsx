import { Layout } from '@/presentation/components/layout/Layout';
import { Badge } from '@/presentation/components/ui/Badge';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/Select';
import {
  ScrollText,
  Activity,
  Hash,
  Shield,
  Send,
  Filter,
  ListChecks,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { getAuditLogs } from '@/data/api/auditLog.api';
import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';

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
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [pageSizeSelectOpen, setPageSizeSelectOpen] = useState(false);
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

  const totalPages = Math.ceil(logs.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLogs = logs.slice(startIndex, startIndex + itemsPerPage);
  const pageStart = logs.length === 0 ? 0 : startIndex + 1;
  const pageEnd = Math.min(startIndex + itemsPerPage, logs.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterAction, filterResourceType, filterFrom, filterTo]);

  const { theme } = useTheme();
  const isLight = theme === 'light';
  const exportLogsAsCsv = () => {
    if (!logs.length) return;
    const header = ['timestamp', 'user', 'action', 'resource_type', 'resource_id', 'details'];
    const rows = logs.map((log) => {
      const details = log.details && typeof log.details === 'object'
        ? JSON.stringify(log.details)
        : (log.details != null ? String(log.details) : '');
      const userValue = log.user_email || ([log.user_first_name, log.user_last_name].filter(Boolean).join(' ') || (log.user_id != null ? `User #${log.user_id}` : ''));
      return [
        formatTimestamp(log.created_at),
        userValue,
        formatActionLabel(log.action),
        log.resource_type || '',
        log.resource_id != null ? String(log.resource_id) : '',
        details,
      ].map((field) => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  const heroCardClass = `rounded-3xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80 border-gray-200/80 shadow-[8px_8px_24px_rgba(209,213,219,0.5),-8px_-8px_24px_rgba(255,255,255,0.9)]' : 'glass neumorphic-dark bg-card/60 border-white/10 shadow-[8px_8px_24px_rgba(0,0,0,0.35),-6px_-6px_20px_rgba(19,65,120,0.2)]'}`;
  const heroIconClass = `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'}`;
  const panelClass = `rounded-2xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'}`;
  const headerClass = `flex items-center gap-3 px-4 py-3 border-b ${isLight ? 'border-gray-200/80 bg-gray-50/50' : 'border-white/10 bg-white/5'}`;
  const iconBoxClass = (accent = 'primary') =>
    `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100' : 'neumorphic-dark-inset bg-white/10'} ${
      accent === 'primary' ? 'text-primary' : accent === 'secondary' ? 'text-secondary' : 'text-foreground'
    }`;
  const statIconClass = (accent = 'primary') =>
    `w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100' : 'neumorphic-dark-inset bg-white/10'} ${accent === 'primary' ? 'text-primary' : 'text-foreground'}`;

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto">
        <div className={`${heroCardClass} mb-6`}>
          <div className="p-8 flex flex-wrap items-center gap-6">
            <div className={heroIconClass}>
              <ScrollText className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Dispatcher Audit Log</h1>
              <p className="text-muted mt-1">Logins, password changes, and dispatch actions for accountability and audit.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className={`rounded-2xl border overflow-hidden ${isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'}`}>
            <div className={`p-4 flex items-center gap-4 ${isLight ? 'bg-gray-50/50' : 'bg-white/5'}`}>
              <span className={statIconClass('primary')}>
                <Hash className="w-5 h-5" strokeWidth={2} />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted">Total records</p>
                <p className="text-2xl font-bold text-foreground mt-0.5">{logs.length}</p>
              </div>
            </div>
          </div>
          <div className={`rounded-2xl border overflow-hidden ${isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'}`}>
            <div className={`p-4 flex items-center gap-4 ${isLight ? 'bg-gray-50/50' : 'bg-white/5'}`}>
              <span className={statIconClass('primary')}>
                <Shield className="w-5 h-5" strokeWidth={2} />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted">Auth actions</p>
                <p className="text-2xl font-bold text-foreground mt-0.5">
                  {logs.filter((l) => l.resource_type === 'auth').length}
                </p>
              </div>
            </div>
          </div>
          <div className={`rounded-2xl border overflow-hidden ${isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'}`}>
            <div className={`p-4 flex items-center gap-4 ${isLight ? 'bg-gray-50/50' : 'bg-white/5'}`}>
              <span className={statIconClass('primary')}>
                <Send className="w-5 h-5" strokeWidth={2} />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted">Dispatch actions</p>
                <p className="text-2xl font-bold text-foreground mt-0.5">
                  {logs.filter((l) => l.resource_type === 'dispatch').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className={`mb-6 ${panelClass}`}>
          <div className={headerClass}>
            <span className={iconBoxClass('primary')}>
              <Filter className="w-5 h-5" strokeWidth={2} />
            </span>
            <span className="font-medium text-foreground">Filters</span>
          </div>
          <div className="p-4 flex flex-col sm:flex-row gap-4 flex-wrap items-start sm:items-center overflow-visible">
            <Select
              value={filterAction}
              onValueChange={setFilterAction}
              open={selectStates.action}
              onOpenChange={(open) => setSelectStates((s) => ({ ...s, action: open }))}
            >
              {({ value, dropdownRect }) => (
                <>
                  <SelectTrigger
                    isOpen={selectStates.action}
                    onClick={() => setSelectStates((s) => ({ ...s, action: !s.action }))}
                    className={`min-w-[160px] rounded-xl py-2.5 border-2 ${isLight ? 'border-gray-200 bg-gray-50/80' : 'border-border bg-white/5'}`}
                  >
                    <SelectValue placeholder="Action" value={value} options={ACTION_OPTIONS} />
                  </SelectTrigger>
                  <SelectContent isOpen={selectStates.action} dropdownRect={dropdownRect} className="rounded-xl border-2 border-border shadow-xl bg-card py-1">
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
            <Select
              value={filterResourceType}
              onValueChange={setFilterResourceType}
              open={selectStates.resource}
              onOpenChange={(open) => setSelectStates((s) => ({ ...s, resource: open }))}
            >
              {({ value, dropdownRect }) => (
                <>
                  <SelectTrigger
                    isOpen={selectStates.resource}
                    onClick={() => setSelectStates((s) => ({ ...s, resource: !s.resource }))}
                    className={`min-w-[140px] rounded-xl py-2.5 border-2 ${isLight ? 'border-gray-200 bg-gray-50/80' : 'border-border bg-white/5'}`}
                  >
                    <SelectValue placeholder="Resource" value={value} options={RESOURCE_OPTIONS} />
                  </SelectTrigger>
                  <SelectContent isOpen={selectStates.resource} dropdownRect={dropdownRect} className="rounded-xl border-2 border-border shadow-xl bg-card py-1">
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
              className={`max-w-[160px] rounded-xl border-2 py-2.5 ${isLight ? 'border-gray-200' : 'border-border bg-white/5'}`}
            />
            <Input
              type="date"
              placeholder="To"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className={`max-w-[160px] rounded-xl border-2 py-2.5 ${isLight ? 'border-gray-200' : 'border-border bg-white/5'}`}
            />
            <Button variant="outline" size="sm" onClick={() => fetchLogs()} className="rounded-xl gap-2">
              <RefreshCw className="w-4 h-4" strokeWidth={2} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportLogsAsCsv} disabled={!logs.length} className="rounded-xl gap-2">
              <Send className="w-4 h-4" strokeWidth={2} />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Activity log table */}
        <div className={panelClass}>
          <div className={headerClass}>
            <span className={iconBoxClass('primary')}>
              <ListChecks className="w-5 h-5" strokeWidth={2} />
            </span>
            <span className="font-medium text-foreground">Activity log ({logs.length})</span>
          </div>
          <div className="p-4">
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-destructive/10 text-destructive text-sm border border-destructive/20">
                {error}
              </div>
            )}
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted">
                <Activity className="w-10 h-10 animate-pulse" strokeWidth={2} />
                <span>Loading audit logs...</span>
              </div>
            ) : (
              <>
                {logs.length > 0 && (
                  <div className={`px-2 sm:px-3 py-2 mb-3 rounded-xl border ${isLight ? 'border-gray-200/80 bg-gray-50/20' : 'border-white/10 bg-white/[0.02]'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted">Rows</span>
                        <Select
                          value={String(itemsPerPage)}
                          onValueChange={(value) => {
                            setItemsPerPage(Number(value));
                            setCurrentPage(1);
                          }}
                          open={pageSizeSelectOpen}
                          onOpenChange={setPageSizeSelectOpen}
                        >
                          {({ value }) => (
                            <>
                              <SelectTrigger
                                isOpen={pageSizeSelectOpen}
                                onClick={() => setPageSizeSelectOpen((o) => !o)}
                                className="h-8 w-[84px]"
                              >
                                <SelectValue
                                  value={value}
                                  options={[
                                    { value: '5', label: '5' },
                                    { value: '8', label: '8' },
                                    { value: '10', label: '10' },
                                    { value: '15', label: '15' },
                                    { value: '20', label: '20' },
                                  ]}
                                />
                              </SelectTrigger>
                              <SelectContent isOpen={pageSizeSelectOpen}>
                                {['5', '8', '10', '15', '20'].map((size) => (
                                  <SelectItem
                                    key={size}
                                    value={size}
                                    onSelect={(v) => {
                                      setItemsPerPage(Number(v));
                                      setCurrentPage(1);
                                      setPageSizeSelectOpen(false);
                                    }}
                                  >
                                    {size}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </>
                          )}
                        </Select>
                        <span className="text-xs text-muted sm:ml-1">Showing {pageStart}-{pageEnd} of {logs.length}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="h-9 w-9 p-0 rounded-lg"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) pageNum = i + 1;
                            else if (currentPage <= 3) pageNum = i + 1;
                            else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                            else pageNum = currentPage - 2 + i;
                            return (
                              <Button
                                key={pageNum}
                                variant={currentPage === pageNum ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setCurrentPage(pageNum)}
                                className={`h-9 w-9 p-0 rounded-lg min-w-[36px] ${currentPage === pageNum ? 'bg-primary text-white hover:bg-primary-hover' : ''}`}
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="h-9 w-9 p-0 rounded-lg"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                        <span className="text-sm text-muted ml-2">Page {currentPage} of {totalPages}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full">
                    <thead>
                      <tr className={isLight ? 'border-b border-gray-200/80 bg-gray-50/50' : 'border-b border-white/10 bg-white/5'}>
                        <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted">Time</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted">User</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted">Action</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted">Resource</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted">Resource ID</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLogs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-muted">
                            No audit log entries found.
                          </td>
                        </tr>
                      ) : (
                        paginatedLogs.map((log) => (
                          <tr
                            key={log.id}
                            className={isLight ? 'border-b border-gray-200/60 hover:bg-gray-50/80 transition-colors' : 'border-b border-white/10 hover:bg-white/5 transition-colors'}
                          >
                            <td className="py-4 px-4 text-sm text-muted whitespace-nowrap">
                              {formatTimestamp(log.created_at)}
                            </td>
                            <td className="py-4 px-4 text-sm text-foreground">
                              {log.user_email || ([log.user_first_name, log.user_last_name].filter(Boolean).join(' ') || (log.user_id != null ? `User #${log.user_id}` : '—'))}
                            </td>
                            <td className="py-4 px-4">
                              <Badge variant="outline" className="rounded-lg border-border bg-primary/5 text-primary">
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
              </>
            )}

          </div>
        </div>
      </div>
    </Layout>
  );
}
