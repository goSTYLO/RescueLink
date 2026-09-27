import { Layout } from '@/presentation/components/layout/Layout';
import { Alert, Button, Card, Input, Pagination, Select, Space, Table, Tabs, Tag } from 'antd';
import {
  ScrollText,
  Hash,
  Shield,
  Send,
  Filter,
  ListChecks,
  RefreshCw,
  Link2,
} from 'lucide-react';
import { getAuditLogs } from '@/data/api/auditLog.api';
import { Breadcrumb } from '@/presentation/components/common/Breadcrumb';
import { useState, useEffect, useCallback } from 'react';

// Feature flag — mirrors USE_BLOCKCHAIN in Backend/.env
const USE_BLOCKCHAIN = import.meta.env.VITE_USE_BLOCKCHAIN === 'true';

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
  { value: 'incident_blockchain_finalize', label: USE_BLOCKCHAIN ? 'Saved to blockchain' : 'Incident finalized' },
  { value: 'incident_verify', label: USE_BLOCKCHAIN ? 'Blockchain verified (legacy)' : 'Incident verified (legacy)' },
];

const RESOURCE_OPTIONS = [
  { value: '', label: 'All Resources' },
  { value: 'auth', label: 'Auth' },
  { value: 'dispatch', label: 'Dispatch' },
  { value: 'incident', label: 'Incident' },
];

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
    ? entries.map(([k, v]) => `${k}: ${v}`).join(', ')
    : '—';
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

  const exportLogsAsCsv = () => {
    if (!logs.length) return;
    const header = ['timestamp', 'user', 'action', 'resource_type', 'resource_id', 'details'];
    const rows = logs.map((log) => {
      const details = formatDetailsForDisplay(log);
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

  const showBlockchainCols = activeTab === 'blockchain' && USE_BLOCKCHAIN;

  const columns = [
    {
      title: 'Time',
      key: 'time',
      render: (_, log) => formatTimestamp(log.created_at),
    },
    {
      title: 'User',
      key: 'user',
      render: (_, log) =>
        log.user_email
        || ([log.user_first_name, log.user_last_name].filter(Boolean).join(' ')
          || (log.user_id != null ? `User #${log.user_id}` : '—')),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, log) => <Tag color="blue">{formatActionLabel(log.action)}</Tag>,
    },
    {
      title: 'Resource',
      dataIndex: 'resource_type',
      render: (value) => value || '—',
    },
    {
      title: 'Resource ID',
      dataIndex: 'resource_id',
      render: (value) => (value != null ? value : '—'),
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
            title: 'Details',
            key: 'details',
            ellipsis: true,
            render: (_, log) => (
              <span title={log.details ? JSON.stringify(log.details) : ''}>
                {formatDetailsForDisplay(log)}
              </span>
            ),
          },
        ]),
  ];

  return (
    <Layout>
      <div className="p-4 md:p-6">
        <Breadcrumb items={[{ label: 'Home', path: '/dashboard' }, { label: 'Audit Log' }]} />

        <Card size="small" style={{ marginTop: 12, marginBottom: 16 }} title={(
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <ScrollText size={18} />
            Dispatcher Audit Log
          </span>
        )}>
          <p style={{ margin: 0 }}>Logins, password changes, and dispatch actions for accountability and audit.</p>
        </Card>

        <Space wrap size="middle" style={{ marginBottom: 16, width: '100%' }}>
          <Card size="small" style={{ minWidth: 160 }}>
            <Space>
              <Hash size={18} />
              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Total records</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{logs.length}</div>
              </div>
            </Space>
          </Card>
          <Card size="small" style={{ minWidth: 160 }}>
            <Space>
              <Shield size={18} />
              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Auth actions</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>
                  {logs.filter((l) => l.resource_type === 'auth').length}
                </div>
              </div>
            </Space>
          </Card>
          <Card size="small" style={{ minWidth: 160 }}>
            <Space>
              <Send size={18} />
              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Dispatch actions</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>
                  {logs.filter((l) => l.resource_type === 'dispatch').length}
                </div>
              </div>
            </Space>
          </Card>
        </Space>

        <Card
          size="small"
          style={{ marginBottom: 16 }}
          title={(
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Filter size={16} />
              Filters
            </span>
          )}
        >
          <Space wrap>
            <Select
              value={filterAction}
              onChange={setFilterAction}
              options={ACTION_OPTIONS}
              style={{ minWidth: 160 }}
              placeholder="Action"
            />
            <Select
              value={filterResourceType}
              onChange={setFilterResourceType}
              options={RESOURCE_OPTIONS}
              style={{ minWidth: 140 }}
              placeholder="Resource"
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
            <Button icon={<RefreshCw size={14} />} onClick={() => fetchLogs()}>
              Refresh
            </Button>
            <Button icon={<Send size={14} />} onClick={exportLogsAsCsv} disabled={!logs.length}>
              Export CSV
            </Button>
          </Space>
        </Card>

        <Card
          size="small"
          title={(
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <ListChecks size={16} />
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
