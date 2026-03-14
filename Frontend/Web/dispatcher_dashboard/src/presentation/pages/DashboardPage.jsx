import { Layout } from '@/presentation/components/layout/Layout';
import { Badge } from '@/presentation/components/ui/Badge';
import { Button } from '@/presentation/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/presentation/components/ui/Dialog';
import { Label } from '@/presentation/components/ui/Label';
import { Switch } from '@/presentation/components/ui/Switch';
import { Activity, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Loader2, SlidersHorizontal, LayoutList, CircleCheck, ExternalLink } from 'lucide-react';
import { incidents as mockIncidents, barangays, departments as departmentsList } from '@/data/mock/mockData';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';
import { getIncidents, verifyIncident } from '@/data/api/incidents.api';
import { createDispatch } from '@/data/api/dispatches.api';
import { DEV_MODE } from '@/core/config/app.config';
import { normalizeRole, ROLES } from '@/core/constants';
import { mapIncidentTypeFilterToApi } from '@/core/utils/incidentClassification';
import { mapApiIncidentToDisplay } from '@/core/utils/incidentDisplay';
import Swal from 'sweetalert2';

const POLLING_INTERVAL_MS = 60000;
const ACTIVE_SECTOR_IDS = new Set(['pnp', 'drrmo']);

const TEAM_OPTIONS_BY_SECTOR = {
  pnp: [
    { value: 'pnp-patrol-alpha', label: 'Patrol Alpha' },
    { value: 'pnp-patrol-bravo', label: 'Patrol Bravo' },
    { value: 'pnp-traffic-unit', label: 'Traffic Unit' },
  ],
  drrmo: [
    { value: 'drrmo-rescue-alpha', label: 'Rescue Alpha' },
    { value: 'drrmo-medical-alpha', label: 'Medical Alpha' },
    { value: 'drrmo-fire-support', label: 'Fire Support' },
  ],
};

function getDefaultSectorId(emergencyType) {
  return String(emergencyType || '').toLowerCase() === 'police' ? 'pnp' : 'drrmo';
}

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
  const [hideDuplicates, setHideDuplicates] = useState(persistedFilterState.hideDuplicates !== false);
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

  // Verify & Assign modal (new incidents must be verified and assigned to a department first)
  const [verifyAssignModalOpen, setVerifyAssignModalOpen] = useState(false);
  const [verifyAssignIncident, setVerifyAssignIncident] = useState(null);
  const [assignDepartmentId, setAssignDepartmentId] = useState('');
  const [assignTeamName, setAssignTeamName] = useState('');
  const [assignSelectOpen, setAssignSelectOpen] = useState(false);
  const [assignTeamSelectOpen, setAssignTeamSelectOpen] = useState(false);

  const fetchIncidents = useCallback(async () => {
    if (Date.now() < rateLimitUntilRef.current) {
      return;
    }
    const token = sessionStorage.getItem('token');
    if (DEV_MODE && !token) {
      const filteredMock = mockIncidents.filter((inc) => {
        if (filterType !== 'All' && inc.emergencyType !== filterType) return false;
        if (filterStatus !== 'All' && inc.status !== filterStatus) return false;
        if (filterSeverity !== 'All' && inc.severity !== filterSeverity) return false;
        if (filterBarangay !== 'All' && inc.barangay !== filterBarangay) return false;
        return true;
      });
      const startIndex = (currentPage - 1) * itemsPerPage;
      const pageItems = filteredMock.slice(startIndex, startIndex + itemsPerPage);
      setIncidents(dedupeIncidentsById(pageItems));
      setTotalIncidentsCount(filteredMock.length);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const apiStatus = mapStatusFilterToApi(filterStatus);
      const apiSeverity = mapSeverityFilterToApi(filterSeverity);
      const apiType = mapIncidentTypeFilterToApi(filterType);
      const apiBarangay = filterBarangay !== 'All' ? filterBarangay : undefined;
      const offset = (currentPage - 1) * itemsPerPage;
      const result = await getIncidents({
        limit: itemsPerPage,
        offset,
        status: apiStatus,
        severity_level: apiSeverity,
        incident_type: apiType,
        barangay: apiBarangay,
        exclude_duplicates: hideDuplicates,
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
  }, [currentPage, filterBarangay, filterSeverity, filterStatus, filterType, itemsPerPage, hideDuplicates]);

  useEffect(() => {
    fetchIncidents();
    const intervalId = setInterval(fetchIncidents, POLLING_INTERVAL_MS);
    const handleIncidentUpdated = () => fetchIncidents();
    window.addEventListener('incident:updated', handleIncidentUpdated);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('incident:updated', handleIncidentUpdated);
    };
  }, [fetchIncidents]);

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
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(totalIncidentsCount / itemsPerPage));
  const paginatedIncidents = sortedIncidents;
  const pageStart = totalIncidentsCount === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1;
  const pageEnd = Math.min(currentPage * itemsPerPage, totalIncidentsCount);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting
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
    const teams = TEAM_OPTIONS_BY_SECTOR[assignDepartmentId] || [];
    if (!teams.some((team) => team.value === assignTeamName)) {
      setAssignTeamName(teams[0]?.value || '');
    }
  }, [assignDepartmentId]);

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
      default: return t ? '📋' : '';
    }
  };

  const departments = (departmentsList || []).filter((d) => ACTIVE_SECTOR_IDS.has(d.id));
  const selectedTeamOptions = TEAM_OPTIONS_BY_SECTOR[assignDepartmentId] || [];
  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
  const normalizedRole = normalizeRole(currentUser.role);
  const canVerifyAndAssign = (
    normalizedRole === ROLES.SUPER_ADMIN
    || normalizedRole === ROLES.DISPATCHER
    || normalizedRole === ROLES.DEPARTMENT_ADMIN
  );

  const openVerifyAssignModal = (incident) => {
    const defaultDepartmentId = incident.assignedDepartmentId || getDefaultSectorId(incident.emergencyType);
    setVerifyAssignIncident(incident);
    setAssignDepartmentId(defaultDepartmentId);
    setAssignTeamName((TEAM_OPTIONS_BY_SECTOR[defaultDepartmentId] || [])[0]?.value || '');
    setVerifyAssignModalOpen(true);
  };

  const closeVerifyAssignModal = () => {
    setVerifyAssignModalOpen(false);
    setVerifyAssignIncident(null);
    setAssignDepartmentId('');
    setAssignTeamName('');
    setAssignSelectOpen(false);
    setAssignTeamSelectOpen(false);
  };

  const submitVerifyAndAssign = async () => {
    if (!verifyAssignIncident || !assignDepartmentId || !assignTeamName) return;
    const dept = departments.find((d) => d.id === assignDepartmentId);
    const assignedDepartment = dept ? dept.name : '';
    const defaultDepartmentId = getDefaultSectorId(verifyAssignIncident.emergencyType);
    const wasDefaultDepartment = defaultDepartmentId === assignDepartmentId;
    const confirm = await Swal.fire({
      title: 'Confirm verification',
      html: `Assign incident <strong>${verifyAssignIncident.id}</strong> to <strong>${assignedDepartment}</strong> (${assignTeamName})?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#134178',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Verify & Assign',
      cancelButtonText: 'Cancel',
      customClass: { popup: 'rounded-2xl shadow-xl', title: 'text-foreground text-xl', htmlContainer: 'text-muted' },
    });

    if (!confirm.isConfirmed) return;

    let rollbackSnapshot = null;
    try {
      rollbackSnapshot = incidents;
      setIncidents((prev) =>
        prev.map((inc) =>
          inc.id === verifyAssignIncident.id
            ? {
                ...inc,
                verified: true,
                status: 'Verified',
                assignedDepartmentId: assignDepartmentId,
                assignedDepartment,
                assignedTeamName: assignTeamName,
              }
            : inc
        )
      );
      const numericId = /^\d+$/.test(String(verifyAssignIncident.id));
      const token = sessionStorage.getItem('token');
      if (numericId && token) {
        await verifyIncident(verifyAssignIncident.id);
        const assignmentResult = await createDispatch({
          report_id: Number(verifyAssignIncident.id),
          department_code: assignDepartmentId,
          department_name: assignedDepartment,
          team_name: assignTeamName,
          default_department_code: defaultDepartmentId,
          was_default_department: wasDefaultDepartment,
          response_status: 'assigned',
        });
        const assignedCount = Number(assignmentResult?.assignment_summary?.assigned_count || 0);
        if (assignedCount === 0) {
          throw new Error('No available or standby responders found for the selected team.');
        }
      }

      closeVerifyAssignModal();
      window.dispatchEvent(new CustomEvent('incident:updated', { detail: { incidentId: verifyAssignIncident.id } }));
      Swal.fire({
        icon: 'success',
        title: 'Incident verified',
        text: `Assigned to ${assignedDepartment} (${assignTeamName}) using auto-team assignment.`,
        timer: 2500,
        showConfirmButton: false,
        timerProgressBar: true,
        customClass: { popup: 'rounded-2xl shadow-xl' },
      });
    } catch (err) {
      if (rollbackSnapshot) {
        setIncidents(rollbackSnapshot);
      }
      await Swal.fire({
        icon: 'error',
        title: 'Verify & assign failed',
        text: err.message || 'Unable to complete verification and assignment.',
        confirmButtonColor: '#134178',
      });
    }
  };

  const criticalIncidents = incidents.filter((i) => i.severity === 'Critical');

  const typeOptions = [
    { value: 'All', label: 'All Types' },
    { value: 'Fire', label: 'Fire' },
    { value: 'Medical', label: 'Medical' },
    { value: 'Police', label: 'Police' },
    { value: 'Disaster', label: 'Disaster' },
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
    { value: 'Resolved', label: 'Resolved' },
  ];

  const heroCardClass = `rounded-3xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80 border-gray-200/80 shadow-[8px_8px_24px_rgba(209,213,219,0.5),-8px_-8px_24px_rgba(255,255,255,0.9)]' : 'glass neumorphic-dark bg-card/60 border-white/10 shadow-[8px_8px_24px_rgba(0,0,0,0.35),-6px_-6px_20px_rgba(19,65,120,0.2)]'}`;
  const heroIconClass = `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'}`;

  return (
    <Layout>
      <div className="p-2 sm:p-3 md:p-4 max-w-7xl mx-auto min-h-[calc(100dvh-96px)] flex flex-col gap-2 md:gap-3">
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
        <div className={`relative z-0 rounded-2xl overflow-hidden border transition-all duration-300 flex-1 min-h-0 ${
          isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'
        }`}>
          <div className={`flex items-center gap-3 px-4 py-2.5 border-b ${
            isLight ? 'border-gray-200/80 bg-gray-50/50' : 'border-white/10 bg-white/5'
          }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'
            }`}>
              <LayoutList className="w-5 h-5" strokeWidth={2} />
            </div>
            <h3 className="text-base font-semibold text-foreground">Incident List</h3>
            <span className={`ml-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isLight ? 'bg-primary/15 text-primary' : 'bg-primary/20 text-primary'
            }`}>
              {totalIncidentsCount}
            </span>
          </div>
          <div className={`px-2 sm:px-3 py-2 border-b ${
            isLight ? 'border-gray-200/80 bg-gray-50/20' : 'border-white/10 bg-white/[0.02]'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">Rows</span>
                <Select value={String(itemsPerPage)} onValueChange={(value) => { setItemsPerPage(Number(value)); setCurrentPage(1); }} open={pageSizeSelectOpen} onOpenChange={setPageSizeSelectOpen}>
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
                          <SelectItem key={size} value={size} onSelect={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); setPageSizeSelectOpen(false); }}>
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
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
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
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="h-9 w-9 p-0 rounded-lg"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted ml-2">Page {currentPage} of {totalPages}</span>
              </div>
            </div>
          </div>
          <div className={`px-2 sm:px-3 py-2 border-b ${
            isLight ? 'border-gray-200/80 bg-gray-50/30' : 'border-white/10 bg-white/[0.03]'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              <h4 className="text-xs font-semibold text-foreground">Filters</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
              <div className="min-w-0">
                <label className="text-xs font-medium text-muted mb-1 block">Emergency Type</label>
                <Select value={filterType} onValueChange={setFilterType}>
                  {({ value }) => (
                    <>
                      <SelectTrigger isOpen={selectStates.type} onClick={() => setSelectStates({ ...selectStates, type: !selectStates.type })} className={`h-8 ${isLight ? 'bg-gray-50/80 border-gray-200' : 'bg-white/5 border-white/10'}`}>
                        <SelectValue placeholder="All Types" value={value} options={typeOptions} />
                      </SelectTrigger>
                      <SelectContent isOpen={selectStates.type}>
                        {typeOptions.map(option => (
                          <SelectItem key={option.value} value={option.value} onSelect={(val) => { setFilterType(val); setSelectStates({ ...selectStates, type: false }); }}>
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
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  {({ value }) => (
                    <>
                      <SelectTrigger isOpen={selectStates.status} onClick={() => setSelectStates({ ...selectStates, status: !selectStates.status })} className={`h-8 ${isLight ? 'bg-gray-50/80 border-gray-200' : 'bg-white/5 border-white/10'}`}>
                        <SelectValue placeholder="All Status" value={value} options={statusOptions} />
                      </SelectTrigger>
                      <SelectContent isOpen={selectStates.status}>
                        {statusOptions.map(option => (
                          <SelectItem key={option.value} value={option.value} onSelect={(val) => { setFilterStatus(val); setSelectStates({ ...selectStates, status: false }); }}>
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
                <Select value={filterBarangay} onValueChange={setFilterBarangay}>
                  {({ value }) => (
                    <>
                      <SelectTrigger isOpen={selectStates.barangay} onClick={() => setSelectStates({ ...selectStates, barangay: !selectStates.barangay })} className={`h-8 ${isLight ? 'bg-gray-50/80 border-gray-200' : 'bg-white/5 border-white/10'}`}>
                        <SelectValue placeholder="All Barangays" value={value} options={barangayOptions} />
                      </SelectTrigger>
                      <SelectContent isOpen={selectStates.barangay} className="max-h-[300px]">
                        {barangayOptions.map(option => (
                          <SelectItem key={option.value} value={option.value} onSelect={(val) => { setFilterBarangay(val); setSelectStates({ ...selectStates, barangay: false }); }}>
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
                <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                  {({ value }) => (
                    <>
                      <SelectTrigger isOpen={selectStates.severity} onClick={() => setSelectStates({ ...selectStates, severity: !selectStates.severity })} className={`h-8 ${isLight ? 'bg-gray-50/80 border-gray-200' : 'bg-white/5 border-white/10'}`}>
                        <SelectValue placeholder="All Severity" value={value} options={severityOptions} />
                      </SelectTrigger>
                      <SelectContent isOpen={selectStates.severity}>
                        {severityOptions.map(option => (
                          <SelectItem key={option.value} value={option.value} onSelect={(val) => { setFilterSeverity(val); setSelectStates({ ...selectStates, severity: false }); }}>
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
                  <Switch id="hide-duplicates" checked={hideDuplicates} onCheckedChange={setHideDuplicates} />
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
                          <td colSpan={8} className="py-10 px-4 text-center text-sm text-muted">
                            No incidents match the current filters.
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
                            {incident.emergencyType}
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
                              {incident.status === 'Resolved' && (
                                <span className="text-[10px] text-muted">
                                  {incident.reporterConfirmedAt ? 'Reporter confirmed' : 'Awaiting confirmation'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-sm text-muted">{incident.timeReported}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 rounded-lg text-foreground/80 hover:bg-primary/15 hover:text-primary transition-all"
                                onClick={(e) => { e.stopPropagation(); navigate(`/incidents/${incident.id}`); }}
                                title="View Details"
                              >
                                <ExternalLink className="w-4 h-4" strokeWidth={2} />
                              </Button>
                              {canVerifyAndAssign && !incident.verified && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                className="h-8 w-8 p-0 rounded-lg text-severity-resolved hover:bg-severity-resolved/20 transition-all"
                                  onClick={(e) => { e.stopPropagation(); openVerifyAssignModal(incident); }}
                                  title="Verify & Assign to Department"
                                >
                                  <CircleCheck className="w-4 h-4" strokeWidth={2} />
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

        {/* Verify & Assign Modal — new incidents must be verified and assigned before department can update */}
        <Dialog open={verifyAssignModalOpen} onOpenChange={(open) => !open && closeVerifyAssignModal()} className="max-w-md">
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Verify & Assign Incident</DialogTitle>
              <DialogDescription>
                Verify this incident and assign it to a department. The department will then be able to give updates to the super admin.
              </DialogDescription>
            </DialogHeader>
            {verifyAssignIncident && (
              <div className="space-y-4 mt-4">
                <div className="rounded-xl border border-border/50 p-3 bg-muted/20">
                  <p className="text-sm font-medium text-foreground">{verifyAssignIncident.id}</p>
                  <p className="text-sm text-muted">{verifyAssignIncident.reporterName} · {verifyAssignIncident.emergencyType} · {verifyAssignIncident.severity}</p>
                  {verifyAssignIncident.barangay && <p className="text-xs text-muted mt-1">{verifyAssignIncident.barangay}</p>}
                </div>
                <div>
                  <Label className="text-foreground">Sector *</Label>
                  <Select value={assignDepartmentId} onValueChange={setAssignDepartmentId} open={assignSelectOpen} onOpenChange={setAssignSelectOpen}>
                    {({ value, onValueChange, dropdownRect }) => (
                      <>
                        <SelectTrigger
                          isOpen={assignSelectOpen}
                          onClick={() => setAssignSelectOpen((o) => !o)}
                          className="mt-1.5"
                        >
                          <SelectValue
                            value={value}
                            options={[{ value: '', label: 'Select sector' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
                            placeholder="Select sector"
                          />
                        </SelectTrigger>
                        <SelectContent isOpen={assignSelectOpen} dropdownRect={dropdownRect}>
                          <SelectItem value="" onSelect={() => { setAssignDepartmentId(''); setAssignSelectOpen(false); }}>Select sector</SelectItem>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={d.id} onSelect={(v) => { setAssignDepartmentId(v); setAssignSelectOpen(false); }}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </>
                    )}
                  </Select>
                  {verifyAssignIncident && (
                    <p className="text-xs text-muted mt-1">
                      Default by classification: {getDefaultSectorId(verifyAssignIncident.emergencyType) === 'pnp' ? 'Police' : 'CDRRMO'} (editable)
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-foreground">Team *</Label>
                  <Select value={assignTeamName} onValueChange={setAssignTeamName} open={assignTeamSelectOpen} onOpenChange={setAssignTeamSelectOpen}>
                    {({ value }) => (
                      <>
                        <SelectTrigger
                          isOpen={assignTeamSelectOpen}
                          onClick={() => setAssignTeamSelectOpen((o) => !o)}
                          className="mt-1.5"
                        >
                          <SelectValue
                            value={value}
                            options={[{ value: '', label: 'Select team' }, ...selectedTeamOptions]}
                            placeholder="Select team"
                          />
                        </SelectTrigger>
                        <SelectContent isOpen={assignTeamSelectOpen}>
                          <SelectItem value="" onSelect={() => { setAssignTeamName(''); setAssignTeamSelectOpen(false); }}>Select team</SelectItem>
                          {selectedTeamOptions.map((t) => (
                            <SelectItem key={t.value} value={t.value} onSelect={(v) => { setAssignTeamName(v); setAssignTeamSelectOpen(false); }}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </>
                    )}
                  </Select>
                </div>
                <p className="text-xs text-muted">
                  Responders are now auto-assigned by backend based on available/standby members in the selected team.
                </p>
                <DialogFooter>
                  <Button onClick={submitVerifyAndAssign} disabled={!assignDepartmentId || !assignTeamName} className="bg-primary text-white hover:bg-primary-hover">
                    Verify & Assign
                  </Button>
                  <Button variant="outline" onClick={closeVerifyAssignModal}>Cancel</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
