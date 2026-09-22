import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/presentation/components/layout/Layout';
import { Alert, Button, Card, Form, Input, Modal, Select, Table, Tabs, Tag } from 'antd';
import { IncidentTypeChips } from '@/presentation/components/common/IncidentTypeChips';
import { ResponderStatusTag, statusSelectProps, embeddedStatusSelectProps } from '@/presentation/components/common/ResponderStatusTag';
import { isValidLocalPhone } from '@/core/utils/inputUtils';
import {
  Users,
  Shield,
  PlusCircle,
  UserPlus,
  Eye,
  MapPin,
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
import { Breadcrumb } from '@/presentation/components/common/Breadcrumb';
import { alertUser } from '@/presentation/feedback/alertUser';

const ASSIGNMENTS_STORAGE_KEY = 'rescuelink_incident_personnel_assignments';
const VEHICLE_ASSIGNMENTS_STORAGE_KEY = 'rescuelink_incident_vehicle_assignments';
const AVAILABILITY_OPTIONS = ['available', 'standby', 'busy', 'off-duty'];
const TASK_TYPES = ['fire', 'medical', 'police', 'disaster', 'sos'];
const teamsPerPage = 5;
const respondersPerPage = 5;
const teamMembersPerPage = 5;
const availabilitySelectOptions = AVAILABILITY_OPTIONS.map((s) => ({ value: s, label: s }));

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
  const [responderForm, setResponderForm] = useState({ name: '', organization: '', contact_number: '', availability_status: 'available', team_name: '', supported_incident_types: [], email: '', password: '' });
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
      alertUser({ icon: 'success', title: 'Vehicle assigned', html: `<strong>${unitName}</strong> has been assigned. Status set to On Dispatch.`, timer: 2500, showConfirmButton: false, timerProgressBar: true });
    } catch (e) {
      alertUser({ icon: 'error', title: 'Assign failed', text: e?.message || 'Failed to assign vehicle' });
    } finally {
      setAssigningVehicleId(null);
    }
  }, [departmentId]);
  const setAssignment = useCallback((incidentId, personnelKey, name) => {
    setAssignments((prev) => ({ ...prev, [incidentId]: { personnelKey, name } }));
    setAssignModalOpen(false);
    setAssigningIncidentId(null);
    alertUser({ icon: 'success', title: 'Personnel assigned', html: `<strong>${name}</strong> has been assigned.`, timer: 2500, showConfirmButton: false, timerProgressBar: true });
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
      alertUser({ icon: 'success', title: 'Team saved', timer: 1500, showConfirmButton: false });
    } catch (error) {
      alertUser({ icon: 'error', title: 'Team save failed', text: error.message || 'Please try again.' });
    }
  };

  const handleCreateResponder = async () => {
    if (!responderForm.name.trim()) return;
    const contact = responderForm.contact_number?.trim() || '';
    if (contact && !isValidLocalPhone(contact)) {
      alertUser({ icon: 'warning', title: 'Invalid contact number', text: 'Use local format 09XXXXXXXXX (11 digits).', confirmButtonColor: '#134178' });
      return;
    }
    const email = responderForm.email?.trim() || '';
    const password = responderForm.password || '';
    if (email || password) {
      if (!email || !password || !contact) {
        alertUser({ icon: 'warning', title: 'Mobile login incomplete', text: 'Email, password, and contact number are required together to create a mobile login.', confirmButtonColor: '#134178' });
        return;
      }
      if (password.length < 8) {
        alertUser({ icon: 'warning', title: 'Invalid password', text: 'Password must be at least 8 characters.', confirmButtonColor: '#134178' });
        return;
      }
    }
    try {
      await createResponder({
        ...responderForm,
        name: responderForm.name.trim(),
        organization: responderForm.organization?.trim() || null,
        contact_number: contact || null,
        team_name: responderForm.team_name || null,
        ...(email ? { email, password, phone_number: contact } : {}),
      });
      setResponderForm((prev) => ({ ...prev, name: '', contact_number: '', email: '', password: '' }));
      await loadResponderResources();
      alertUser({
        icon: 'success',
        title: 'Responder added',
        text: email ? 'They can sign in on mobile with that phone number and password.' : undefined,
        timer: email ? 2500 : 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      alertUser({ icon: 'error', title: 'Responder create failed', text: error.message || 'Please try again.' });
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
      alertUser({ icon: 'success', title: 'Responder mapped', timer: 1500, showConfirmButton: false });
    } catch (error) {
      alertUser({ icon: 'error', title: 'Map failed', text: error.message || 'Please try again.' });
    }
  };

  const handleRemoveMember = async (teamId, responderId) => {
    try {
      await removeTeamMember(Number(teamId), Number(responderId));
      await loadResponderResources();
      const members = await getTeamMembers(Number(teamId));
      setTeamMembersByTeamId((prev) => ({ ...prev, [Number(teamId)]: Array.isArray(members) ? members : [] }));
      alertUser({ icon: 'success', title: 'Responder removed', timer: 1200, showConfirmButton: false });
    } catch (error) {
      alertUser({ icon: 'error', title: 'Remove failed', text: error.message || 'Please try again.' });
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

  const deptName = department?.name || user.department || 'Department';

  const pager = (page, total, onPrev, onNext) => (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 8 }}>
      <Button disabled={page <= 1} onClick={onPrev}>Prev</Button>
      <span style={{ fontSize: 12, opacity: 0.7 }}>Page {page} / {total}</span>
      <Button disabled={page >= total} onClick={onNext}>Next</Button>
    </div>
  );

  const incidentColumns = [
    {
      title: 'Incident ID',
      dataIndex: 'id',
      render: (id) => <Button type="link" onClick={() => navigate(`/incidents/${id}`)}>{id}</Button>,
    },
    {
      title: 'Type',
      key: 'type',
      render: (_, incident) => (
        <IncidentTypeChips incidentTypes={incident.incidentTypes} fallbackType={incident.emergencyType} compact />
      ),
    },
    {
      title: 'Location',
      dataIndex: 'barangay',
      render: (barangay) => <span><MapPin size={14} style={{ marginRight: 4 }} />{barangay}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (status) => <Tag color="purple">{status}</Tag>,
    },
    {
      title: 'Assigned To',
      key: 'assigned',
      render: (_, incident) => getAssignment(incident.id)?.name || '—',
    },
    {
      title: 'Vehicle',
      key: 'vehicle',
      render: (_, incident) => getVehicleAssignment(incident.id)?.name || '—',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, incident) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Button type="text" icon={<UserPlus size={14} />} onClick={() => openAssignModal(incident.id)} title="Assign personnel" />
          <Button type="text" icon={<Truck size={14} />} onClick={() => openVehicleAssignModal(incident.id)} title="Assign vehicle" />
          <Button type="text" icon={<Eye size={14} />} onClick={() => navigate(`/incidents/${incident.id}`)} title="View details" />
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <div className="p-4 max-w-7xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Breadcrumb items={[{ label: 'Home', path: '/department/dashboard' }, { label: 'Department Personnel' }]} />
        <Card
          size="small"
          title={(
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Users size={18} />
              Personnel Management
            </span>
          )}
        >
          <p style={{ margin: 0, opacity: 0.75 }}>Teams and responders for your department</p>
        </Card>

        {loadingDept || loadingResources ? (
          <Card size="small">Loading...</Card>
        ) : (
          <Tabs
            defaultActiveKey="teams"
            items={[
              {
                key: 'teams',
                label: 'Teams',
                children: (
                  <Card
                    size="small"
                    title={(
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <Shield size={16} />
                        Team Status
                      </span>
                    )}
                    extra={isDeptAdmin ? (
                      <Button
                        type="primary"
                        onClick={() => {
                          setTeamForm((prev) => ({ ...prev, department_code: inferredSectorCode || 'drrmo', team_name: '', supported_incident_types: [] }));
                          setCreateTeamDialogOpen(true);
                        }}
                      >
                        Create Team
                      </Button>
                    ) : null}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <Input value={teamSearch} onChange={(e) => setTeamSearch(e.target.value)} placeholder="Search team/member/status" />
                      <Select
                        value={teamStatusFilter}
                        onChange={setTeamStatusFilter}
                        options={[{ value: 'all', label: 'All status' }, ...availabilitySelectOptions]}
                        {...statusSelectProps}
                      />
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
                      Showing {teamRangeStart}-{teamRangeEnd} of {teamStatusFiltered.length}
                    </div>
                    {paginatedTeams.map((team) => {
                      const teamMembers = teamMembersByTeamId[team.team_id] || [];
                      return (
                        <Card key={team.team_id} size="small" type="inner" style={{ marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                            <strong>{String(team.department_code || '').toUpperCase()} • {team.team_name}</strong>
                            {isDeptAdmin ? (
                              <Select
                                style={{ width: 140 }}
                                value={String(team.team_status || 'available').toLowerCase()}
                                onChange={async (v) => {
                                  await updateResponderTeamStatus(team.team_id, v);
                                  await loadResponderResources();
                                }}
                                options={availabilitySelectOptions}
                                {...statusSelectProps}
                              />
                            ) : (
                              <ResponderStatusTag status={team.team_status}>{String(team.team_status || 'available')}</ResponderStatusTag>
                            )}
                          </div>
                          <p style={{ fontSize: 12, opacity: 0.7, margin: '4px 0' }}>
                            Supported: {Array.isArray(team.supported_incident_types) && team.supported_incident_types.length ? team.supported_incident_types.join(', ') : 'all'}
                          </p>
                          <p style={{ fontSize: 12, opacity: 0.7, margin: '4px 0' }}>Members: {teamMembers.length}</p>
                          {teamMembers.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {teamMembers.slice(0, 6).map((member) => (
                                <ResponderStatusTag key={`${team.team_id}-${member.responder_id}`} status={member.availability_status}>
                                  {member.name} • {String(member.availability_status || 'available').toLowerCase()}
                                </ResponderStatusTag>
                              ))}
                              {teamMembers.length > 6 && <Tag>+{teamMembers.length - 6} more</Tag>}
                            </div>
                          ) : (
                            <p style={{ fontSize: 12, opacity: 0.7 }}>No mapped members.</p>
                          )}
                          {isDeptAdmin && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                              <Button onClick={() => {
                                setSelectedTeamForMembers(team);
                                setMemberForm({ responder_id: '' });
                                setTeamMemberSearch('');
                                setTeamMemberStatusFilter('all');
                                setManageMembersDialogOpen(true);
                              }}>
                                Assign Members
                              </Button>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                    {paginatedTeams.length === 0 && <Alert type="info" message="No teams match the current filters." showIcon />}
                    {pager(safeTeamPage, teamTotalPages, () => setTeamPage((p) => Math.max(1, p - 1)), () => setTeamPage((p) => Math.min(teamTotalPages, p + 1)))}
                  </Card>
                ),
              },
              {
                key: 'responders',
                label: 'Responders',
                children: (
                  <div style={{ display: 'grid', gridTemplateColumns: isDeptAdmin ? '1fr 1fr' : '1fr', gap: 12 }}>
                    {isDeptAdmin && (
                      <Card
                        size="small"
                        title={(
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <PlusCircle size={16} />
                            Create Responder
                          </span>
                        )}
                      >
                        <Form layout="vertical" size="small">
                          <Form.Item label="Name"><Input maxLength={100} value={responderForm.name} onChange={(e) => setResponderForm((p) => ({ ...p, name: e.target.value }))} /></Form.Item>
                          <Form.Item label="Contact Number"><Input value={responderForm.contact_number} onChange={(e) => setResponderForm((p) => ({ ...p, contact_number: e.target.value }))} placeholder="09XXXXXXXXX" /></Form.Item>
                          <Form.Item label="Email (optional mobile login)"><Input type="email" value={responderForm.email} onChange={(e) => setResponderForm((p) => ({ ...p, email: e.target.value }))} /></Form.Item>
                          <Form.Item label="Password (optional mobile login)"><Input.Password value={responderForm.password} onChange={(e) => setResponderForm((p) => ({ ...p, password: e.target.value }))} placeholder="Min 8 characters" /></Form.Item>
                          <Form.Item label="Team">
                            <Select
                              value={responderForm.team_name || undefined}
                              onChange={(v) => setResponderForm((p) => ({ ...p, team_name: v || '' }))}
                              allowClear
                              placeholder="Unassigned"
                              options={deptTeams.map((team) => ({ value: team.team_name, label: `${team.department_code}:${team.team_name}` }))}
                            />
                          </Form.Item>
                          <Form.Item label="Supported Task Types">
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {TASK_TYPES.map((taskType) => (
                                <Button
                                  key={taskType}
                                  type={responderForm.supported_incident_types.includes(taskType) ? 'primary' : 'default'}
                                  onClick={() => setResponderForm((p) => ({ ...p, supported_incident_types: toggleTaskType(p.supported_incident_types, taskType) }))}
                                >
                                  {taskType}
                                </Button>
                              ))}
                            </div>
                          </Form.Item>
                          <Button type="primary" block onClick={handleCreateResponder}>Save Responder</Button>
                        </Form>
                      </Card>
                    )}
                    <Card
                      size="small"
                      title={(
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <Users size={16} />
                          Responder Status
                        </span>
                      )}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                        <Input value={responderSearch} onChange={(e) => setResponderSearch(e.target.value)} placeholder="Search responder/team/status" />
                        <Select value={responderStatusFilter} onChange={setResponderStatusFilter} options={[{ value: 'all', label: 'All status' }, ...availabilitySelectOptions]} {...statusSelectProps} />
                        <Select
                          value={responderTeamFilter}
                          onChange={setResponderTeamFilter}
                          options={[{ value: 'all', label: 'All teams' }, ...responderTeamFilterOptions.map((tn) => ({ value: tn, label: tn }))]}
                        />
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
                        Showing {responderRangeStart}-{responderRangeEnd} of {responderStatusFiltered.length}
                      </div>
                      {paginatedResponders.map((responder) => (
                        <Card key={responder.responder_id} size="small" type="inner" style={{ marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                            <div>
                              <strong>{responder.name}</strong>
                              <div style={{ fontSize: 12, opacity: 0.7 }}>{responder.team_name || 'Unassigned team'}</div>
                            </div>
                            {isDeptAdmin ? (
                              <Select
                                style={{ width: 140 }}
                                value={String(responder.availability_status || 'available').toLowerCase()}
                                onChange={async (v) => { await updateResponderStatus(responder.responder_id, v); await loadResponderResources(); }}
                                options={availabilitySelectOptions}
                                {...statusSelectProps}
                              />
                            ) : (
                              <ResponderStatusTag status={responder.availability_status}>{String(responder.availability_status || 'available')}</ResponderStatusTag>
                            )}
                          </div>
                        </Card>
                      ))}
                      {paginatedResponders.length === 0 && <Alert type="info" message="No responders match the current filters." showIcon />}
                      {pager(safeResponderPage, responderTotalPages, () => setResponderPage((p) => Math.max(1, p - 1)), () => setResponderPage((p) => Math.min(responderTotalPages, p + 1)))}
                    </Card>
                  </div>
                ),
              },
            ]}
          />
        )}

        {isDeptAdmin && (
          <Card size="small" title="Assign Personnel to Incidents">
            <p style={{ opacity: 0.75, marginTop: 0 }}>Assign team members to new or assigned incidents</p>
            <Table
              size="small"
              rowKey="id"
              columns={incidentColumns}
              dataSource={activeDepartmentIncidents}
              pagination={false}
              locale={{ emptyText: 'No incidents assigned to your department that need assignment' }}
            />
          </Card>
        )}

        <Modal
          open={assignModalOpen}
          onCancel={closeAssignModal}
          title="Assign personnel"
          footer={null}
        >
          <p style={{ opacity: 0.75 }}>{assigningIncidentId ? `Select for ${assigningIncidentId}` : 'Select a team member'}</p>
          <div style={{ maxHeight: 280, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {list.map((p, idx) => {
              const personnelKey = `${departmentId}-${idx}`;
              const isAvailable = String(p.status || '').toLowerCase() === 'available';
              return (
                <Card
                  key={personnelKey}
                  size="small"
                  type="inner"
                  hoverable={isAvailable}
                  onClick={isAvailable ? () => setAssignment(assigningIncidentId, personnelKey, p.name) : undefined}
                  style={{ cursor: isAvailable ? 'pointer' : 'not-allowed', opacity: isAvailable ? 1 : 0.6 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {isAvailable ? <UserCheck size={18} /> : <Clock size={18} />}
                    <div style={{ flex: 1 }}>
                      <strong>{p.name}</strong>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>{p.role} · {p.unit}</div>
                    </div>
                    <Tag color={isAvailable ? 'green' : 'gold'}>{p.status}</Tag>
                  </div>
                </Card>
              );
            })}
            {list.length === 0 && <Alert type="info" message="No personnel in this department" showIcon />}
          </div>
        </Modal>

        <Modal
          open={vehicleModalOpen}
          onCancel={closeVehicleAssignModal}
          title="Assign vehicle"
          footer={null}
        >
          <p style={{ opacity: 0.75 }}>{assigningIncidentIdVehicle ? `Select for ${assigningIncidentIdVehicle}` : 'Select a vehicle'}</p>
          <div style={{ maxHeight: 280, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {unitsList.map((u) => {
              const isAvailable = String(u.status || '').toLowerCase() === 'available';
              const isAssigning = assigningVehicleId === u.id;
              return (
                <Card
                  key={u.id}
                  size="small"
                  type="inner"
                  hoverable
                  onClick={() => !isAssigning && assignVehicleToIncident(assigningIncidentIdVehicle, u.id, u.name)}
                  style={{ cursor: isAssigning ? 'wait' : 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {isAvailable ? <Truck size={18} /> : <Clock size={18} />}
                    <div style={{ flex: 1 }}>
                      <strong>{u.name}</strong>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>{u.type} · {u.id}</div>
                    </div>
                    <Tag color={isAvailable ? 'green' : 'gold'}>{isAssigning ? 'Assigning…' : u.status}</Tag>
                  </div>
                </Card>
              );
            })}
            {unitsList.length === 0 && <Alert type="info" message="No vehicles in this department" showIcon />}
          </div>
        </Modal>

        <Modal
          open={createTeamDialogOpen}
          onCancel={() => setCreateTeamDialogOpen(false)}
          title="Create Team"
          footer={[
            <Button key="cancel" onClick={() => setCreateTeamDialogOpen(false)}>Cancel</Button>,
            <Button key="save" type="primary" onClick={handleCreateTeam}>Save Team</Button>,
          ]}
        >
          <p style={{ opacity: 0.75 }}>Add a new team for {deptName}. Sector is set to your department.</p>
          <Form layout="vertical" size="small">
            <Form.Item label="Sector">
              <Select
                value={teamForm.department_code}
                onChange={(v) => setTeamForm((p) => ({ ...p, department_code: v }))}
                options={[{ value: 'pnp', label: 'pnp' }, { value: 'drrmo', label: 'drrmo' }]}
              />
            </Form.Item>
            <Form.Item label="Team Name">
              <Input value={teamForm.team_name} onChange={(e) => setTeamForm((p) => ({ ...p, team_name: e.target.value }))} />
            </Form.Item>
            <Form.Item label="Supported Task Types">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {TASK_TYPES.map((taskType) => (
                  <Button
                    key={taskType}
                    type={teamForm.supported_incident_types.includes(taskType) ? 'primary' : 'default'}
                    onClick={() => setTeamForm((p) => ({ ...p, supported_incident_types: toggleTaskType(p.supported_incident_types, taskType) }))}
                  >
                    {taskType}
                  </Button>
                ))}
              </div>
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          open={manageMembersDialogOpen}
          onCancel={() => setManageMembersDialogOpen(false)}
          title={`Assign Members — ${selectedTeamForMembers ? `${String(selectedTeamForMembers.department_code || '').toUpperCase()} • ${selectedTeamForMembers.team_name}` : 'Team'}`}
          footer={[<Button key="close" onClick={() => setManageMembersDialogOpen(false)}>Close</Button>]}
          width={720}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 12 }}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select responder"
              value={memberForm.responder_id || undefined}
              onChange={(v) => setMemberForm({ responder_id: v })}
              options={assignableResponderOptions}
              {...embeddedStatusSelectProps}
            />
            <Button
              type="primary"
              disabled={!selectedTeamForMembers?.team_id || !memberForm.responder_id}
              onClick={() => handleMapMember(selectedTeamForMembers?.team_id, memberForm.responder_id)}
            >
              Add
            </Button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <Input value={teamMemberSearch} onChange={(e) => setTeamMemberSearch(e.target.value)} placeholder="Search assigned members" />
            <Select
              value={teamMemberStatusFilter}
              onChange={setTeamMemberStatusFilter}
              options={[{ value: 'all', label: 'All status' }, ...availabilitySelectOptions]} {...statusSelectProps}
            />
          </div>
          <div style={{ maxHeight: 256, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {paginatedTeamMembers.map((member) => (
              <Card key={`assigned-${member.responder_id}`} size="small" type="inner">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div>
                    <strong>{member.name}</strong>
                    <div style={{ fontSize: 12, marginTop: 4 }}><ResponderStatusTag status={member.availability_status}>{String(member.availability_status || 'available').toLowerCase()}</ResponderStatusTag></div>
                  </div>
                  <Button onClick={() => handleRemoveMember(selectedTeamForMembers?.team_id, member.responder_id)}>Remove</Button>
                </div>
              </Card>
            ))}
            {paginatedTeamMembers.length === 0 && <Alert type="info" message="No team members match current filters." showIcon />}
          </div>
          {pager(safeTeamMemberPage, teamMemberTotalPages, () => setTeamMemberPage((p) => Math.max(1, p - 1)), () => setTeamMemberPage((p) => Math.min(teamMemberTotalPages, p + 1)))}
        </Modal>
      </div>
    </Layout>
  );
}
