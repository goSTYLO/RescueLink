import { Layout } from '@/presentation/components/layout/Layout';
import { Alert, Card, Input, Pagination, Select, Space, Table, Tabs, Tag, Typography } from 'antd';
import {
  ScrollText,
  Hash,
  Shield,
  Send,
  Filter,
  ListChecks,
  RefreshCw,
  Link2,
  Download,
} from 'lucide-react';
import { getAuditLogs, downloadAuditLogXlsx } from '@/data/api/auditLog.api';
import { Breadcrumb } from '@/presentation/components/common/Breadcrumb';
import { Button } from '@/presentation/components/ui/Button';
import { useState, useEffect, useCallback } from 'react';

const USE_BLOCKCHAIN = import.meta.env.VITE_USE_BLOCKCHAIN === 'true';

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'dispatcher_login', label: 'Dispatcher login' },
  { value: 'dispatcher_signup', label: 'Dispatcher signup' },
  { value: 'dispatcher_logout', label: 'Logout' },
  { value: 'user_login', label: 'Citizen login' },
  { value: 'user_logout', label: 'Citizen logout' },
  { value: 'user_register', label: 'Account registered' },
  { value: 'password_change', label: 'Password changed' },
  { value: 'password_reset', label: 'Password reset' },
  { value: 'user_profile_update', label: 'Profile updated' },
  { value: 'user_avatar_update', label: 'Profile photo updated' },
  { value: 'user_avatar_delete', label: 'Profile photo removed' },
  { value: 'dispatch_create', label: 'Dispatch created' },
  { value: 'dispatch_update', label: 'Dispatch updated' },
  { value: 'dispatch_delete', label: 'Dispatch deleted' },
  { value: 'department_create', label: 'Created department' },
  { value: 'department_update', label: 'Updated department' },
  { value: 'department_delete', label: 'Deleted department' },
  { value: 'department_unit_create', label: 'Added unit' },
  { value: 'department_unit_assign', label: 'Assigned unit to incident' },
  { value: 'responder_create', label: 'Created responder' },
  { value: 'responder_team_create', label: 'Created team' },
  { value: 'responder_application_submit', label: 'Volunteer application submitted' },
  { value: 'incident_create', label: 'Incident reported' },
  { value: 'incident_reporter_confirm_resolution', label: 'Resolution confirmed' },
  { value: 'incident_blockchain_finalize', label: USE_BLOCKCHAIN ? 'Saved to blockchain' : 'Incident finalized' },
  { value: 'incident_verify', label: USE_BLOCKCHAIN ? 'Blockchain verified (legacy)' : 'Incident verified (legacy)' },
  { value: 'escalation_request', label: 'Assistance requested' },
];

const RESOURCE_OPTIONS = [
  { value: '', label: 'All areas' },
  { value: 'auth', label: 'Auth' },
  { value: 'dispatch', label: 'Dispatch' },
  { value: 'incident', label: 'Incident' },
  { value: 'department', label: 'Department' },
  { value: 'department_unit', label: 'Unit' },
  { value: 'department_personnel', label: 'Roster' },
  { value: 'responder', label: 'Responder' },
  { value: 'team', label: 'Team' },
  { value: 'escalation', label: 'Escalation' },
  { value: 'responder_application', label: 'Application' },
];

const RESOURCE_LABELS = Object.fromEntries(
  RESOURCE_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]),
);

const DETAIL_KEY_LABELS = {
  department_id: 'Department',
  report_id: 'Incident',
  unit_id: 'Unit',
  personnel_id: 'Roster person',
  responder_id: 'Responder',
  team_id: 'Team',
  user_id: 'User',
  via: 'Method',
  method: 'Method',
  name: 'Name',
  code: 'Code',
  type: 'Type',
  status: 'Status',
  role: 'Role',
  note: 'Note',
  specialization_fields: 'Specializations',
  address: 'Address',
  firstName: 'First name',
  lastName: 'Last name',
};

const PAGE_SIZE_OPTIONS = [
  { value: 5, label: '5' },
  { value: 8, label: '8' },
  { value: 10, label: '10' },
  { value: 15, label: '15' },
  { value: 20, label: '20' },
];

const BLOCKCHAIN_ACTIONS = new Set(['incident_verify', 'incident_blockchain_finalize']);

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
  if (action === 'incident_blockchain_finalize') {
    return USE_BLOCKCHAIN ? 'Saved to blockchain' : 'Incident finalized';
  }
  if (action === 'incident_verify') {
    return USE_BLOCKCHAIN ? 'Blockchain verified (legacy)' : 'Incident verified (legacy)';
  }
  const opt = ACTION_OPTIONS.find((o) => o.value === action);
  return opt ? opt.label : (action || '—').replace(/_/g, ' ');
}

function formatResourceLabel(resourceType) {
  if (!resourceType) return '—';
  return RESOURCE_LABELS[resourceType] || String(resourceType).replace(/_/g, ' ');
}

function truncateHash(hash, len = 10) {
  if (!hash || typeof hash !== 'string') return '—';
  const s = hash.startsWith('0x') ? hash : `0x${hash}`;
  if (s.length <= len + 2) return s;
  return `${s.slice(0, len)}...`;
}

function parseDetails(details) {
  if (details == null) return null;
  if (typeof details === 'object') return details;
  if (typeof details === 'string') {
    const t = details.trim();
    if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
      try {
        return JSON.parse(details);
      } catch {
        return null;
      }
    }
    return null;
  }
  return null;
}

function formatDetailValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object' && value != null) return JSON.stringify(value);
  return String(value);
}

function formatDetailsForDisplay(log) {
  const details = parseDetails(log.details);
  if (!details || typeof details !== 'object') {
    return log.details != null && typeof log.details === 'string' ? log.details : '—';
  }
  const isBlockchain = BLOCKCHAIN_ACTIONS.has(log.action) && (details.tx_hash || details.block_number != null);
  if (isBlockchain && USE_BLOCKCHAIN) {
    const parts = [];
    if (details.block_number != null) parts.push(`Block #${details.block_number}`);
    if (details.tx_hash) parts.push(truncateHash(details.tx_hash));
    parts.push('Saved to blockchain');
    return parts.join(' · ');
  }
  const entries = Object.entries(details).filter(([, v]) => v != null && v !== '');
  return entries.length > 0
    ? entries.map(([k, v]) => `${DETAIL_KEY_LABELS[k] || k.replace(/_/g, ' ')}: ${formatDetailValue(v)}`).join(', ')
    : '—';
}

function whoLabel(log) {
  return (
    log.user_email
    || ([log.user_first_name, log.user_last_name].filter(Boolean).join(' ')
      || (log.user_id != null ? `User #${log.user_id}` : '—'))
  );
}

function TechnicalExpand({ log }) {
  const details = parseDetails(log.details);
  const json = details
    ? JSON.stringify(details, null, 2)
    : (log.details != null ? String(log.details) : '—');
  return (
    <div className="text-xs space-y-2 py-1">
      <div className="font-semibold text-foreground">Technical details for IT</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono">
        <div>
          <span className="text-muted">Action code:</span>
          {' '}
          {log.action || '—'}
        </div>
        <div>
          <span className="text-muted">Resource type:</span>
          {' '}
          {log.resource_type || '—'}
        </div>
        <div>
          <span className="text-muted">Resource ID:</span>
          {' '}
          {log.resource_id != null ? log.resource_id : '—'}
        </div>
        <div>
          <span className="text-muted">User ID:</span>
          {' '}
          {log.user_id != null ? log.user_id : '—'}
        </div>
      </div>
      <Typography.Paragraph
        copyable={json !== '—'}
        style={{ marginBottom: 0, fontFamily: 'ui-monospace, monospace', whiteSpace: 'pre-wrap' }}
      >
        {json}
      </Typography.Paragraph>
    </div>
  );
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
  const [activeTab, setActiveTab] = useState('all');
  const [exporting, setExporting] = useState(false);

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

  const blockchainLogs = logs.filter((l) => BLOCKCHAIN_ACTIONS.has(l.action));
  const allLogsForTab = activeTab === 'blockchain' && USE_BLOCKCHAIN ? blockchainLogs : logs;
  const totalPages = Math.ceil(allLogsForTab.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLogs = allLogsForTab.slice(startIndex, startIndex + itemsPerPage);
  const pageStart = allLogsForTab.length === 0 ? 0 : startIndex + 1;
  const pageEnd = Math.min(startIndex + itemsPerPage, allLogsForTab.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterAction, filterResourceType, filterFrom, filterTo, activeTab]);

  async function onExportExcel() {
    setExporting(true);
    setError(null);
    try {
      const fromParam = filterFrom ? new Date(filterFrom).toISOString() : undefined;
      const toParam = filterTo ? new Date(filterTo + 'T23:59:59.999Z').toISOString() : undefined;
      await downloadAuditLogXlsx({
        action: filterAction || undefined,
        resource_type: filterResourceType || undefined,
        from: fromParam,
        to: toParam,
      });
    } catch (err) {
      setError(err.message || 'Excel export failed');
    } finally {
      setExporting(false);
    }
  }

  const showBlockchainCols = activeTab === 'blockchain' && USE_BLOCKCHAIN;

  const columns = [
    {
      title: 'Time',
      key: 'time',
      render: (_, log) => formatTimestamp(log.created_at),
    },
    {
      title: 'Who',
      key: 'user',
      render: (_, log) => whoLabel(log),
    },
    {
      title: 'What happened',
      key: 'action',
      render: (_, log) => <Tag color="blue">{formatActionLabel(log.action)}</Tag>,
    },
    {
      title: 'Area',
      key: 'area',
      render: (_, log) => formatResourceLabel(log.resource_type),
    },
    ...(showBlockchainCols
      ? [
          {
            title: 'Block',
            key: 'block',
            render: (_, log) => {
              const d = parseDetails(log.details) || log.details;
              return d?.block_number != null ? `#${d.block_number}` : '—';
            },
          },
          {
            title: 'Tx Hash',
            key: 'tx',
            render: (_, log) => {
              const d = parseDetails(log.details) || log.details;
              const txHash = d?.tx_hash;
              return <span title={txHash || ''}>{txHash ? truncateHash(txHash) : '—'}</span>;
            },
          },
          {
            title: 'Status',
            key: 'bcStatus',
            render: () => <Tag color="green">Saved to blockchain</Tag>,
          },
        ]
      : [
          {
            title: 'Summary',
            key: 'details',
            ellipsis: true,
            render: (_, log) => (
              <span title={formatDetailsForDisplay(log)}>
                {formatDetailsForDisplay(log)}
              </span>
            ),
          },
        ]),
  ];

  return (
    <Layout>
      <div className="p-4 md:p-6 flex flex-col gap-6">
        <Breadcrumb items={[{ label: 'Home', path: '/dashboard' }, { label: 'Audit Log' }]} />

        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <ScrollText className="w-6 h-6" aria-hidden />
              Audit Log
            </h1>
            <p className="text-sm text-muted mt-1">
              Important department, dispatch, and citizen account actions. Expand a row for technical IDs (IT), or export Excel for full codes.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => onExportExcel()} disabled={exporting || loading} className="gap-2">
            <Download className="w-4 h-4" aria-hidden /> Excel
          </Button>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card size="small" className="h-full">
            <Space>
              <Hash size={18} className="text-muted" aria-hidden />
              <div>
                <div className="text-xs text-muted">Total records (loaded)</div>
                <div className="text-xl font-semibold tabular-nums">{logs.length}</div>
              </div>
            </Space>
          </Card>
          <Card size="small" className="h-full">
            <Space>
              <Shield size={18} className="text-muted" aria-hidden />
              <div>
                <div className="text-xs text-muted">Auth actions</div>
                <div className="text-xl font-semibold tabular-nums">
                  {logs.filter((l) => l.resource_type === 'auth').length}
                </div>
              </div>
            </Space>
          </Card>
          <Card size="small" className="h-full">
            <Space>
              <Send size={18} className="text-muted" aria-hidden />
              <div>
                <div className="text-xs text-muted">Dispatch actions</div>
                <div className="text-xl font-semibold tabular-nums">
                  {logs.filter((l) => l.resource_type === 'dispatch').length}
                </div>
              </div>
            </Space>
          </Card>
        </div>

        <Card
          size="small"
          title={(
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <Filter size={16} aria-hidden />
              Filters
            </span>
          )}
        >
          <Space wrap>
            <Select
              value={filterAction}
              onChange={setFilterAction}
              options={ACTION_OPTIONS}
              style={{ minWidth: 180 }}
              placeholder="Action"
              showSearch
              optionFilterProp="label"
            />
            <Select
              value={filterResourceType}
              onChange={setFilterResourceType}
              options={RESOURCE_OPTIONS}
              style={{ minWidth: 140 }}
              placeholder="Area"
            />
            <Input
              type="date"
              placeholder="From"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              style={{ maxWidth: 160 }}
            />
            <Input
              type="date"
              placeholder="To"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              style={{ maxWidth: 160 }}
            />
            <Button variant="outline" size="sm" onClick={() => fetchLogs()} className="gap-2">
              <RefreshCw className="w-4 h-4" aria-hidden /> Refresh
            </Button>
          </Space>
          <p className="text-xs text-muted mt-3 mb-0">
            Excel export uses these filters and includes friendly labels plus Action code columns (up to 10,000 rows).
          </p>
        </Card>

        <Card
          size="small"
          title={(
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <ListChecks size={16} aria-hidden />
              {activeTab === 'blockchain' && USE_BLOCKCHAIN
                ? `Blockchain logs (${blockchainLogs.length})`
                : `Activity log (${logs.length})`}
            </span>
          )}
          extra={USE_BLOCKCHAIN ? (
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              size="small"
              items={[
                { key: 'all', label: 'All Logs' },
                {
                  key: 'blockchain',
                  label: (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Link2 size={14} />
                      Blockchain Logs
                    </span>
                  ),
                },
              ]}
            />
          ) : null}
        >
          {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}

          {allLogsForTab.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
              <Space wrap>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Rows</span>
                <Select
                  value={itemsPerPage}
                  onChange={(value) => {
                    setItemsPerPage(Number(value));
                    setCurrentPage(1);
                  }}
                  options={PAGE_SIZE_OPTIONS}
                  style={{ width: 84 }}
                />
                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  Showing {pageStart}-{pageEnd} of {allLogsForTab.length}
                </span>
              </Space>
              <Pagination
                current={currentPage}
                total={allLogsForTab.length}
                pageSize={itemsPerPage}
                onChange={setCurrentPage}
                showSizeChanger={false}
                size="small"
              />
            </div>
          )}

          <Table
            size="small"
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={paginatedLogs}
            pagination={false}
            expandable={{
              expandedRowRender: (log) => <TechnicalExpand log={log} />,
              rowExpandable: () => true,
            }}
            locale={{
              emptyText: showBlockchainCols
                ? 'No blockchain save logs found.'
                : 'No audit log entries found.',
            }}
          />
          {allLogsForTab.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.7 }}>
              Page {currentPage} of {totalPages}
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}
