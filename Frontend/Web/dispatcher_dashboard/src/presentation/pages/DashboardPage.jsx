import { Layout } from '@/presentation/components/layout/Layout';
import { Badge } from '@/presentation/components/ui/Badge';
import { Button } from '@/presentation/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/presentation/components/ui/Dialog';
import { Label } from '@/presentation/components/ui/Label';
import { Switch } from '@/presentation/components/ui/Switch';
import { Activity, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Loader2, SlidersHorizontal, LayoutList, CircleCheck, ExternalLink, Merge, Archive, ArchiveRestore, Search } from 'lucide-react';
import { incidents as mockIncidents, barangays } from '@/data/mock/mockData';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';
import { getIncidents, verifyIncident, linkDuplicate, acknowledgeBackupRequest, archiveIncident, unarchiveIncident } from '@/data/api/incidents.api';
import { getDepartmentById, getDepartments } from '@/data/api/departments.api';
import { DEV_MODE } from '@/core/config/app.config';
import { normalizeRole, ROLES } from '@/core/constants';

// Feature flag — mirrors USE_BLOCKCHAIN in Backend/.env
const USE_BLOCKCHAIN = import.meta.env.VITE_USE_BLOCKCHAIN === 'true';
import { mapIncidentTypeFilterToApi } from '@/core/utils/incidentClassification';
import { mapApiIncidentToDisplay, hasOpenBackupUi, getBackupDialogCapabilities, getAutoAssignmentBadge } from '@/core/utils/incidentDisplay';
import { formatDepartmentToIncidentDistance } from '@/core/utils/geoDistance';
import { SelectParentIncidentDialog } from '@/presentation/components/common/SelectParentIncidentDialog';
import { VolunteerStatusBadge } from '@/presentation/components/common/VolunteerStatusBadge';
import { BackupRequestedBadge } from '@/presentation/components/common/BackupRequestedBadge';
import { BackupRequestDialog } from '@/presentation/components/common/BackupRequestDialog';
import { Tabs, TabsList, TabsTrigger } from '@/presentation/components/ui/Tabs';
import { Breadcrumb } from '@/presentation/components/common/Breadcrumb';
import { useIncidentWebSocketStatus } from '@/presentation/context/IncidentWebSocketContext';
import Swal from 'sweetalert2';

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
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [incidents, setIncidents] = useState([]);
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
  const [selectStates, setSelectStates] = useState({
    type: false,
    status: false,
    severity: false,
    barangay: false,
  });
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(Number(persistedFilterState.currentPage) || 1);
  const [itemsPerPage, setItemsPerPage] = useState(Number(persistedFilterState.itemsPerPage) || 5);
  const [pageSizeSelectOpen, setPageSizeSelectOpen] = useState(false);

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
    const token = sessionStorage.getItem('token');
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
    } catch (err) {
      const message = err.message || 'Failed to fetch incidents';
      if (message.toLowerCase().includes('rate limited')) {
        rateLimitUntilRef.current = Date.now() + 30000;
      }
      setError(message);
      setIncidents([]);
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
        const user = JSON.parse(sessionStorage.getItem('user') || '{}');
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
      Swal.fire({
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
      Swal.fire({ icon: 'error', title: 'Acknowledge failed', text: err.message || 'Could not acknowledge backup request.' });
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

  // Severity: Critical #FF4F52, Warning amber, Resolved/Low muted green (dark theme)
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'Critical': return 'bg-primary/20 text-primary border-primary/50';
      case 'Warning': return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'Resolved':
      case 'Low': return 'bg-severity-resolved/20 text-severity-resolved border-emerald-500/40';
      default: return 'bg-card text-muted border-[rgba(19,65,120,0.35)]';
    }
  };

  // Status: workflow stage (dark theme)
  const getStatusColor = (status) => {
    switch (status) {
      case 'New':
      case 'Pending': return 'bg-secondary/30 text-secondary-light border-secondary/50';
      case 'Verified': return 'bg-severity-resolved/20 text-severity-resolved border-emerald-500/40';
      case 'In Progress': return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'Resolved': return 'bg-severity-resolved/20 text-severity-resolved border-emerald-500/40';
      case 'Closed': return 'bg-emerald-700/20 text-emerald-300 border-emerald-500/60';
      case 'Duplicate': return 'bg-card text-muted border-[rgba(19,65,120,0.35)]';
      default: return 'bg-card text-muted border-[rgba(19,65,120,0.35)]';
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

  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
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
    const confirm = await Swal.fire({
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
      Swal.fire({
        icon: 'success',
        title: 'Archived',
        text: `Incident #${incident.id} has been moved to archives.`,
        timer: 2000,
        showConfirmButton: false,
        timerProgressBar: true,
      });
    } catch (err) {
      Swal.fire({
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
    const confirm = await Swal.fire({
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
      Swal.fire({
        icon: 'success',
        title: 'Restored',
        text: `Incident #${incident.id} restored to active dashboard.`,
        timer: 2000,
        showConfirmButton: false,
        timerProgressBar: true,
      });
    } catch (err) {
      Swal.fire({
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
    const confirm = await Swal.fire({
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
      const token = sessionStorage.getItem('token');
      if (numericId && token) {
        await verifyIncident(verifyIncidentTarget.id);
      }

      closeVerifyModal();
      await fetchIncidents();
      window.dispatchEvent(new CustomEvent('incident:updated', { detail: { incidentId: verifyIncidentTarget.id } }));
      Swal.fire({
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
      await Swal.fire({
        icon: 'error',
        title: USE_BLOCKCHAIN ? 'Save failed' : 'Audit entry failed',
        text: err.message || (USE_BLOCKCHAIN ? 'Unable to save incident to blockchain.' : 'Unable to create audit log entry.'),
        confirmButtonColor: '#134178',
      });
    } finally {
      setVerifyInProgress(false);
    }
  };

  const criticalIncidents = incidents.filter((i) => i.severity === 'Critical');

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

  const heroCardClass = `rounded-3xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80 border-gray-200/80 shadow-[8px_8px_24px_rgba(209,213,219,0.5),-8px_-8px_24px_rgba(255,255,255,0.9)]' : 'glass neumorphic-dark bg-card/60 border-white/10 shadow-[8px_8px_24px_rgba(0,0,0,0.35),-6px_-6px_20px_rgba(19,65,120,0.2)]'}`;
  const heroIconClass = `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'}`;

  return (
    <Layout>
      <div className="p-2 sm:p-3 md:p-4 max-w-7xl mx-auto min-h-[calc(100dvh-96px)] flex flex-col gap-2 md:gap-3">
        <Breadcrumb items={[{ label: 'Home', path: '/dashboard' }, { label: 'Dashboard' }]} />
        <div className={heroCardClass}>
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2">
            <div className={heroIconClass}>
              <Activity className="w-5 h-5" strokeWidth={2} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
              <h1 className="text-base sm:text-lg font-semibold text-foreground mr-1 sm:mr-2">Incident Overview</h1>
              <Badge variant="outline" className="rounded-lg">Total: {totalIncidentsCount}</Badge>
              <Badge variant="outline" className="rounded-lg">Critical: {criticalIncidents.length}</Badge>
              <Badge variant="outline" className="rounded-lg">Filtered: {totalIncidentsCount}</Badge>
              <span className="text-xs text-muted">Polling every 30s</span>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-3 bg-primary/15 border-2 border-primary/50 rounded-xl flex items-center justify-between">
            <p className="text-primary font-medium">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchIncidents}>Retry</Button>
          </div>
        )}

        {/* Incidents Table – glassmorphism + neumorphism (z-0 so Filters dropdown can sit above) */}
        <Tabs value={dashboardView} onValueChange={setDashboardView} className="flex-1 min-h-0 flex flex-col">
        <div className={`relative z-0 rounded-2xl overflow-hidden border transition-all duration-300 flex-1 min-h-0 flex flex-col ${
          isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'
        }`}>
          <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b ${
            isLight ? 'border-gray-200/80 bg-gray-50/50' : 'border-white/10 bg-white/5'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'
              }`}>
                <LayoutList className="w-5 h-5" strokeWidth={2} />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {isVolunteerView ? 'Volunteer Response' : isArchivedView ? 'Archived Incidents' : 'Incident List'}
              </h3>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                isLight ? 'bg-primary/15 text-primary' : 'bg-primary/20 text-primary'
              }`}>
                {totalIncidentsCount}
              </span>
            </div>
            <TabsList className={`rounded-xl p-1 ${isLight ? 'bg-gray-100 border border-gray-200' : 'bg-white/10 border border-white/10'}`}>
              <TabsTrigger value="all" className="rounded-lg px-3 py-1.5 text-xs sm:text-sm">All Incidents</TabsTrigger>
              <TabsTrigger value="volunteer" className="rounded-lg px-3 py-1.5 text-xs sm:text-sm">Volunteer Response</TabsTrigger>
              <TabsTrigger value="archived" className="rounded-lg px-3 py-1.5 text-xs sm:text-sm flex items-center gap-1.5">
                <Archive className="w-3.5 h-3.5" />
                Archived
              </TabsTrigger>
            </TabsList>
          </div>
          <div className={`px-2 sm:px-3 py-2 border-b ${
            isLight ? 'border-gray-200/80 bg-gray-50/20' : 'border-white/10 bg-white/[0.02]'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">Rows</span>
                <Select value={String(activeItemsPerPage)} onValueChange={(value) => {
                  const n = Number(value);
                  if (isVolunteerView) { setVolunteerItemsPerPage(n); setVolunteerCurrentPage(1); }
                  else { setItemsPerPage(n); setCurrentPage(1); }
                }} open={pageSizeSelectOpen} onOpenChange={setPageSizeSelectOpen}>
                  {({ value }) => (
                    <>
                      <SelectTrigger
                        isOpen={pageSizeSelectOpen}
                        onClick={() => setPageSizeSelectOpen((o) => !o)}
                        className="h-8 w-[84px]"
                      >
                        <SelectValue value={value} options={[
                          { value: '5', label: '5' },
                          { value: '8', label: '8' },
                          { value: '10', label: '10' },
                          { value: '15', label: '15' },
                          { value: '20', label: '20' },
                        ]} />
                      </SelectTrigger>
                      <SelectContent isOpen={pageSizeSelectOpen}>
                        {['5', '8', '10', '15', '20'].map((size) => (
                          <SelectItem key={size} value={size} onSelect={(v) => {
                            const n = Number(v);
                            if (isVolunteerView) { setVolunteerItemsPerPage(n); setVolunteerCurrentPage(1); }
                            else { setItemsPerPage(n); setCurrentPage(1); }
                            setPageSizeSelectOpen(false);
                          }}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </>
                  )}
                </Select>
                <span className="text-xs text-muted sm:ml-1">Showing {pageStart}-{pageEnd} of {totalIncidentsCount}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={activeCurrentPage === 1}
                  className="h-9 w-9 p-0 rounded-lg"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (activeCurrentPage <= 3) pageNum = i + 1;
                    else if (activeCurrentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = activeCurrentPage - 2 + i;
                    return (
                      <Button
                        key={pageNum}
                        variant={activeCurrentPage === pageNum ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveCurrentPage(pageNum)}
                        className={`h-9 w-9 p-0 rounded-lg min-w-[36px] ${activeCurrentPage === pageNum ? 'bg-primary text-white hover:bg-primary-hover' : ''}`}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={activeCurrentPage === totalPages}
                  className="h-9 w-9 p-0 rounded-lg"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted ml-2">Page {activeCurrentPage} of {totalPages}</span>
              </div>
            </div>
          </div>
          <div className={`px-2 sm:px-3 py-2 border-b ${
            isLight ? 'border-gray-200/80 bg-gray-50/30' : 'border-white/10 bg-white/[0.03]'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-primary" />
                <h4 className="text-xs font-semibold text-foreground">Filters</h4>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search ID, barangay, description..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (isVolunteerView) setVolunteerCurrentPage(1);
                    else setCurrentPage(1);
                  }}
                  className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    isLight
                      ? 'bg-white border-gray-200 text-foreground placeholder-muted focus:border-primary focus:outline-none'
                      : 'bg-white/5 border-white/10 text-foreground placeholder-muted focus:border-primary focus:outline-none'
                  }`}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
              <div className="min-w-0">
                <label className="text-xs font-medium text-muted mb-1 block">Emergency Type</label>
                <Select value={activeFilterType} onValueChange={(v) => (isVolunteerView ? setVolunteerFilterType(v) : setFilterType(v))}>
                  {({ value }) => (
                    <>
                      <SelectTrigger isOpen={selectStates.type} onClick={() => setSelectStates({ ...selectStates, type: !selectStates.type })} className={`h-8 ${isLight ? 'bg-gray-50/80 border-gray-200' : 'bg-white/5 border-white/10'}`}>
                        <SelectValue placeholder="All Types" value={value} options={typeOptions} />
                      </SelectTrigger>
                      <SelectContent isOpen={selectStates.type}>
                        {typeOptions.map(option => (
                          <SelectItem key={option.value} value={option.value} onSelect={(val) => {
                            if (isVolunteerView) setVolunteerFilterType(val);
                            else setFilterType(val);
                            setSelectStates({ ...selectStates, type: false });
                          }}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </>
                  )}
                </Select>
              </div>
              <div className="min-w-0">
                <label className="text-xs font-medium text-muted mb-1 block">Status</label>
                <Select value={activeFilterStatus} onValueChange={(v) => (isVolunteerView ? setVolunteerFilterStatus(v) : setFilterStatus(v))}>
                  {({ value }) => (
                    <>
                      <SelectTrigger isOpen={selectStates.status} onClick={() => setSelectStates({ ...selectStates, status: !selectStates.status })} className={`h-8 ${isLight ? 'bg-gray-50/80 border-gray-200' : 'bg-white/5 border-white/10'}`}>
                        <SelectValue placeholder="All Status" value={value} options={statusOptions} />
                      </SelectTrigger>
                      <SelectContent isOpen={selectStates.status}>
                        {statusOptions.map(option => (
                          <SelectItem key={option.value} value={option.value} onSelect={(val) => {
                            if (isVolunteerView) setVolunteerFilterStatus(val);
                            else setFilterStatus(val);
                            setSelectStates({ ...selectStates, status: false });
                          }}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </>
                  )}
                </Select>
              </div>
              <div className="min-w-0">
                <label className="text-xs font-medium text-muted mb-1 block">Barangay</label>
                <Select value={activeFilterBarangay} onValueChange={(v) => (isVolunteerView ? setVolunteerFilterBarangay(v) : setFilterBarangay(v))}>
                  {({ value }) => (
                    <>
                      <SelectTrigger isOpen={selectStates.barangay} onClick={() => setSelectStates({ ...selectStates, barangay: !selectStates.barangay })} className={`h-8 ${isLight ? 'bg-gray-50/80 border-gray-200' : 'bg-white/5 border-white/10'}`}>
                        <SelectValue placeholder="All Barangays" value={value} options={barangayOptions} />
                      </SelectTrigger>
                      <SelectContent isOpen={selectStates.barangay} className="max-h-[300px]">
                        {barangayOptions.map(option => (
                          <SelectItem key={option.value} value={option.value} onSelect={(val) => {
                            if (isVolunteerView) setVolunteerFilterBarangay(val);
                            else setFilterBarangay(val);
                            setSelectStates({ ...selectStates, barangay: false });
                          }}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </>
                  )}
                </Select>
              </div>
              <div className="min-w-0">
                <label className="text-xs font-medium text-muted mb-1 block">Severity</label>
                <Select value={activeFilterSeverity} onValueChange={(v) => (isVolunteerView ? setVolunteerFilterSeverity(v) : setFilterSeverity(v))}>
                  {({ value }) => (
                    <>
                      <SelectTrigger isOpen={selectStates.severity} onClick={() => setSelectStates({ ...selectStates, severity: !selectStates.severity })} className={`h-8 ${isLight ? 'bg-gray-50/80 border-gray-200' : 'bg-white/5 border-white/10'}`}>
                        <SelectValue placeholder="All Severity" value={value} options={severityOptions} />
                      </SelectTrigger>
                      <SelectContent isOpen={selectStates.severity}>
                        {severityOptions.map(option => (
                          <SelectItem key={option.value} value={option.value} onSelect={(val) => {
                            if (isVolunteerView) setVolunteerFilterSeverity(val);
                            else setFilterSeverity(val);
                            setSelectStates({ ...selectStates, severity: false });
                          }}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </>
                  )}
                </Select>
              </div>
              <div className="min-w-0 flex items-end pb-1">
                <div className="flex items-center gap-2">
                  <Switch
                    id="hide-duplicates"
                    checked={activeHideDuplicates}
                    onCheckedChange={(v) => (isVolunteerView ? setVolunteerHideDuplicates(v) : setHideDuplicates(v))}
                  />
                  <Label htmlFor="hide-duplicates" className="text-xs font-medium text-muted cursor-pointer">Hide duplicates</Label>
                </div>
              </div>
            </div>
          </div>
          <div className="p-2 sm:p-3 flex-1 min-h-0 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
              </div>
            ) : (
              <div className="h-full flex flex-col min-h-0">
                <div className="overflow-auto rounded-xl border border-border/50 flex-1 min-h-0 max-h-[55dvh] md:max-h-none">
                  <table className="w-full">
                    <thead>
                      <tr className={isLight ? 'bg-gray-50/80' : 'bg-white/5'}>
                        <th
                          className="text-left py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleSort('id')}
                        >
                          <div className="flex items-center gap-1">Incident ID{getSortIcon('id')}</div>
                        </th>
                        <th
                          className="text-left py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleSort('reporter')}
                        >
                          <div className="flex items-center gap-1">Reporter{getSortIcon('reporter')}</div>
                        </th>
                        <th
                          className="text-left py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleSort('barangay')}
                        >
                          <div className="flex items-center gap-1">Barangay{getSortIcon('barangay')}</div>
                        </th>
                        <th
                          className="text-left py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleSort('type')}
                        >
                          <div className="flex items-center gap-1">Type{getSortIcon('type')}</div>
                        </th>
                        <th
                          className="text-left py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleSort('severity')}
                        >
                          <div className="flex items-center gap-1">Severity{getSortIcon('severity')}</div>
                        </th>
                        <th
                          className="text-left py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleSort('status')}
                        >
                          <div className="flex items-center gap-1">Status{getSortIcon('status')}</div>
                        </th>
                        {isVolunteerView && (
                          <>
                            <th
                              className="text-left py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => handleSort('volunteer')}
                            >
                              <div className="flex items-center gap-1">Volunteer{getSortIcon('volunteer')}</div>
                            </th>
                            <th
                              className="text-left py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => handleSort('distance')}
                              title={viewerHq.name ? `From ${viewerHq.name} HQ` : 'From department HQ'}
                            >
                              <div className="flex items-center gap-1">Distance{getSortIcon('distance')}</div>
                            </th>
                          </>
                        )}
                        <th
                          className="text-left py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleSort('time')}
                        >
                          <div className="flex items-center gap-1">Time Reported{getSortIcon('time')}</div>
                        </th>
                        <th className="text-left py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedIncidents.length === 0 && (
                        <tr>
                          <td colSpan={isVolunteerView ? 10 : 8} className="py-10 px-4 text-center text-sm text-muted">
                            {isVolunteerView
                              ? 'No volunteers have accepted an incident yet.'
                              : 'No incidents match the current filters.'}
                          </td>
                        </tr>
                      )}
                      {paginatedIncidents.map((incident, idx) => (
                        <tr
                          key={incident.id}
                          className={`border-t border-border/50 transition-colors ${
                            isLight ? (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50') : (idx % 2 === 0 ? 'bg-transparent' : 'bg-white/5')
                          } hover:bg-primary/5`}
                        >
                          <td className="py-2.5 px-3 text-sm font-mono text-foreground">{incident.id}</td>
                          <td className="py-2.5 px-3 text-sm font-medium text-foreground">{incident.reporterName}</td>
                          <td className="py-2.5 px-3 text-sm text-muted">{incident.barangay}</td>
                          <td className="py-2.5 px-3 text-sm text-foreground">
                            <span className="mr-1">{getTypeEmoji(incident.emergencyType)}</span>
                            {incident.emergencyTypesLabel || incident.emergencyType}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge className={`${getSeverityColor(incident.severity)} border rounded-lg px-2 py-0.5 text-[11px] font-semibold`}>
                              {(incident.severity || '—').toString().toUpperCase()}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-col gap-1">
                              <Badge className={`${getStatusColor(incident.status)} border rounded-lg px-2 py-0.5 text-[11px] font-semibold w-fit`}>
                                {(incident.status || '—').toString().toUpperCase()}
                              </Badge>
                              <VolunteerStatusBadge responderStatus={incident.responderStatus} />
                              {getAutoAssignmentBadge(incident) && (
                                <Badge className={`${getAutoAssignmentBadge(incident).className} border rounded-lg px-2 py-0.5 text-[11px] font-semibold w-fit`}>
                                  {getAutoAssignmentBadge(incident).label}
                                </Badge>
                              )}
                              {hasOpenBackupUi(incident) && (
                                <BackupRequestedBadge
                                  status={incident.openBackupStatus || 'pending'}
                                  onClick={() => openBackupDialog(incident)}
                                />
                              )}
                              {Number(incident.backupVolunteerCount) > 0 && (
                                <Badge className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-lg px-2 py-0.5 text-[11px] font-semibold w-fit">
                                  {incident.backupVolunteerCount} BACKUP VOL.
                                </Badge>
                              )}
                              {incident.status === 'Resolved' && (
                                <span className="text-[10px] text-muted">
                                  {incident.reporterConfirmedAt ? 'Reporter confirmed' : 'Awaiting confirmation'}
                                </span>
                              )}
                              {incident.isDuplicate && (
                                <Badge className="bg-gray-500/20 text-gray-400 border border-gray-500/40 rounded-lg px-2 py-0.5 text-[11px] font-semibold w-fit">
                                  DUPLICATE
                                </Badge>
                              )}
                              {!incident.isDuplicate && incident.flaggedForReview && (
                                <Badge className="bg-orange-500/20 text-orange-400 border border-orange-500/40 rounded-lg px-2 py-0.5 text-[11px] font-semibold w-fit">
                                  POSSIBLE DUPLICATE
                                </Badge>
                              )}
                            </div>
                          </td>
                          {isVolunteerView && (
                            <>
                              <td className="py-2.5 px-3 text-sm">
                                <div className="flex flex-col gap-1">
                                  <span className="font-medium text-foreground">{incident.acceptedByName || 'Volunteer'}</span>
                                  {incident.acceptedByPhone && (
                                    <span className="text-xs text-muted">{incident.acceptedByPhone}</span>
                                  )}
                                  <VolunteerStatusBadge responderStatus={incident.responderStatus} />
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-sm text-muted" title={getIncidentDistance(incident).hint}>
                                {getIncidentDistance(incident).label}
                              </td>
                            </>
                          )}
                          <td className="py-2.5 px-3 text-sm text-muted">{incident.timeReported}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-9 px-3 rounded-lg text-foreground border-primary/40 hover:bg-primary/10 hover:text-primary transition-all gap-1.5"
                                onClick={(e) => { e.stopPropagation(); navigate(`/incidents/${incident.id}`); }}
                                title="View Details"
                              >
                                <ExternalLink className="w-4 h-4" strokeWidth={2} />
                                View
                              </Button>
                              {canVerify && incident.status === 'Closed' && Boolean(incident.reporterConfirmedAt) && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-9 px-3 rounded-lg bg-severity-resolved hover:bg-severity-resolved/90 text-white border-0 gap-1.5"
                                  onClick={(e) => { e.stopPropagation(); openVerifyModal(incident); }}
                                  title={USE_BLOCKCHAIN ? 'Save to Blockchain' : 'Create Audit Entry'}
                                >
                                  <CircleCheck className="w-4 h-4" strokeWidth={2} />
                                  Save
                                </Button>
                              )}
                              {canManageDuplicates && !incident.isDuplicate && /^\d+$/.test(String(incident.id)) && !isArchivedView && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-9 px-3 rounded-lg text-amber-600 border-amber-500/40 hover:bg-amber-500/20 transition-all gap-1.5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIncidentToLinkAsDuplicate(incident);
                                    setBrowseDuplicateDialogOpen(true);
                                  }}
                                  title="Mark as duplicate"
                                >
                                  <Merge className="w-4 h-4" strokeWidth={2} />
                                  Duplicate
                                </Button>
                              )}
                              {canArchive && isArchivedView && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={archivingInProgress}
                                  className="h-9 px-3 rounded-lg text-emerald-600 border-emerald-500/40 hover:bg-emerald-500/20 transition-all gap-1.5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUnarchiveIncident(incident);
                                  }}
                                  title="Restore to Active Dashboard"
                                >
                                  <ArchiveRestore className="w-4 h-4" strokeWidth={2} />
                                  Restore
                                </Button>
                              )}
                              {canArchive && !isArchivedView && incident.status === 'Closed' && !incident.isArchived && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={archivingInProgress}
                                  className="h-9 px-3 rounded-lg text-slate-500 border-slate-500/40 hover:bg-slate-500/20 transition-all gap-1.5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleArchiveIncident(incident);
                                  }}
                                  title="Archive Incident"
                                >
                                  <Archive className="w-4 h-4" strokeWidth={2} />
                                  Archive
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            )}
          </div>
        </div>
        </Tabs>

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

        {/* Finalization Modal — blockchain or audit trail depending on USE_BLOCKCHAIN flag */}
        <Dialog open={verifyModalOpen} onOpenChange={(open) => !open && closeVerifyModal()} className="max-w-md">
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {USE_BLOCKCHAIN ? 'Save Incident to Blockchain' : 'Create Audit Entry'}
              </DialogTitle>
              <DialogDescription>
                {USE_BLOCKCHAIN
                  ? 'Save this closed and reporter-confirmed incident on the blockchain for audit and authenticity.'
                  : 'Create an audit log entry for this closed and reporter-confirmed incident.'}
              </DialogDescription>
            </DialogHeader>
            {verifyIncidentTarget && (
              <div className="space-y-4 mt-4">
                <div className="rounded-xl border border-border/50 p-3 bg-muted/20">
                  <p className="text-sm font-medium text-foreground">{verifyIncidentTarget.id}</p>
                  <p className="text-sm text-muted">{verifyIncidentTarget.reporterName} · {verifyIncidentTarget.emergencyType} · {verifyIncidentTarget.severity}</p>
                  {verifyIncidentTarget.barangay && <p className="text-xs text-muted mt-1">{verifyIncidentTarget.barangay}</p>}
                </div>
                <DialogFooter>
                  <Button onClick={submitVerifyOnly} disabled={verifyInProgress} className="bg-primary text-white hover:bg-primary-hover">
                    {verifyInProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <CircleCheck className="w-4 h-4" />}
                    {verifyInProgress ? 'Saving...' : 'Save'}
                  </Button>
                  <Button variant="outline" onClick={closeVerifyModal} disabled={verifyInProgress}>Cancel</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

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
              Swal.fire({ icon: 'success', title: 'Marked as duplicate', timer: 1500, showConfirmButton: false });
            } catch (err) {
              Swal.fire({ icon: 'error', title: 'Failed', text: err.message || 'Could not link duplicate' });
            } finally {
              setLinkDuplicateInProgress(false);
            }
          }}
        />
      </div>
    </Layout>
  );
}
