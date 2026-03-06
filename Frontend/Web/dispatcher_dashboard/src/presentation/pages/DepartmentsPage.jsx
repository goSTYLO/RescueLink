import { Layout } from '@/presentation/components/layout/Layout';
import { Badge } from '@/presentation/components/ui/Badge';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Label } from '@/presentation/components/ui/Label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/presentation/components/ui/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/presentation/components/ui/Tabs';
import { Combobox } from '@/presentation/components/ui/Combobox';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '@/data/api/departments.api';
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
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Swal from 'sweetalert2';
import {
  Flame,
  Shield,
  HeartPulse,
  MountainSnow,
  Building2,
  PlusCircle,
  PenLine,
  Trash2,
  LayoutGrid,
  Network,
  AlertCircle,
  Users,
  ChevronRight,
} from 'lucide-react';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';

const DEPARTMENT_TYPES = [
  { value: 'Fire', label: 'Fire' },
  { value: 'Police', label: 'Police' },
  { value: 'Medical', label: 'Medical' },
  { value: 'Disaster', label: 'Disaster' },
  { value: 'Community', label: 'Community' },
];
const TASK_TYPES = ['fire', 'medical', 'police', 'disaster'];
const AVAILABILITY_OPTIONS = ['available', 'standby', 'busy', 'off-duty'];

function normalizeSectorCode(rawValue) {
  const value = String(rawValue || '').trim().toLowerCase();
  if (!value) return '';
  if (['drrmo', 'cdrmmo', 'cdrrmo'].includes(value)) return 'drrmo';
  if (['pnp', 'police'].includes(value)) return 'pnp';
  return value;
}

function inferDepartmentSectorCode(dept) {
  const directCode = normalizeSectorCode(dept?.code);
  if (directCode === 'drrmo' || directCode === 'pnp') return directCode;

  const type = String(dept?.type || '').trim().toLowerCase();
  if (type === 'police') return 'pnp';

  const name = String(dept?.name || '').trim().toLowerCase();
  if (/(police|pnp|crime)/i.test(name)) return 'pnp';
  return 'drrmo';
}

export function DepartmentsPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [departments, setDepartments] = useState([]);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createTeamDialogOpen, setCreateTeamDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [typeSelectOpen, setTypeSelectOpen] = useState(false);
  useEffect(() => {
    if (!dialogOpen) setTypeSelectOpen(false);
  }, [dialogOpen]);

  const mapDepartment = (dept) => ({
    id: String(dept.department_id),
    departmentId: dept.department_id,
    name: dept.name,
    type: dept.type,
    color: dept.color || 'gray',
    statusRaw: dept.status || 'active',
    unitsCount: Number(dept.units_count ?? dept.total_units ?? 0),
    availableUnits: Number(dept.available_units ?? 0),
    personnelCount: Number(dept.personnel_count ?? 0),
    activeTaskCount: Number(dept.active_task_count ?? 0),
    activeIncidents: Number(dept.active_incidents ?? 0),
  });

  const loadDepartments = useCallback(async () => {
    setIsLoadingDepartments(true);
    try {
      const rows = await getDepartments();
      setDepartments(Array.isArray(rows) ? rows.map(mapDepartment) : []);
      setLastSyncAt(new Date());
    } catch (error) {
      setDepartments([]);
      Swal.fire({
        icon: 'error',
        title: 'Could not load departments',
        text: error.message || 'Please try again later.',
        confirmButtonColor: '#134178',
      });
    } finally {
      setIsLoadingDepartments(false);
    }
  }, []);

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
    }
  }, []);

  useEffect(() => {
    loadDepartments();
    loadResponderResources();
    const intervalId = setInterval(loadDepartments, 30000);
    const handleIncidentUpdated = () => loadDepartments();
    window.addEventListener('incident:updated', handleIncidentUpdated);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('incident:updated', handleIncidentUpdated);
    };
  }, [loadDepartments, loadResponderResources]);
  const [form, setForm] = useState({
    name: '',
    type: 'Fire',
    color: 'red',
    unitsCount: 0,
    personnelCount: 0,
    activeTaskCount: 0,
  });
  const [responders, setResponders] = useState([]);
  const [teams, setTeams] = useState([]);
  const [teamForm, setTeamForm] = useState({ department_code: 'drrmo', team_name: '', team_status: 'available', supported_incident_types: [] });
  const [responderForm, setResponderForm] = useState({ name: '', organization: '', contact_number: '', availability_status: 'available', team_name: '', supported_incident_types: [] });
  const [memberForm, setMemberForm] = useState({ responder_id: '' });
  const [teamMembersByTeamId, setTeamMembersByTeamId] = useState({});
  const [manageMembersDialogOpen, setManageMembersDialogOpen] = useState(false);
  const [selectedTeamForMembers, setSelectedTeamForMembers] = useState(null);
  const [teamMemberSearch, setTeamMemberSearch] = useState('');
  const [teamMemberStatusFilter, setTeamMemberStatusFilter] = useState('all');
  const [teamMemberPage, setTeamMemberPage] = useState(1);
  const teamMembersPerPage = 5;
  const [teamSearch, setTeamSearch] = useState('');
  const [teamStatusFilter, setTeamStatusFilter] = useState('all');
  const [teamSectorFilter, setTeamSectorFilter] = useState('all');
  const [teamPage, setTeamPage] = useState(1);
  const teamsPerPage = 5;
  const [responderSearch, setResponderSearch] = useState('');
  const [responderStatusFilter, setResponderStatusFilter] = useState('all');
  const [responderTeamFilter, setResponderTeamFilter] = useState('all');
  const [responderPage, setResponderPage] = useState(1);
  const respondersPerPage = 5;

  const heroCardClass = `rounded-3xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80 border-gray-200/80 shadow-[8px_8px_24px_rgba(209,213,219,0.5),-8px_-8px_24px_rgba(255,255,255,0.9)]' : 'glass neumorphic-dark bg-card/60 border-white/10 shadow-[8px_8px_24px_rgba(0,0,0,0.35),-6px_-6px_20px_rgba(19,65,120,0.2)]'}`;
  const heroIconClass = `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'}`;
  const panelClass = `rounded-2xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'}`;
  const headerClass = `flex items-center gap-3 px-4 py-3 border-b ${isLight ? 'border-gray-200/80 bg-gray-50/50' : 'border-white/10 bg-white/5'}`;
  const iconBoxClass = (accent = 'primary') =>
    `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100' : 'neumorphic-dark-inset bg-white/10'} ${
      accent === 'primary' ? 'text-primary' : accent === 'secondary' ? 'text-secondary' : 'text-foreground'
    }`;

  const getDepartmentIcon = (type) => {
    switch (type) {
      case 'Fire': return Flame;
      case 'Police': return Shield;
      case 'Medical': return HeartPulse;
      case 'Disaster': return MountainSnow;
      default: return Building2;
    }
  };

  const getDepartmentStats = (dept) => {
    const activeIncidents = dept.activeIncidents ?? 0;
    const availableUnits = dept.availableUnits ?? 0;
    const totalUnits = dept.unitsCount ?? 0;
    let status = 'Available';
    if (totalUnits === 0) status = 'Available';
    else if (availableUnits === 0) status = 'Critical Load';
    else if (availableUnits < totalUnits / 2) status = 'Partially Busy';
    return {
      activeIncidents,
      availableUnits: totalUnits > 0 ? availableUnits : 0,
      totalUnits,
      status,
    };
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Available': return 'bg-severity-resolved/20 text-severity-resolved border-severity-resolved/40';
      case 'Partially Busy': return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'Critical Load': return 'bg-primary/20 text-primary border-primary/50';
      default: return 'bg-card text-muted border-border';
    }
  };

  const totalActiveIncidents = departments.reduce((sum, dept) => sum + (dept.activeIncidents || 0), 0);
  const totalAvailableUnits = departments.reduce((sum, dept) => sum + (dept.availableUnits || 0), 0);

  function buildDepartmentLiveStats(dept) {
    const inferredCode = inferDepartmentSectorCode(dept);
    const deptName = String(dept?.name || '').trim().toLowerCase();
    const deptTeams = teams.filter((team) => normalizeSectorCode(team?.department_code) === inferredCode);
    const deptTeamNames = new Set(
      deptTeams
        .map((team) => String(team?.team_name || '').trim())
        .filter(Boolean)
    );

    const availableTeamCount = deptTeams.filter((team) => {
      const status = String(team?.team_status || 'available').toLowerCase();
      return status === 'available' || status === 'standby';
    }).length;

    const responderSet = new Map();
    responders.forEach((responder) => {
      const responderId = Number(responder?.responder_id);
      if (!Number.isFinite(responderId)) return;
      const teamName = String(responder?.team_name || '').trim();
      const organization = String(responder?.organization || '').trim().toLowerCase();
      const belongsToTeam = teamName && deptTeamNames.has(teamName);
      const belongsToDeptName = deptName && organization === deptName;
      if (belongsToTeam || belongsToDeptName) {
        responderSet.set(responderId, responder);
      }
    });

    const responderCount = responderSet.size;
    const availableResponderCount = Array.from(responderSet.values()).filter((responder) => {
      const status = String(responder?.availability_status || 'available').toLowerCase();
      return status === 'available' || status === 'standby';
    }).length;

    const apiTotalUnits = Number(dept?.unitsCount ?? 0);
    const apiAvailableUnits = Number(dept?.availableUnits ?? 0);
    const apiPersonnelCount = Number(dept?.personnelCount ?? 0);

    const unitsTotal = apiTotalUnits > 0 ? apiTotalUnits : deptTeams.length;
    const unitsAvailable = apiTotalUnits > 0 ? apiAvailableUnits : availableTeamCount;
    const personnelCount = apiPersonnelCount > 0 ? apiPersonnelCount : responderCount;

    return {
      unitsTotal,
      unitsAvailable,
      personnelCount,
      responderAvailable: availableResponderCount,
    };
  }

  const openAddDialog = () => {
    setEditingDept(null);
    setForm({ name: '', type: 'Fire', color: 'red', unitsCount: 0, personnelCount: 0, activeTaskCount: 0 });
    setDialogOpen(true);
  };

  const openEditDialog = (dept, e) => {
    e?.stopPropagation();
    setEditingDept(dept);
    setForm({
      name: dept.name,
      type: dept.type,
      color: dept.color || 'red',
      unitsCount: dept.unitsCount ?? 0,
      personnelCount: dept.personnelCount ?? 0,
      activeTaskCount: dept.activeTaskCount ?? 0,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Swal.fire({ icon: 'error', title: 'Validation failed', text: 'Please enter a department name.', confirmButtonColor: '#134178' });
      return;
    }
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        color: form.color,
        status: 'active',
      };

      if (editingDept) {
        await updateDepartment(editingDept.departmentId, payload);
        Swal.fire({ icon: 'success', title: 'Department updated', text: 'Department details have been saved.', timer: 2000, showConfirmButton: false, timerProgressBar: true });
      } else {
        await createDepartment(payload);
        Swal.fire({ icon: 'success', title: 'Department added', text: 'The new department has been added.', timer: 2000, showConfirmButton: false, timerProgressBar: true });
      }
      await loadDepartments();
      setDialogOpen(false);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: editingDept ? 'Update failed' : 'Create failed',
        text: error.message || 'Please try again later.',
        confirmButtonColor: '#134178',
      });
    }
  };

  const handleDelete = (departmentId, e) => {
    e?.stopPropagation();
    Swal.fire({
      title: 'Delete department?',
      text: 'This action cannot be undone. The department and its data will be removed.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
      customClass: { popup: 'rounded-2xl shadow-xl', title: 'text-foreground text-xl', htmlContainer: 'text-muted', confirmButton: 'rounded-xl px-5 py-2.5 font-medium', cancelButton: 'rounded-xl px-5 py-2.5 font-medium' },
    }).then((result) => {
      if (result.isConfirmed) {
        if (!departmentId) return;
        deleteDepartment(departmentId)
          .then(() => loadDepartments())
          .then(() => {
            Swal.fire({ icon: 'success', title: 'Department deleted', text: 'The department has been removed.', timer: 2000, showConfirmButton: false, timerProgressBar: true });
          })
          .catch((error) => {
            Swal.fire({ icon: 'error', title: 'Delete failed', text: error.message || 'Please try again later.', confirmButtonColor: '#134178' });
          });
      }
    });
  };

  const handleCreateTeam = async () => {
    if (!teamForm.team_name.trim()) return;
    try {
      await createResponderTeam({
        department_code: teamForm.department_code,
        team_name: teamForm.team_name.trim(),
        team_status: teamForm.team_status,
        supported_incident_types: teamForm.supported_incident_types,
      });
      setTeamForm((prev) => ({ ...prev, team_name: '', supported_incident_types: [] }));
      await loadResponderResources();
      Swal.fire({ icon: 'success', title: 'Team saved', timer: 1500, showConfirmButton: false });
      return true;
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Team save failed', text: error.message || 'Please try again.' });
      return false;
    }
  };

  const handleCreateResponder = async () => {
    if (!responderForm.name.trim()) return;
    try {
      await createResponder({
        ...responderForm,
        name: responderForm.name.trim(),
        organization: responderForm.organization.trim() || null,
        contact_number: responderForm.contact_number.trim() || null,
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

  const toggleTaskType = (values, taskType) => {
    if (values.includes(taskType)) return values.filter((entry) => entry !== taskType);
    return [...values, taskType];
  };

  const responderTeamFilterOptions = useMemo(() => {
    const uniqueTeams = Array.from(new Set(responders.map((responder) => String(responder.team_name || '').trim()).filter(Boolean)));
    return uniqueTeams.sort((a, b) => a.localeCompare(b));
  }, [responders]);

  const teamSectorFilterOptions = useMemo(() => {
    const uniqueSectors = Array.from(new Set(teams.map((team) => String(team.department_code || '').trim().toLowerCase()).filter(Boolean)));
    return uniqueSectors.sort((a, b) => a.localeCompare(b));
  }, [teams]);

  const teamStatusFiltered = useMemo(() => {
    const normalizedSearch = teamSearch.trim().toLowerCase();
    return teams.filter((team) => {
      const teamStatus = String(team.team_status || 'available').toLowerCase();
      const departmentCode = String(team.department_code || '').toLowerCase();
      const teamName = String(team.team_name || '');
      const memberList = teamMembersByTeamId[team.team_id] || [];
      const memberNames = memberList.map((member) => String(member?.name || '')).join(' ');

      if (teamStatusFilter !== 'all' && teamStatus !== teamStatusFilter) return false;
      if (teamSectorFilter !== 'all' && departmentCode !== teamSectorFilter) return false;
      if (!normalizedSearch) return true;

      const haystack = `${departmentCode} ${teamName} ${teamStatus} ${memberNames}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [teams, teamMembersByTeamId, teamSearch, teamStatusFilter, teamSectorFilter]);

  const teamTotalPages = Math.max(1, Math.ceil(teamStatusFiltered.length / teamsPerPage));
  const safeTeamPage = Math.min(teamPage, teamTotalPages);
  const paginatedTeams = useMemo(() => {
    const start = (safeTeamPage - 1) * teamsPerPage;
    return teamStatusFiltered.slice(start, start + teamsPerPage);
  }, [teamStatusFiltered, safeTeamPage]);

  const teamRangeStart = teamStatusFiltered.length === 0 ? 0 : (safeTeamPage - 1) * teamsPerPage + 1;
  const teamRangeEnd = Math.min(safeTeamPage * teamsPerPage, teamStatusFiltered.length);

  const selectedTeamMembers = selectedTeamForMembers?.team_id
    ? (teamMembersByTeamId[selectedTeamForMembers.team_id] || [])
    : [];

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

  const assignableResponderOptions = useMemo(() => {
    if (!selectedTeamForMembers?.team_id) return [];
    const assignedIds = new Set(selectedTeamMembers.map((member) => Number(member.responder_id)));
    return responders
      .filter((responder) => !assignedIds.has(Number(responder.responder_id)))
      .map((responder) => ({
        value: String(responder.responder_id),
        label: `${responder.name} • ${String(responder.availability_status || 'unknown').toLowerCase()}`,
      }));
  }, [responders, selectedTeamForMembers, selectedTeamMembers]);

  const responderStatusFiltered = useMemo(() => {
    const normalizedSearch = responderSearch.trim().toLowerCase();
    return responders.filter((responder) => {
      const status = String(responder.availability_status || 'available').toLowerCase();
      const teamName = String(responder.team_name || '');
      const name = String(responder.name || '');
      if (responderStatusFilter !== 'all' && status !== responderStatusFilter) return false;
      if (responderTeamFilter !== 'all' && teamName !== responderTeamFilter) return false;
      if (!normalizedSearch) return true;
      const searchHaystack = `${name} ${teamName} ${status}`.toLowerCase();
      return searchHaystack.includes(normalizedSearch);
    });
  }, [responders, responderSearch, responderStatusFilter, responderTeamFilter]);

  const responderTotalPages = Math.max(1, Math.ceil(responderStatusFiltered.length / respondersPerPage));
  const safeResponderPage = Math.min(responderPage, responderTotalPages);
  const paginatedResponders = useMemo(() => {
    const start = (safeResponderPage - 1) * respondersPerPage;
    return responderStatusFiltered.slice(start, start + respondersPerPage);
  }, [responderStatusFiltered, safeResponderPage]);

  const responderRangeStart = responderStatusFiltered.length === 0 ? 0 : (safeResponderPage - 1) * respondersPerPage + 1;
  const responderRangeEnd = Math.min(safeResponderPage * respondersPerPage, responderStatusFiltered.length);

  useEffect(() => {
    const teamIds = teams.map((team) => team.team_id).filter(Boolean);
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
      if (cancelled) return;
      setTeamMembersByTeamId(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [teams]);

  useEffect(() => {
    setTeamPage(1);
  }, [teamSearch, teamStatusFilter, teamSectorFilter]);

  useEffect(() => {
    if (teamPage > teamTotalPages) {
      setTeamPage(teamTotalPages);
    }
  }, [teamPage, teamTotalPages]);

  useEffect(() => {
    setTeamMemberPage(1);
  }, [teamMemberSearch, teamMemberStatusFilter, selectedTeamForMembers?.team_id]);

  useEffect(() => {
    if (teamMemberPage > teamMemberTotalPages) {
      setTeamMemberPage(teamMemberTotalPages);
    }
  }, [teamMemberPage, teamMemberTotalPages]);

  useEffect(() => {
    setResponderPage(1);
  }, [responderSearch, responderStatusFilter, responderTeamFilter]);

  useEffect(() => {
    if (responderPage > responderTotalPages) {
      setResponderPage(responderTotalPages);
    }
  }, [responderPage, responderTotalPages]);

  return (
    <Layout>
      <div className="p-3 md:p-4 max-w-7xl mx-auto">
        <div className={`${heroCardClass} mb-3`}>
          <div className="px-4 py-3 flex flex-wrap items-center gap-3">
            <div className={heroIconClass}>
              <Network className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Department Operations</h1>
              <p className="text-xs text-muted">Compact management for departments, teams, responders, and mapping.</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="departments" className="space-y-3">
          <TabsList className="w-full sm:w-auto sm:inline-flex gap-1">
            <TabsTrigger value="departments">Departments List</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="responders">Responders</TabsTrigger>
          </TabsList>

          <TabsContent value="departments" className="space-y-3">
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={openAddDialog}
                className="gap-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium px-4 py-2"
              >
                <PlusCircle className="w-4 h-4" strokeWidth={2} />
                Add Department
              </Button>
            </div>

            {isLoadingDepartments && <p className="text-sm text-muted">Loading departments...</p>}
            {!isLoadingDepartments && departments.length === 0 && <p className="text-sm text-muted">No departments found.</p>}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {departments.map((dept) => {
                const Icon = getDepartmentIcon(dept.type);
                const stats = getDepartmentStats(dept);
                const live = buildDepartmentLiveStats(dept);
                const totalUnitsDisplay = live.unitsTotal;
                const availableFromUnits = Math.min(live.unitsAvailable, totalUnitsDisplay);
                const unitsDisplay = totalUnitsDisplay > 0
                  ? `${availableFromUnits}/${totalUnitsDisplay}`
                  : '0/0';
                return (
                  <div
                    key={dept.id}
                    className={`${panelClass} cursor-pointer hover:shadow-lg transition-all duration-300`}
                    onClick={() => navigate(`/departments/${dept.departmentId}`)}
                  >
                    <div className={`${headerClass} py-2.5`}>
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'
                      }`}>
                        <Icon className="w-4 h-4" strokeWidth={2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-foreground truncate" title={dept.name}>{dept.name}</h3>
                        <p className="text-xs text-muted truncate">{dept.type} Response</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 min-w-[32px] rounded-md" onClick={(e) => openEditDialog(dept, e)} title="Edit">
                          <PenLine className="w-3.5 h-3.5" strokeWidth={2} />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 min-w-[32px] rounded-md" onClick={(e) => handleDelete(dept.departmentId, e)} title="Delete">
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                        </Button>
                      </div>
                    </div>
                    <div className="p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted">Status</span>
                        <Badge className={`${getStatusColor(stats.status)} rounded-lg px-2 py-0.5 text-[11px] font-medium`}>{stats.status}</Badge>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs"><span className="text-muted">Active Incidents</span><span className="font-semibold text-foreground">{stats.activeIncidents}</span></div>
                        <div className="flex items-center justify-between text-xs"><span className="text-muted">Teams</span><span className="font-semibold text-primary">{unitsDisplay}</span></div>
                        <div className="flex items-center justify-between text-xs"><span className="text-muted">Responders</span><span className="font-semibold text-foreground">{live.personnelCount}</span></div>
                        <div className="flex items-center justify-between text-xs"><span className="text-muted">Active Tasks</span><span className="font-semibold text-foreground">{dept.activeTaskCount ?? 0}</span></div>
                      </div>
                      <Button className="w-full rounded-lg h-8 gap-2 bg-primary hover:bg-primary-hover text-white text-xs font-medium" onClick={(e) => { e.stopPropagation(); navigate(`/departments/${dept.departmentId}`); }}>
                        View Department
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="teams">
            <div className="grid grid-cols-1 gap-3">
              <div className={panelClass}>
                <div className={headerClass}>
                  <div className={iconBoxClass('secondary')}><Shield className="w-4 h-4" /></div>
                  <h3 className="text-sm font-semibold text-foreground flex-1">Team Status</h3>
                  <Button
                    type="button"
                    className="h-8 text-xs px-3"
                    onClick={() => setCreateTeamDialogOpen(true)}
                  >
                    Create Team
                  </Button>
                </div>
                <div className="p-3 space-y-2 max-h-[420px] overflow-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input
                      value={teamSearch}
                      onChange={(event) => setTeamSearch(event.target.value)}
                      placeholder="Search team/member/status"
                      className="h-8 text-xs"
                    />
                    <select
                      className="h-8 px-2 py-1 border border-border rounded bg-card text-foreground text-xs"
                      value={teamStatusFilter}
                      onChange={(event) => setTeamStatusFilter(event.target.value)}
                    >
                      <option value="all">All status</option>
                      {AVAILABILITY_OPTIONS.map((status) => <option key={`team-status-filter-${status}`} value={status}>{status}</option>)}
                    </select>
                    <select
                      className="h-8 px-2 py-1 border border-border rounded bg-card text-foreground text-xs"
                      value={teamSectorFilter}
                      onChange={(event) => setTeamSectorFilter(event.target.value)}
                    >
                      <option value="all">All sectors</option>
                      {teamSectorFilterOptions.map((sectorCode) => <option key={`sector-filter-${sectorCode}`} value={sectorCode}>{sectorCode.toUpperCase()}</option>)}
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
                        <select
                          className="px-2 py-1 border border-border rounded bg-card text-foreground text-xs"
                          value={String(team.team_status || 'available').toLowerCase()}
                          onChange={async (e) => {
                            await updateResponderTeamStatus(team.team_id, e.target.value);
                            await loadResponderResources();
                          }}
                        >
                          {AVAILABILITY_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </div>
                      <p className="text-[11px] text-muted mt-1">
                        Supported: {Array.isArray(team.supported_incident_types) && team.supported_incident_types.length ? team.supported_incident_types.join(', ') : 'all'}
                      </p>
                      <p className="text-[11px] text-muted mt-1">
                        Members: {teamMembers.length}
                      </p>
                      {teamMembers.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {teamMembers.slice(0, 6).map((member) => (
                            <span key={`${team.team_id}-${member.responder_id}`} className="text-[10px] px-1.5 py-0.5 rounded border border-border/60 text-muted">
                              {member.name} • {String(member.availability_status || 'available').toLowerCase()}
                            </span>
                          ))}
                          {teamMembers.length > 6 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded border border-border/60 text-muted">
                              +{teamMembers.length - 6} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted mt-1">No mapped members.</p>
                      )}
                      <div className="mt-2 flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-7 text-[11px] px-2.5"
                          onClick={() => {
                            setSelectedTeamForMembers(team);
                            setMemberForm({ responder_id: '' });
                            setTeamMemberSearch('');
                            setTeamMemberStatusFilter('all');
                            setManageMembersDialogOpen(true);
                          }}
                        >
                          Assign Members
                        </Button>
                      </div>
                    </div>
                    );
                  })}
                  {paginatedTeams.length === 0 && (
                    <div className="text-xs text-muted border border-border/60 rounded-lg p-2.5">No teams match the current filters.</div>
                  )}
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-7 px-2.5 text-[11px]"
                      onClick={() => setTeamPage((prev) => Math.max(1, prev - 1))}
                      disabled={safeTeamPage <= 1}
                    >
                      Prev
                    </Button>
                    <span className="text-[11px] text-muted px-1">Page {safeTeamPage} / {teamTotalPages}</span>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-7 px-2.5 text-[11px]"
                      onClick={() => setTeamPage((prev) => Math.min(teamTotalPages, prev + 1))}
                      disabled={safeTeamPage >= teamTotalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="responders">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              <div className={panelClass}>
                <div className={headerClass}><div className={iconBoxClass('secondary')}><PlusCircle className="w-4 h-4" /></div><h3 className="text-sm font-semibold text-foreground">Create Responder</h3></div>
                <div className="p-3 space-y-2.5">
                  <div><Label className="text-xs">Name</Label><Input value={responderForm.name} onChange={(e) => setResponderForm((prev) => ({ ...prev, name: e.target.value }))} /></div>
                  <div><Label className="text-xs">Contact Number</Label><Input value={responderForm.contact_number} onChange={(e) => setResponderForm((prev) => ({ ...prev, contact_number: e.target.value }))} /></div>
                  <div>
                    <Label className="text-xs">Team</Label>
                    <select className="w-full mt-1 px-2.5 py-2 border border-border rounded-lg bg-card text-foreground text-sm" value={responderForm.team_name} onChange={(e) => setResponderForm((prev) => ({ ...prev, team_name: e.target.value }))}>
                      <option value="">Unassigned</option>
                      {teams.map((team) => (
                        <option key={team.team_id} value={team.team_name}>{team.department_code}:{team.team_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Supported Task Types</Label>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {TASK_TYPES.map((taskType) => (
                        <Button key={taskType} type="button" variant={responderForm.supported_incident_types.includes(taskType) ? 'default' : 'outline'} className="h-7 text-[11px]" onClick={() => setResponderForm((prev) => ({ ...prev, supported_incident_types: toggleTaskType(prev.supported_incident_types, taskType) }))}>
                          {taskType}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Button className="w-full h-8 text-xs" onClick={handleCreateResponder}>Save Responder</Button>
                </div>
              </div>

              <div className={panelClass}>
                <div className={headerClass}><div className={iconBoxClass('primary')}><Users className="w-4 h-4" /></div><h3 className="text-sm font-semibold text-foreground">Responder Status</h3></div>
                <div className="p-3 space-y-2 max-h-[420px] overflow-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input
                      value={responderSearch}
                      onChange={(event) => setResponderSearch(event.target.value)}
                      placeholder="Search responder/team/status"
                      className="h-8 text-xs"
                    />
                    <select
                      className="h-8 px-2 py-1 border border-border rounded bg-card text-foreground text-xs"
                      value={responderStatusFilter}
                      onChange={(event) => setResponderStatusFilter(event.target.value)}
                    >
                      <option value="all">All status</option>
                      {AVAILABILITY_OPTIONS.map((status) => <option key={`status-filter-${status}`} value={status}>{status}</option>)}
                    </select>
                    <select
                      className="h-8 px-2 py-1 border border-border rounded bg-card text-foreground text-xs"
                      value={responderTeamFilter}
                      onChange={(event) => setResponderTeamFilter(event.target.value)}
                    >
                      <option value="all">All teams</option>
                      {responderTeamFilterOptions.map((teamName) => <option key={`team-filter-${teamName}`} value={teamName}>{teamName}</option>)}
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
                      <select
                        className="px-2 py-1 border border-border rounded bg-card text-foreground text-xs"
                        value={String(responder.availability_status || 'available').toLowerCase()}
                        onChange={async (e) => {
                          await updateResponderStatus(responder.responder_id, e.target.value);
                          await loadResponderResources();
                        }}
                      >
                        {AVAILABILITY_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </div>
                  ))}
                  {paginatedResponders.length === 0 && (
                    <div className="text-xs text-muted border border-border/60 rounded-lg p-2.5">No responders match the current filters.</div>
                  )}
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-7 px-2.5 text-[11px]"
                      onClick={() => setResponderPage((prev) => Math.max(1, prev - 1))}
                      disabled={safeResponderPage <= 1}
                    >
                      Prev
                    </Button>
                    <span className="text-[11px] text-muted px-1">Page {safeResponderPage} / {responderTotalPages}</span>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-7 px-2.5 text-[11px]"
                      onClick={() => setResponderPage((prev) => Math.min(responderTotalPages, prev + 1))}
                      disabled={safeResponderPage >= responderTotalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={`max-w-lg w-full !p-0 overflow-visible rounded-2xl border-0 shadow-2xl ${isLight ? 'bg-white border border-gray-200/90 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)]' : 'bg-card border border-white/20 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)]'}`}>
          <div className={`px-6 py-5 rounded-t-2xl ${isLight ? 'bg-gradient-to-br from-primary via-primary to-primary-hover' : 'bg-gradient-to-br from-primary/95 via-primary to-primary-hover'}`}>
            <DialogTitle className="text-lg font-semibold text-white m-0 tracking-tight">
              {editingDept ? 'Edit Department' : 'Add Department'}
            </DialogTitle>
            <DialogDescription className="!text-white/90 mt-1 text-sm">
              {editingDept ? 'Update department details below.' : 'Enter the new department details.'}
            </DialogDescription>
          </div>
          <div className={`p-6 space-y-5 w-full min-w-0 overflow-visible ${isLight ? 'bg-white' : 'bg-card'}`}>
            <div className="w-full min-w-0">
              <Label className="block text-sm font-medium text-foreground mb-2">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Bureau of Fire Protection"
                className={`w-full rounded-xl border-2 py-2.5 transition-colors focus:ring-2 focus:ring-primary/30 focus:border-primary ${isLight ? 'border-gray-200 hover:border-gray-300' : 'border-border bg-white/5 hover:border-white/20'}`}
              />
            </div>
            <div className="w-full min-w-0">
              <Label className="block text-sm font-medium text-foreground mb-2">Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))} open={typeSelectOpen} onOpenChange={setTypeSelectOpen}>
                {({ value, dropdownRect }) => (
                  <>
                    <SelectTrigger isOpen={typeSelectOpen} onClick={() => setTypeSelectOpen((o) => !o)} className={`w-full rounded-xl py-2.5 border-2 transition-colors ${isLight ? 'bg-gray-50/80 border-gray-200 hover:border-gray-300' : 'bg-white/5 border-border hover:border-white/20'}`}>
                      <SelectValue placeholder="Select type" value={value} options={DEPARTMENT_TYPES} />
                    </SelectTrigger>
                    <SelectContent isOpen={typeSelectOpen} dropdownRect={dropdownRect} className="rounded-xl border-2 border-border shadow-xl bg-card py-1">
                      {DEPARTMENT_TYPES.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} onSelect={(v) => { setForm((f) => ({ ...f, type: v })); setTypeSelectOpen(false); }}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </>
                )}
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4 w-full min-w-0">
              <div className="min-w-0 flex flex-col">
                <Label className="block text-sm font-medium text-foreground mb-2">Units</Label>
                <Input type="number" min={0} value={form.unitsCount} onChange={(e) => setForm((f) => ({ ...f, unitsCount: parseInt(e.target.value, 10) || 0 }))} placeholder="0" className={`w-full rounded-xl border-2 py-2.5 focus:ring-2 focus:ring-primary/30 focus:border-primary ${isLight ? 'border-gray-200' : 'border-border bg-white/5'}`} />
              </div>
              <div className="min-w-0 flex flex-col">
                <Label className="block text-sm font-medium text-foreground mb-2">Personnel</Label>
                <Input type="number" min={0} value={form.personnelCount} onChange={(e) => setForm((f) => ({ ...f, personnelCount: parseInt(e.target.value, 10) || 0 }))} placeholder="0" className={`w-full rounded-xl border-2 py-2.5 focus:ring-2 focus:ring-primary/30 focus:border-primary ${isLight ? 'border-gray-200' : 'border-border bg-white/5'}`} />
              </div>
              <div className="min-w-0 flex flex-col">
                <Label className="block text-sm font-medium text-foreground mb-2">Active Tasks</Label>
                <Input type="number" min={0} value={form.activeTaskCount} onChange={(e) => setForm((f) => ({ ...f, activeTaskCount: parseInt(e.target.value, 10) || 0 }))} placeholder="0" className={`w-full rounded-xl border-2 py-2.5 focus:ring-2 focus:ring-primary/30 focus:border-primary ${isLight ? 'border-gray-200' : 'border-border bg-white/5'}`} />
              </div>
            </div>
          </div>
          <div className={`px-6 py-4 border-t flex justify-between items-center gap-3 rounded-b-2xl ${isLight ? 'bg-gray-50/90 border-t border-gray-200' : 'bg-white/[0.03] border-t border-border'}`}>
            <Button type="button" onClick={handleSave} className="rounded-xl bg-primary hover:bg-primary-hover text-white font-medium px-5 py-2.5 shadow-md hover:shadow-lg transition-all duration-200">
              {editingDept ? 'Save Changes' : 'Add Department'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl font-medium px-5 py-2.5 border-2 text-foreground hover:bg-muted/50 hover:text-foreground transition-all duration-200">
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createTeamDialogOpen} onOpenChange={setCreateTeamDialogOpen}>
        <DialogContent className={`max-w-lg w-full !p-0 overflow-visible rounded-2xl border-0 shadow-2xl ${isLight ? 'bg-white border border-gray-200/90 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)]' : 'bg-card border border-white/20 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)]'}`}>
          <div className={`px-6 py-5 rounded-t-2xl ${isLight ? 'bg-gradient-to-br from-primary via-primary to-primary-hover' : 'bg-gradient-to-br from-primary/95 via-primary to-primary-hover'}`}>
            <DialogTitle className="text-lg font-semibold text-white m-0 tracking-tight">
              Create Team
            </DialogTitle>
            <DialogDescription className="!text-white/90 mt-1 text-sm">
              Add a new team and configure supported task types.
            </DialogDescription>
          </div>
          <div className={`p-6 space-y-3 w-full min-w-0 overflow-visible ${isLight ? 'bg-white' : 'bg-card'}`}>
            <div>
              <Label className="text-xs">Sector</Label>
              <select className="w-full mt-1 px-2.5 py-2 border border-border rounded-lg bg-card text-foreground text-sm" value={teamForm.department_code} onChange={(e) => setTeamForm((prev) => ({ ...prev, department_code: e.target.value }))}>
                <option value="pnp">pnp</option>
                <option value="drrmo">drrmo</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Team Name</Label>
              <Input value={teamForm.team_name} onChange={(e) => setTeamForm((prev) => ({ ...prev, team_name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Supported Task Types</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {TASK_TYPES.map((taskType) => (
                  <Button key={taskType} type="button" variant={teamForm.supported_incident_types.includes(taskType) ? 'default' : 'outline'} className="h-7 text-[11px]" onClick={() => setTeamForm((prev) => ({ ...prev, supported_incident_types: toggleTaskType(prev.supported_incident_types, taskType) }))}>
                    {taskType}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className={`px-6 py-4 border-t gap-2 ${isLight ? 'bg-gray-50/90 border-t border-gray-200' : 'bg-white/[0.03] border-t border-border'}`}>
            <Button
              type="button"
              className="h-8 text-xs px-4"
              onClick={async () => {
                const ok = await handleCreateTeam();
                if (ok) setCreateTeamDialogOpen(false);
              }}
            >
              Save Team
            </Button>
            <Button type="button" variant="outline" className="h-8 text-xs px-4" onClick={() => setCreateTeamDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageMembersDialogOpen} onOpenChange={setManageMembersDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Assign Members - {selectedTeamForMembers ? `${String(selectedTeamForMembers.department_code || '').toUpperCase()} • ${selectedTeamForMembers.team_name}` : 'Team'}
            </DialogTitle>
            <DialogDescription>
              Add or remove members for this team. Status is shown for assignment decisions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2 items-end">
              <div>
                <Label className="text-xs">Add responder</Label>
                <Combobox
                  options={assignableResponderOptions}
                  value={memberForm.responder_id}
                  onValueChange={(nextValue) => setMemberForm({ responder_id: nextValue })}
                  placeholder="Select responder"
                  searchPlaceholder="Search responder..."
                />
              </div>
              <Button
                type="button"
                className="h-9"
                disabled={!selectedTeamForMembers?.team_id || !memberForm.responder_id}
                onClick={() => handleMapMember(selectedTeamForMembers?.team_id, memberForm.responder_id)}
              >
                Add
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                value={teamMemberSearch}
                onChange={(event) => setTeamMemberSearch(event.target.value)}
                placeholder="Search assigned members"
                className="h-8 text-xs"
              />
              <select
                className="h-8 px-2 py-1 border border-border rounded bg-card text-foreground text-xs"
                value={teamMemberStatusFilter}
                onChange={(event) => setTeamMemberStatusFilter(event.target.value)}
              >
                <option value="all">All status</option>
                {AVAILABILITY_OPTIONS.map((status) => <option key={`member-status-filter-${status}`} value={status}>{status}</option>)}
              </select>
            </div>

            <div className="space-y-2 max-h-64 overflow-auto">
              {paginatedTeamMembers.map((member) => (
                <div key={`assigned-member-${member.responder_id}`} className="border border-border/60 rounded-lg p-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{member.name}</p>
                    <p className="text-[11px] text-muted">Status: {String(member.availability_status || 'available').toLowerCase()}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-7 text-[11px] px-2.5"
                    onClick={() => handleRemoveMember(selectedTeamForMembers?.team_id, member.responder_id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              {paginatedTeamMembers.length === 0 && (
                <p className="text-xs text-muted border border-border/60 rounded-lg p-2.5">No team members match current filters.</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-1.5">
              <Button
                type="button"
                variant="outline"
                className="h-7 px-2.5 text-[11px]"
                onClick={() => setTeamMemberPage((prev) => Math.max(1, prev - 1))}
                disabled={safeTeamMemberPage <= 1}
              >
                Prev
              </Button>
              <span className="text-[11px] text-muted px-1">Page {safeTeamMemberPage} / {teamMemberTotalPages}</span>
              <Button
                type="button"
                variant="outline"
                className="h-7 px-2.5 text-[11px]"
                onClick={() => setTeamMemberPage((prev) => Math.min(teamMemberTotalPages, prev + 1))}
                disabled={safeTeamMemberPage >= teamMemberTotalPages}
              >
                Next
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageMembersDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
