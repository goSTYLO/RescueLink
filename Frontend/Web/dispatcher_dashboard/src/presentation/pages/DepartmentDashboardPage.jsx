import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/presentation/components/layout/Layout';
import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';
import { Badge } from '@/presentation/components/ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/presentation/components/ui/Dialog';
import { Eye, Truck, MapPin, CheckCircle, AlertCircle, LayoutDashboard, UserPlus, X, Clock, Shield } from 'lucide-react';
import { getIncidents, normalizeIncidentStatus } from '@/data/api/incidents.api';
import { getDepartmentById, getDepartmentUnits, assignDepartmentUnit } from '@/data/api/departments.api';
import { getResponderTeams } from '@/data/api/responders.api';
import { createDispatch } from '@/data/api/dispatches.api';
import { inferDepartmentSectorCode, normalizeSectorCode } from '@/core/utils/departmentSector';
import { ROLES } from '@/core/constants';
import { useTheme } from '@/presentation/context/ThemeContext';
import Swal from 'sweetalert2';

function mapApiIncidentToRow(api) {
  const typeMap = { fire: 'Fire', medical: 'Medical', police: 'Police', disaster: 'Disaster', other: 'Other' };
  const emergencyType = typeMap[api.incident_type?.toLowerCase()] || (api.incident_type ? String(api.incident_type).charAt(0).toUpperCase() + String(api.incident_type).slice(1) : '—');
  const severityMap = { high: 'Critical', medium: 'Warning', low: 'Low' };
  const severity = severityMap[api.severity_level?.toLowerCase()] || (api.severity_level || '—');
  const statusMap = { pending: 'Pending', resolved: 'Resolved', verified: 'Verified', in_progress: 'In Progress' };
  const canonicalStatus = normalizeIncidentStatus(api.status);
  const status = statusMap[canonicalStatus];
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
    barangay: api.barangay || '—',
    emergencyType,
    severity,
    status,
    timeReported,
  };
}

const ASSIGNMENTS_STORAGE_KEY = 'rescuelink_incident_personnel_assignments';
const VEHICLE_ASSIGNMENTS_STORAGE_KEY = 'rescuelink_incident_vehicle_assignments';

function getStoredAssignments() {
  try {
    const raw = localStorage.getItem(ASSIGNMENTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getStoredVehicleAssignments() {
  try {
    const raw = localStorage.getItem(VEHICLE_ASSIGNMENTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function DepartmentDashboardPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const departmentId = user.departmentId || user.department_id;

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assignments, setAssignments] = useState(getStoredAssignments);
  const [vehicleAssignments, setVehicleAssignments] = useState(getStoredVehicleAssignments);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assigningIncidentId, setAssigningIncidentId] = useState(null);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [assigningIncidentIdVehicle, setAssigningIncidentIdVehicle] = useState(null);
  const [department, setDepartment] = useState(null);
  const [departmentSectorCode, setDepartmentSectorCode] = useState('');
  const [teams, setTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [unitsList, setUnitsList] = useState([]);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getIncidents({ limit: 100, offset: 0, withMeta: false });
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
    const intervalId = setInterval(fetchIncidents, 15000);
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

  useEffect(() => {
    try {
      localStorage.setItem(VEHICLE_ASSIGNMENTS_STORAGE_KEY, JSON.stringify(vehicleAssignments));
    } catch (_) {}
  }, [vehicleAssignments]);

  const departmentIncidents = incidents;
  const activeIncidents = departmentIncidents.filter((i) => i.status !== 'Resolved' && i.status !== 'resolved');

  const getAssignment = useCallback((incidentId) => assignments[incidentId] || null, [assignments]);
  const getVehicleAssignment = useCallback((incidentId) => vehicleAssignments[incidentId] || null, [vehicleAssignments]);
  const [assigningVehicleId, setAssigningVehicleId] = useState(null);
  const assignVehicleToIncident = useCallback(async (incidentId, unitId, unitName) => {
    if (!departmentId || !incidentId || !unitId) return;
    setAssigningVehicleId(unitId);
    try {
      await assignDepartmentUnit(departmentId, unitId, Number(incidentId));
      const list = await getDepartmentUnits(departmentId);
      setUnitsList((Array.isArray(list) ? list : []).map((u) => ({
        id: u.unit_id,
        name: u.name,
        type: u.type,
        status: u.status || 'Available',
      })));
      setVehicleAssignments((prev) => ({ ...prev, [incidentId]: { vehicleId: unitId, name: unitName } }));
      setVehicleModalOpen(false);
      setAssigningIncidentIdVehicle(null);
      Swal.fire({
        icon: 'success',
        title: 'Vehicle assigned',
        html: `<strong>${unitName}</strong> has been assigned to incident <strong>${incidentId}</strong>. Status set to On Dispatch.`,
        timer: 2500,
        showConfirmButton: false,
        timerProgressBar: true,
        customClass: { popup: 'rounded-2xl shadow-xl' },
      });
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'Assign failed',
        text: e?.message || 'Failed to assign vehicle',
        customClass: { popup: 'rounded-2xl shadow-xl' },
      });
    } finally {
      setAssigningVehicleId(null);
    }
  }, [departmentId]);

  const assignTeamToIncident = useCallback(async (incidentId, team) => {
    if (!department?.code || !department?.name || !team?.team_name) return;
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
  }, [department, fetchIncidents]);

  const openAssignModal = (incidentId) => {
    setAssigningIncidentId(incidentId);
    setAssignModalOpen(true);
  };
  const closeAssignModal = () => {
    setAssignModalOpen(false);
    setAssigningIncidentId(null);
  };
  const openVehicleAssignModal = (incidentId) => {
    setAssigningIncidentIdVehicle(incidentId);
    setVehicleModalOpen(true);
  };
  const closeVehicleAssignModal = () => {
    setVehicleModalOpen(false);
    setAssigningIncidentIdVehicle(null);
  };

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
    };
    const cls = map[s] || 'bg-muted text-muted-foreground';
    return <Badge className={cls}>{status || '—'}</Badge>;
  };

  const getTypeIcon = (type) => {
    const icons = { Fire: '🔥', Medical: '🏥', Police: '👮', Disaster: '⚠️' };
    return icons[String(type)] || '📋';
  };

  const heroCardClass = `rounded-3xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80 border-gray-200/80 shadow-[8px_8px_24px_rgba(209,213,219,0.5),-8px_-8px_24px_rgba(255,255,255,0.9)]' : 'glass neumorphic-dark bg-card/60 border-white/10 shadow-[8px_8px_24px_rgba(0,0,0,0.35),-6px_-6px_20px_rgba(19,65,120,0.2)]'}`;
  const heroIconClass = `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'}`;

  if (user.role !== ROLES.DEPARTMENT_ADMIN && user.role !== ROLES.PERSONNEL) return null;

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className={heroCardClass}>
          <div className="p-8 flex flex-wrap items-center gap-6">
            <div className={heroIconClass}>
              <LayoutDashboard className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Department Dashboard</h1>
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 rounded-2xl border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Total Assigned</p>
                <p className="text-2xl font-bold text-foreground">{departmentIncidents.length}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Truck className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>
          <Card className="p-4 rounded-2xl border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Awaiting Action</p>
                <p className="text-2xl font-bold text-foreground">{departmentIncidents.filter((i) => i.status === 'Verified' || i.status === 'verified' || i.status === 'New').length}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-indigo-400" />
              </div>
            </div>
          </Card>
          <Card className="p-4 rounded-2xl border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">In Progress</p>
                <p className="text-2xl font-bold text-foreground">{departmentIncidents.filter((i) => i.status === 'In Progress' || i.status === 'in-progress').length}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Truck className="w-6 h-6 text-amber-400" />
              </div>
            </div>
          </Card>
          <Card className="p-4 rounded-2xl border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Resolved</p>
                <p className="text-2xl font-bold text-foreground">{departmentIncidents.filter((i) => i.status === 'Resolved' || i.status === 'resolved').length}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </Card>
        </div>

        <Card className="rounded-2xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-xl font-semibold text-foreground">Assigned Incidents</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={isLight ? 'bg-gray-50 border-b border-gray-200' : 'bg-muted/30 border-b border-border'}>
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Incident ID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Location</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Severity</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Assigned To</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Vehicle</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Reported</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted">Loading incidents…</td>
                  </tr>
                ) : (
                departmentIncidents.map((incident) => (
                  <tr key={incident.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => navigate(`/incidents/${incident.id}`)} className="text-sm font-medium text-primary hover:underline">
                        {incident.id}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center gap-1">
                        {getTypeIcon(incident.emergencyType)}
                        <span className="capitalize text-foreground">{incident.emergencyType}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4 text-muted" />
                        {incident.barangay}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={getSeverityColor(incident.severity)}>{String(incident.severity || '—')}</Badge>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(incident.status)}</td>
                    <td className="px-4 py-3 text-sm text-muted">
                      {getAssignment(incident.id) ? (getAssignment(incident.id).teamName || getAssignment(incident.id).name) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">
                      {getVehicleAssignment(incident.id) ? getVehicleAssignment(incident.id).name : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">{incident.timeReported || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {user.role === ROLES.DEPARTMENT_ADMIN && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => openAssignModal(incident.id)} className="text-primary" title="Assign personnel">
                              <UserPlus className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => openVehicleAssignModal(incident.id)} className="text-primary" title="Assign vehicle">
                              <Truck className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/incidents/${incident.id}`)} className="text-primary" title="View details">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {!loading && !error && departmentIncidents.length === 0 && (
          <div className="text-center py-12 text-muted">
            <p className="text-lg">No incidents assigned to your department yet</p>
          </div>
        )}

        <Card className="p-4 bg-primary/5 border-primary/20 rounded-2xl">
          <h3 className="font-semibold text-foreground mb-2">Notes</h3>
          <ul className="text-sm text-muted space-y-1 list-disc list-inside">
            <li>Click an incident ID to view details and update status</li>
            <li>Use the assign icons to assign personnel or a vehicle to an incident (Dept Admin)</li>
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
              {!teamsLoading && teams.map((team) => (
                <button
                  key={team.team_id}
                  type="button"
                  onClick={() => assignTeamToIncident(assigningIncidentId, team)}
                  className={`w-full text-left flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all duration-200 ${
                    isLight
                      ? 'border-gray-200/80 bg-white hover:bg-primary/5 hover:border-primary/30 cursor-pointer shadow-sm'
                      : 'border-white/10 bg-white/5 hover:bg-primary/10 hover:border-primary/30 cursor-pointer'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'bg-primary/15 text-primary' : 'bg-primary/20 text-primary'}`}>
                    <Shield className="w-5 h-5" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{team.team_name}</p>
                    <p className="text-sm text-muted">{String(team.department_code || '').toUpperCase()} · {String(team.team_status || 'available').toLowerCase()}</p>
                  </div>
                  {Array.isArray(team.supported_incident_types) && team.supported_incident_types.length > 0 && (
                    <span className="flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium bg-muted/50 text-muted-foreground">
                      {team.supported_incident_types.slice(0, 2).join(', ')}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {!teamsLoading && teams.length === 0 && <p className="text-sm text-muted py-6 text-center">No teams in this department. Create teams in the Personnel page first.</p>}
          </DialogContent>
        </Dialog>

        {/* Assign Vehicle Modal — Dept Admin only */}
        <Dialog open={vehicleModalOpen} onOpenChange={(open) => !open && closeVehicleAssignModal()} className="max-w-md">
          <DialogContent className={`max-w-md rounded-2xl overflow-hidden ${isLight ? 'glass neumorphic-light bg-white/95 border-gray-200/80' : 'glass neumorphic-dark bg-card/95 border-white/10'}`}>
            <div className={`flex items-center justify-between border-b ${isLight ? 'border-gray-200/80 pb-4' : 'border-white/10 pb-4'}`}>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-foreground">Assign vehicle</DialogTitle>
                <p className="text-sm text-muted mt-1">
                  {assigningIncidentIdVehicle ? `Select a vehicle for ${assigningIncidentIdVehicle}` : 'Select a vehicle'}
                </p>
              </DialogHeader>
              <button type="button" onClick={closeVehicleAssignModal} className={`p-2 rounded-xl transition-colors ${isLight ? 'hover:bg-gray-100 text-gray-500' : 'hover:bg-white/10 text-muted'}`} aria-label="Close">
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>
            <div className="mt-4 space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {unitsList.map((u) => {
                const isAvailable = String(u.status || '').toLowerCase() === 'available';
                const isAssigning = assigningVehicleId === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => assignVehicleToIncident(assigningIncidentIdVehicle, u.id, u.name)}
                    disabled={isAssigning}
                    className={`w-full text-left flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all duration-200 ${isLight ? 'border-gray-200/80 bg-white hover:bg-primary/5 hover:border-primary/30 cursor-pointer shadow-sm' : 'border-white/10 bg-white/5 hover:bg-primary/10 hover:border-primary/30 cursor-pointer'}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isAvailable ? (isLight ? 'bg-green-500/15 text-green-600' : 'bg-green-500/20 text-green-400') : (isLight ? 'bg-amber-500/15 text-amber-600' : 'bg-amber-500/20 text-amber-400')}`}>
                      {isAvailable ? <Truck className="w-5 h-5" strokeWidth={2} /> : <Clock className="w-5 h-5" strokeWidth={2} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">{u.name}</p>
                      <p className="text-sm text-muted">{u.type} · {u.id}</p>
                    </div>
                    <span className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium ${isAvailable ? 'bg-green-500/20 text-green-600' : 'bg-amber-500/20 text-amber-600'}`}>{isAssigning ? 'Assigning…' : u.status}</span>
                  </button>
                );
              })}
            </div>
            {unitsList.length === 0 && <p className="text-sm text-muted py-6 text-center">No vehicles in this department</p>}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
