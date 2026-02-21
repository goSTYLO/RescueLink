import { Layout } from '@/presentation/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/Card';
import { Badge } from '@/presentation/components/ui/Badge';
import { Button } from '@/presentation/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/presentation/components/ui/Dialog';
import { Label } from '@/presentation/components/ui/Label';
import { AlertTriangle, Activity, AlertCircle, Clock, CheckCircle2, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Loader2, SlidersHorizontal, LayoutList, PhoneCall, CircleCheck, ExternalLink } from 'lucide-react';
import { incidents as mockIncidents, barangays, departments as departmentsList } from '@/data/mock/mockData';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';
import { getIncidents } from '@/data/api/incidents.api';
import { DEV_MODE } from '@/core/config/app.config';
import Swal from 'sweetalert2';

// Icon Container Component (dark theme)
function IconContainer({ children, className = '' }) {
  return (
    <div className={`w-12 h-12 rounded-xl bg-secondary/30 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:bg-secondary/50 border border-[rgba(19,65,120,0.35)] ${className}`}>
      {children}
    </div>
  );
}

// Map API incident to dashboard shape
function mapApiIncidentToDashboard(api) {
  const firstName = api.reporter_first_name || '';
  const lastName = api.reporter_last_name || '';
  const reporterName = (firstName || lastName)
    ? [firstName, lastName].filter(Boolean).join(' ').trim()
    : `User #${api.user_id}`;

  const typeMap = { fire: 'Fire', medical: 'Medical', police: 'Police', disaster: 'Disaster' };
  const emergencyType = typeMap[api.incident_type?.toLowerCase()] || (api.incident_type ? String(api.incident_type).charAt(0).toUpperCase() + String(api.incident_type).slice(1) : '—');

  const severityMap = { high: 'Critical', medium: 'Warning', low: 'Low' };
  const severity = severityMap[api.severity_level?.toLowerCase()] || (api.severity_level || '—');

  const statusMap = { pending: 'Pending', resolved: 'Resolved', verified: 'Verified' };
  const status = statusMap[api.status?.toLowerCase()] || (api.status || 'Pending');

  let timeReported = '—';
  if (api.created_at) {
    const d = new Date(api.created_at);
    timeReported = d.toLocaleString('en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: 'numeric', minute: '2-digit', hour12: true
    });
  }

  return {
    id: api.report_id,
    reporterName,
    reporterPhone: api.reporter_phone || null,
    barangay: '—',
    emergencyType,
    severity,
    status,
    timeReported,
    verified: api.verified ?? false,
  };
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterBarangay, setFilterBarangay] = useState('All');
  const [selectStates, setSelectStates] = useState({
    type: false,
    status: false,
    barangay: false,
  });
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Verify & Assign modal (new incidents must be verified and assigned to a department first)
  const [verifyAssignModalOpen, setVerifyAssignModalOpen] = useState(false);
  const [verifyAssignIncident, setVerifyAssignIncident] = useState(null);
  const [assignDepartmentId, setAssignDepartmentId] = useState('');
  const [assignSelectOpen, setAssignSelectOpen] = useState(false);

  // Call modal (call reporter or department)
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callIncident, setCallIncident] = useState(null);
  const [callTarget, setCallTarget] = useState('reporter'); // 'reporter' | 'department'
  const [callDepartmentId, setCallDepartmentId] = useState('');
  const [callDeptSelectOpen, setCallDeptSelectOpen] = useState(false);

  const fetchIncidents = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (DEV_MODE && !token) {
      setIncidents(mockIncidents);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const apiStatus = filterStatus === 'Resolved' ? 'resolved' : (filterStatus === 'New' || filterStatus === 'Verified' || filterStatus === 'In Progress') ? 'pending' : undefined;
      const data = await getIncidents({ limit: 100, offset: 0, status: apiStatus });
      setIncidents(Array.isArray(data) ? data.map(mapApiIncidentToDashboard) : []);
    } catch (err) {
      setError(err.message || 'Failed to fetch incidents');
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const filteredIncidents = incidents.filter(inc => {
    if (filterType !== 'All' && inc.emergencyType !== filterType) return false;
    if (filterStatus !== 'All' && inc.status !== filterStatus) return false;
    if (filterBarangay !== 'All' && inc.barangay !== filterBarangay) return false;
    return true;
  });

  // Sorting logic
  const sortedIncidents = [...filteredIncidents].sort((a, b) => {
    if (!sortColumn) return 0;
    
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
        aValue = a.severity;
        bValue = b.severity;
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
      case 'time':
        aValue = a.timeReported;
        bValue = b.timeReported;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedIncidents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedIncidents = sortedIncidents.slice(startIndex, endIndex);

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
  }, [filterType, filterStatus, filterBarangay]);

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

  const departments = departmentsList || [];

  const openVerifyAssignModal = (incident) => {
    setVerifyAssignIncident(incident);
    setAssignDepartmentId(incident.assignedDepartmentId || '');
    setVerifyAssignModalOpen(true);
  };

  const closeVerifyAssignModal = () => {
    setVerifyAssignModalOpen(false);
    setVerifyAssignIncident(null);
    setAssignDepartmentId('');
    setAssignSelectOpen(false);
  };

  const submitVerifyAndAssign = () => {
    if (!verifyAssignIncident || !assignDepartmentId) return;
    const dept = departments.find((d) => d.id === assignDepartmentId);
    const assignedDepartment = dept ? dept.name : '';
    Swal.fire({
      title: 'Confirm verification',
      html: `Assign incident <strong>${verifyAssignIncident.id}</strong> to <strong>${assignedDepartment}</strong>? The department will be able to give updates.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#134178',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Verify & Assign',
      cancelButtonText: 'Cancel',
      customClass: { popup: 'rounded-2xl shadow-xl', title: 'text-foreground text-xl', htmlContainer: 'text-muted' },
    }).then((result) => {
      if (result.isConfirmed) {
        setIncidents((prev) =>
          prev.map((inc) =>
            inc.id === verifyAssignIncident.id
              ? {
                  ...inc,
                  verified: true,
                  status: 'Verified',
                  assignedDepartmentId: assignDepartmentId,
                  assignedDepartment,
                }
              : inc
          )
        );
        closeVerifyAssignModal();
        Swal.fire({
          icon: 'success',
          title: 'Incident verified',
          text: `Assigned to ${assignedDepartment}. The department can now update this incident.`,
          timer: 2500,
          showConfirmButton: false,
          timerProgressBar: true,
          customClass: { popup: 'rounded-2xl shadow-xl' },
        });
      }
    });
  };

  const openCallModal = (incident) => {
    setCallIncident(incident);
    setCallTarget(incident.assignedDepartmentId ? 'department' : 'reporter');
    setCallDepartmentId(incident.assignedDepartmentId || (departments[0]?.id || ''));
    setCallModalOpen(true);
  };

  const closeCallModal = () => {
    setCallModalOpen(false);
    setCallIncident(null);
    setCallTarget('reporter');
    setCallDepartmentId('');
    setCallDeptSelectOpen(false);
  };

  const getDepartmentContactPhone = (departmentId) => {
    const dept = departments.find((d) => d.id === departmentId);
    if (!dept) return null;
    const contactMap = {
      bfp: '+63 75 523 1234',
      pnp: '+63 75 522 5678',
      health: '+63 75 523 9012',
      drrmo: '+63 75 524 3456',
      barangay: '+63 75 522 7890',
    };
    return contactMap[departmentId] || null;
  };

  const criticalIncidents = incidents.filter(i => i.severity === 'Critical');

  const typeOptions = [
    { value: 'All', label: 'All Types' },
    { value: 'Fire', label: 'Fire' },
    { value: 'Medical', label: 'Medical' },
    { value: 'Police', label: 'Police' },
    { value: 'Disaster', label: 'Disaster' },
  ];

  const statusOptions = [
    { value: 'All', label: 'All Status' },
    { value: 'New', label: 'New' },
    { value: 'Verified', label: 'Verified' },
    { value: 'In Progress', label: 'In Progress' },
    { value: 'Resolved', label: 'Resolved' },
  ];

  const barangayOptions = [
    { value: 'All', label: 'All Barangays' },
    ...barangays.map(b => ({ value: b, label: b })),
  ];

  const heroCardClass = `rounded-3xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80 border-gray-200/80 shadow-[8px_8px_24px_rgba(209,213,219,0.5),-8px_-8px_24px_rgba(255,255,255,0.9)]' : 'glass neumorphic-dark bg-card/60 border-white/10 shadow-[8px_8px_24px_rgba(0,0,0,0.35),-6px_-6px_20px_rgba(19,65,120,0.2)]'}`;
  const heroIconClass = `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'}`;

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto">
        <div className={`${heroCardClass} mb-6`}>
          <div className="p-8 flex flex-wrap items-center gap-6">
            <div className={heroIconClass}>
              <Activity className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Incident Overview</h1>
              <p className="text-muted mt-1">Monitor and manage emergency incidents across Dagupan City</p>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-primary/15 border-2 border-primary/50 rounded-xl flex items-center justify-between">
            <p className="text-primary font-medium">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchIncidents}>Retry</Button>
          </div>
        )}

        {/* Alert Banner – extra top margin so it sits clearly below the hero */}
        {criticalIncidents.length > 0 && (
          <div className="mt-4 mb-6 p-4 bg-primary/15 border-2 border-primary/50 rounded-xl flex items-start gap-3 shadow-card hover:shadow-card-hover transition-all duration-300 animate-pulse-glow">
            <IconContainer className={isLight ? 'bg-white border-border' : 'bg-primary/20 border-primary/50'}>
              <AlertTriangle className="w-6 h-6 text-primary" />
            </IconContainer>
            <div className="flex-1">
              <h3 className="font-semibold text-primary">Critical Incidents Detected</h3>
              <p className="text-sm text-foreground/90 mt-1">
                {criticalIncidents.length} critical incident(s) requiring immediate attention
              </p>
            </div>
          </div>
        )}

        {/* Stats – reference card layout: icon + pill tag, value, label */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          {/* Total Incidents */}
          <Card className={`rounded-2xl border shadow-sm transition-all duration-300 hover:shadow-md overflow-hidden ${
            isLight ? 'bg-white border-gray-100' : 'bg-card border-border'
          }`}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isLight ? 'bg-secondary/20' : 'bg-secondary/30'
                }`}>
                  <Activity className={`w-6 h-6 ${isLight ? 'text-secondary' : 'text-secondary-light'}`} />
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  isLight ? 'bg-gray-100 text-gray-600' : 'bg-white/10 text-muted'
                }`}>
                  Overview
                </span>
              </div>
              <p className="text-4xl font-bold text-foreground tracking-tight">{incidents.length}</p>
              <p className="text-sm font-medium text-muted mt-1">Total Incidents</p>
            </div>
          </Card>

          {/* Critical */}
          <Card className={`rounded-2xl border shadow-sm transition-all duration-300 hover:shadow-md overflow-hidden ${
            isLight ? 'bg-white border-gray-100' : 'bg-card border-border'
          }`}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-primary" />
                </div>
                <span className="rounded-full px-2.5 py-1 text-xs font-medium bg-primary/15 text-primary border border-primary/40">
                  Action Required
                </span>
              </div>
              <p className="text-4xl font-bold text-foreground tracking-tight">{incidents.filter(i => i.severity === 'Critical').length}</p>
              <p className="text-sm font-medium text-muted mt-1">Critical</p>
            </div>
          </Card>

          {/* In Progress */}
          <Card className={`rounded-2xl border shadow-sm transition-all duration-300 hover:shadow-md overflow-hidden ${
            isLight ? 'bg-white border-gray-100' : 'bg-card border-border'
          }`}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  isLight ? 'bg-amber-50 text-amber-700' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  Active
                </span>
              </div>
              <p className="text-4xl font-bold text-foreground tracking-tight">{incidents.filter(i => i.status === 'In Progress').length}</p>
              <p className="text-sm font-medium text-muted mt-1">In Progress</p>
            </div>
          </Card>

          {/* Resolved */}
          <Card className={`rounded-2xl border shadow-sm transition-all duration-300 hover:shadow-md overflow-hidden ${
            isLight ? 'bg-white border-gray-100' : 'bg-card border-border'
          }`}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-severity-resolved/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-severity-resolved" />
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  isLight ? 'bg-emerald-50 text-emerald-700' : 'bg-severity-resolved/20 text-severity-resolved'
                }`}>
                  Completed
                </span>
              </div>
              <p className="text-4xl font-bold text-foreground tracking-tight">{incidents.filter(i => i.severity === 'Resolved').length}</p>
              <p className="text-sm font-medium text-muted mt-1">Resolved</p>
            </div>
          </Card>
        </div>

        {/* Filters – glassmorphism + neumorphism (overflow-visible so dropdowns show; z-10 when dropdown open so list doesn't cover) */}
        <div className={`relative mb-6 rounded-2xl overflow-visible border transition-all duration-300 ${
          selectStates.type || selectStates.status || selectStates.barangay ? 'z-10' : ''
        } ${isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'}`}>
          <div className={`flex items-center gap-3 px-6 py-4 border-b ${
            isLight ? 'border-gray-200/80 bg-gray-50/50' : 'border-white/10 bg-white/5'
          }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'
            }`}>
              <SlidersHorizontal className="w-5 h-5" strokeWidth={2} />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Filters</h3>
          </div>
          <div className="p-6 flex flex-wrap gap-6">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-muted mb-2 block">Emergency Type</label>
              <Select value={filterType} onValueChange={setFilterType}>
                {({ isOpen, setIsOpen, value, onValueChange }) => (
                  <>
                    <SelectTrigger isOpen={selectStates.type} onClick={() => setSelectStates({ ...selectStates, type: !selectStates.type })} className={isLight ? 'bg-gray-50/80 border-gray-200' : 'bg-white/5 border-white/10'}>
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
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-muted mb-2 block">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                {({ isOpen, setIsOpen, value, onValueChange }) => (
                  <>
                    <SelectTrigger isOpen={selectStates.status} onClick={() => setSelectStates({ ...selectStates, status: !selectStates.status })} className={isLight ? 'bg-gray-50/80 border-gray-200' : 'bg-white/5 border-white/10'}>
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
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-muted mb-2 block">Barangay</label>
              <Select value={filterBarangay} onValueChange={setFilterBarangay}>
                {({ isOpen, setIsOpen, value, onValueChange }) => (
                  <>
                    <SelectTrigger isOpen={selectStates.barangay} onClick={() => setSelectStates({ ...selectStates, barangay: !selectStates.barangay })} className={isLight ? 'bg-gray-50/80 border-gray-200' : 'bg-white/5 border-white/10'}>
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
          </div>
        </div>

        {/* Incidents Table – glassmorphism + neumorphism (z-0 so Filters dropdown can sit above) */}
        <div className={`relative z-0 rounded-2xl overflow-visible border transition-all duration-300 ${
          isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'
        }`}>
          <div className={`flex items-center gap-3 px-6 py-4 border-b ${
            isLight ? 'border-gray-200/80 bg-gray-50/50' : 'border-white/10 bg-white/5'
          }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'
            }`}>
              <LayoutList className="w-5 h-5" strokeWidth={2} />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Incident List</h3>
            <span className={`ml-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isLight ? 'bg-primary/15 text-primary' : 'bg-primary/20 text-primary'
            }`}>
              {filteredIncidents.length}
            </span>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border border-border/50 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className={isLight ? 'bg-gray-50/80' : 'bg-white/5'}>
                        <th
                          className="text-left py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleSort('id')}
                        >
                          <div className="flex items-center gap-1">Incident ID{getSortIcon('id')}</div>
                        </th>
                        <th
                          className="text-left py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleSort('reporter')}
                        >
                          <div className="flex items-center gap-1">Reporter{getSortIcon('reporter')}</div>
                        </th>
                        <th
                          className="text-left py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleSort('barangay')}
                        >
                          <div className="flex items-center gap-1">Barangay{getSortIcon('barangay')}</div>
                        </th>
                        <th
                          className="text-left py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleSort('type')}
                        >
                          <div className="flex items-center gap-1">Type{getSortIcon('type')}</div>
                        </th>
                        <th
                          className="text-left py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleSort('severity')}
                        >
                          <div className="flex items-center gap-1">Severity{getSortIcon('severity')}</div>
                        </th>
                        <th
                          className="text-left py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleSort('status')}
                        >
                          <div className="flex items-center gap-1">Status{getSortIcon('status')}</div>
                        </th>
                        <th
                          className="text-left py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => handleSort('time')}
                        >
                          <div className="flex items-center gap-1">Time Reported{getSortIcon('time')}</div>
                        </th>
                        <th className="text-left py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedIncidents.map((incident, idx) => (
                        <tr
                          key={incident.id}
                          className={`border-t border-border/50 transition-colors ${
                            isLight ? (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50') : (idx % 2 === 0 ? 'bg-transparent' : 'bg-white/5')
                          } hover:bg-primary/5`}
                        >
                          <td className="py-3.5 px-4 text-sm font-mono text-foreground">{incident.id}</td>
                          <td className="py-3.5 px-4 text-sm font-medium text-foreground">{incident.reporterName}</td>
                          <td className="py-3.5 px-4 text-sm text-muted">{incident.barangay}</td>
                          <td className="py-3.5 px-4 text-sm text-foreground">
                            <span className="mr-1">{getTypeEmoji(incident.emergencyType)}</span>
                            {incident.emergencyType}
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge className={`${getSeverityColor(incident.severity)} border rounded-lg px-2.5 py-1 text-xs font-semibold`}>
                              {(incident.severity || '—').toString().toUpperCase()}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge className={`${getStatusColor(incident.status)} border rounded-lg px-2.5 py-1 text-xs font-semibold`}>
                              {(incident.status || '—').toString().toUpperCase()}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-sm text-muted">{incident.timeReported}</td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-9 w-9 p-0 rounded-lg text-foreground/80 hover:bg-primary/15 hover:text-primary transition-all"
                                onClick={(e) => { e.stopPropagation(); navigate(`/incidents/${incident.id}`); }}
                                title="View Details"
                              >
                                <ExternalLink className="w-4 h-4" strokeWidth={2} />
                              </Button>
                              {!incident.verified && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-9 w-9 p-0 rounded-lg text-severity-resolved hover:bg-severity-resolved/20 transition-all"
                                  onClick={(e) => { e.stopPropagation(); openVerifyAssignModal(incident); }}
                                  title="Verify & Assign to Department"
                                >
                                  <CircleCheck className="w-4 h-4" strokeWidth={2} />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-9 w-9 p-0 rounded-lg text-foreground/80 hover:bg-secondary/20 hover:text-foreground transition-all"
                                onClick={(e) => { e.stopPropagation(); openCallModal(incident); }}
                                title="Call Reporter or Department"
                              >
                                <PhoneCall className="w-4 h-4" strokeWidth={2} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className={`flex items-center justify-end gap-2 mt-4 pt-4 border-t ${
                    isLight ? 'border-gray-200' : 'border-white/10'
                  }`}>
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
                )}
              </>
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
                  <Label className="text-foreground">Assign to department *</Label>
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
                            options={[{ value: '', label: 'Select department' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
                            placeholder="Select department"
                          />
                        </SelectTrigger>
                        <SelectContent isOpen={assignSelectOpen} dropdownRect={dropdownRect}>
                          <SelectItem value="" onSelect={() => { setAssignDepartmentId(''); setAssignSelectOpen(false); }}>Select department</SelectItem>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={d.id} onSelect={(v) => { setAssignDepartmentId(v); setAssignSelectOpen(false); }}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </>
                    )}
                  </Select>
                </div>
                <DialogFooter>
                  <Button onClick={submitVerifyAndAssign} disabled={!assignDepartmentId} className="bg-primary text-white hover:bg-primary-hover">
                    Verify & Assign
                  </Button>
                  <Button variant="outline" onClick={closeVerifyAssignModal}>Cancel</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Call Modal — call reporter or department */}
        <Dialog open={callModalOpen} onOpenChange={(open) => !open && closeCallModal()} className="max-w-md">
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Call</DialogTitle>
              <DialogDescription>
                Call the reporter or the assigned department for this incident.
              </DialogDescription>
            </DialogHeader>
            {callIncident && (
              <div className="space-y-4 mt-4">
                <div className="rounded-xl border border-border/50 p-3 bg-muted/20">
                  <p className="text-sm font-medium text-foreground">{callIncident.id}</p>
                  <p className="text-sm text-muted">{callIncident.reporterName} · {callIncident.emergencyType}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={callTarget === 'reporter' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCallTarget('reporter')}
                    className={callTarget === 'reporter' ? 'bg-primary text-white' : ''}
                  >
                    Call Reporter
                  </Button>
                  <Button
                    variant={callTarget === 'department' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCallTarget('department')}
                    className={callTarget === 'department' ? 'bg-primary text-white' : ''}
                  >
                    Call Department
                  </Button>
                </div>
                {callTarget === 'reporter' && (
                  <div>
                    <Label className="text-muted text-xs">Reporter phone</Label>
                    <p className="text-foreground font-medium mt-1">{callIncident.reporterPhone || '—'}</p>
                    {callIncident.reporterPhone && (
                      <a href={`tel:${callIncident.reporterPhone.replace(/\s/g, '')}`} className="inline-flex items-center gap-2 mt-2 text-primary hover:underline">
                        <PhoneCall className="w-4 h-4" />
                        Dial number
                      </a>
                    )}
                  </div>
                )}
                {callTarget === 'department' && (
                  <div>
                    <Label className="text-foreground">Department</Label>
                    <Select value={callDepartmentId} onValueChange={setCallDepartmentId} open={callDeptSelectOpen} onOpenChange={setCallDeptSelectOpen}>
                      {({ value, onValueChange, dropdownRect }) => (
                        <>
                          <SelectTrigger isOpen={callDeptSelectOpen} onClick={() => setCallDeptSelectOpen((o) => !o)} className="mt-1.5">
                            <SelectValue value={value} options={departments.map((d) => ({ value: d.id, label: d.name }))} />
                          </SelectTrigger>
                          <SelectContent isOpen={callDeptSelectOpen} dropdownRect={dropdownRect}>
                            {departments.map((d) => (
                              <SelectItem key={d.id} value={d.id} onSelect={(v) => { setCallDepartmentId(v); setCallDeptSelectOpen(false); }}>{d.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </>
                      )}
                    </Select>
                    {(() => {
                      const phone = getDepartmentContactPhone(callDepartmentId);
                      return (
                        <div className="mt-3">
                          <Label className="text-muted text-xs">Department contact</Label>
                          <p className="text-foreground font-medium mt-1">{phone || '—'}</p>
                          {phone && (
                            <a href={`tel:${phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-2 mt-2 text-primary hover:underline">
                              <PhoneCall className="w-4 h-4" />
                              Dial number
                            </a>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
                <DialogFooter className="justify-end">
                  <Button variant="outline" onClick={closeCallModal}>Close</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
