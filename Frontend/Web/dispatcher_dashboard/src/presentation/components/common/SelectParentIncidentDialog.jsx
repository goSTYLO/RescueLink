/**
 * Reusable dialog to browse and select an incident as parent (e.g. when linking as duplicate).
 * Includes search, filters, and pagination - a mini version of the dashboard.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Modal, Button, Select, Input, Tag, Table } from 'antd';
import { IncidentTypeChips } from '@/presentation/components/common/IncidentTypeChips';
import { Search, ChevronLeft, ChevronRight, Merge, Loader2, LayoutList } from 'lucide-react';
import { getIncidents } from '@/data/api/incidents.api';
import { mapApiIncidentToDisplay } from '@/core/utils/incidentDisplay';
import { mapIncidentTypeFilterToApi } from '@/core/utils/incidentClassification';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';
import { barangays } from '@/data/mock/mockData';

function mapStatusFilterToApi(value) {
  if (value === 'Pending') return 'pending';
  if (value === 'Verified') return 'verified';
  if (value === 'In Progress') return 'in_progress';
  if (value === 'Resolved') return 'resolved';
  if (value === 'Closed') return 'closed';
  return undefined;
}

function mapSeverityFilterToApi(value) {
  if (value === 'Critical') return 'high';
  if (value === 'Warning') return 'medium';
  if (value === 'Low') return 'low';
  return undefined;
}

const TYPE_OPTIONS = [
  { value: 'All', label: 'All Types' },
  { value: 'Fire', label: 'Fire' },
  { value: 'Medical', label: 'Medical' },
  { value: 'Police', label: 'Police' },
  { value: 'Disaster', label: 'Disaster' },
  { value: 'Other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'All', label: 'All Status' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Verified', label: 'Verified' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Resolved', label: 'Resolved' },
  { value: 'Closed', label: 'Closed' },
];

const SEVERITY_OPTIONS = [
  { value: 'All', label: 'All Severity' },
  { value: 'Critical', label: 'Critical' },
  { value: 'Warning', label: 'Warning' },
  { value: 'Low', label: 'Low' },
];

function severityTagColor(severity) {
  if (severity === 'Critical') return 'error';
  if (severity === 'Warning') return 'warning';
  return 'success';
}

export function SelectParentIncidentDialog({
  open,
  onOpenChange,
  currentIncidentId,
  onSelect,
  loading: linkLoading = false,
}) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [incidents, setIncidents] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [filterBarangay, setFilterBarangay] = useState('All');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(8);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const apiType = mapIncidentTypeFilterToApi(filterType);
      const apiStatus = mapStatusFilterToApi(filterStatus);
      const apiSeverity = mapSeverityFilterToApi(filterSeverity);
      const apiBarangay = filterBarangay !== 'All' ? filterBarangay : undefined;
      const offset = (page - 1) * pageSize;
      const result = await getIncidents({
        limit: pageSize,
        offset,
        status: apiStatus,
        severity_level: apiSeverity,
        incident_type: apiType,
        barangay: apiBarangay,
        search: searchDebounced || undefined,
        exclude_duplicates: false,
        exclude_report_id: currentIncidentId ?? undefined,
        withMeta: true,
      });
      const items = Array.isArray(result?.items) ? result.items : [];
      setIncidents(items.map(mapApiIncidentToDisplay));
      setTotalCount(Number(result?.totalCount ?? 0));
    } catch {
      setIncidents([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterType, filterStatus, filterSeverity, filterBarangay, searchDebounced, currentIncidentId]);

  useEffect(() => {
    if (open) {
      setPage(1);
      fetchIncidents();
    }
  }, [open, fetchIncidents]);

  const filteredIncidents = incidents;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const panelClass = isLight ? 'bg-gray-50/80 border-gray-200/80' : 'bg-white/5 border-white/10';
  const borderClass = isLight ? 'border-gray-200/80' : 'border-white/10';

  const columns = [
    {
      title: 'Incident',
      key: 'incident',
      render: (_, inc) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/incidents/${inc.id}`}
              className="font-medium text-primary hover:underline"
              onClick={() => onOpenChange?.(false)}
            >
              Report #{inc.id}
            </Link>
            <IncidentTypeChips incidentTypes={inc.incidentTypes} compact className="inline-flex" />
            <Tag color={severityTagColor(inc.severity)}>{inc.severity}</Tag>
            <Tag>{inc.status}</Tag>
          </div>
          <p className="text-sm text-muted mt-0.5">{inc.barangay} · {inc.reporterName}</p>
          <p className="text-xs text-muted mt-0.5">{inc.timeReported}</p>
        </div>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 180,
      align: 'right',
      render: (_, inc) => (
        <Button
          onClick={() => onSelect(inc.id)}
          disabled={linkLoading}
          icon={linkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Merge className="w-3 h-3" />}
        >
          Link as duplicate
        </Button>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      title={(
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <LayoutList className="w-5 h-5" />
          Select parent incident
        </span>
      )}
      footer={null}
      width={768}
      destroyOnClose
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
    >
      <p style={{ marginBottom: 16, color: 'var(--ant-color-text-secondary)' }}>
        Browse incidents to link this report as a duplicate. Use search and filters to find the related incident.
      </p>

      <div className="flex flex-col gap-4">
        <Input
          prefix={<Search className="w-4 h-4 text-muted" />}
          placeholder="Search by report ID, description, or barangay..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
        />

        <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl border ${borderClass} ${panelClass}`}>
          <div>
            <label className="text-xs font-medium text-muted block mb-1">Type</label>
            <Select
              className="w-full"
              value={filterType}
              onChange={(v) => { setFilterType(v); setPage(1); }}
              options={TYPE_OPTIONS}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted block mb-1">Status</label>
            <Select
              className="w-full"
              value={filterStatus}
              onChange={(v) => { setFilterStatus(v); setPage(1); }}
              options={STATUS_OPTIONS}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted block mb-1">Severity</label>
            <Select
              className="w-full"
              value={filterSeverity}
              onChange={(v) => { setFilterSeverity(v); setPage(1); }}
              options={SEVERITY_OPTIONS}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted block mb-1">Barangay</label>
            <Select
              className="w-full"
              value={filterBarangay}
              onChange={(v) => { setFilterBarangay(v); setPage(1); }}
              options={[
                { value: 'All', label: 'All Barangays' },
                ...barangays.map((b) => ({ value: b, label: b })),
              ]}
            />
          </div>
        </div>

        <Table
          size="small"
          rowKey="id"
          columns={columns}
          dataSource={filteredIncidents}
          loading={loading}
          pagination={false}
          locale={{ emptyText: 'No incidents found. Try adjusting filters or search.' }}
          className={`rounded-xl border ${borderClass}`}
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
            <p className="text-sm text-muted">
              Page {page} of {totalPages} · {totalCount} total
            </p>
            <div className="flex items-center gap-1">
              <Button
                type="text"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                icon={<ChevronLeft className="w-4 h-4" />}
              />
              <Button
                type="text"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                icon={<ChevronRight className="w-4 h-4" />}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
