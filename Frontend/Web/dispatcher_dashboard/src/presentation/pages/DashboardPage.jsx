import { Layout } from '@/presentation/components/layout/Layout';
import { Alert, Button, Card, Input, Modal, Pagination, Select, Space, Switch, Table, Tabs, Tag } from 'antd';
import { Activity, ArrowUpDown, ArrowUp, ArrowDown, LayoutList, CircleCheck, ExternalLink, Merge, Archive, ArchiveRestore, Search } from 'lucide-react';
import { incidents as mockIncidents, barangays } from '@/data/mock/mockData';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getIncidents, verifyIncident, linkDuplicate, acknowledgeBackupRequest, archiveIncident, unarchiveIncident } from '@/data/api/incidents.api';
import { getDepartmentById, getDepartments } from '@/data/api/departments.api';
import { DEV_MODE } from '@/core/config/app.config';
import { normalizeRole, ROLES } from '@/core/constants';
import { getAuthToken, getStoredUser } from '@/core/auth/session';

// Feature flag — mirrors USE_BLOCKCHAIN in Backend/.env
const USE_BLOCKCHAIN = import.meta.env.VITE_USE_BLOCKCHAIN === 'true';
import { mapIncidentTypeFilterToApi } from '@/core/utils/incidentClassification';
import { mapApiIncidentToDisplay, hasOpenBackupUi, getBackupDialogCapabilities, getAutoAssignmentBadge } from '@/core/utils/incidentDisplay';
import { formatDepartmentToIncidentDistance } from '@/core/utils/geoDistance';
import { SelectParentIncidentDialog } from '@/presentation/components/common/SelectParentIncidentDialog';
import { VolunteerStatusBadge } from '@/presentation/components/common/VolunteerStatusBadge';
import { BackupRequestedBadge } from '@/presentation/components/common/BackupRequestedBadge';
import { BackupRequestDialog } from '@/presentation/components/common/BackupRequestDialog';
import { Breadcrumb } from '@/presentation/components/common/Breadcrumb';
import { useIncidentWebSocketStatus } from '@/presentation/context/IncidentWebSocketContext';
import { alertUser } from '@/presentation/feedback/alertUser';
import { INCIDENT_ACTION_BTN_PROPS, incidentTableRowClickProps } from '@/core/utils/incidentDashboardTable';
import { countIncidentOverviewKpis } from '@/core/utils/incidentOverviewKpis';
import { IncidentOverviewKpiTags } from '@/presentation/components/dashboard/IncidentOverviewKpiTags';
import { kpiTagColor } from '@/presentation/components/insights/insightsColors';

const POLLING_INTERVAL_MS = 60000;
const POLLING_WHEN_WS_CONNECTED_MS = 120000;

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

function mapApiIncidentToDashboard(api) {
  return mapApiIncidentToDisplay(api);
}

const DASHBOARD_FILTER_STATE_KEY = 'dashboard:filters:v1';
const DASHBOARD_VOLUNTEER_FILTER_STATE_KEY = 'dashboard:filters:volunteer:v1';

function dedupeIncidentsById(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = item?.id;
    if (key == null || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

export function DashboardPage() {
  const rateLimitUntilRef = useRef(0);
  const navigate = useNavigate();
  const { isConnected: wsConnected } = useIncidentWebSocketStatus();
  const [incidents, setIncidents] = useState([]);
  const [overviewIncidents, setOverviewIncidents] = useState([]);
  const [totalIncidentsCount, setTotalIncidentsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const persistedFilterState = (() => {
    try {
      return JSON.parse(sessionStorage.getItem(DASHBOARD_FILTER_STATE_KEY) || '{}');
    } catch {
      return {};
    }
  })();
  const [filterType, setFilterType] = useState(persistedFilterState.filterType || 'All');
  const [filterStatus, setFilterStatus] = useState(persistedFilterState.filterStatus || 'All');
  const [filterSeverity, setFilterSeverity] = useState(persistedFilterState.filterSeverity || 'All');
  const [filterBarangay, setFilterBarangay] = useState(persistedFilterState.filterBarangay || 'All');
  const [hideDuplicates, setHideDuplicates] = useState(persistedFilterState.hideDuplicates === true);
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(Number(persistedFilterState.currentPage) || 1);
  const [itemsPerPage, setItemsPerPage] = useState(Number(persistedFilterState.itemsPerPage) || 5);

  // Incident finalization modal (closed + reporter-confirmed incidents)
  // Label: "Save to Blockchain" when USE_BLOCKCHAIN=true, "Create Audit Entry" when false
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyIncidentTarget, setVerifyIncidentTarget] = useState(null);
  const [verifyInProgress, setVerifyInProgress] = useState(false);
  const [dashboardView, setDashboardView] = useState(() => {
    try {
      const saved = sessionStorage.getItem('dashboard:view');
      return ['volunteer', 'archived'].includes(saved) ? saved : 'all';
    } catch {
      return 'all';
    }
  });
  const [searchQuery, setSearchQuery] = useState('');
  const volunteerFilterState = (() => {
    try {
      return JSON.parse(sessionStorage.getItem(DASHBOARD_VOLUNTEER_FILTER_STATE_KEY) || '{}');
    } catch {
      return {};
    }
  })();
  const [volunteerFilterType, setVolunteerFilterType] = useState(volunteerFilterState.filterType || 'All');
  const [volunteerFilterStatus, setVolunteerFilterStatus] = useState(volunteerFilterState.filterStatus || 'All');
  const [volunteerFilterSeverity, setVolunteerFilterSeverity] = useState(volunteerFilterState.filterSeverity || 'All');
  const [volunteerFilterBarangay, setVolunteerFilterBarangay] = useState(volunteerFilterState.filterBarangay || 'All');
  const [volunteerHideDuplicates, setVolunteerHideDuplicates] = useState(volunteerFilterState.hideDuplicates === true);
  const [volunteerCurrentPage, setVolunteerCurrentPage] = useState(Number(volunteerFilterState.currentPage) || 1);
  const [volunteerItemsPerPage, setVolunteerItemsPerPage] = useState(Number(volunteerFilterState.itemsPerPage) || 5);
  const [viewerHq, setViewerHq] = useState({ latitude: null, longitude: null, name: null });
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [backupDialogIncident, setBackupDialogIncident] = useState(null);
  const [acknowledgingBackup, setAcknowledgingBackup] = useState(false);
  const [archivingInProgress, setArchivingInProgress] = useState(false);

  const isVolunteerView = dashboardView === 'volunteer';
  const isArchivedView = dashboardView === 'archived';
  const activeFilterType = isVolunteerView ? volunteerFilterType : filterType;
  const activeFilterStatus = isVolunteerView ? volunteerFilterStatus : filterStatus;
  const activeFilterSeverity = isVolunteerView ? volunteerFilterSeverity : filterSeverity;
  const activeFilterBarangay = isVolunteerView ? volunteerFilterBarangay : filterBarangay;
  const activeHideDuplicates = isVolunteerView ? volunteerHideDuplicates : hideDuplicates;
  const activeCurrentPage = isVolunteerView ? volunteerCurrentPage : currentPage;
  const activeItemsPerPage = isVolunteerView ? volunteerItemsPerPage : itemsPerPage;

  const fetchIncidents = useCallback(async () => {
    if (Date.now() < rateLimitUntilRef.current) {
      return;
    }
    const token = getAuthToken();
    if (DEV_MODE && !token) {
      const filteredMock = mockIncidents.filter((inc) => {
        if (activeFilterType !== 'All' && inc.emergencyType !== activeFilterType) return false;
        if (activeFilterStatus !== 'All' && inc.status !== activeFilterStatus) return false;
        if (activeFilterSeverity !== 'All' && inc.severity !== activeFilterSeverity) return false;
        if (activeFilterBarangay !== 'All' && inc.barangay !== activeFilterBarangay) return false;
        if (isVolunteerView && !inc.acceptedByUserId) return false;
        return true;
      });
      const startIndex = (activeCurrentPage - 1) * activeItemsPerPage;
      const pageItems = filteredMock.slice(startIndex, startIndex + activeItemsPerPage);
      setIncidents(dedupeIncidentsById(pageItems));
      setOverviewIncidents(dedupeIncidentsById(filteredMock));
      setTotalIncidentsCount(filteredMock.length);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const apiStatus = mapStatusFilterToApi(activeFilterStatus);
      const apiSeverity = mapSeverityFilterToApi(activeFilterSeverity);
      const apiType = mapIncidentTypeFilterToApi(activeFilterType);
      const apiBarangay = activeFilterBarangay !== 'All' ? activeFilterBarangay : undefined;
      const offset = (activeCurrentPage - 1) * activeItemsPerPage;
      const result = await getIncidents({
        limit: activeItemsPerPage,
        offset,
        status: apiStatus,
        severity_level: apiSeverity,
        incident_type: apiType,
        barangay: apiBarangay,
        exclude_duplicates: activeHideDuplicates,
        volunteer_accepted: isVolunteerView,
        archived: isArchivedView,
        search: searchQuery.trim() || undefined,
        withMeta: true,
      });
      const mapped = Array.isArray(result?.items) ? result.items.map(mapApiIncidentToDashboard) : [];
      setIncidents(dedupeIncidentsById(mapped));
      setTotalIncidentsCount(Number(result?.totalCount || 0));
      try {
        const overviewResult = await getIncidents({
          limit: 100,
          offset: 0,
          status: apiStatus,
          severity_level: apiSeverity,
          incident_type: apiType,
          barangay: apiBarangay,
          exclude_duplicates: activeHideDuplicates,
          volunteer_accepted: isVolunteerView,
          archived: isArchivedView,
          search: searchQuery.trim() || undefined,
          withMeta: false,
        });
        const overviewList = Array.isArray(overviewResult) ? overviewResult : (overviewResult?.items || []);
        setOverviewIncidents(dedupeIncidentsById(overviewList.map(mapApiIncidentToDashboard)));
      } catch {
        setOverviewIncidents(dedupeIncidentsById(mapped));
      }
    } catch (err) {
      const message = err.message || 'Failed to fetch incidents';
      if (message.toLowerCase().includes('rate limited')) {
        rateLimitUntilRef.current = Date.now() + 30000;
      }
      setError(message);
      setIncidents([]);
      setOverviewIncidents([]);
      setTotalIncidentsCount(0);
    } finally {
      setLoading(false);
    }
  }, [activeCurrentPage, activeFilterBarangay, activeFilterSeverity, activeFilterStatus, activeFilterType, activeItemsPerPage, activeHideDuplicates, isVolunteerView, isArchivedView, searchQuery]);

  useEffect(() => {
    sessionStorage.setItem('dashboard:view', dashboardView);
  }, [dashboardView]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = getStoredUser();
        const deptId = user.departmentId || user.department_id;
        if (deptId) {
          const dept = await getDepartmentById(deptId);
          if (!cancelled) {
            setViewerHq({
              latitude: dept?.latitude ?? null,
              longitude: dept?.longitude ?? null,
              name: dept?.name || null,
            });
          }
          return;
        }
        const depts = await getDepartments();
        const cdrrmo = (Array.isArray(depts) ? depts : []).find(
          (d) => String(d.code || '').toLowerCase() === 'drrmo'
        );
        if (!cancelled) {
          setViewerHq({
            latitude: cdrrmo?.latitude ?? null,
            longitude: cdrrmo?.longitude ?? null,
            name: cdrrmo?.name || 'CDRRMO',
          });
        }
      } catch {
        if (!cancelled) setViewerHq({ latitude: null, longitude: null, name: null });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    fetchIncidents();
    const intervalMs = wsConnected ? POLLING_WHEN_WS_CONNECTED_MS : POLLING_INTERVAL_MS;
    const intervalId = setInterval(fetchIncidents, intervalMs);
    const handleIncidentUpdated = () => fetchIncidents();
    window.addEventListener('incident:updated', handleIncidentUpdated);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('incident:updated', handleIncidentUpdated);
    };
  }, [fetchIncidents, wsConnected]);

  useEffect(() => {
    sessionStorage.setItem(DASHBOARD_FILTER_STATE_KEY, JSON.stringify({
      filterType,
      filterStatus,
      filterSeverity,
      filterBarangay,
      currentPage,
      itemsPerPage,
      hideDuplicates,
    }));
  }, [filterType, filterStatus, filterSeverity, filterBarangay, currentPage, itemsPerPage, hideDuplicates]);

  useEffect(() => {
    sessionStorage.setItem(DASHBOARD_VOLUNTEER_FILTER_STATE_KEY, JSON.stringify({
      filterType: volunteerFilterType,
      filterStatus: volunteerFilterStatus,
      filterSeverity: volunteerFilterSeverity,
      filterBarangay: volunteerFilterBarangay,
      currentPage: volunteerCurrentPage,
      itemsPerPage: volunteerItemsPerPage,
      hideDuplicates: volunteerHideDuplicates,
    }));
  }, [volunteerFilterType, volunteerFilterStatus, volunteerFilterSeverity, volunteerFilterBarangay, volunteerCurrentPage, volunteerItemsPerPage, volunteerHideDuplicates]);

  const filteredIncidents = incidents;

  // Sorting logic
  const sortedIncidents = [...filteredIncidents].sort((a, b) => {
    if (!sortColumn) return 0;

    const severityRank = { Critical: 3, Warning: 2, Low: 1, Resolved: 0 };
    const statusRank = { Pending: 4, Verified: 3, 'In Progress': 2, Resolved: 1, Closed: 0 };
    
    let aValue, bValue;
    switch (sortColumn) {
      case 'id':
        aValue = a.id;
        bValue = b.id;
        break;
      case 'reporter':
        aValue = a.reporterName;
        bValue = b.reporterName;
        break;
      case 'barangay':
        aValue = a.barangay;
        bValue = b.barangay;
        break;
      case 'type':
        aValue = a.emergencyType;
        bValue = b.emergencyType;
        break;
      case 'severity':
        aValue = severityRank[a.severity] ?? -1;
        bValue = severityRank[b.severity] ?? -1;
        break;
      case 'status':
        aValue = statusRank[a.status] ?? -1;
        bValue = statusRank[b.status] ?? -1;
        break;
      case 'time':
        aValue = a.timeReportedTs || 0;
        bValue = b.timeReportedTs || 0;
        break;
      case 'volunteer':
        aValue = a.acceptedByName || '';
        bValue = b.acceptedByName || '';
        break;
      case 'distance': {
        const aDist = formatDepartmentToIncidentDistance(viewerHq.latitude, viewerHq.longitude, a.latitude, a.longitude).label;
        const bDist = formatDepartmentToIncidentDistance(viewerHq.latitude, viewerHq.longitude, b.latitude, b.longitude).label;
        aValue = aDist === '—' ? Infinity : parseFloat(aDist);
        bValue = bDist === '—' ? Infinity : parseFloat(bDist);
        break;
      }
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(totalIncidentsCount / activeItemsPerPage));
  const paginatedIncidents = sortedIncidents;
  const pageStart = totalIncidentsCount === 0 ? 0 : ((activeCurrentPage - 1) * activeItemsPerPage) + 1;
  const pageEnd = Math.min(activeCurrentPage * activeItemsPerPage, totalIncidentsCount);

  const setActiveCurrentPage = (value) => {
    if (isVolunteerView) {
      setVolunteerCurrentPage(typeof value === 'function' ? value(volunteerCurrentPage) : value);
    } else {
      setCurrentPage(typeof value === 'function' ? value(currentPage) : value);
    }
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setActiveCurrentPage(1);
  };

  const getSortIcon = (column) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-4 h-4 ml-1 text-muted" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 ml-1 text-foreground" />
      : <ArrowDown className="w-4 h-4 ml-1 text-foreground" />;
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, filterStatus, filterSeverity, filterBarangay]);

  useEffect(() => {
    setVolunteerCurrentPage(1);
  }, [volunteerFilterType, volunteerFilterStatus, volunteerFilterSeverity, volunteerFilterBarangay, dashboardView]);

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
        text: 'This backup request was already acknowledged. Notify a department to dispatch official units.',
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
    navigate(`/incidents/${incident.id}?tab=details&focus=assign`);
  };

  const handleDispatchBackup = () => {
    const incident = backupDialogIncident;
    if (!incident?.id) return;
    setBackupDialogOpen(false);
    setBackupDialogIncident(null);
    navigate(`/incidents/${incident.id}?tab=details&focus=dispatch`);
  };

  const getIncidentDistance = (incident) =>
    formatDepartmentToIncidentDistance(viewerHq.latitude, viewerHq.longitude, incident.latitude, incident.longitude);

  const severityTagColor = (severity) => {
    switch (severity) {
      case 'Critical': return 'red';
      case 'Warning': return 'gold';
      case 'Resolved':
      case 'Low': return 'green';
      default: return 'default';
    }
  };

  const statusTagColor = (status) => {
    switch (status) {
      case 'New':
      case 'Pending': return 'blue';
      case 'Verified': return 'green';
      case 'In Progress': return 'gold';
      case 'Resolved':
      case 'Closed': return 'green';
      case 'Duplicate': return 'default';
      default: return 'default';
    }
  };

  const getTypeEmoji = (type) => {
    const t = (type || '').toString();
    switch (t) {
      case 'Fire': return '🔥';
      case 'Medical': return '🏥';
      case 'Police': return '👮';
      case 'Disaster': return '⚠️';
      case 'SOS': return '🆘';
      default: return t ? '📋' : '';
    }
  };

  const currentUser = getStoredUser();
  const normalizedRole = normalizeRole(currentUser.role);
  const backupDialogCapabilities = getBackupDialogCapabilities(backupDialogIncident, currentUser.role);
  const canVerify = (
    normalizedRole === ROLES.SUPER_ADMIN
    || normalizedRole === ROLES.DISPATCHER
  );
  const canManageDuplicates = normalizedRole === ROLES.SUPER_ADMIN || normalizedRole === ROLES.DISPATCHER;
  const canArchive = normalizedRole === ROLES.SUPER_ADMIN || normalizedRole === ROLES.DISPATCHER;
  const [browseDuplicateDialogOpen, setBrowseDuplicateDialogOpen] = useState(false);
  const [incidentToLinkAsDuplicate, setIncidentToLinkAsDuplicate] = useState(null);
  const [linkDuplicateInProgress, setLinkDuplicateInProgress] = useState(false);

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
      html: `Restore incident <strong>#${incident.id}</strong> back to the active dashboard?`,
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

  const openVerifyModal = (incident) => {
    setVerifyIncidentTarget(incident);
    setVerifyModalOpen(true);
  };

  const closeVerifyModal = () => {
    setVerifyModalOpen(false);
    setVerifyIncidentTarget(null);
  };

  const submitVerifyOnly = async () => {
    if (!verifyIncidentTarget) return;
    const confirm = await alertUser({
      title: USE_BLOCKCHAIN ? 'Save to blockchain' : 'Create audit entry',
      html: USE_BLOCKCHAIN
        ? `Save incident <strong>${verifyIncidentTarget.id}</strong> to the blockchain?`
        : `Create an audit log entry for incident <strong>${verifyIncidentTarget.id}</strong>?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#134178',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Save',
      cancelButtonText: 'Cancel',
      customClass: { popup: 'rounded-2xl shadow-xl', title: 'text-foreground text-xl', htmlContainer: 'text-muted' },
    });

    if (!confirm.isConfirmed) return;

    setVerifyInProgress(true);
    try {
      const numericId = /^\d+$/.test(String(verifyIncidentTarget.id));
      const token = getAuthToken();
      if (numericId && token) {
        await verifyIncident(verifyIncidentTarget.id);
      }

      closeVerifyModal();
      await fetchIncidents();
      window.dispatchEvent(new CustomEvent('incident:updated', { detail: { incidentId: verifyIncidentTarget.id } }));
      alertUser({
        icon: 'success',
        title: USE_BLOCKCHAIN ? 'Saved to blockchain' : 'Audit entry created',
        text: USE_BLOCKCHAIN
          ? 'Incident has been saved to the blockchain.'
          : 'Audit log entry has been created for this incident.',
        timer: 2500,
        showConfirmButton: false,
        timerProgressBar: true,
        customClass: { popup: 'rounded-2xl shadow-xl' },
      });
    } catch (err) {
      await alertUser({
        icon: 'error',
        title: USE_BLOCKCHAIN ? 'Save failed' : 'Audit entry failed',
        text: err.message || (USE_BLOCKCHAIN ? 'Unable to save incident to blockchain.' : 'Unable to create audit log entry.'),
        confirmButtonColor: '#134178',
      });
    } finally {
      setVerifyInProgress(false);
    }
  };

  const criticalIncidents = overviewIncidents.filter((i) => i.severity === 'Critical');
  const overviewKpiCounts = useMemo(
    () => countIncidentOverviewKpis(overviewIncidents, { totalOverride: totalIncidentsCount }),
    [overviewIncidents, totalIncidentsCount],
  );

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

  const barangayOptions = [
    { value: 'All', label: 'All Barangays' },
    ...barangays.map(b => ({ value: b, label: b })),
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
      render: (id) => <span style={{ fontFamily: 'monospace' }}>{id}</span>,
    },
    {
      title: sortTitle('Reporter', 'reporter'),
      dataIndex: 'reporterName',
    },
    {
      title: sortTitle('Barangay', 'barangay'),
      dataIndex: 'barangay',
    },
    {
      title: sortTitle('Type', 'type'),
      key: 'type',
      render: (_, incident) => (
        <span>
          <span style={{ marginRight: 4 }}>{getTypeEmoji(incident.emergencyType)}</span>
          {incident.emergencyTypesLabel || incident.emergencyType}
        </span>
      ),
    },
    {
      title: sortTitle('Severity', 'severity'),
      dataIndex: 'severity',
      render: (severity) => (
        <Tag color={severityTagColor(severity)}>{(severity || '—').toString().toUpperCase()}</Tag>
      ),
    },
    {
      title: sortTitle('Status', 'status'),
      key: 'status',
      render: (_, incident) => (
        <Space direction="vertical" size={4}>
          <Tag color={statusTagColor(incident.status)}>{(incident.status || '—').toString().toUpperCase()}</Tag>
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
          {incident.status === 'Resolved' && (
            <span style={{ fontSize: 10, opacity: 0.7 }}>
              {incident.reporterConfirmedAt ? 'Reporter confirmed' : 'Awaiting confirmation'}
            </span>
          )}
          {incident.isDuplicate && <Tag>DUPLICATE</Tag>}
          {!incident.isDuplicate && incident.flaggedForReview && <Tag color="orange">POSSIBLE DUPLICATE</Tag>}
        </Space>
      ),
    },
    ...(isVolunteerView ? [
      {
        title: sortTitle('Volunteer', 'volunteer'),
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
        title: sortTitle('Distance', 'distance'),
        key: 'distance',
        render: (_, incident) => (
          <span title={getIncidentDistance(incident).hint}>{getIncidentDistance(incident).label}</span>
        ),
      },
    ] : []),
    {
      title: sortTitle('Time Reported', 'time'),
      dataIndex: 'timeReported',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 240,
      render: (_, incident) => (
        <Space size={4} wrap={false}>
          <Button
            {...INCIDENT_ACTION_BTN_PROPS}
            color="primary"
            variant="solid"
            icon={<ExternalLink size={12} />}
            onClick={(e) => { e.stopPropagation(); navigate(`/incidents/${incident.id}`); }}
          >
            View
          </Button>
          {canVerify && incident.status === 'Closed' && Boolean(incident.reporterConfirmedAt) && (
            <Button
              {...INCIDENT_ACTION_BTN_PROPS}
              color="green"
              variant="solid"
              icon={<CircleCheck size={12} />}
              onClick={(e) => { e.stopPropagation(); openVerifyModal(incident); }}
            >
              Save
            </Button>
          )}
          {canManageDuplicates && !incident.isDuplicate && /^\d+$/.test(String(incident.id)) && !isArchivedView && (
            <Button
              {...INCIDENT_ACTION_BTN_PROPS}
              color="gold"
              variant="solid"
              icon={<Merge size={12} />}
              onClick={(e) => {
                e.stopPropagation();
                setIncidentToLinkAsDuplicate(incident);
                setBrowseDuplicateDialogOpen(true);
              }}
            >
              Duplicate
            </Button>
          )}
          {canArchive && isArchivedView && (
            <Button
              {...INCIDENT_ACTION_BTN_PROPS}
              color="cyan"
              variant="solid"
              disabled={archivingInProgress}
              icon={<ArchiveRestore size={12} />}
              onClick={(e) => { e.stopPropagation(); handleUnarchiveIncident(incident); }}
            >
              Restore
            </Button>
          )}
          {canArchive && !isArchivedView && incident.status === 'Closed' && !incident.isArchived && (
            <Button
              {...INCIDENT_ACTION_BTN_PROPS}
              color="default"
              variant="outlined"
              disabled={archivingInProgress}
              icon={<Archive size={12} />}
              onClick={(e) => { e.stopPropagation(); handleArchiveIncident(incident); }}
            >
              Archive
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Layout>
      <div className="p-2 sm:p-3 md:p-4 max-w-7xl mx-auto min-h-[calc(100dvh-96px)] flex flex-col gap-2 md:gap-3">
        <Breadcrumb items={[{ label: 'Home', path: '/dashboard' }, { label: 'Dashboard' }]} />

        <Card
          size="small"
          title={(
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Activity size={18} />
              Incident Overview
            </span>
          )}
          extra={(
            <Space wrap size={[4, 8]}>
              <IncidentOverviewKpiTags counts={overviewKpiCounts} />
              <Tag color={kpiTagColor('critical')}>Critical: {criticalIncidents.length}</Tag>
              <span style={{ fontSize: 12, opacity: 0.7 }}>Polling every 30s</span>
            </Space>
          )}
        />

        {error && (
          <Alert
            type="warning"
            showIcon
            message={error}
            action={<Button onClick={fetchIncidents}>Retry</Button>}
          />
        )}

        <Card
          size="small"
          style={{ flex: 1 }}
          title={(
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <LayoutList size={16} />
              {isVolunteerView ? 'Volunteer Response' : isArchivedView ? 'Archived Incidents' : 'Incident List'}
              <Tag>{totalIncidentsCount}</Tag>
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
                value={activeItemsPerPage}
                onChange={(value) => {
                  const n = Number(value);
                  if (isVolunteerView) { setVolunteerItemsPerPage(n); setVolunteerCurrentPage(1); }
                  else { setItemsPerPage(n); setCurrentPage(1); }
                }}
                options={PAGE_SIZE_OPTIONS}
                style={{ width: 84 }}
              />
              <span style={{ fontSize: 12, opacity: 0.7 }}>Showing {pageStart}-{pageEnd} of {totalIncidentsCount}</span>
            </Space>
            <Pagination
              current={activeCurrentPage}
              total={totalIncidentsCount}
              pageSize={activeItemsPerPage}
              onChange={(page) => setActiveCurrentPage(page)}
              showSizeChanger={false}
              size="small"
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 8, width: '100%', maxWidth: 480 }}>
              <Input
                prefix={<Search size={14} />}
                placeholder="Search ID, barangay, description..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (isVolunteerView) setVolunteerCurrentPage(1);
                  else setCurrentPage(1);
                }}
                style={{ width: '100%' }}
                allowClear
              />
            </div>
            <Space wrap align="end">
              <div>
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Emergency Type</div>
                <Select
                  value={activeFilterType}
                  onChange={(v) => (isVolunteerView ? setVolunteerFilterType(v) : setFilterType(v))}
                  options={typeOptions}
                  style={{ minWidth: 140 }}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Status</div>
                <Select
                  value={activeFilterStatus}
                  onChange={(v) => (isVolunteerView ? setVolunteerFilterStatus(v) : setFilterStatus(v))}
                  options={statusOptions}
                  style={{ minWidth: 140 }}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Barangay</div>
                <Select
                  value={activeFilterBarangay}
                  onChange={(v) => (isVolunteerView ? setVolunteerFilterBarangay(v) : setFilterBarangay(v))}
                  options={barangayOptions}
                  style={{ minWidth: 160 }}
                  showSearch
                  optionFilterProp="label"
                />
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Severity</div>
                <Select
                  value={activeFilterSeverity}
                  onChange={(v) => (isVolunteerView ? setVolunteerFilterSeverity(v) : setFilterSeverity(v))}
                  options={severityOptions}
                  style={{ minWidth: 140 }}
                />
              </div>
              <Space align="center" style={{ paddingBottom: 4 }}>
                <Switch
                  checked={activeHideDuplicates}
                  onChange={(v) => (isVolunteerView ? setVolunteerHideDuplicates(v) : setHideDuplicates(v))}
                />
                <span style={{ fontSize: 12 }}>Hide duplicates</span>
              </Space>
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
            scroll={{ x: true }}
            onRow={(record) => incidentTableRowClickProps(record, navigate)}
          />
        </Card>

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
          open={verifyModalOpen}
          title={USE_BLOCKCHAIN ? 'Save Incident to Blockchain' : 'Create Audit Entry'}
          onCancel={closeVerifyModal}
          footer={(
            <Space>
              <Button type="primary" onClick={submitVerifyOnly} loading={verifyInProgress} icon={!verifyInProgress ? <CircleCheck size={14} /> : undefined}>
                {verifyInProgress ? 'Saving...' : 'Save'}
              </Button>
              <Button onClick={closeVerifyModal} disabled={verifyInProgress}>Cancel</Button>
            </Space>
          )}
          destroyOnClose
        >
          <p style={{ marginBottom: 12, opacity: 0.7 }}>
            {USE_BLOCKCHAIN
              ? 'Save this closed and reporter-confirmed incident on the blockchain for audit and authenticity.'
              : 'Create an audit log entry for this closed and reporter-confirmed incident.'}
          </p>
          {verifyIncidentTarget && (
            <Card size="small">
              <p style={{ margin: 0, fontWeight: 500 }}>{verifyIncidentTarget.id}</p>
              <p style={{ margin: '4px 0 0', opacity: 0.7 }}>
                {verifyIncidentTarget.reporterName} · {verifyIncidentTarget.emergencyType} · {verifyIncidentTarget.severity}
              </p>
              {verifyIncidentTarget.barangay && (
                <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.7 }}>{verifyIncidentTarget.barangay}</p>
              )}
            </Card>
          )}
        </Modal>

        <SelectParentIncidentDialog
          open={browseDuplicateDialogOpen}
          onOpenChange={(open) => {
            setBrowseDuplicateDialogOpen(open);
            if (!open) setIncidentToLinkAsDuplicate(null);
          }}
          currentIncidentId={incidentToLinkAsDuplicate?.id}
          loading={linkDuplicateInProgress}
          onSelect={async (parentId) => {
            if (!incidentToLinkAsDuplicate) return;
            setLinkDuplicateInProgress(true);
            try {
              await linkDuplicate(incidentToLinkAsDuplicate.id, parentId);
              setBrowseDuplicateDialogOpen(false);
              setIncidentToLinkAsDuplicate(null);
              await fetchIncidents();
              window.dispatchEvent(new CustomEvent('incident:updated', { detail: { incidentId: incidentToLinkAsDuplicate.id } }));
              alertUser({ icon: 'success', title: 'Marked as duplicate', timer: 1500, showConfirmButton: false });
            } catch (err) {
              alertUser({ icon: 'error', title: 'Failed', text: err.message || 'Could not link duplicate' });
            } finally {
              setLinkDuplicateInProgress(false);
            }
          }}
        />
      </div>
    </Layout>
  );
}
