import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/presentation/components/layout/Layout';
import { Card } from '@/presentation/components/ui/Card';
import { Badge } from '@/presentation/components/ui/Badge';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Label } from '@/presentation/components/ui/Label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/presentation/components/ui/Dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/presentation/components/ui/Tabs';
import { Combobox } from '@/presentation/components/ui/Combobox';
import {
  Users,
  Shield,
  PlusCircle,
  UserPlus,
  Eye,
  MapPin,
  X,
  UserCheck,
  Truck,
  Clock,
} from 'lucide-react';
import { getDepartmentById, getDepartmentUnits, assignDepartmentUnit } from '@/data/api/departments.api';
import {
  getResponders,
  getResponderTeams,
  getTeamMembers,
  createResponder,
  createResponderTeam,
  addTeamMember,
  removeTeamMember,
  updateResponderStatus,
  updateResponderTeamStatus,
} from '@/data/api/responders.api';
import { personnel as mockPersonnel, incidents as mockIncidents } from '@/data/mock/mockData';
import { ROLES } from '@/core/constants';
import { normalizeSectorCode, inferDepartmentSectorCode } from '@/core/utils/departmentSector';
import { useTheme } from '@/presentation/context/ThemeContext';
import { Breadcrumb } from '@/presentation/components/common/Breadcrumb';
import Swal from 'sweetalert2';

const ASSIGNMENTS_STORAGE_KEY = 'rescuelink_incident_personnel_assignments';
const VEHICLE_ASSIGNMENTS_STORAGE_KEY = 'rescuelink_incident_vehicle_assignments';
const AVAILABILITY_OPTIONS = ['available', 'standby', 'busy', 'off-duty'];
const TASK_TYPES = ['fire', 'medical', 'police', 'disaster', 'sos'];
const teamsPerPage = 5;
const respondersPerPage = 5;
const teamMembersPerPage = 5;

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

function toggleTaskType(values, taskType) {
  if (values.includes(taskType)) return values.filter((entry) => entry !== taskType);
  return [...values, taskType];
}

export function DepartmentPersonnelPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const departmentId = user.departmentId ?? user.department_id;
  const isDeptAdmin = user.role === ROLES.DEPARTMENT_ADMIN;

  const [department, setDepartment] = useState(null);
  const [inferredSectorCode, setInferredSectorCode] = useState('');
  const [teams, setTeams] = useState([]);
  const [responders, setResponders] = useState([]);
  const [teamMembersByTeamId, setTeamMembersByTeamId] = useState({});
  const [loadingDept, setLoadingDept] = useState(true);
  const [loadingResources, setLoadingResources] = useState(true);

  const [createTeamDialogOpen, setCreateTeamDialogOpen] = useState(false);
  const [teamForm, setTeamForm] = useState({ department_code: 'drrmo', team_name: '', team_status: 'available', supported_incident_types: [] });
  const [manageMembersDialogOpen, setManageMembersDialogOpen] = useState(false);
  const [selectedTeamForMembers, setSelectedTeamForMembers] = useState(null);
  const [memberForm, setMemberForm] = useState({ responder_id: '' });
  const [teamSearch, setTeamSearch] = useState('');
  const [teamStatusFilter, setTeamStatusFilter] = useState('all');
  const [teamPage, setTeamPage] = useState(1);
  const [responderSearch, setResponderSearch] = useState('');
  const [responderStatusFilter, setResponderStatusFilter] = useState('all');
  const [responderTeamFilter, setResponderTeamFilter] = useState('all');
  const [responderPage, setResponderPage] = useState(1);
  const [responderForm, setResponderForm] = useState({ name: '', organization: '', contact_number: '', availability_status: 'available', team_name: '', supported_incident_types: [] });
  const [teamMemberSearch, setTeamMemberSearch] = useState('');
  const [teamMemberStatusFilter, setTeamMemberStatusFilter] = useState('all');
  const [teamMemberPage, setTeamMemberPage] = useState(1);

  const [assignments, setAssignments] = useState(getStoredAssignments);
  const [vehicleAssignments, setVehicleAssignments] = useState(getStoredVehicleAssignments);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assigningIncidentId, setAssigningIncidentId] = useState(null);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [assigningIncidentIdVehicle, setAssigningIncidentIdVehicle] = useState(null);
  const [unitsList, setUnitsList] = useState([]);
  const [assigningVehicleId, setAssigningVehicleId] = useState(null);

  useEffect(() => {
    const role = user.role || '';
    if (role !== ROLES.DEPARTMENT_ADMIN && role !== ROLES.PERSONNEL) {
      navigate('/dashboard', { replace: true });
    }
  }, [user.role, navigate]);

  useEffect(() => {
    if (!departmentId) {
      setLoadingDept(false);
      return;
    }
    let cancelled = false;
    getDepartmentById(departmentId)
      .then((dept) => {
        if (cancelled) return;
        setDepartment(dept);
        setInferredSectorCode(inferDepartmentSectorCode(dept));
      })
      .catch(() => {
        if (!cancelled) setDepartment(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingDept(false);
      });
    return () => { cancelled = true; };
  }, [departmentId]);

  const loadResponderResources = useCallback(async () => {
    try {
      const [responderRows, teamRows] = await Promise.all([
        getResponders({ limit: 300, offset: 0 }),
        getResponderTeams({ limit: 300, offset: 0 }),
      ]);
      setResponders(Array.isArray(responderRows) ? responderRows : []);
      setTeams(Array.isArray(teamRows) ? teamRows : []);
    } catch {
      setResponders([]);
      setTeams([]);
    } finally {
      setLoadingResources(false);
    }
  }, []);

  useEffect(() => {
    loadResponderResources();
  }, [loadResponderResources]);

  useEffect(() => {
    const handleIncidentUpdated = () => {
      loadResponderResources();
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
    };
    window.addEventListener('incident:updated', handleIncidentUpdated);
    return () => window.removeEventListener('incident:updated', handleIncidentUpdated);
  }, [loadResponderResources, departmentId]);

  const deptTeams = useMemo(() => {
    if (!inferredSectorCode) return [];
    return teams.filter((team) => normalizeSectorCode(team.department_code) === inferredSectorCode);
  }, [teams, inferredSectorCode]);

  const deptTeamNames = useMemo(() => new Set(deptTeams.map((t) => String(t.team_name || '').trim()).filter(Boolean)), [deptTeams]);

  const deptResponders = useMemo(() => {
    return responders.filter((r) => deptTeamNames.has(String(r.team_name || '').trim()));
  }, [responders, deptTeamNames]);

  useEffect(() => {
    const teamIds = deptTeams.map((t) => t.team_id).filter(Boolean);
    if (teamIds.length === 0) {
      setTeamMembersByTeamId({});
      return;
    }
    let cancelled = false;
    Promise.all(
      teamIds.map(async (teamId) => {
        try {
          const members = await getTeamMembers(teamId);
          return [teamId, Array.isArray(members) ? members : []];
        } catch {
          return [teamId, []];
        }
      })
    ).then((entries) => {
      if (!cancelled) setTeamMembersByTeamId(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [deptTeams]);

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

  const list = (mockPersonnel && departmentId && mockPersonnel[departmentId]) ? mockPersonnel[departmentId] : [];
  const departmentIncidents = (mockIncidents || []).filter((inc) => inc.assignedDepartmentId === departmentId);
  const activeDepartmentIncidents = departmentIncidents.filter((i) => i.status !== 'Resolved' && i.status !== 'resolved');
  const getAssignment = useCallback((incidentId) => assignments[incidentId] || null, [assignments]);
  const getVehicleAssignment = useCallback((incidentId) => vehicleAssignments[incidentId] || null, [vehicleAssignments]);
  const assignVehicleToIncident = useCallback(async (incidentId, unitId, unitName) => {
    if (!departmentId || !incidentId || !unitId) return;
    setAssigningVehicleId(unitId);
    try {
      await assignDepartmentUnit(departmentId, unitId, Number(incidentId));
      const rows = await getDepartmentUnits(departmentId);
      setUnitsList((Array.isArray(rows) ? rows : []).map((u) => ({
        id: u.unit_id,
        name: u.name,
        type: u.type,
        status: u.status || 'Available',
      })));
      setVehicleAssignments((prev) => ({ ...prev, [incidentId]: { vehicleId: unitId, name: unitName } }));
      setVehicleModalOpen(false);
      setAssigningIncidentIdVehicle(null);
      Swal.fire({ icon: 'success', title: 'Vehicle assigned', html: `<strong>${unitName}</strong> has been assigned. Status set to On Dispatch.`, timer: 2500, showConfirmButton: false, timerProgressBar: true });
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Assign failed', text: e?.message || 'Failed to assign vehicle' });
    } finally {
      setAssigningVehicleId(null);
    }
  }, [departmentId]);
  const setAssignment = useCallback((incidentId, personnelKey, name) => {
    setAssignments((prev) => ({ ...prev, [incidentId]: { personnelKey, name } }));
    setAssignModalOpen(false);
    setAssigningIncidentId(null);
    Swal.fire({ icon: 'success', title: 'Personnel assigned', html: `<strong>${name}</strong> has been assigned.`, timer: 2500, showConfirmButton: false, timerProgressBar: true });
  }, []);
  const openAssignModal = (incidentId) => { setAssigningIncidentId(incidentId); setAssignModalOpen(true); };
  const closeAssignModal = () => { setAssignModalOpen(false); setAssigningIncidentId(null); };
  const openVehicleAssignModal = (incidentId) => { setAssigningIncidentIdVehicle(incidentId); setVehicleModalOpen(true); };
  const closeVehicleAssignModal = () => { setVehicleModalOpen(false); setAssigningIncidentIdVehicle(null); };

  const handleCreateTeam = async () => {
    if (!teamForm.team_name.trim()) return;
    try {
      await createResponderTeam({
        department_code: inferredSectorCode || teamForm.department_code,
        team_name: teamForm.team_name.trim(),
        team_status: teamForm.team_status,
        supported_incident_types: teamForm.supported_incident_types,
      });
      setTeamForm((prev) => ({ ...prev, team_name: '', supported_incident_types: [] }));
      await loadResponderResources();
      setCreateTeamDialogOpen(false);
      Swal.fire({ icon: 'success', title: 'Team saved', timer: 1500, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Team save failed', text: error.message || 'Please try again.' });
    }
  };

  const handleCreateResponder = async () => {
    if (!responderForm.name.trim()) return;
    try {
      await createResponder({
        ...responderForm,
        name: responderForm.name.trim(),
        organization: responderForm.organization?.trim() || null,
        contact_number: responderForm.contact_number?.trim() || null,
        team_name: responderForm.team_name || null,
      });
      setResponderForm((prev) => ({ ...prev, name: '', contact_number: '' }));
      await loadResponderResources();
      Swal.fire({ icon: 'success', title: 'Responder added', timer: 1500, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Responder create failed', text: error.message || 'Please try again.' });
    }
  };

  const handleMapMember = async (teamId, responderId) => {
    if (!teamId || !responderId) return;
    try {
      await addTeamMember(Number(teamId), Number(responderId));
      setMemberForm({ responder_id: '' });
      await loadResponderResources();
      const members = await getTeamMembers(Number(teamId));
      setTeamMembersByTeamId((prev) => ({ ...prev, [Number(teamId)]: Array.isArray(members) ? members : [] }));
      Swal.fire({ icon: 'success', title: 'Responder mapped', timer: 1500, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Map failed', text: error.message || 'Please try again.' });
    }
  };

  const handleRemoveMember = async (teamId, responderId) => {
    try {
      await removeTeamMember(Number(teamId), Number(responderId));
      await loadResponderResources();
      const members = await getTeamMembers(Number(teamId));
      setTeamMembersByTeamId((prev) => ({ ...prev, [Number(teamId)]: Array.isArray(members) ? members : [] }));
      Swal.fire({ icon: 'success', title: 'Responder removed', timer: 1200, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Remove failed', text: error.message || 'Please try again.' });
    }
  };

  const teamStatusFiltered = useMemo(() => {
    const normalizedSearch = teamSearch.trim().toLowerCase();
    return deptTeams.filter((team) => {
      const teamStatus = String(team.team_status || 'available').toLowerCase();
      const teamName = String(team.team_name || '');
      const memberList = teamMembersByTeamId[team.team_id] || [];
      const memberNames = memberList.map((m) => String(m?.name || '')).join(' ');
      if (teamStatusFilter !== 'all' && teamStatus !== teamStatusFilter) return false;
      if (!normalizedSearch) return true;
      return `${teamName} ${teamStatus} ${memberNames}`.toLowerCase().includes(normalizedSearch);
    });
  }, [deptTeams, teamMembersByTeamId, teamSearch, teamStatusFilter]);

  const teamTotalPages = Math.max(1, Math.ceil(teamStatusFiltered.length / teamsPerPage));
  const safeTeamPage = Math.min(teamPage, teamTotalPages);
  const paginatedTeams = useMemo(() => {
    const start = (safeTeamPage - 1) * teamsPerPage;
    return teamStatusFiltered.slice(start, start + teamsPerPage);
  }, [teamStatusFiltered, safeTeamPage]);

  const teamRangeStart = teamStatusFiltered.length === 0 ? 0 : (safeTeamPage - 1) * teamsPerPage + 1;
  const teamRangeEnd = Math.min(safeTeamPage * teamsPerPage, teamStatusFiltered.length);

  const selectedTeamMembers = selectedTeamForMembers?.team_id ? (teamMembersByTeamId[selectedTeamForMembers.team_id] || []) : [];
  const selectedTeamMembersFiltered = useMemo(() => {
    const query = teamMemberSearch.trim().toLowerCase();
    return selectedTeamMembers.filter((member) => {
      const status = String(member.availability_status || 'available').toLowerCase();
      const name = String(member.name || '');
      if (teamMemberStatusFilter !== 'all' && status !== teamMemberStatusFilter) return false;
      if (!query) return true;
      return `${name} ${status}`.toLowerCase().includes(query);
    });
  }, [selectedTeamMembers, teamMemberSearch, teamMemberStatusFilter]);

  const teamMemberTotalPages = Math.max(1, Math.ceil(selectedTeamMembersFiltered.length / teamMembersPerPage));
  const safeTeamMemberPage = Math.min(teamMemberPage, teamMemberTotalPages);
  const paginatedTeamMembers = useMemo(() => {
    const start = (safeTeamMemberPage - 1) * teamMembersPerPage;
    return selectedTeamMembersFiltered.slice(start, start + teamMembersPerPage);
  }, [selectedTeamMembersFiltered, safeTeamMemberPage]);

  const responderTeamFilterOptions = useMemo(() => {
    const names = Array.from(new Set(deptResponders.map((r) => String(r.team_name || '').trim()).filter(Boolean)));
    return names.sort((a, b) => a.localeCompare(b));
  }, [deptResponders]);

  const responderStatusFiltered = useMemo(() => {
    const normalizedSearch = responderSearch.trim().toLowerCase();
    return deptResponders.filter((responder) => {
      const status = String(responder.availability_status || 'available').toLowerCase();
      const teamName = String(responder.team_name || '');
      const name = String(responder.name || '');
      if (responderStatusFilter !== 'all' && status !== responderStatusFilter) return false;
      if (responderTeamFilter !== 'all' && teamName !== responderTeamFilter) return false;
      if (!normalizedSearch) return true;
      return `${name} ${teamName} ${status}`.toLowerCase().includes(normalizedSearch);
    });
  }, [deptResponders, responderSearch, responderStatusFilter, responderTeamFilter]);

  const responderTotalPages = Math.max(1, Math.ceil(responderStatusFiltered.length / respondersPerPage));
  const safeResponderPage = Math.min(responderPage, responderTotalPages);
  const paginatedResponders = useMemo(() => {
    const start = (safeResponderPage - 1) * respondersPerPage;
    return responderStatusFiltered.slice(start, start + respondersPerPage);
  }, [responderStatusFiltered, safeResponderPage]);

  const responderRangeStart = responderStatusFiltered.length === 0 ? 0 : (safeResponderPage - 1) * respondersPerPage + 1;
  const responderRangeEnd = Math.min(safeResponderPage * respondersPerPage, responderStatusFiltered.length);

  const assignableResponderOptions = useMemo(() => {
    if (!selectedTeamForMembers?.team_id) return [];
    const assignedIds = new Set(selectedTeamMembers.map((m) => Number(m.responder_id)));
    return deptResponders
      .filter((r) => !assignedIds.has(Number(r.responder_id)))
      .map((r) => ({ value: String(r.responder_id), label: `${r.name} • ${String(r.availability_status || 'unknown').toLowerCase()}` }));
  }, [deptResponders, selectedTeamForMembers, selectedTeamMembers]);

  const heroCardClass = `rounded-3xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80 border-gray-200/80 shadow-[8px_8px_24px_rgba(209,213,219,0.5),-8px_-8px_24px_rgba(255,255,255,0.9)]' : 'glass neumorphic-dark bg-card/60 border-white/10 shadow-[8px_8px_24px_rgba(0,0,0,0.35),-6px_-6px_20px_rgba(19,65,120,0.2)]'}`;
  const heroIconClass = `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'}`;
  const panelClass = `rounded-2xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'}`;
  const headerClass = `flex items-center gap-3 px-4 py-3 border-b ${isLight ? 'border-gray-200/80 bg-gray-50/50' : 'border-white/10 bg-white/5'}`;
  const iconBoxClass = (accent = 'primary') =>
    `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100' : 'neumorphic-dark-inset bg-white/10'} ${accent === 'primary' ? 'text-primary' : accent === 'secondary' ? 'text-secondary' : 'text-foreground'}`;

  if (user.role !== ROLES.DEPARTMENT_ADMIN && user.role !== ROLES.PERSONNEL) return null;

  const deptName = department?.name || user.department || 'Department';

  return (
    <Layout>
      <div className="p-3 md:p-4 max-w-7xl mx-auto space-y-3">
        <Breadcrumb items={[{ label: 'Home', path: '/department/dashboard' }, { label: 'Department Personnel' }]} />
        <div className={heroCardClass}>
          <div className="px-4 py-3 flex flex-wrap items-center gap-3">
            <div className={heroIconClass}>
              <Users className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Personnel Management</h1>
              <p className="text-xs text-muted">Teams and responders for your department</p>
            </div>
          </div>
        </div>

        {loadingDept || loadingResources ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : (
          <Tabs defaultValue="teams" className="space-y-3">
            <TabsList className="w-full sm:w-auto sm:inline-flex gap-1">
              <TabsTrigger value="teams">Teams</TabsTrigger>
              <TabsTrigger value="responders">Responders</TabsTrigger>
            </TabsList>

            <TabsContent value="teams" className="space-y-3">
              <div className={panelClass}>
                <div className={headerClass}>
                  <div className={iconBoxClass('secondary')}><Shield className="w-4 h-4" /></div>
                  <h3 className="text-sm font-semibold text-foreground flex-1">Team Status</h3>
                  {isDeptAdmin && (
                    <Button
                      type="button"
                      className="h-8 text-xs px-3"
                      onClick={() => {
                        setTeamForm((prev) => ({ ...prev, department_code: inferredSectorCode || 'drrmo', team_name: '', supported_incident_types: [] }));
                        setCreateTeamDialogOpen(true);
                      }}
                    >
                      Create Team
                    </Button>
                  )}
                </div>
                <div className="p-3 space-y-2 max-h-[420px] overflow-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input value={teamSearch} onChange={(e) => setTeamSearch(e.target.value)} placeholder="Search team/member/status" className="h-8 text-xs" />
                    <select className="h-8 px-2 py-1 border border-border rounded bg-card text-foreground text-xs" value={teamStatusFilter} onChange={(e) => setTeamStatusFilter(e.target.value)}>
                      <option value="all">All status</option>
                      {AVAILABILITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted">
                    <span>Showing {teamRangeStart}-{teamRangeEnd} of {teamStatusFiltered.length}</span>
                    <span>{teamsPerPage} per page</span>
                  </div>
                  {paginatedTeams.map((team) => {
                    const teamMembers = teamMembersByTeamId[team.team_id] || [];
                    return (
                      <div key={team.team_id} className="border border-border/60 rounded-lg p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-foreground">{String(team.department_code || '').toUpperCase()} • {team.team_name}</p>
                          {isDeptAdmin ? (
                            <select
                              className="px-2 py-1 border border-border rounded bg-card text-foreground text-xs"
                              value={String(team.team_status || 'available').toLowerCase()}
                              onChange={async (e) => {
                                await updateResponderTeamStatus(team.team_id, e.target.value);
                                await loadResponderResources();
                              }}
                            >
                              {AVAILABILITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          ) : (
                            <span className="text-[11px] px-2 py-0.5 rounded bg-muted/50 text-muted-foreground">{String(team.team_status || 'available')}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted mt-1">Supported: {Array.isArray(team.supported_incident_types) && team.supported_incident_types.length ? team.supported_incident_types.join(', ') : 'all'}</p>
                        <p className="text-[11px] text-muted mt-1">Members: {teamMembers.length}</p>
                        {teamMembers.length > 0 ? (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {teamMembers.slice(0, 6).map((member) => (
                              <span key={`${team.team_id}-${member.responder_id}`} className="text-[10px] px-1.5 py-0.5 rounded border border-border/60 text-muted">
                                {member.name} • {String(member.availability_status || 'available').toLowerCase()}
                              </span>
                            ))}
                            {teamMembers.length > 6 && <span className="text-[10px] px-1.5 py-0.5 rounded border border-border/60 text-muted">+{teamMembers.length - 6} more</span>}
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted mt-1">No mapped members.</p>
                        )}
                        {isDeptAdmin && (
                          <div className="mt-2 flex justify-end">
                            <Button type="button" variant="outline" className="h-7 text-[11px] px-2.5" onClick={() => { setSelectedTeamForMembers(team); setMemberForm({ responder_id: '' }); setTeamMemberSearch(''); setTeamMemberStatusFilter('all'); setManageMembersDialogOpen(true); }}>
                              Assign Members
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {paginatedTeams.length === 0 && <div className="text-xs text-muted border border-border/60 rounded-lg p-2.5">No teams match the current filters.</div>}
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <Button type="button" variant="outline" className="h-7 px-2.5 text-[11px]" onClick={() => setTeamPage((p) => Math.max(1, p - 1))} disabled={safeTeamPage <= 1}>Prev</Button>
                    <span className="text-[11px] text-muted px-1">Page {safeTeamPage} / {teamTotalPages}</span>
                    <Button type="button" variant="outline" className="h-7 px-2.5 text-[11px]" onClick={() => setTeamPage((p) => Math.min(teamTotalPages, p + 1))} disabled={safeTeamPage >= teamTotalPages}>Next</Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="responders" className="space-y-3">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {isDeptAdmin && (
                  <div className={panelClass}>
                    <div className={headerClass}><div className={iconBoxClass('secondary')}><PlusCircle className="w-4 h-4" /></div><h3 className="text-sm font-semibold text-foreground">Create Responder</h3></div>
                    <div className="p-3 space-y-2.5">
                      <div><Label className="text-xs">Name</Label><Input value={responderForm.name} onChange={(e) => setResponderForm((p) => ({ ...p, name: e.target.value }))} /></div>
                      <div><Label className="text-xs">Contact Number</Label><Input value={responderForm.contact_number} onChange={(e) => setResponderForm((p) => ({ ...p, contact_number: e.target.value }))} /></div>
                      <div>
                        <Label className="text-xs">Team</Label>
                        <select className="w-full mt-1 px-2.5 py-2 border border-border rounded-lg bg-card text-foreground text-sm" value={responderForm.team_name} onChange={(e) => setResponderForm((p) => ({ ...p, team_name: e.target.value }))}>
                          <option value="">Unassigned</option>
                          {deptTeams.map((team) => <option key={team.team_id} value={team.team_name}>{team.department_code}:{team.team_name}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs">Supported Task Types</Label>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {TASK_TYPES.map((taskType) => (
                            <Button key={taskType} type="button" variant={responderForm.supported_incident_types.includes(taskType) ? 'default' : 'outline'} className="h-7 text-[11px]" onClick={() => setResponderForm((p) => ({ ...p, supported_incident_types: toggleTaskType(p.supported_incident_types, taskType) }))}>{taskType}</Button>
                          ))}
                        </div>
                      </div>
                      <Button className="w-full h-8 text-xs" onClick={handleCreateResponder}>Save Responder</Button>
                    </div>
                  </div>
                )}
                <div className={panelClass}>
                  <div className={headerClass}><div className={iconBoxClass('primary')}><Users className="w-4 h-4" /></div><h3 className="text-sm font-semibold text-foreground">Responder Status</h3></div>
                  <div className="p-3 space-y-2 max-h-[420px] overflow-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Input value={responderSearch} onChange={(e) => setResponderSearch(e.target.value)} placeholder="Search responder/team/status" className="h-8 text-xs" />
                      <select className="h-8 px-2 py-1 border border-border rounded bg-card text-foreground text-xs" value={responderStatusFilter} onChange={(e) => setResponderStatusFilter(e.target.value)}>
                        <option value="all">All status</option>
                        {AVAILABILITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <select className="h-8 px-2 py-1 border border-border rounded bg-card text-foreground text-xs" value={responderTeamFilter} onChange={(e) => setResponderTeamFilter(e.target.value)}>
                        <option value="all">All teams</option>
                        {responderTeamFilterOptions.map((tn) => <option key={tn} value={tn}>{tn}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted">
                      <span>Showing {responderRangeStart}-{responderRangeEnd} of {responderStatusFiltered.length}</span>
                      <span>{respondersPerPage} per page</span>
                    </div>
                    {paginatedResponders.map((responder) => (
                      <div key={responder.responder_id} className="border border-border/60 rounded-lg p-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{responder.name}</p>
                          <p className="text-[11px] text-muted truncate">{responder.team_name || 'Unassigned team'}</p>
                        </div>
                        {isDeptAdmin ? (
                          <select
                            className="px-2 py-1 border border-border rounded bg-card text-foreground text-xs"
                            value={String(responder.availability_status || 'available').toLowerCase()}
                            onChange={async (e) => { await updateResponderStatus(responder.responder_id, e.target.value); await loadResponderResources(); }}
                          >
                            {AVAILABILITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-muted/50 text-muted-foreground">{String(responder.availability_status || 'available')}</span>
                        )}
                      </div>
                    ))}
                    {paginatedResponders.length === 0 && <div className="text-xs text-muted border border-border/60 rounded-lg p-2.5">No responders match the current filters.</div>}
                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      <Button type="button" variant="outline" className="h-7 px-2.5 text-[11px]" onClick={() => setResponderPage((p) => Math.max(1, p - 1))} disabled={safeResponderPage <= 1}>Prev</Button>
                      <span className="text-[11px] text-muted px-1">Page {safeResponderPage} / {responderTotalPages}</span>
                      <Button type="button" variant="outline" className="h-7 px-2.5 text-[11px]" onClick={() => setResponderPage((p) => Math.min(responderTotalPages, p + 1))} disabled={safeResponderPage >= responderTotalPages}>Next</Button>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {isDeptAdmin && (
          <>
            <Card className="rounded-2xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border">
                <h2 className="text-xl font-semibold text-foreground">Assign Personnel to Incidents</h2>
                <p className="text-sm text-muted mt-0.5">Assign team members to new or assigned incidents</p>
              </div>
              <div className="overflow-x-auto">
                {activeDepartmentIncidents.length === 0 ? (
                  <div className="p-8 text-center text-muted text-sm">No incidents assigned to your department that need assignment</div>
                ) : (
                  <table className="w-full">
                    <thead className={isLight ? 'bg-gray-50 border-b border-gray-200' : 'bg-muted/30 border-b border-border'}>
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Incident ID</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Type</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Location</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Assigned To</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Vehicle</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {activeDepartmentIncidents.map((incident) => (
                        <tr key={incident.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-6 py-3">
                            <button type="button" onClick={() => navigate(`/incidents/${incident.id}`)} className="text-sm font-medium text-primary hover:underline">{incident.id}</button>
                          </td>
                          <td className="px-6 py-3 text-sm text-foreground capitalize">{incident.emergencyType}</td>
                          <td className="px-6 py-3 text-sm text-muted"><span className="inline-flex items-center gap-1"><MapPin className="w-4 h-4" /> {incident.barangay}</span></td>
                          <td className="px-6 py-3"><Badge className="bg-indigo-500/20 text-indigo-400">{incident.status}</Badge></td>
                          <td className="px-6 py-3 text-sm text-muted">{getAssignment(incident.id) ? getAssignment(incident.id).name : '—'}</td>
                          <td className="px-6 py-3 text-sm text-muted">{getVehicleAssignment(incident.id) ? getVehicleAssignment(incident.id).name : '—'}</td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" onClick={() => openAssignModal(incident.id)} className="text-primary" title="Assign personnel"><UserPlus className="w-4 h-4" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => openVehicleAssignModal(incident.id)} className="text-primary" title="Assign vehicle"><Truck className="w-4 h-4" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => navigate(`/incidents/${incident.id}`)} className="text-primary" title="View details"><Eye className="w-4 h-4" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>

            <Dialog open={assignModalOpen} onOpenChange={(open) => !open && closeAssignModal()} className="max-w-md">
              <DialogContent className={`max-w-md rounded-2xl overflow-hidden ${isLight ? 'glass neumorphic-light bg-white/95 border-gray-200/80' : 'glass neumorphic-dark bg-card/95 border-white/10'}`}>
                <div className={`flex items-center justify-between border-b ${isLight ? 'border-gray-200/80 pb-4' : 'border-white/10 pb-4'}`}>
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-foreground">Assign personnel</DialogTitle>
                    <p className="text-sm text-muted mt-1">{assigningIncidentId ? `Select for ${assigningIncidentId}` : 'Select a team member'}</p>
                  </DialogHeader>
                  <button type="button" onClick={closeAssignModal} className={`p-2 rounded-xl transition-colors ${isLight ? 'hover:bg-gray-100 text-gray-500' : 'hover:bg-white/10 text-muted'}`} aria-label="Close"><X className="w-5 h-5" strokeWidth={2} /></button>
                </div>
                <div className="mt-4 space-y-3 max-h-[280px] overflow-y-auto pr-1">
                  {list.map((p, idx) => {
                    const personnelKey = `${departmentId}-${idx}`;
                    const isAvailable = String(p.status || '').toLowerCase() === 'available';
                    const Wrapper = isAvailable ? 'button' : 'div';
                    const wrapperProps = isAvailable ? { type: 'button', onClick: () => setAssignment(assigningIncidentId, personnelKey, p.name) } : {};
                    return (
                      <Wrapper key={personnelKey} {...wrapperProps} className={`w-full text-left flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all duration-200 ${isAvailable ? (isLight ? 'border-gray-200/80 bg-white hover:bg-primary/5 hover:border-primary/30 cursor-pointer' : 'border-white/10 bg-white/5 hover:bg-primary/10 hover:border-primary/30 cursor-pointer') : (isLight ? 'border-gray-200/60 bg-gray-50/50 opacity-60 cursor-not-allowed' : 'border-white/5 bg-white/5 opacity-60 cursor-not-allowed')}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isAvailable ? (isLight ? 'bg-green-500/15 text-green-600' : 'bg-green-500/20 text-green-400') : (isLight ? 'bg-amber-500/15 text-amber-600' : 'bg-amber-500/20 text-amber-400')}`}>
                          {isAvailable ? <UserCheck className="w-5 h-5" strokeWidth={2} /> : <Clock className="w-5 h-5" strokeWidth={2} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground">{p.name}</p>
                          <p className="text-sm text-muted">{p.role} · {p.unit}</p>
                        </div>
                        <span className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium ${isAvailable ? 'bg-green-500/20 text-green-600' : 'bg-amber-500/20 text-amber-600'}`}>{p.status}</span>
                      </Wrapper>
                    );
                  })}
                </div>
                {list.length === 0 && <p className="text-sm text-muted py-6 text-center">No personnel in this department</p>}
              </DialogContent>
            </Dialog>

            <Dialog open={vehicleModalOpen} onOpenChange={(open) => !open && closeVehicleAssignModal()} className="max-w-md">
              <DialogContent className={`max-w-md rounded-2xl overflow-hidden ${isLight ? 'glass neumorphic-light bg-white/95 border-gray-200/80' : 'glass neumorphic-dark bg-card/95 border-white/10'}`}>
                <div className={`flex items-center justify-between border-b ${isLight ? 'border-gray-200/80 pb-4' : 'border-white/10 pb-4'}`}>
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-foreground">Assign vehicle</DialogTitle>
                    <p className="text-sm text-muted mt-1">{assigningIncidentIdVehicle ? `Select for ${assigningIncidentIdVehicle}` : 'Select a vehicle'}</p>
                  </DialogHeader>
                  <button type="button" onClick={closeVehicleAssignModal} className={`p-2 rounded-xl transition-colors ${isLight ? 'hover:bg-gray-100 text-gray-500' : 'hover:bg-white/10 text-muted'}`} aria-label="Close"><X className="w-5 h-5" strokeWidth={2} /></button>
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
                        className={`w-full text-left flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all duration-200 ${isLight ? 'border-gray-200/80 bg-white hover:bg-primary/5 hover:border-primary/30 cursor-pointer' : 'border-white/10 bg-white/5 hover:bg-primary/10 hover:border-primary/30 cursor-pointer'}`}
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
          </>
        )}

        <Dialog open={createTeamDialogOpen} onOpenChange={setCreateTeamDialogOpen}>
          <DialogContent className={`max-w-lg w-full !p-0 overflow-visible rounded-2xl border-0 shadow-2xl ${isLight ? 'bg-white border border-gray-200/90' : 'bg-card border border-white/20'}`}>
            <div className={`px-6 py-5 rounded-t-2xl ${isLight ? 'bg-gradient-to-br from-primary via-primary to-primary-hover' : 'bg-gradient-to-br from-primary/95 via-primary to-primary-hover'}`}>
              <DialogTitle className="text-lg font-semibold text-white m-0">Create Team</DialogTitle>
              <DialogDescription className="!text-white/90 mt-1 text-sm">Add a new team for {deptName}. Sector is set to your department.</DialogDescription>
            </div>
            <div className={`p-6 space-y-3 w-full ${isLight ? 'bg-white' : 'bg-card'}`}>
              <div>
                <Label className="text-xs">Sector</Label>
                <select className="w-full mt-1 px-2.5 py-2 border border-border rounded-lg bg-card text-foreground text-sm" value={teamForm.department_code} onChange={(e) => setTeamForm((p) => ({ ...p, department_code: e.target.value }))}>
                  <option value="pnp">pnp</option>
                  <option value="drrmo">drrmo</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Team Name</Label>
                <Input value={teamForm.team_name} onChange={(e) => setTeamForm((p) => ({ ...p, team_name: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Supported Task Types</Label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {TASK_TYPES.map((taskType) => (
                    <Button key={taskType} type="button" variant={teamForm.supported_incident_types.includes(taskType) ? 'default' : 'outline'} className="h-7 text-[11px]" onClick={() => setTeamForm((p) => ({ ...p, supported_incident_types: toggleTaskType(p.supported_incident_types, taskType) }))}>{taskType}</Button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter className={`px-6 py-4 border-t gap-2 ${isLight ? 'bg-gray-50/90 border-gray-200' : 'bg-white/[0.03] border-border'}`}>
              <Button type="button" className="h-8 text-xs px-4" onClick={handleCreateTeam}>Save Team</Button>
              <Button type="button" variant="outline" className="h-8 text-xs px-4" onClick={() => setCreateTeamDialogOpen(false)}>Cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={manageMembersDialogOpen} onOpenChange={setManageMembersDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Assign Members — {selectedTeamForMembers ? `${String(selectedTeamForMembers.department_code || '').toUpperCase()} • ${selectedTeamForMembers.team_name}` : 'Team'}</DialogTitle>
              <DialogDescription>Add or remove members for this team.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2 items-end">
                <div>
                  <Label className="text-xs">Add responder</Label>
                  <Combobox options={assignableResponderOptions} value={memberForm.responder_id} onValueChange={(next) => setMemberForm({ responder_id: next })} placeholder="Select responder" searchPlaceholder="Search responder..." />
                </div>
                <Button type="button" className="h-9" disabled={!selectedTeamForMembers?.team_id || !memberForm.responder_id} onClick={() => handleMapMember(selectedTeamForMembers?.team_id, memberForm.responder_id)}>Add</Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input value={teamMemberSearch} onChange={(e) => setTeamMemberSearch(e.target.value)} placeholder="Search assigned members" className="h-8 text-xs" />
                <select className="h-8 px-2 py-1 border border-border rounded bg-card text-foreground text-xs" value={teamMemberStatusFilter} onChange={(e) => setTeamMemberStatusFilter(e.target.value)}>
                  <option value="all">All status</option>
                  {AVAILABILITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-2 max-h-64 overflow-auto">
                {paginatedTeamMembers.map((member) => (
                  <div key={`assigned-${member.responder_id}`} className="border border-border/60 rounded-lg p-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{member.name}</p>
                      <p className="text-[11px] text-muted">Status: {String(member.availability_status || 'available').toLowerCase()}</p>
                    </div>
                    <Button type="button" variant="outline" className="h-7 text-[11px] px-2.5" onClick={() => handleRemoveMember(selectedTeamForMembers?.team_id, member.responder_id)}>Remove</Button>
                  </div>
                ))}
                {paginatedTeamMembers.length === 0 && <p className="text-xs text-muted border border-border/60 rounded-lg p-2.5">No team members match current filters.</p>}
              </div>
              <div className="flex items-center justify-end gap-1.5">
                <Button type="button" variant="outline" className="h-7 px-2.5 text-[11px]" onClick={() => setTeamMemberPage((p) => Math.max(1, p - 1))} disabled={safeTeamMemberPage <= 1}>Prev</Button>
                <span className="text-[11px] text-muted px-1">Page {safeTeamMemberPage} / {teamMemberTotalPages}</span>
                <Button type="button" variant="outline" className="h-7 px-2.5 text-[11px]" onClick={() => setTeamMemberPage((p) => Math.min(teamMemberTotalPages, p + 1))} disabled={safeTeamMemberPage >= teamMemberTotalPages}>Next</Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setManageMembersDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
