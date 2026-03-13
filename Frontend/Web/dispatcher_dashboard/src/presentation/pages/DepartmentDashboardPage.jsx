import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/presentation/components/layout/Layout';
import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';
import { Badge } from '@/presentation/components/ui/Badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/presentation/components/ui/Dialog';
import { Eye, Truck, MapPin, CheckCircle, AlertCircle, Activity, LayoutList, SlidersHorizontal, UserPlus, X, Clock, Shield, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { getIncidents } from '@/data/api/incidents.api';
import { getDepartmentById, getDepartmentUnits, assignDepartmentUnit } from '@/data/api/departments.api';
import { getResponderTeams } from '@/data/api/responders.api';
import { createDispatch } from '@/data/api/dispatches.api';
import { inferDepartmentSectorCode, normalizeSectorCode } from '@/core/utils/departmentSector';
import { mapApiIncidentToDisplay } from '@/core/utils/incidentDisplay';
import { ROLES } from '@/core/constants';
import { useTheme } from '@/presentation/context/ThemeContext';
import Swal from 'sweetalert2';

function mapApiIncidentToRow(api) {
  return mapApiIncidentToDisplay(api);
}

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
  const { theme } = useTheme();
  const isLight = theme === 'light';
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
  const [selectStates, setSelectStates] = useState({ type: false, status: false, severity: false });
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [pageSizeSelectOpen, setPageSizeSelectOpen] = useState(false);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getIncidents({ limit: 40, offset: 0, withMeta: false });
      const list = Array.isArray(result) ? result : (result?.items || []);
      setIncidents(list.map(mapApiIncidentToRow));
    } catch (err) {
      setError(err.message || 'Failed to load incidents');
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user.role !== ROLES.DEPARTMENT_ADMIN && user.role !== ROLES.PERSONNEL) {
      navigate('/dashboard', { replace: true });
    }
  }, [user.role, navigate]);

  useEffect(() => {
    if (user.role !== ROLES.DEPARTMENT_ADMIN && user.role !== ROLES.PERSONNEL) return;
    fetchIncidents();
    const intervalId = setInterval(fetchIncidents, 30000);
    const handleUpdated = () => fetchIncidents();
    window.addEventListener('incident:updated', handleUpdated);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('incident:updated', handleUpdated);
    };
  }, [user.role, fetchIncidents]);

  useEffect(() => {
    if (!departmentId || (user.role !== ROLES.DEPARTMENT_ADMIN && user.role !== ROLES.PERSONNEL)) return;
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
  }, [departmentId, user.role]);

  useEffect(() => {
    if (user.role !== ROLES.DEPARTMENT_ADMIN && user.role !== ROLES.PERSONNEL) return;
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
  }, [user.role, departmentSectorCode]);

  useEffect(() => {
    if (!departmentId || (user.role !== ROLES.DEPARTMENT_ADMIN && user.role !== ROLES.PERSONNEL)) return;
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
  }, [departmentId, user.role]);

  useEffect(() => {
    try {
      localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(assignments));
    } catch (_) {}
  }, [assignments]);

  const departmentIncidents = incidents;
  const filteredIncidents = departmentIncidents.filter((incident) => {
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
  }, [filterType, filterStatus, filterSeverity]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const activeIncidents = departmentIncidents.filter((i) => {
    const s = String(i.status || '').toLowerCase();
    return s !== 'resolved' && s !== 'closed';
  });

  const getAssignment = useCallback((incidentId) => assignments[incidentId] || null, [assignments]);
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
  const assignTeamToIncident = useCallback(async (incidentId, team) => {
    if (!department?.code || !department?.name || !team?.team_name) return;
    if (!isTeamAssignable(team)) {
      Swal.fire({
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
      Swal.fire({
        icon: 'success',
        title: 'Team assigned',
        html: `Team <strong>${team.team_name}</strong> has been assigned to incident <strong>${incidentId}</strong>. Available members are assigned by the system.`,
        timer: 2500,
        showConfirmButton: false,
        timerProgressBar: true,
        customClass: { popup: 'rounded-2xl shadow-xl' },
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Assignment failed',
        text: err.message || 'Could not assign team. Try again.',
        customClass: { popup: 'rounded-2xl shadow-xl' },
      });
    }
  }, [department, fetchIncidents, isTeamAssignable]);


  const getSeverityColor = (severity) => {
    switch (String(severity).toLowerCase()) {
      case 'critical': return 'bg-primary/20 text-primary border-primary/50';
      case 'warning': return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'resolved':
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/40';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusBadge = (status) => {
    const s = String(status || '').toLowerCase();
    const map = {
      new: 'bg-blue-500/20 text-blue-400',
      verified: 'bg-purple-500/20 text-purple-400',
      'in progress': 'bg-indigo-500/20 text-indigo-400',
      assigned: 'bg-indigo-500/20 text-indigo-400',
      resolved: 'bg-green-500/20 text-green-400',
      closed: 'bg-emerald-700/20 text-emerald-300',
    };
    const cls = map[s] || 'bg-muted text-muted-foreground';
    return <Badge className={cls}>{status || '—'}</Badge>;
  };

  const getTypeIcon = (type) => {
    const icons = { Fire: '🔥', Medical: '🏥', Police: '👮', Disaster: '⚠️' };
    return icons[String(type)] || '📋';
  };

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

  const severityOptions = [
    { value: 'All', label: 'All Severity' },
    { value: 'Critical', label: 'Critical' },
    { value: 'Warning', label: 'Warning' },
    { value: 'Low', label: 'Low' },
  ];

  const heroCardClass = `rounded-3xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80 border-gray-200/80 shadow-[8px_8px_24px_rgba(209,213,219,0.5),-8px_-8px_24px_rgba(255,255,255,0.9)]' : 'glass neumorphic-dark bg-card/60 border-white/10 shadow-[8px_8px_24px_rgba(0,0,0,0.35),-6px_-6px_20px_rgba(19,65,120,0.2)]'}`;
  const heroIconClass = `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'}`;

  if (user.role !== ROLES.DEPARTMENT_ADMIN && user.role !== ROLES.PERSONNEL) return null;

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className={heroCardClass}>
          <div className="p-8 flex flex-wrap items-center gap-6">
            <div className={heroIconClass}>
              <Activity className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Incident Overview</h1>
              <p className="text-muted mt-1">{user.department || 'Department'} — Assigned Incidents</p>
            </div>
          </div>
        </div>

        {loading && (
          <p className="text-muted text-center py-4">Loading incidents…</p>
        )}
        {error && (
          <Card className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10">
            <p className="text-foreground mb-2">{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchIncidents()}>Retry</Button>
          </Card>
        )}
        {activeIncidents.length > 0 && !loading && (
          <Card className="bg-amber-500/10 border-amber-500/30 p-4 rounded-2xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground">
                  {activeIncidents.length} Active Incident{activeIncidents.length !== 1 ? 's' : ''} Requiring Response
                </h3>
                <p className="text-sm text-muted mt-1">Review and update incident statuses below</p>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-4 rounded-2xl border border-border">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Truck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted uppercase font-semibold">Total Assigned</p>
                <p className="text-lg font-bold text-foreground">{departmentIncidents.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-xs text-muted uppercase font-semibold">Awaiting Action</p>
                <p className="text-lg font-bold text-foreground">{departmentIncidents.filter((i) => i.status === 'Verified' || i.status === 'verified' || i.status === 'New').length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Activity className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted uppercase font-semibold">In Progress</p>
                <p className="text-lg font-bold text-foreground">{departmentIncidents.filter((i) => i.status === 'In Progress' || i.status === 'in-progress').length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted uppercase font-semibold">Resolved</p>
                <p className="text-lg font-bold text-foreground">{departmentIncidents.filter((i) => i.status === 'Resolved' || i.status === 'resolved').length}</p>
              </div>
            </div>
          </div>
        </Card>

        <div className={`relative z-0 rounded-2xl overflow-hidden border transition-all duration-300 ${
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
            <h3 className="text-base font-semibold text-foreground">Assigned Incidents</h3>
            <span className={`ml-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isLight ? 'bg-primary/15 text-primary' : 'bg-primary/20 text-primary'
            }`}>
              {filteredIncidents.length}
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
                      <SelectTrigger isOpen={pageSizeSelectOpen} onClick={() => setPageSizeSelectOpen((o) => !o)} className="h-8 w-[84px]">
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
                <span className="text-xs text-muted sm:ml-1">Showing {pageStart}-{pageEnd} of {filteredIncidents.length}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={safePage === 1} className="h-9 w-9 p-0 rounded-lg">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={safePage === totalPages} className="h-9 w-9 p-0 rounded-lg">
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted">Page {safePage} of {totalPages}</span>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="min-w-0">
                <label className="text-xs font-medium text-muted mb-1 block">Type</label>
                <Select value={filterType} onValueChange={setFilterType}>
                  {({ value }) => (
                    <>
                      <SelectTrigger isOpen={selectStates.type} onClick={() => setSelectStates({ ...selectStates, type: !selectStates.type })} className={`h-8 ${isLight ? 'bg-gray-50/80 border-gray-200' : 'bg-white/5 border-white/10'}`}>
                        <SelectValue placeholder="All Types" value={value} options={typeOptions} />
                      </SelectTrigger>
                      <SelectContent isOpen={selectStates.type}>
                        {typeOptions.map((option) => (
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
                        {statusOptions.map((option) => (
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
                <label className="text-xs font-medium text-muted mb-1 block">Severity</label>
                <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                  {({ value }) => (
                    <>
                      <SelectTrigger isOpen={selectStates.severity} onClick={() => setSelectStates({ ...selectStates, severity: !selectStates.severity })} className={`h-8 ${isLight ? 'bg-gray-50/80 border-gray-200' : 'bg-white/5 border-white/10'}`}>
                        <SelectValue placeholder="All Severity" value={value} options={severityOptions} />
                      </SelectTrigger>
                      <SelectContent isOpen={selectStates.severity}>
                        {severityOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value} onSelect={(val) => { setFilterSeverity(val); setSelectStates({ ...selectStates, severity: false }); }}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </>
                  )}
                </Select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={isLight ? 'bg-gray-50 border-b border-gray-200' : 'bg-muted/30 border-b border-border'}>
                <tr>
                  <th className="px-2.5 py-2 text-left text-xs font-semibold text-foreground cursor-pointer" onClick={() => handleSort('id')}><div className="flex items-center gap-1">Incident ID{getSortIcon('id')}</div></th>
                  <th className="px-2.5 py-2 text-left text-xs font-semibold text-foreground cursor-pointer" onClick={() => handleSort('type')}><div className="flex items-center gap-1">Type{getSortIcon('type')}</div></th>
                  <th className="px-2.5 py-2 text-left text-xs font-semibold text-foreground cursor-pointer" onClick={() => handleSort('location')}><div className="flex items-center gap-1">Location{getSortIcon('location')}</div></th>
                  <th className="px-2.5 py-2 text-left text-xs font-semibold text-foreground cursor-pointer" onClick={() => handleSort('severity')}><div className="flex items-center gap-1">Severity{getSortIcon('severity')}</div></th>
                  <th className="px-2.5 py-2 text-left text-xs font-semibold text-foreground cursor-pointer" onClick={() => handleSort('status')}><div className="flex items-center gap-1">Status{getSortIcon('status')}</div></th>
                  <th className="px-2.5 py-2 text-left text-xs font-semibold text-foreground">Assigned To</th>
                  <th className="px-2.5 py-2 text-left text-xs font-semibold text-foreground cursor-pointer" onClick={() => handleSort('reported')}><div className="flex items-center gap-1">Reported{getSortIcon('reported')}</div></th>
                  <th className="px-2.5 py-2 text-left text-xs font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted">Loading incidents…</td>
                  </tr>
                ) : (
                  paginatedIncidents.map((incident) => (
                    <tr key={incident.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-2.5 py-2">
                        <button type="button" onClick={() => navigate(`/incidents/${incident.id}`)} className="text-xs font-medium text-primary hover:underline">
                          {incident.id}
                        </button>
                      </td>
                      <td className="px-2.5 py-2 text-xs">
                        <span className="inline-flex items-center gap-1">
                          {getTypeIcon(incident.emergencyType)}
                          <span className="capitalize text-foreground">{incident.emergencyType}</span>
                        </span>
                      </td>
                      <td className="px-2.5 py-2 text-xs text-muted">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4 text-muted" />
                          {incident.barangay}
                        </div>
                      </td>
                      <td className="px-2.5 py-2">
                        <Badge className={getSeverityColor(incident.severity)}>{String(incident.severity || '—')}</Badge>
                      </td>
                      <td className="px-2.5 py-2">
                        <div className="flex flex-col gap-1">
                          {getStatusBadge(incident.status)}
                          {(incident.status === 'Resolved' || incident.status === 'resolved') && !incident.reporterConfirmedAt && (
                            <span className="text-xs text-amber-500 font-medium">Awaiting confirmation</span>
                          )}
                        </div>
                      </td>
                      <td className="px-2.5 py-2 text-xs text-muted">
                        {getAssignment(incident.id) ? (getAssignment(incident.id).teamName || getAssignment(incident.id).name) : '—'}
                      </td>
                      <td className="px-2.5 py-2 text-xs text-muted">{incident.timeReported || '—'}</td>
                      <td className="px-2.5 py-2">
                        <div className="flex items-center gap-1">
                          {user.role === ROLES.DEPARTMENT_ADMIN && (
                            <Button size="sm" variant="ghost" onClick={() => openAssignModal(incident.id)} className="text-primary" title="Assign personnel">
                              <UserPlus className="w-4 h-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/incidents/${incident.id}`)} className="text-primary" title="View details">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
                {!loading && paginatedIncidents.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted">No incidents match the current filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {!loading && !error && filteredIncidents.length === 0 && (
          <div className="text-center py-12 text-muted">
            <p className="text-lg">No incidents assigned to your department yet</p>
          </div>
        )}

        <Card className="p-4 bg-primary/5 border-primary/20 rounded-2xl">
          <h3 className="font-semibold text-foreground mb-2">Notes</h3>
          <ul className="text-sm text-muted space-y-1 list-disc list-inside">
            <li>Click an incident ID to view details and update status</li>
            <li>Use the assign icon to assign personnel to an incident (Dept Admin)</li>
            <li>Status updates are visible to the Super Admin control center</li>
          </ul>
        </Card>

        {/* Assign Personnel Modal — Dept Admin only: assign a response team (uses API teams) */}
        <Dialog open={assignModalOpen} onOpenChange={(open) => !open && closeAssignModal()} className="max-w-md">
          <DialogContent className={`max-w-md rounded-2xl overflow-hidden ${isLight ? 'glass neumorphic-light bg-white/95 border-gray-200/80' : 'glass neumorphic-dark bg-card/95 border-white/10'}`}>
            <div className={`flex items-center justify-between border-b ${isLight ? 'border-gray-200/80 pb-4' : 'border-white/10 pb-4'}`}>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-foreground">Assign personnel</DialogTitle>
                <p className="text-sm text-muted mt-1">
                  {assigningIncidentId ? `Assign a response team to incident ${assigningIncidentId}. The selected team's available members will be assigned by the system.` : 'Assign a response team to this incident.'}
                </p>
              </DialogHeader>
              <button
                type="button"
                onClick={closeAssignModal}
                className={`p-2 rounded-xl transition-colors ${isLight ? 'hover:bg-gray-100 text-gray-500' : 'hover:bg-white/10 text-muted'}`}
                aria-label="Close"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>
            <div className="mt-4 space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {teamsLoading && <p className="text-sm text-muted py-4 text-center">Loading teams…</p>}
              {!teamsLoading && teams.map((team) => {
                const assignable = isTeamAssignable(team);
                return (
                <button
                  key={team.team_id}
                  type="button"
                  onClick={() => assignTeamToIncident(assigningIncidentId, team)}
                  disabled={!assignable}
                  className={`w-full text-left flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all duration-200 ${
                    isLight
                      ? `${assignable ? 'border-gray-200/80 bg-white hover:bg-primary/5 hover:border-primary/30 cursor-pointer shadow-sm' : 'border-gray-200/80 bg-gray-100/80 opacity-70 cursor-not-allowed'}`
                      : `${assignable ? 'border-white/10 bg-white/5 hover:bg-primary/10 hover:border-primary/30 cursor-pointer' : 'border-white/10 bg-white/5 opacity-60 cursor-not-allowed'}`
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'bg-primary/15 text-primary' : 'bg-primary/20 text-primary'}`}>
                    <Shield className="w-5 h-5" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{team.team_name}</p>
                    <p className="text-sm text-muted">{String(team.department_code || '').toUpperCase()} · {String(team.team_status || 'available').toLowerCase()}</p>
                  </div>
                  {!assignable && (
                    <span className="flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-600">
                      Unavailable
                    </span>
                  )}
                  {Array.isArray(team.supported_incident_types) && team.supported_incident_types.length > 0 && (
                    <span className="flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium bg-muted/50 text-muted-foreground">
                      {team.supported_incident_types.slice(0, 2).join(', ')}
                    </span>
                  )}
                </button>
                );
              })}
            </div>
            {!teamsLoading && teams.length === 0 && <p className="text-sm text-muted py-6 text-center">No teams in this department. Create teams in the Personnel page first.</p>}
          </DialogContent>
        </Dialog>


      </div>
    </Layout>
  );
}
