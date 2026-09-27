import { Layout } from '@/presentation/components/layout/Layout';
import { Alert, Button, Card, Checkbox, Select, Switch, Table, Tabs, Tag } from 'antd';
import {
  Shield,
  AlertTriangle,
  Merge,
  Users,
  TrendingUp,
  FileText,
  Copy,
  CheckCircle,
  XCircle,
  AlertOctagon,
  MapPin,
  Settings,
  ListChecks,
} from 'lucide-react';
import { incidents, barangays, disasterControlMode } from '@/data/mock/mockData';
import { getAdminLogs } from '@/data/api/auditLog.api';
import { ROLES, normalizeRole } from '@/core/constants';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { alertUser } from '@/presentation/feedback/alertUser';
import { AccessDeniedNotice } from '@/presentation/components/common/AccessDeniedNotice';
import { Breadcrumb } from '@/presentation/components/common/Breadcrumb';

export function AdminActionsPage() {
  const navigate = useNavigate();
  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
  const isAdmin = normalizeRole(currentUser.role) === ROLES.SUPER_ADMIN;

  const [disasterMode, setDisasterMode] = useState(disasterControlMode.active);
  const [disasterType, setDisasterType] = useState('');
  const [selectedBarangays, setSelectedBarangays] = useState([]);
  const [autoEscalate, setAutoEscalate] = useState(false);
  const [filterAction, setFilterAction] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [adminLogs, setAdminLogs] = useState([]);
  const [adminLogsLoading, setAdminLogsLoading] = useState(true);
  const [adminLogsError, setAdminLogsError] = useState(null);

  const fetchAdminLogs = useCallback(async () => {
    setAdminLogsLoading(true);
    setAdminLogsError(null);
    try {
      const data = await getAdminLogs({
        limit: 100,
        offset: 0,
        action: filterAction !== 'all' ? filterAction : undefined,
      });
      setAdminLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      setAdminLogsError(err.message || 'Failed to load admin logs');
      setAdminLogs([]);
    } finally {
      setAdminLogsLoading(false);
    }
  }, [filterAction]);

  useEffect(() => {
    fetchAdminLogs();
  }, [fetchAdminLogs]);

  const duplicateIncidents = incidents.filter((inc) =>
    inc.status === 'Duplicate' || (inc.possibleDuplicates && inc.possibleDuplicates.length > 0)
  );

  const filteredLogs = adminLogs.filter((log) => {
    const actionMatch = filterAction === 'all' || log.action === filterAction;
    const adminLabel = log.user_email || [log.user_first_name, log.user_last_name].filter(Boolean).join(' ') || `User #${log.user_id}`;
    const userMatch = filterUser === 'all' || adminLabel === filterUser;
    return actionMatch && userMatch;
  });

  const handleActivateDisasterMode = () => {
    if (!disasterType) {
      alertUser({
        icon: 'warning',
        title: 'Select Disaster Type',
        text: 'Please select a disaster type (e.g., Typhoon, Flood) before activating emergency protocols.',
        confirmButtonColor: '#134178',
      });
      return;
    }
    if (selectedBarangays.length === 0) {
      alertUser({
        icon: 'warning',
        title: 'Select Affected Areas',
        text: 'Please select at least one affected barangay to enable Disaster Control Mode.',
        confirmButtonColor: '#134178',
      });
      return;
    }
    setDisasterMode(true);
    const autoEscalateNote = autoEscalate ? '<br><strong>Auto-escalation:</strong> New incidents will automatically be set to Warning.' : '';
    alertUser({
      icon: 'success',
      title: 'Disaster Control Mode Activated',
      html: `Emergency protocols are now active for <strong>${disasterType}</strong>.<br><br>
             <strong>Affected barangays:</strong> ${selectedBarangays.join(', ')}${autoEscalateNote}`,
      confirmButtonColor: '#134178',
      confirmButtonText: 'Understood',
    });
  };

  const handleDeactivateDisasterMode = () => {
    alertUser({
      title: 'Deactivate Disaster Control Mode?',
      text: 'This will revert to normal operating procedures. Emergency protocols will be disabled.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, deactivate',
      cancelButtonText: 'Cancel',
    }).then((result) => {
      if (result.isConfirmed) {
        setDisasterMode(false);
        setDisasterType('');
        setSelectedBarangays([]);
        setAutoEscalate(false);
        alertUser({
          icon: 'success',
          title: 'Deactivated',
          text: 'Disaster Control Mode has been turned off. Normal operations resumed.',
          timer: 2000,
          showConfirmButton: false,
          timerProgressBar: true,
        });
      }
    });
  };

  if (!isAdmin) {
    return <AccessDeniedNotice message="This page is only accessible to administrators." redirectPath="/dashboard" />;
  }

  const disasterTypeOptions = [
    { value: 'Typhoon', label: 'Typhoon' },
    { value: 'Flood', label: 'Flood' },
    { value: 'Earthquake', label: 'Earthquake' },
    { value: 'Fire - Multiple Locations', label: 'Fire - Multiple Locations' },
    { value: 'Other Mass Emergency', label: 'Other Mass Emergency' },
  ];

  const actionFilterOptions = [
    { value: 'all', label: 'All Actions' },
    { value: 'user_create', label: 'User created' },
    { value: 'user_role_update', label: 'Role change' },
    { value: 'user_deactivate', label: 'User deactivated' },
    { value: 'user_delete', label: 'User deleted' },
    { value: 'user_read', label: 'User read' },
    { value: 'users_list', label: 'Users list' },
    { value: 'stats_view', label: 'Stats view' },
  ];

  function formatActionLabel(action) {
    const opt = actionFilterOptions.find((o) => o.value === action);
    return opt ? opt.label : (action || '—').replace(/_/g, ' ');
  }

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

  function formatDetailsForDisplay(details) {
    if (details == null) return '—';
    const parsed = typeof details === 'object' ? details : (typeof details === 'string' && details.trim().startsWith('{') ? (() => { try { return JSON.parse(details); } catch { return null; } })() : null);
    if (!parsed || typeof parsed !== 'object') return details != null ? String(details) : '—';
    const entries = Object.entries(parsed).filter(([, v]) => v != null && v !== '');
    return entries.length > 0 ? entries.map(([k, v]) => `${k}: ${v}`).join(', ') : '—';
  }

  const severityColor = (severity) => {
    if (severity === 'Critical') return 'red';
    if (severity === 'Warning') return 'gold';
    return 'green';
  };

  const logActionIcon = (action) => {
    if (['user_role_update', 'user_deactivate', 'user_delete'].includes(action)) return <Shield size={14} />;
    if (action === 'user_create') return <Users size={14} />;
    if (action === 'stats_view') return <TrendingUp size={14} />;
    return <FileText size={14} />;
  };

  const logColumns = [
    {
      title: 'Action',
      dataIndex: 'action',
      render: (action) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {logActionIcon(action)}
          <Tag color="blue">{formatActionLabel(action)}</Tag>
        </span>
      ),
    },
    {
      title: 'Admin',
      key: 'admin',
      render: (_, log) => log.user_email || [log.user_first_name, log.user_last_name].filter(Boolean).join(' ') || `User #${log.user_id}`,
    },
    {
      title: 'Details',
      key: 'details',
      render: (_, log) => {
        const details = typeof log.details === 'object' ? log.details : (typeof log.details === 'string' && log.details.trim().startsWith('{') ? (() => { try { return JSON.parse(log.details); } catch { return {}; } })() : {});
        return (
          <div>
            <div>{formatDetailsForDisplay(log.details)}</div>
            {details?.reason && <div style={{ opacity: 0.7, fontSize: 12 }}>Reason: {details.reason}</div>}
          </div>
        );
      },
    },
    {
      title: 'When',
      dataIndex: 'created_at',
      render: (ts) => formatTimestamp(ts),
    },
    {
      title: '',
      key: 'link',
      render: (_, log) => {
        const details = typeof log.details === 'object' ? log.details : (typeof log.details === 'string' && log.details.trim().startsWith('{') ? (() => { try { return JSON.parse(log.details); } catch { return {}; } })() : {});
        const incidentId = log.resource_id ?? details?.report_id ?? details?.incident_id ?? details?.user_id;
        if (incidentId && log.resource_type === 'incident') {
          return <Button type="link" onClick={() => navigate(`/incidents/${incidentId}`)}>View Incident {incidentId} →</Button>;
        }
        if (incidentId && log.resource_type === 'user') {
          return <Button type="link" onClick={() => navigate('/admin/users')}>View user #{incidentId} →</Button>;
        }
        return null;
      },
    },
  ];

  const duplicateColumns = [
    {
      title: 'Incident',
      key: 'id',
      render: (_, incident) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Copy size={14} />
          {incident.id}
          {incident.status === 'Duplicate' && <Tag>Marked as Duplicate</Tag>}
        </span>
      ),
    },
    {
      title: 'Type / Location',
      key: 'meta',
      render: (_, incident) => `${incident.emergencyType} — ${incident.barangay}`,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      render: (severity) => <Tag color={severityColor(severity)}>{severity}</Tag>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      ellipsis: true,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, incident) => (
        <Button onClick={() => navigate(`/incidents/${incident.id}`)}>View Details</Button>
      ),
    },
  ];

  // Disaster Control tab content kept behind false for parity with prior UI
  const disasterTabChildren = (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
      <Card
        size="small"
        title={(
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <AlertOctagon size={16} />
            Disaster Control Mode
          </span>
        )}
      >
        {!disasterMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Alert
              type="warning"
              showIcon
              icon={<AlertTriangle size={16} />}
              message="What is Disaster Control Mode?"
              description="This mode enables emergency protocols for large-scale disasters like typhoons and floods."
            />
            <div>
              <div style={{ marginBottom: 4, fontWeight: 500 }}>Disaster Type</div>
              <Select
                style={{ width: '100%' }}
                placeholder="Select disaster type"
                value={disasterType || undefined}
                onChange={setDisasterType}
                options={disasterTypeOptions}
              />
            </div>
            <div>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>Affected Barangays ({selectedBarangays.length} selected)</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <Button onClick={() => setSelectedBarangays(barangays)}>Select All Barangays</Button>
                <Button onClick={() => setSelectedBarangays([])}>Unselect All Barangays</Button>
              </div>
              <Checkbox.Group
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}
                options={barangays.map((b) => ({ label: b, value: b }))}
                value={selectedBarangays}
                onChange={setSelectedBarangays}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 500 }}>Auto-escalate to Warning</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>All new incidents automatically set to Warning severity</div>
              </div>
              <Switch checked={autoEscalate} onChange={setAutoEscalate} />
            </div>
            <Button type="primary" danger icon={<AlertOctagon size={14} />} onClick={handleActivateDisasterMode} block>
              Activate Disaster Control Mode
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Alert
              type="error"
              showIcon
              icon={<AlertOctagon size={16} />}
              message="Disaster Mode Active"
              description={(
                <>
                  <strong>Type:</strong> {disasterType}<br />
                  <strong>Affected Areas:</strong> {selectedBarangays.length} barangays<br />
                  <strong>Auto-escalation:</strong> {autoEscalate ? 'Enabled' : 'Disabled'}
                </>
              )}
            />
            <Button type="primary" icon={<Users size={14} />} onClick={() => alert('Bulk assignment interface would open here')} block>
              Bulk Incident Assignment
            </Button>
            <Button icon={<MapPin size={14} />} onClick={() => navigate('/map')} block>
              View Affected Areas on Map
            </Button>
            <Button danger icon={<XCircle size={14} />} onClick={handleDeactivateDisasterMode} block>
              Deactivate Disaster Mode
            </Button>
          </div>
        )}
      </Card>
      <Card
        size="small"
        title={(
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Settings size={16} />
            Disaster Mode Features
          </span>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {['Bulk incident assignment by barangay', 'Automatic severity escalation', 'Priority override controls'].map((text) => (
            <div key={text} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <CheckCircle size={16} />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  return (
    <Layout>
      <div className="p-4 md:p-6">
        <Breadcrumb items={[{ label: 'Home', path: '/dashboard' }, { label: 'Admin Actions' }]} />
        <Card
          size="small"
          style={{ marginTop: 12, marginBottom: 12 }}
          title={(
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Shield size={18} />
              Admin Actions
            </span>
          )}
        >
          <p style={{ margin: 0, opacity: 0.75 }}>Advanced administrative controls and oversight</p>
        </Card>

        {disasterMode && (
          <Alert
            type="error"
            showIcon
            icon={<AlertOctagon size={18} />}
            style={{ marginBottom: 12 }}
            message="Disaster Control Mode Active"
            description="Enhanced emergency protocols are currently in effect. Normal operating procedures are overridden."
          />
        )}

        <Tabs
          defaultActiveKey="logs"
          items={[
            ...(false ? [{ key: 'disaster', label: 'Disaster Control', children: disasterTabChildren }] : []),
            {
              key: 'duplicates',
              label: 'Duplicate Management',
              children: (
                <Card
                  size="small"
                  title={(
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <Merge size={16} />
                      Duplicate Incident Management
                    </span>
                  )}
                >
                  {duplicateIncidents.length > 0 ? (
                    <Table
                      size="small"
                      rowKey="id"
                      columns={duplicateColumns}
                      dataSource={duplicateIncidents}
                      pagination={false}
                    />
                  ) : (
                    <div style={{ textAlign: 'center', padding: 32 }}>
                      <CheckCircle size={28} style={{ marginBottom: 8 }} />
                      <p style={{ opacity: 0.7 }}>No duplicate incidents detected</p>
                    </div>
                  )}
                </Card>
              ),
            },
            {
              key: 'logs',
              label: 'Admin Logs',
              children: (
                <Card
                  size="small"
                  title={(
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <ListChecks size={16} />
                      Admin Action Logs
                    </span>
                  )}
                  extra={(
                    <Select
                      style={{ width: 200 }}
                      value={filterAction}
                      onChange={setFilterAction}
                      options={actionFilterOptions}
                    />
                  )}
                >
                  {adminLogsError && (
                    <Alert type="error" showIcon message={adminLogsError} style={{ marginBottom: 12 }} />
                  )}
                  <Table
                    size="small"
                    rowKey="id"
                    loading={adminLogsLoading}
                    columns={logColumns}
                    dataSource={filteredLogs}
                    pagination={false}
                    locale={{ emptyText: 'No admin actions match the current filters' }}
                  />
                </Card>
              ),
            },
          ]}
        />
      </div>
    </Layout>
  );
}
