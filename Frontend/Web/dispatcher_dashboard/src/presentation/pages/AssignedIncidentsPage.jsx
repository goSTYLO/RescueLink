import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/presentation/components/layout/Layout';
import { Alert, Button, Card, Table, Tag } from 'antd';
import { ClipboardList, Eye, MapPin } from 'lucide-react';
import { getIncidents } from '@/data/api/incidents.api';
import { mapApiIncidentToDisplay } from '@/core/utils/incidentDisplay';
import { ROLES } from '@/core/constants';
import { useIncidentWebSocketStatus } from '@/presentation/context/IncidentWebSocketContext';
import { Breadcrumb } from '@/presentation/components/common/Breadcrumb';
import { INCIDENT_ACTION_BTN_PROPS, incidentTableRowClickProps } from '@/core/utils/incidentDashboardTable';

function mapApiIncidentToRow(api) {
  return mapApiIncidentToDisplay(api);
}

const POLLING_INTERVAL_MS = 30000;
const POLLING_WHEN_WS_CONNECTED_MS = 120000;

export function AssignedIncidentsPage() {
  const navigate = useNavigate();
  const { isConnected: wsConnected } = useIncidentWebSocketStatus();
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user.role !== ROLES.DEPARTMENT_HEAD) {
      navigate(user.role === ROLES.DEPARTMENT_ADMIN ? '/department/dashboard' : '/dashboard', { replace: true });
    }
  }, [user.role, navigate]);

  const fetchIncidents = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const result = await getIncidents({ limit: 40, offset: 0, withMeta: false });
      const list = Array.isArray(result) ? result : (result?.items || []);
      setIncidents(list.map(mapApiIncidentToRow));
    } catch (err) {
      setError(err.message || 'Failed to load incidents');
      setIncidents([]);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user.role !== ROLES.DEPARTMENT_HEAD) return;
    fetchIncidents(false);
    const intervalMs = wsConnected ? POLLING_WHEN_WS_CONNECTED_MS : POLLING_INTERVAL_MS;
    const intervalId = setInterval(() => fetchIncidents(true), intervalMs);
    const handleUpdated = () => fetchIncidents(true);
    window.addEventListener('incident:updated', handleUpdated);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('incident:updated', handleUpdated);
    };
  }, [user.role, fetchIncidents, wsConnected]);

  const severityColor = (severity) => {
    const key = String(severity).toLowerCase();
    if (key === 'critical') return 'red';
    if (key === 'warning') return 'gold';
    if (key === 'resolved' || key === 'low') return 'green';
    return 'default';
  };

  const statusColor = (status) => {
    const key = String(status || '').toLowerCase();
    if (key === 'resolved' || key === 'closed') return 'green';
    if (key === 'verified') return 'purple';
    if (key === 'in progress' || key === 'assigned') return 'blue';
    return 'default';
  };

  const getTypeIcon = (type) => {
    const icons = { Fire: '🔥', Medical: '🏥', Police: '👮', Disaster: '⚠️', SOS: '🆘' };
    return icons[String(type)] || '📋';
  };

  const columns = [
    {
      title: 'Incident ID',
      dataIndex: 'id',
      render: (id) => (
        <Button type="link" onClick={() => navigate(`/incidents/${id}`)}>{id}</Button>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'emergencyType',
      render: (type) => <span>{getTypeIcon(type)} {type}</span>,
    },
    {
      title: 'Location',
      dataIndex: 'barangay',
      render: (barangay) => (
        <span><MapPin size={14} style={{ marginRight: 4 }} />{barangay}</span>
      ),
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      render: (severity) => <Tag color={severityColor(severity)}>{String(severity || '—')}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (status) => <Tag color={statusColor(status)}>{status || '—'}</Tag>,
    },
    { title: 'Reported', dataIndex: 'timeReported', render: (value) => value || '—' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, incident) => (
        <Button
          {...INCIDENT_ACTION_BTN_PROPS}
          color="primary"
          variant="solid"
          aria-label="View details"
          icon={<Eye size={12} />}
          onClick={(e) => { e.stopPropagation(); navigate(`/incidents/${incident.id}`); }}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <Layout>
      <div className="p-4 md:p-6">
        <Breadcrumb items={[{ label: 'Home', path: '/department/dashboard' }, { label: 'Assigned Incidents' }]} />
        <Card size="small" style={{ marginTop: 12 }} title={(
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={18} />
            Assigned Incidents
          </span>
        )}>
          <p style={{ marginBottom: 12 }}>{user.department || 'Department'} — incidents assigned to your department</p>
          {error && <Alert type="warning" showIcon message={error} style={{ marginBottom: 12 }} />}
          <Table
            size="small"
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={incidents}
            pagination={false}
            locale={{ emptyText: 'No incidents assigned to your department yet' }}
            onRow={(record) => incidentTableRowClickProps(record, navigate)}
          />
        </Card>
      </div>
    </Layout>
  );
}
