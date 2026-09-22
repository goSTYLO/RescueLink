import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/presentation/components/layout/Layout';
import { Alert, Button, Card, Input, Modal, Pagination, Select, Space, Table, Tabs, Tag } from 'antd';
import { Eye, MapPin, AlertCircle, Activity, LayoutList, UserPlus, Shield, ArrowUpDown, ArrowUp, ArrowDown, Archive, ArchiveRestore, Search, HandHelping } from 'lucide-react';
import { getIncidents, acknowledgeBackupRequest, archiveIncident, unarchiveIncident } from '@/data/api/incidents.api';
import { getDepartmentById, getDepartmentUnits } from '@/data/api/departments.api';
import { getResponderTeams } from '@/data/api/responders.api';
import { createDispatch } from '@/data/api/dispatches.api';
import { inferDepartmentSectorCode, normalizeSectorCode } from '@/core/utils/departmentSector';
import { mapApiIncidentToDisplay, isIncidentActiveForDashboard, hasOpenBackupUi, getBackupDialogCapabilities, getAutoAssignmentBadge } from '@/core/utils/incidentDisplay';
import { formatDepartmentToIncidentDistance } from '@/core/utils/geoDistance';
import { VolunteerStatusBadge } from '@/presentation/components/common/VolunteerStatusBadge';
import { ResponderStatusTag } from '@/presentation/components/common/ResponderStatusTag';
import { BackupRequestedBadge } from '@/presentation/components/common/BackupRequestedBadge';
import { BackupRequestDialog } from '@/presentation/components/common/BackupRequestDialog';
import { ROLES, normalizeRole } from '@/core/constants';
import { useIncidentWebSocketStatus } from '@/presentation/context/IncidentWebSocketContext';
import { Breadcrumb } from '@/presentation/components/common/Breadcrumb';
import { alertUser } from '@/presentation/feedback/alertUser';

function mapApiIncidentToRow(api) {
  return mapApiIncidentToDisplay(api);
}

const POLLING_INTERVAL_MS = 30000;
const POLLING_WHEN_WS_CONNECTED_MS = 120000;

const ASSIGNMENTS_STORAGE_KEY = 'rescuelink_incident_personnel_assignments';

function getStoredAssignments() {
  try {
    const raw = localStorage.getItem(ASSIGNMENTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function DepartmentDashboardPage() {
  const navigate = useNavigate();
  const { isConnected: wsConnected } = useIncidentWebSocketStatus();
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const departmentId = user.departmentId || user.department_id;

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assignments, setAssignments] = useState(getStoredAssignments);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assigningIncidentId, setAssigningIncidentId] = useState(null);
  const [department, setDepartment] = useState(null);
  const [departmentSectorCode, setDepartmentSectorCode] = useState('');
  const [teams, setTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [unitsList, setUnitsList] = useState([]);
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [dashboardView, setDashboardView] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [backupDialogIncident, setBackupDialogIncident] = useState(null);
  const [acknowledgingBackup, setAcknowledgingBackup] = useState(false);
  const [archivingInProgress, setArchivingInProgress] = useState(false);
  const isVolunteerView = dashboardView === 'volunteer';
  const isArchivedView = dashboardView === 'archived';
  const normalizedRole = normalizeRole(user.role);
  const isAuthorizedRole = normalizedRole === ROLES.DEPARTMENT_ADMIN || normalizedRole === ROLES.DEPARTMENT_HEAD || normalizedRole === ROLES.PERSONNEL || normalizedRole === ROLES.SUPER_ADMIN;

  const fetchIncidents = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const result = await getIncidents({
        limit: 100,
        offset: 0,
        archived: isArchivedView,
        volunteer_accepted: isVolunteerView,
        search: searchQuery.trim() || undefined,
        withMeta: false,
      });
      const list = Array.isArray(result) ? result : (result?.items || []);
      setIncidents(list.map(mapApiIncidentToRow));
    } catch (err) {
      setError(err.message || 'Failed to load incidents');
      setIncidents([]);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [isArchivedView, isVolunteerView, searchQuery]);

  useEffect(() => {
    if (!isAuthorizedRole) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthorizedRole, navigate]);

  const refetchTeamsAndUnits = useCallback((isSilent = false) => {
    if (!isAuthorizedRole) return;
    if (!isSilent) setTeamsLoading(true);
    getResponderTeams({ limit: 200 })
      .then((list) => {
        const arr = Array.isArray(list) ? list : [];
        if (departmentSectorCode) {
          const filtered = arr.filter((t) => normalizeSectorCode(t.department_code) === departmentSectorCode);
          setTeams(filtered);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!isSilent) setTeamsLoading(false);
      });
    if (departmentId) {
      getDepartmentUnits(departmentId)
        .then((rows) => {
          const list = (Array.isArray(rows) ? rows : []).map((u) => ({
            id: u.unit_id,
            name: u.name,
            type: u.type,
            status: u.status || 'Available',
          }));
          setUnitsList(list);
        })
        .catch(() => {});
    }
  }, [isAuthorizedRole, departmentId, departmentSectorCode]);

  useEffect(() => {
    if (!isAuthorizedRole) return;
    fetchIncidents(false);
    const intervalMs = wsConnected ? POLLING_WHEN_WS_CONNECTED_MS : POLLING_INTERVAL_MS;
    const intervalId = setInterval(() => fetchIncidents(true), intervalMs);
    const handleUpdated = () => {
      fetchIncidents(true);
      refetchTeamsAndUnits(true);
    };
    window.addEventListener('incident:updated', handleUpdated);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('incident:updated', handleUpdated);
    };
  }, [isAuthorizedRole, fetchIncidents, wsConnected, refetchTeamsAndUnits]);

  useEffect(() => {
    if (!departmentId || !isAuthorizedRole) return;
    let cancelled = false;
    getDepartmentById(departmentId)
      .then((dept) => {
        if (!cancelled && dept) {
          setDepartment(dept);
          setDepartmentSectorCode(inferDepartmentSectorCode(dept));
        }
      })
      .catch(() => {
        if (!cancelled) setDepartment(null);
      });
    return () => { cancelled = true; };
  }, [departmentId, isAuthorizedRole]);

  useEffect(() => {
    if (!isAuthorizedRole) return;
    setTeamsLoading(true);
    getResponderTeams({ limit: 200 })
      .then((list) => {
        const arr = Array.isArray(list) ? list : [];
        if (departmentSectorCode) {
          const filtered = arr.filter((t) => normalizeSectorCode(t.department_code) === departmentSectorCode);
          setTeams(filtered);
        } else {
          setTeams([]);
        }
      })
      .catch(() => setTeams([]))
      .finally(() => setTeamsLoading(false));
  }, [isAuthorizedRole, departmentSectorCode]);

  useEffect(() => {
    if (!departmentId || !isAuthorizedRole) return;
    let cancelled = false;
    getDepartmentUnits(departmentId)
      .then((rows) => {
        if (cancelled) return;
        const list = (Array.isArray(rows) ? rows : []).map((u) => ({
          id: u.unit_id,
          name: u.name,
          type: u.type,
          status: u.status || 'Available',
        }));
        setUnitsList(list);
      })
      .catch(() => { if (!cancelled) setUnitsList([]); });
    return () => { cancelled = true; };
  }, [departmentId, isAuthorizedRole]);

  useEffect(() => {
    try {
      localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(assignments));
    } catch (_) {}
  }, [assignments]);

  const departmentIncidents = incidents;
  const scopeIncidents = isVolunteerView
    ? departmentIncidents.filter((inc) => inc.acceptedByUserId != null)
    : departmentIncidents;
  const filteredIncidents = scopeIncidents.filter((incident) => {
    if (filterType !== 'All' && incident.emergencyType !== filterType) return false;
    if (filterStatus !== 'All' && incident.status !== filterStatus) return false;
    if (filterSeverity !== 'All' && incident.severity !== filterSeverity) return false;
    return true;
  });

  const sortedIncidents = [...filteredIncidents].sort((a, b) => {
    if (!sortColumn) return 0;
    const severityRank = { Critical: 3, Warning: 2, Low: 1 };
    const statusRank = { Pending: 4, Verified: 3, 'In Progress': 2, Resolved: 1, Closed: 0 };
    let aValue;
    let bValue;

    switch (sortColumn) {
      case 'id':
        aValue = Number(a.id) || 0;
        bValue = Number(b.id) || 0;
        break;
      case 'type':
        aValue = String(a.emergencyType || '');
        bValue = String(b.emergencyType || '');
        break;
      case 'location':
        aValue = String(a.barangay || '');
        bValue = String(b.barangay || '');
        break;
      case 'severity':
        aValue = severityRank[a.severity] ?? -1;
        bValue = severityRank[b.severity] ?? -1;
        break;
      case 'status':
        aValue = statusRank[a.status] ?? -1;
        bValue = statusRank[b.status] ?? -1;
        break;
      case 'reported':
        aValue = Date.parse(a.timeReported) || 0;
        bValue = Date.parse(b.timeReported) || 0;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sortedIncidents.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = sortedIncidents.length === 0 ? 0 : ((safePage - 1) * itemsPerPage) + 1;
  const pageEnd = Math.min(safePage * itemsPerPage, sortedIncidents.length);
  const paginatedIncidents = sortedIncidents.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const getSortIcon = (column) => {
    if (sortColumn !== column) return <ArrowUpDown className="w-4 h-4 ml-1 text-muted" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="w-4 h-4 ml-1 text-foreground" />
      : <ArrowDown className="w-4 h-4 ml-1 text-foreground" />;
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, filterStatus, filterSeverity, dashboardView]);

  const getIncidentDistance = (incident) =>
    formatDepartmentToIncidentDistance(department?.latitude, department?.longitude, incident.latitude, incident.longitude);

  const openBackupDialog = (incident) => {
    setBackupDialogIncident(incident);
    setBackupDialogOpen(true);
  };

  const handleAcknowledgeBackup = async () => {
    const incident = backupDialogIncident;
    const backupId = incident?.activeBackupRequestId;
    if (!backupId) return;
    if (String(incident?.openBackupStatus || '').toLowerCase() === 'acknowledged') {
      alertUser({
        icon: 'info',
        title: 'Already acknowledged',
        text: 'This backup request was already acknowledged. Assign an official backup team.',
      });
      return;
    }
    setAcknowledgingBackup(true);
    try {
      await acknowledgeBackupRequest(incident.id, backupId);
      setBackupDialogOpen(false);
      setBackupDialogIncident(null);
      fetchIncidents();
    } catch (err) {
      alertUser({ icon: 'error', title: 'Acknowledge failed', text: err.message || 'Could not acknowledge backup request.' });
    } finally {
      setAcknowledgingBackup(false);
    }
  };

  const handleAssignTeamBackup = () => {
    const incident = backupDialogIncident;
    if (!incident?.id) return;
    setBackupDialogOpen(false);
    setBackupDialogIncident(null);
    openAssignModal(incident.id);
  };

  const backupDialogCapabilities = getBackupDialogCapabilities(backupDialogIncident, user.role);

  const handleDispatchBackup = () => {
    const incident = backupDialogIncident;
    if (!incident?.id) return;
    setBackupDialogOpen(false);
    setBackupDialogIncident(null);
    navigate(`/incidents/${incident.id}?tab=details&focus=assign`);
  };

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const activeIncidents = departmentIncidents.filter((i) => isIncidentActiveForDashboard(i));

  const getAssignment = useCallback((incident) => {
    if (incident?.assignedTeamName) {
      return { teamName: incident.assignedTeamName };
    }
    return null;
  }, []);
  const isTeamAssignable = useCallback((team) => {
    const status = String(team?.team_status || 'available').trim().toLowerCase();
    return status.includes('available') || status.includes('standby');
  }, []);

  const openAssignModal = (incidentId) => {
    setAssigningIncidentId(incidentId);
    setAssignModalOpen(true);
  };

  const closeAssignModal = () => {
    setAssignModalOpen(false);
    setAssigningIncidentId(null);
  };
  const handleArchiveIncident = async (incident) => {
    if (!incident) return;
    const confirm = await alertUser({
      title: 'Archive Incident',
      html: `Move incident <strong>#${incident.id}</strong> to the archives?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#134178',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Archive',
      cancelButtonText: 'Cancel',
      customClass: { popup: 'rounded-2xl shadow-xl', title: 'text-foreground text-xl', htmlContainer: 'text-muted' },
    });
    if (!confirm.isConfirmed) return;

    setArchivingInProgress(true);
    try {
      await archiveIncident(incident.id);
      await fetchIncidents();
      window.dispatchEvent(new CustomEvent('incident:updated', { detail: { incidentId: incident.id } }));
      alertUser({
        icon: 'success',
        title: 'Archived',
        text: `Incident #${incident.id} has been moved to archives.`,
        timer: 2000,
        showConfirmButton: false,
        timerProgressBar: true,
      });
    } catch (err) {
      alertUser({
        icon: 'error',
        title: 'Archive Failed',
        text: err.message || 'Failed to archive incident.',
      });
    } finally {
      setArchivingInProgress(false);
    }
  };

  const handleUnarchiveIncident = async (incident) => {
    if (!incident) return;
    const confirm = await alertUser({
      title: 'Restore Incident',
      html: `Restore incident <strong>#${incident.id}</strong> back to the active department dashboard?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#134178',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Restore',
      cancelButtonText: 'Cancel',
      customClass: { popup: 'rounded-2xl shadow-xl', title: 'text-foreground text-xl', htmlContainer: 'text-muted' },
    });
    if (!confirm.isConfirmed) return;

    setArchivingInProgress(true);
    try {
      await unarchiveIncident(incident.id);
      await fetchIncidents();
      window.dispatchEvent(new CustomEvent('incident:updated', { detail: { incidentId: incident.id } }));
      alertUser({
        icon: 'success',
        title: 'Restored',
        text: `Incident #${incident.id} restored to active dashboard.`,
        timer: 2000,
        showConfirmButton: false,
        timerProgressBar: true,
      });
    } catch (err) {
      alertUser({
        icon: 'error',
        title: 'Restore Failed',
        text: err.message || 'Failed to restore incident.',
      });
    } finally {
      setArchivingInProgress(false);
    }
  };
  const assignTeamToIncident = useCallback(async (incidentId, team) => {
    if (!department?.code || !department?.name || !team?.team_name) return;
    if (!isTeamAssignable(team)) {
      alertUser({
        icon: 'warning',
        title: 'Team unavailable',
        text: 'Only available or standby teams can be assigned.',
        confirmButtonColor: '#134178',
      });
      return;
    }
    const reportId = Number(incidentId);
    if (!Number.isFinite(reportId)) return;
    try {
      await createDispatch({
        report_id: reportId,
        department_code: department.code,
        department_name: department.name,
        team_name: team.team_name,
        response_status: 'assigned',
      });
      setAssignments((prev) => ({ ...prev, [incidentId]: { teamName: team.team_name, departmentName: department.name } }));
      setAssignModalOpen(false);
      setAssigningIncidentId(null);
      await fetchIncidents();
      window.dispatchEvent(new CustomEvent('incident:updated', { detail: { incidentId } }));
      alertUser({
        icon: 'success',
        title: 'Team assigned',
        html: `Team <strong>${team.team_name}</strong> has been assigned to incident <strong>${incidentId}</strong>. Available members are assigned by the system.`,
        timer: 2500,
        showConfirmButton: false,
        timerProgressBar: true,
        customClass: { popup: 'rounded-2xl shadow-xl' },
      });
    } catch (err) {
      alertUser({
        icon: 'error',
        title: 'Assignment failed',
        text: err.message || 'Could not assign team. Try again.',
        customClass: { popup: 'rounded-2xl shadow-xl' },
      });
    }
  }, [department, fetchIncidents, isTeamAssignable]);


  const severityTagColor = (severity) => {
    switch (String(severity).toLowerCase()) {
      case 'critical': return 'red';
      case 'warning': return 'gold';
      case 'resolved':
      case 'low': return 'green';
      default: return 'default';
    }
  };

  const statusTagColor = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'new' || s === 'pending') return 'blue';
    if (s === 'verified') return 'purple';
    if (s === 'in progress' || s === 'assigned') return 'geekblue';
    if (s === 'resolved' || s === 'closed') return 'green';
    return 'default';
  };

  const getTypeIcon = (type) => {
    const icons = { Fire: '🔥', Medical: '🏥', Police: '👮', Disaster: '⚠️', SOS: '🆘' };
    return icons[String(type)] || '📋';
  };

  const typeOptions = [
    { value: 'All', label: 'All Types' },
    { value: 'Fire', label: 'Fire' },
    { value: 'Medical', label: 'Medical' },
    { value: 'Police', label: 'Police' },
    { value: 'Disaster', label: 'Disaster' },
    { value: 'SOS', label: 'SOS' },
    { value: 'Other', label: 'Other' },
  ];

  const statusOptions = [
    { value: 'All', label: 'All Status' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Verified', label: 'Verified' },
    { value: 'In Progress', label: 'In Progress' },
    { value: 'Resolved', label: 'Resolved' },
    { value: 'Closed', label: 'Closed' },
  ];

  const severityOptions = [
    { value: 'All', label: 'All Severity' },
    { value: 'Critical', label: 'Critical' },
    { value: 'Warning', label: 'Warning' },
    { value: 'Low', label: 'Low' },
  ];

  const PAGE_SIZE_OPTIONS = [
    { value: 5, label: '5' },
    { value: 8, label: '8' },
    { value: 10, label: '10' },
    { value: 15, label: '15' },
    { value: 20, label: '20' },
  ];

  const sortTitle = (label, column) => (
    <button type="button" onClick={() => handleSort(column)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0 }}>
      {label}{getSortIcon(column)}
    </button>
  );

  const columns = [
    {
      title: sortTitle('Incident ID', 'id'),
      dataIndex: 'id',
      render: (id) => (
        <Button type="link" onClick={() => navigate(`/incidents/${id}`)}>{id}</Button>
      ),
    },
    {
      title: sortTitle('Type', 'type'),
      key: 'type',
      render: (_, incident) => (
        <span>{getTypeIcon(incident.emergencyType)} {incident.emergencyTypesLabel || incident.emergencyType}</span>
      ),
    },
    {
      title: sortTitle('Location', 'location'),
      dataIndex: 'barangay',
      render: (barangay) => (
        <span><MapPin size={14} style={{ marginRight: 4 }} />{barangay}</span>
      ),
    },
    {
      title: sortTitle('Severity', 'severity'),
      dataIndex: 'severity',
      render: (severity) => <Tag color={severityTagColor(severity)}>{String(severity || '—')}</Tag>,
    },
    {
      title: sortTitle('Status', 'status'),
      key: 'status',
      render: (_, incident) => (
        <Space direction="vertical" size={4}>
          <Tag color={statusTagColor(incident.status)}>{incident.status || '—'}</Tag>
          <VolunteerStatusBadge responderStatus={incident.responderStatus} />
          {getAutoAssignmentBadge(incident) && (
            <Tag color="blue">{getAutoAssignmentBadge(incident).label}</Tag>
          )}
          {hasOpenBackupUi(incident) && (
            <BackupRequestedBadge
              status={incident.openBackupStatus || 'pending'}
              onClick={() => openBackupDialog(incident)}
            />
          )}
          {Number(incident.backupVolunteerCount) > 0 && (
            <Tag color="purple">{incident.backupVolunteerCount} BACKUP VOL.</Tag>
          )}
          {(incident.hasPendingEscalation || incident.has_pending_escalation) && (
            <Button
              type="link"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/incidents/${incident.id}?tab=escalation`);
              }}
              icon={<HandHelping size={12} />}
              style={{ padding: 0, height: 'auto', fontSize: 11 }}
            >
              Assistance Requested
            </Button>
          )}
          {(incident.status === 'Resolved' || incident.status === 'resolved') && !incident.reporterConfirmedAt && (
            <span style={{ fontSize: 12, color: '#d97706' }}>Awaiting confirmation</span>
          )}
        </Space>
      ),
    },
    ...(isVolunteerView ? [
      {
        title: 'Volunteer',
        key: 'volunteer',
        render: (_, incident) => (
          <Space direction="vertical" size={2}>
            <span>{incident.acceptedByName || 'Volunteer'}</span>
            {incident.acceptedByPhone && <span style={{ fontSize: 12, opacity: 0.7 }}>{incident.acceptedByPhone}</span>}
            <VolunteerStatusBadge responderStatus={incident.responderStatus} />
          </Space>
        ),
      },
      {
        title: 'Distance',
        key: 'distance',
        render: (_, incident) => (
          <span title={getIncidentDistance(incident).hint}>{getIncidentDistance(incident).label}</span>
        ),
      },
    ] : []),
    {
      title: 'Assigned To',
      key: 'assigned',
      render: (_, incident) => {
        const a = getAssignment(incident);
        return a ? (a.teamName || a.name) : '—';
      },
    },
    {
      title: sortTitle('Reported', 'reported'),
      dataIndex: 'timeReported',
      render: (v) => v || '—',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, incident) => (
        <Space>
          {(normalizedRole === ROLES.DEPARTMENT_ADMIN || normalizedRole === ROLES.DEPARTMENT_HEAD) && !isArchivedView && !incident.assignedTeamName && (
            <Button type="text" icon={<UserPlus size={16} />} onClick={() => openAssignModal(incident.id)} title="Assign personnel" />
          )}
          <Button type="text" icon={<Eye size={16} />} onClick={() => navigate(`/incidents/${incident.id}`)} title="View details" />
          {isArchivedView && (
            <Button type="text" disabled={archivingInProgress} icon={<ArchiveRestore size={16} />} onClick={() => handleUnarchiveIncident(incident)} title="Restore incident" />
          )}
          {!isArchivedView && (incident.status === 'Closed' || incident.status === 'closed') && !incident.isArchived && (
            <Button type="text" disabled={archivingInProgress} icon={<Archive size={16} />} onClick={() => handleArchiveIncident(incident)} title="Archive incident" />
          )}
        </Space>
      ),
    },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Breadcrumb items={[{ label: 'Home', path: '/department/dashboard' }, { label: 'Department Dashboard' }]} />

        <Card size="small" title={(
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Activity size={18} />
            Incident Overview
          </span>
        )} extra={<Tag color="blue">{departmentIncidents.length} total</Tag>}>
          <p style={{ marginBottom: 12 }}>{user.department || 'Department'} — Assigned Incidents</p>

          {activeIncidents.length > 0 && !loading && (
            <Alert
              type="warning"
              showIcon
              icon={<AlertCircle size={16} />}
              message={<span><strong>{activeIncidents.length} active incident{activeIncidents.length !== 1 ? 's' : ''}</strong> requiring response.</span>}
              style={{ marginBottom: 12 }}
            />
          )}

          {departmentIncidents.some((i) => i.hasPendingEscalation) && !loading && (
            <Alert
              type="warning"
              showIcon
              icon={<HandHelping size={16} />}
              message={(
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span>
                    <strong>
                      {departmentIncidents.filter((i) => i.hasPendingEscalation).length} inter-department assistance request{departmentIncidents.filter((i) => i.hasPendingEscalation).length !== 1 ? 's' : ''}
                    </strong>{' '}
                    awaiting response.
                  </span>
                  {departmentIncidents.find((i) => i.hasPendingEscalation) && (
                    <Button
                      onClick={() => {
                        const first = departmentIncidents.find((i) => i.hasPendingEscalation);
                        if (first) navigate(`/incidents/${first.id}?tab=escalation`);
                      }}
                      icon={<Eye size={14} />}
                    >
                      Review Assistance
                    </Button>
                  )}
                </div>
              )}
              style={{ marginBottom: 12 }}
            />
          )}

          <Space wrap size="middle">
            <Card size="small" style={{ minWidth: 120 }}>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Total Assigned</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{departmentIncidents.length}</div>
            </Card>
            <Card size="small" style={{ minWidth: 120 }}>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Awaiting Action</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{departmentIncidents.filter((i) => i.status === 'Verified' || i.status === 'verified' || i.status === 'New').length}</div>
            </Card>
            <Card size="small" style={{ minWidth: 120 }}>
              <div style={{ fontSize: 11, opacity: 0.7 }}>In Progress</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{departmentIncidents.filter((i) => i.status === 'In Progress' || i.status === 'in-progress').length}</div>
            </Card>
            <Card size="small" style={{ minWidth: 120 }}>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Resolved</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{departmentIncidents.filter((i) => i.status === 'Resolved' || i.status === 'resolved').length}</div>
            </Card>
          </Space>
        </Card>

        {error && (
          <Alert
            type="warning"
            showIcon
            message={error}
            action={<Button onClick={() => fetchIncidents()}>Retry</Button>}
            style={{ marginBottom: 12 }}
          />
        )}

        <Card
          size="small"
          title={(
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <LayoutList size={16} />
              {isVolunteerView ? 'Volunteer Response' : isArchivedView ? 'Archived Incidents' : 'Assigned Incidents'}
              <Tag>{filteredIncidents.length}</Tag>
            </span>
          )}
          extra={(
            <Tabs
              activeKey={dashboardView}
              onChange={setDashboardView}
              size="small"
              items={[
                { key: 'all', label: 'All Incidents' },
                { key: 'volunteer', label: 'Volunteer Response' },
                { key: 'archived', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Archive size={12} />Archived</span> },
              ]}
            />
          )}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
            <Space wrap>
              <span style={{ fontSize: 12, opacity: 0.7 }}>Rows</span>
              <Select
                value={itemsPerPage}
                onChange={(value) => { setItemsPerPage(Number(value)); setCurrentPage(1); }}
                options={PAGE_SIZE_OPTIONS}
                style={{ width: 84 }}
              />
              <span style={{ fontSize: 12, opacity: 0.7 }}>Showing {pageStart}-{pageEnd} of {filteredIncidents.length}</span>
            </Space>
            <Pagination
              current={safePage}
              total={sortedIncidents.length}
              pageSize={itemsPerPage}
              onChange={setCurrentPage}
              showSizeChanger={false}
              size="small"
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 8, width: '100%', maxWidth: 480 }}>
              <Input
                prefix={<Search size={14} />}
                placeholder="Search ID, barangay..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                style={{ width: '100%' }}
                allowClear
              />
            </div>
            <Space wrap>
              <div>
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Type</div>
                <Select value={filterType} onChange={setFilterType} options={typeOptions} style={{ minWidth: 140 }} />
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Status</div>
                <Select value={filterStatus} onChange={setFilterStatus} options={statusOptions} style={{ minWidth: 140 }} />
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Severity</div>
                <Select value={filterSeverity} onChange={setFilterSeverity} options={severityOptions} style={{ minWidth: 140 }} />
              </div>
            </Space>
          </div>

          <Table
            size="small"
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={paginatedIncidents}
            pagination={false}
            locale={{
              emptyText: isVolunteerView
                ? 'No volunteers have accepted an incident yet.'
                : 'No incidents match the current filters.',
            }}
          />
        </Card>

        {!loading && !error && filteredIncidents.length === 0 && (
          <p style={{ textAlign: 'center', padding: 48, opacity: 0.7 }}>No incidents assigned to your department yet</p>
        )}

        <BackupRequestDialog
          open={backupDialogOpen}
          onOpenChange={setBackupDialogOpen}
          incidentId={backupDialogIncident?.id}
          onAcknowledge={handleAcknowledgeBackup}
          onDispatch={handleDispatchBackup}
          onAssignTeam={handleAssignTeamBackup}
          acknowledging={acknowledgingBackup}
          target={backupDialogIncident?.pendingBackupTarget}
          broadcastCount={backupDialogIncident?.pendingBackupBroadcastCount}
          backupVolunteers={backupDialogIncident?.backupVolunteers || []}
          openBackupStatus={backupDialogIncident?.openBackupStatus || 'pending'}
          canAcknowledge={backupDialogCapabilities.canAcknowledge}
          canNotifyDepartment={backupDialogCapabilities.canNotifyDepartment}
          canAssignTeam={backupDialogCapabilities.canAssignTeam}
        />

        <Modal
          open={assignModalOpen}
          title="Assign personnel"
          onCancel={closeAssignModal}
          footer={null}
          destroyOnClose
        >
          <p style={{ marginBottom: 12, opacity: 0.7, fontSize: 13 }}>
            {assigningIncidentId
              ? `Assign a response team to incident ${assigningIncidentId}. The selected team's available members will be assigned by the system.`
              : 'Assign a response team to this incident.'}
          </p>
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {teamsLoading && <p style={{ textAlign: 'center', opacity: 0.7 }}>Loading teams…</p>}
            {!teamsLoading && teams.map((team) => {
              const assignable = isTeamAssignable(team);
              return (
                <Button
                  key={team.team_id}
                  block
                  disabled={!assignable}
                  onClick={() => assignTeamToIncident(assigningIncidentId, team)}
                  style={{ height: 'auto', marginBottom: 8, textAlign: 'left', padding: '12px 16px' }}
                >
                  <Space>
                    <Shield size={18} />
                    <div>
                      <div style={{ fontWeight: 600 }}>{team.team_name}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {String(team.department_code || '').toUpperCase()} · <ResponderStatusTag status={team.team_status}>{String(team.team_status || 'available').toLowerCase()}</ResponderStatusTag>
                      </div>
                    </div>
                    {!assignable && <Tag color="gold">Unavailable</Tag>}
                    {Array.isArray(team.supported_incident_types) && team.supported_incident_types.length > 0 && (
                      <Tag>{team.supported_incident_types.slice(0, 2).join(', ')}</Tag>
                    )}
                  </Space>
                </Button>
              );
            })}
            {!teamsLoading && teams.length === 0 && (
              <p style={{ textAlign: 'center', opacity: 0.7, padding: 24 }}>No teams in this department. Create teams in the Personnel page first.</p>
            )}
          </div>
        </Modal>
      </div>
    </Layout>
  );
}
