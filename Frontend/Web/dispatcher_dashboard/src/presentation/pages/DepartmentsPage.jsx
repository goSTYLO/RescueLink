import { Layout } from '@/presentation/components/layout/Layout';
import { Alert, Button, Card, Form, Input, Modal, Select, Tabs, Tag } from 'antd';
import { isValidLocalPhone } from '@/core/utils/inputUtils';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '@/data/api/departments.api';
import { searchDagupanLocations, reverseDagupanLocation } from '@/data/api/location.api';
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
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { alertUser } from '@/presentation/feedback/alertUser';
import {
  Flame, Shield, HeartPulse, MountainSnow, Building2, PlusCircle, PenLine, Trash2, Network, Users, ChevronRight,
} from 'lucide-react';
import { useIncidentWebSocketStatus } from '@/presentation/context/IncidentWebSocketContext';
import { Breadcrumb } from '@/presentation/components/common/Breadcrumb';
import { ResponderStatusTag, statusSelectProps, embeddedStatusSelectProps } from '@/presentation/components/common/ResponderStatusTag';

const DEPARTMENT_TYPES = [
  { value: 'Fire', label: 'Fire' },
  { value: 'Police', label: 'Police' },
  { value: 'Medical', label: 'Medical' },
  { value: 'Disaster', label: 'Disaster' },
  { value: 'Community', label: 'Community' },
];
const TASK_TYPES = ['fire', 'medical', 'police', 'disaster', 'sos'];
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

const POLLING_INTERVAL_MS = 60000;
const POLLING_WHEN_WS_CONNECTED_MS = 120000;

export function DepartmentsPage() {
  const navigate = useNavigate();
  const { isConnected: wsConnected } = useIncidentWebSocketStatus();
  const [departments, setDepartments] = useState([]);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createTeamDialogOpen, setCreateTeamDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);

  const mapDepartment = (dept) => ({
    id: String(dept.department_id),
    departmentId: dept.department_id,
    code: dept.code || '',
    name: dept.name,
    type: dept.type,
    color: dept.color || 'gray',
    statusRaw: dept.status || 'active',
    unitsCount: Number(dept.units_count ?? dept.total_units ?? 0),
    availableUnits: Number(dept.available_units ?? 0),
    personnelCount: Number(dept.personnel_count ?? 0),
    activeTaskCount: Number(dept.active_task_count ?? 0),
    activeIncidents: Number(dept.active_incidents ?? 0),
    address: dept.address || '',
    latitude: dept.latitude != null ? Number(dept.latitude) : null,
    longitude: dept.longitude != null ? Number(dept.longitude) : null,
  });

  const loadDepartments = useCallback(async () => {
    setIsLoadingDepartments(true);
    try {
      const rows = await getDepartments();
      setDepartments(Array.isArray(rows) ? rows.map(mapDepartment) : []);
      setLastSyncAt(new Date());
    } catch (error) {
      setDepartments([]);
      alertUser({
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
    const intervalMs = wsConnected ? POLLING_WHEN_WS_CONNECTED_MS : POLLING_INTERVAL_MS;
    const intervalId = setInterval(loadDepartments, intervalMs);
    const handleIncidentUpdated = () => loadDepartments();
    window.addEventListener('incident:updated', handleIncidentUpdated);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('incident:updated', handleIncidentUpdated);
    };
  }, [loadDepartments, loadResponderResources, wsConnected]);
  const [form, setForm] = useState({
    name: '',
    type: 'Fire',
    color: 'red',
    address: '',
    latitude: '',
    longitude: '',
  });
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [noSuggestionForQuery, setNoSuggestionForQuery] = useState('');
  const suppressNextAddressSearchRef = useRef(false);
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


  const totalActiveIncidents = departments.reduce((sum, dept) => sum + (dept.activeIncidents || 0), 0);
  const totalAvailableUnits = departments.reduce((sum, dept) => sum + (dept.availableUnits || 0), 0);

  function buildDepartmentLiveStats(dept) {
    const inferredCode = inferDepartmentSectorCode(dept);
    const deptName = String(dept?.name || '').trim().toLowerCase();
    const deptCode = String(dept?.code || '').trim().toLowerCase();
    // Match teams by inferred sector code OR the department's actual code for backward compatibility
    // Only match by deptCode if both team and department have non-empty codes to avoid matching empty/null teams
    const deptTeams = teams.filter((team) => {
      const teamCodeRaw = String(team?.department_code || '').trim().toLowerCase();
      const teamCode = normalizeSectorCode(team?.department_code);
      const matchesInferred = teamCode === inferredCode;
      const matchesDeptCode = teamCodeRaw && deptCode && teamCode === deptCode;
      return matchesInferred || matchesDeptCode;
    });
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

    // Prioritize actual team count from teams data over stored unitsCount for accuracy
    const actualTeamCount = deptTeams.length;
    const unitsTotal = actualTeamCount > 0 ? actualTeamCount : apiTotalUnits;
    const unitsAvailable = actualTeamCount > 0 ? availableTeamCount : apiAvailableUnits;
    const personnelCount = responderCount > 0 ? responderCount : apiPersonnelCount;

    return {
      unitsTotal,
      unitsAvailable,
      personnelCount,
      responderAvailable: availableResponderCount,
    };
  }

  const openAddDialog = () => {
    setEditingDept(null);
    setForm({ name: '', type: 'Fire', color: 'red', address: '', latitude: '', longitude: '' });
    setLocationSuggestions([]);
    setLocationError('');
    setNoSuggestionForQuery('');
    setDialogOpen(true);
  };

  const openEditDialog = (dept, e) => {
    e?.stopPropagation();
    setEditingDept(dept);
    setForm({
      name: dept.name,
      type: dept.type,
      color: dept.color || 'red',
      address: dept.address || '',
      latitude: dept.latitude ?? '',
      longitude: dept.longitude ?? '',
    });
    setLocationSuggestions([]);
    setLocationError('');
    setNoSuggestionForQuery('');
    setDialogOpen(true);
  };

  useEffect(() => {
    if (!dialogOpen) return;
    if (suppressNextAddressSearchRef.current) {
      suppressNextAddressSearchRef.current = false;
      return;
    }
    const query = String(form.address || '').trim();
    if (query.length < 3) {
      setLocationSuggestions([]);
      setNoSuggestionForQuery('');
      return;
    }

    const handle = setTimeout(async () => {
      setIsSearchingLocation(true);
      setLocationError('');
      try {
        const response = await searchDagupanLocations(query, 5);
        const apiResults = Array.isArray(response?.results) ? response.results : [];
        setNoSuggestionForQuery(apiResults.length === 0 ? query : '');
        const manualOption = {
          label: `Use typed address: ${query}`,
          latitude: null,
          longitude: null,
          osmType: 'manual',
          osmId: `manual-${query}`,
          rawInput: query,
        };
        setLocationSuggestions([manualOption, ...apiResults]);
      } catch (error) {
        setNoSuggestionForQuery('');
        setLocationSuggestions([
          {
            label: `Use typed address: ${query}`,
            latitude: null,
            longitude: null,
            osmType: 'manual',
            osmId: `manual-${query}`,
            rawInput: query,
          },
        ]);
        setLocationError(error.message || 'Failed to search address suggestions.');
      } finally {
        setIsSearchingLocation(false);
      }
    }, 350);

    return () => clearTimeout(handle);
  }, [dialogOpen, form.address]);

  const applyLocationSuggestion = (suggestion) => {
    suppressNextAddressSearchRef.current = true;
    setForm((prev) => ({
      ...prev,
      address: suggestion?.rawInput || suggestion?.label || prev.address,
      latitude: suggestion?.latitude ?? prev.latitude,
      longitude: suggestion?.longitude ?? prev.longitude,
    }));
    setLocationSuggestions([]);
    setNoSuggestionForQuery('');
  };

  const useCurrentLocation = () => {
    if (!navigator?.geolocation) {
      setLocationError('Geolocation is not supported in this browser.');
      return;
    }

    setIsResolvingLocation(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = Number(position.coords.latitude);
        const lng = Number(position.coords.longitude);
        setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));
        try {
          const response = await reverseDagupanLocation(lat, lng);
          if (response?.result?.label) {
            setForm((prev) => ({ ...prev, address: response.result.label }));
          }
        } catch (error) {
          setLocationError(error.message || 'Could not reverse geocode your current location.');
        } finally {
          setIsResolvingLocation(false);
        }
      },
      () => {
        setIsResolvingLocation(false);
        setLocationError('Unable to get current location. Please check browser permissions.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      alertUser({ icon: 'error', title: 'Validation failed', text: 'Please enter a department name.', confirmButtonColor: '#134178' });
      return;
    }
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        color: form.color,
        address: String(form.address || '').trim() || null,
        latitude: String(form.latitude).trim() !== '' ? Number(form.latitude) : null,
        longitude: String(form.longitude).trim() !== '' ? Number(form.longitude) : null,
        status: 'active',
      };

      let savedRow = null;

      if (editingDept) {
        savedRow = await updateDepartment(editingDept.departmentId, payload);
        alertUser({ icon: 'success', title: 'Department updated', text: 'Department details have been saved.', timer: 2000, showConfirmButton: false, timerProgressBar: true });
      } else {
        savedRow = await createDepartment(payload);
        alertUser({ icon: 'success', title: 'Department added', text: 'The new department has been added.', timer: 2000, showConfirmButton: false, timerProgressBar: true, confirmButtonColor: '#134178' });
      }

      const requestedLocation = Boolean(payload.address || Number.isFinite(payload.latitude) || Number.isFinite(payload.longitude));
      const persistedLocation = Boolean(
        String(savedRow?.address || '').trim()
        || Number.isFinite(Number(savedRow?.latitude))
        || Number.isFinite(Number(savedRow?.longitude))
      );

      if (requestedLocation && !persistedLocation) {
        alertUser({
          icon: 'warning',
          title: 'Location not persisted',
          text: 'Department was saved, but its address/coordinates were not stored. Run the latest backend migration and retry.',
          confirmButtonColor: '#134178',
        });
      }

      await loadDepartments();
      setDialogOpen(false);
    } catch (error) {
      alertUser({
        icon: 'error',
        title: editingDept ? 'Update failed' : 'Create failed',
        text: error.message || 'Please try again later.',
        confirmButtonColor: '#134178',
      });
    }
  };

  const handleDelete = (departmentId, e) => {
    e?.stopPropagation();
    alertUser({
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
            alertUser({ icon: 'success', title: 'Department deleted', text: 'The department has been removed.', timer: 2000, showConfirmButton: false, timerProgressBar: true });
          })
          .catch((error) => {
            alertUser({ icon: 'error', title: 'Delete failed', text: error.message || 'Please try again later.', confirmButtonColor: '#134178' });
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
      alertUser({ icon: 'success', title: 'Team saved', timer: 1500, showConfirmButton: false });
      return true;
    } catch (error) {
      alertUser({ icon: 'error', title: 'Team save failed', text: error.message || 'Please try again.' });
      return false;
    }
  };

  const handleCreateResponder = async () => {
    if (!responderForm.name.trim()) return;
    const contact = responderForm.contact_number.trim();
    if (contact && !isValidLocalPhone(contact)) {
      alertUser({ icon: 'warning', title: 'Invalid contact number', text: 'Use local format 09XXXXXXXXX (11 digits).', confirmButtonColor: '#134178' });
      return;
    }
    try {
      await createResponder({
        ...responderForm,
        name: responderForm.name.trim(),
        organization: responderForm.organization.trim() || null,
        contact_number: contact || null,
        team_name: responderForm.team_name || null,
      });
      setResponderForm((prev) => ({ ...prev, name: '', contact_number: '' }));
      await loadResponderResources();
      alertUser({ icon: 'success', title: 'Responder added', timer: 1500, showConfirmButton: false });
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
  const statusTagColor = (status) => {
    if (status === 'Available') return 'green';
    if (status === 'Partially Busy') return 'gold';
    if (status === 'Critical Load') return 'red';
    return 'default';
  };

  const pager = (page, total, onPrev, onNext) => (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 8 }}>
      <Button disabled={page <= 1} onClick={onPrev}>Prev</Button>
      <span style={{ fontSize: 12, opacity: 0.7 }}>Page {page} / {total}</span>
      <Button disabled={page >= total} onClick={onNext}>Next</Button>
    </div>
  );

  const availabilitySelectOptions = AVAILABILITY_OPTIONS.map((status) => ({ value: status, label: status }));

  return (
    <Layout>
      <div className="p-4 max-w-7xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Breadcrumb items={[{ label: 'Home', path: '/dashboard' }, { label: 'Departments' }]} />
        <Card size="small" title={(<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Network size={18} />Department Operations</span>)}>
          <p style={{ margin: 0, opacity: 0.75 }}>Compact management for departments, teams, responders, and mapping.</p>
        </Card>

        <Tabs
          defaultActiveKey="departments"
          items={[
            {
              key: 'departments',
              label: 'Departments List',
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                    <Button type="primary" icon={<PlusCircle size={14} />} onClick={openAddDialog}>Add Department</Button>
                  </div>
                  {isLoadingDepartments && <Alert type="info" message="Loading departments..." showIcon style={{ marginBottom: 12 }} />}
                  {!isLoadingDepartments && departments.length === 0 && <Alert type="info" message="No departments found." showIcon style={{ marginBottom: 12 }} />}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {departments.map((dept) => {
                      const Icon = getDepartmentIcon(dept.type);
                      const stats = getDepartmentStats(dept);
                      const live = buildDepartmentLiveStats(dept);
                      const totalUnitsDisplay = live.unitsTotal;
                      const availableFromUnits = Math.min(live.unitsAvailable, totalUnitsDisplay);
                      const unitsDisplay = totalUnitsDisplay > 0 ? `${availableFromUnits}/${totalUnitsDisplay}` : '0/0';
                      return (
                        <Card
                          key={dept.id}
                          size="small"
                          hoverable
                          onClick={() => navigate(`/departments/${dept.departmentId}`)}
                          title={(<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Icon size={16} />{dept.name}</span>)}
                          extra={(
                            <span onClick={(e) => e.stopPropagation()}>
                              <Button type="text" icon={<PenLine size={14} />} onClick={(e) => openEditDialog(dept, e)} title="Edit" />
                              <Button type="text" danger icon={<Trash2 size={14} />} onClick={(e) => handleDelete(dept.departmentId, e)} title="Delete" />
                            </span>
                          )}
                        >
                          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>{dept.type} Response</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: 12, opacity: 0.7 }}>Status</span>
                            <Tag color={statusTagColor(stats.status)}>{stats.status}</Tag>
                          </div>
                          <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ opacity: 0.7 }}>Active Incidents</span><strong>{stats.activeIncidents}</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ opacity: 0.7 }}>Teams</span><strong>{unitsDisplay}</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ opacity: 0.7 }}>Responders</span><strong>{live.personnelCount}</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ opacity: 0.7 }}>Active Tasks</span><strong>{dept.activeTaskCount ?? 0}</strong></div>
                          </div>
                          <Button type="primary" block icon={<ChevronRight size={14} />} onClick={(e) => { e.stopPropagation(); navigate(`/departments/${dept.departmentId}`); }}>View Department</Button>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ),
            },
            {
              key: 'teams',
              label: 'Teams',
              children: (
                <Card size="small" title={(<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Shield size={16} />Team Status</span>)} extra={<Button type="primary" onClick={() => setCreateTeamDialogOpen(true)}>Create Team</Button>}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <Input value={teamSearch} onChange={(e) => setTeamSearch(e.target.value)} placeholder="Search team/member/status" />
                    <Select value={teamStatusFilter} onChange={setTeamStatusFilter} options={[{ value: 'all', label: 'All status' }, ...availabilitySelectOptions]} {...statusSelectProps} />
                    <Select value={teamSectorFilter} onChange={setTeamSectorFilter} options={[{ value: 'all', label: 'All sectors' }, ...teamSectorFilterOptions.map((sectorCode) => ({ value: sectorCode, label: sectorCode.toUpperCase() }))]} />
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>Showing {teamRangeStart}-{teamRangeEnd} of {teamStatusFiltered.length}</div>
                  {paginatedTeams.map((team) => {
                    const teamMembers = teamMembersByTeamId[team.team_id] || [];
                    return (
                      <Card key={team.team_id} size="small" type="inner" style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                          <strong>{String(team.department_code || '').toUpperCase()} • {team.team_name}</strong>
                          <Select style={{ width: 140 }} value={String(team.team_status || 'available').toLowerCase()} onChange={async (v) => { await updateResponderTeamStatus(team.team_id, v); await loadResponderResources(); }} options={availabilitySelectOptions} {...statusSelectProps} />
                        </div>
                        <p style={{ fontSize: 12, opacity: 0.7, margin: '4px 0' }}>Supported: {Array.isArray(team.supported_incident_types) && team.supported_incident_types.length ? team.supported_incident_types.join(', ') : 'all'}</p>
                        <p style={{ fontSize: 12, opacity: 0.7, margin: '4px 0' }}>Members: {teamMembers.length}</p>
                        {teamMembers.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {teamMembers.slice(0, 6).map((member) => (<ResponderStatusTag key={`${team.team_id}-${member.responder_id}`} status={member.availability_status}>{member.name} • {String(member.availability_status || 'available').toLowerCase()}</ResponderStatusTag>))}
                            {teamMembers.length > 6 && <Tag>+{teamMembers.length - 6} more</Tag>}
                          </div>
                        ) : (<p style={{ fontSize: 12, opacity: 0.7 }}>No mapped members.</p>)}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                          <Button onClick={() => { setSelectedTeamForMembers(team); setMemberForm({ responder_id: '' }); setTeamMemberSearch(''); setTeamMemberStatusFilter('all'); setManageMembersDialogOpen(true); }}>Assign Members</Button>
                        </div>
                      </Card>
                    );
                  })}
                  {paginatedTeams.length === 0 && <Alert type="info" message="No teams match the current filters." showIcon />}
                  {pager(safeTeamPage, teamTotalPages, () => setTeamPage((prev) => Math.max(1, prev - 1)), () => setTeamPage((prev) => Math.min(teamTotalPages, prev + 1)))}
                </Card>
              ),
            },
            {
              key: 'responders',
              label: 'Responders',
              children: (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Card size="small" title={(<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><PlusCircle size={16} />Create Responder</span>)}>
                    <Form layout="vertical" size="small">
                      <Form.Item label="Name"><Input maxLength={100} value={responderForm.name} onChange={(e) => setResponderForm((prev) => ({ ...prev, name: e.target.value }))} /></Form.Item>
                      <Form.Item label="Contact Number"><Input value={responderForm.contact_number} onChange={(e) => setResponderForm((prev) => ({ ...prev, contact_number: e.target.value }))} placeholder="09XXXXXXXXX" /></Form.Item>
                      <Form.Item label="Team">
                        <Select allowClear placeholder="Unassigned" value={responderForm.team_name || undefined} onChange={(v) => setResponderForm((prev) => ({ ...prev, team_name: v || '' }))} options={teams.map((team) => ({ value: team.team_name, label: `${team.department_code}:${team.team_name}` }))} />
                      </Form.Item>
                      <Form.Item label="Supported Task Types">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {TASK_TYPES.map((taskType) => (
                            <Button key={taskType} type={responderForm.supported_incident_types.includes(taskType) ? 'primary' : 'default'} onClick={() => setResponderForm((prev) => ({ ...prev, supported_incident_types: toggleTaskType(prev.supported_incident_types, taskType) }))}>{taskType}</Button>
                          ))}
                        </div>
                      </Form.Item>
                      <Button type="primary" block onClick={handleCreateResponder}>Save Responder</Button>
                    </Form>
                  </Card>
                  <Card size="small" title={(<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Users size={16} />Responder Status</span>)}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <Input value={responderSearch} onChange={(e) => setResponderSearch(e.target.value)} placeholder="Search responder/team/status" />
                      <Select value={responderStatusFilter} onChange={setResponderStatusFilter} options={[{ value: 'all', label: 'All status' }, ...availabilitySelectOptions]} {...statusSelectProps} />
                      <Select value={responderTeamFilter} onChange={setResponderTeamFilter} options={[{ value: 'all', label: 'All teams' }, ...responderTeamFilterOptions.map((teamName) => ({ value: teamName, label: teamName }))]} />
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>Showing {responderRangeStart}-{responderRangeEnd} of {responderStatusFiltered.length}</div>
                    {paginatedResponders.map((responder) => (
                      <Card key={responder.responder_id} size="small" type="inner" style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                          <div><strong>{responder.name}</strong><div style={{ fontSize: 12, opacity: 0.7 }}>{responder.team_name || 'Unassigned team'}</div></div>
                          <Select style={{ width: 140 }} value={String(responder.availability_status || 'available').toLowerCase()} onChange={async (v) => { await updateResponderStatus(responder.responder_id, v); await loadResponderResources(); }} options={availabilitySelectOptions} {...statusSelectProps} />
                        </div>
                      </Card>
                    ))}
                    {paginatedResponders.length === 0 && <Alert type="info" message="No responders match the current filters." showIcon />}
                    {pager(safeResponderPage, responderTotalPages, () => setResponderPage((prev) => Math.max(1, prev - 1)), () => setResponderPage((prev) => Math.min(responderTotalPages, prev + 1)))}
                  </Card>
                </div>
              ),
            },
          ]}
        />
      </div>

      <Modal open={dialogOpen} onCancel={() => setDialogOpen(false)} title={editingDept ? 'Edit Department' : 'Add Department'} footer={[<Button key="cancel" onClick={() => setDialogOpen(false)}>Cancel</Button>, <Button key="save" type="primary" onClick={handleSave}>{editingDept ? 'Save Changes' : 'Add Department'}</Button>]}>
        <p style={{ opacity: 0.75 }}>{editingDept ? 'Update department details below.' : 'Enter the new department details.'}</p>
        <Form layout="vertical" size="small">
          <Form.Item label="Name"><Input maxLength={100} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Bureau of Fire Protection" /></Form.Item>
          <Form.Item label="Type"><Select value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))} options={DEPARTMENT_TYPES} /></Form.Item>
          <Form.Item label="Address">
            <div style={{ position: 'relative' }}>
              <Input maxLength={255} value={form.address} onChange={(e) => { setNoSuggestionForQuery(''); setForm((f) => ({ ...f, address: e.target.value })); }} placeholder="Search Dagupan address" />
              {String(form.address || '').trim().length >= 3 && !isSearchingLocation && locationSuggestions.length === 0 && !locationError && noSuggestionForQuery === String(form.address || '').trim() && (
                <Alert type="info" showIcon message="No map suggestion found. You can still save the typed address." style={{ marginTop: 8 }} />
              )}
              {locationSuggestions.length > 0 && (
                <Card size="small" style={{ marginTop: 8, maxHeight: 160, overflow: 'auto' }}>
                  {locationSuggestions.map((suggestion) => (
                    <Button key={`${suggestion.osmType || 'osm'}-${suggestion.osmId || suggestion.label}`} type="text" block style={{ textAlign: 'left', height: 'auto', whiteSpace: 'normal' }} onClick={() => applyLocationSuggestion(suggestion)}>{suggestion.label}</Button>
                  ))}
                </Card>
              )}
            </div>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button onClick={useCurrentLocation} disabled={isResolvingLocation}>{isResolvingLocation ? 'Using location...' : 'Use Current Location'}</Button>
              {isSearchingLocation && <span style={{ fontSize: 12, opacity: 0.7 }}>Searching...</span>}
            </div>
            {locationError && <Alert type="error" showIcon message={locationError} style={{ marginTop: 8 }} />}
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item label="Latitude"><Input type="number" step="any" value={form.latitude} onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))} placeholder="16.04" /></Form.Item>
            <Form.Item label="Longitude"><Input type="number" step="any" value={form.longitude} onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))} placeholder="120.33" /></Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal open={createTeamDialogOpen} onCancel={() => setCreateTeamDialogOpen(false)} title="Create Team" footer={[<Button key="cancel" onClick={() => setCreateTeamDialogOpen(false)}>Cancel</Button>, <Button key="save" type="primary" onClick={async () => { const ok = await handleCreateTeam(); if (ok) setCreateTeamDialogOpen(false); }}>Save Team</Button>]}>
        <p style={{ opacity: 0.75 }}>Add a new team and configure supported task types.</p>
        <Form layout="vertical" size="small">
          <Form.Item label="Sector">
            <Select value={teamForm.department_code} onChange={(v) => setTeamForm((prev) => ({ ...prev, department_code: v }))} options={departments.length === 0 ? [{ value: '', label: 'No departments available', disabled: true }] : departments.map((dept) => ({ value: dept.code || dept.id, label: `${dept.name} (${dept.code || dept.id})` }))} />
          </Form.Item>
          <Form.Item label="Team Name"><Input value={teamForm.team_name} onChange={(e) => setTeamForm((prev) => ({ ...prev, team_name: e.target.value }))} /></Form.Item>
          <Form.Item label="Supported Task Types">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {TASK_TYPES.map((taskType) => (
                <Button key={taskType} type={teamForm.supported_incident_types.includes(taskType) ? 'primary' : 'default'} onClick={() => setTeamForm((prev) => ({ ...prev, supported_incident_types: toggleTaskType(prev.supported_incident_types, taskType) }))}>{taskType}</Button>
              ))}
            </div>
          </Form.Item>
        </Form>
      </Modal>

      <Modal open={manageMembersDialogOpen} onCancel={() => setManageMembersDialogOpen(false)} title={`Assign Members - ${selectedTeamForMembers ? `${String(selectedTeamForMembers.department_code || '').toUpperCase()} • ${selectedTeamForMembers.team_name}` : 'Team'}`} footer={[<Button key="close" onClick={() => setManageMembersDialogOpen(false)}>Close</Button>]} width={720}>
        <p style={{ opacity: 0.75 }}>Add or remove members for this team. Status is shown for assignment decisions.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 12 }}>
          <Select showSearch optionFilterProp="label" placeholder="Select responder" value={memberForm.responder_id || undefined} onChange={(v) => setMemberForm({ responder_id: v })} options={assignableResponderOptions} {...embeddedStatusSelectProps} />
          <Button type="primary" disabled={!selectedTeamForMembers?.team_id || !memberForm.responder_id} onClick={() => handleMapMember(selectedTeamForMembers?.team_id, memberForm.responder_id)}>Add</Button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <Input value={teamMemberSearch} onChange={(e) => setTeamMemberSearch(e.target.value)} placeholder="Search assigned members" />
          <Select value={teamMemberStatusFilter} onChange={setTeamMemberStatusFilter} options={[{ value: 'all', label: 'All status' }, ...availabilitySelectOptions]} {...statusSelectProps} />
        </div>
        <div style={{ maxHeight: 256, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {paginatedTeamMembers.map((member) => (
            <Card key={`assigned-member-${member.responder_id}`} size="small" type="inner">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div><strong>{member.name}</strong><div style={{ fontSize: 12, marginTop: 4 }}><ResponderStatusTag status={member.availability_status}>{String(member.availability_status || 'available').toLowerCase()}</ResponderStatusTag></div></div>
                <Button onClick={() => handleRemoveMember(selectedTeamForMembers?.team_id, member.responder_id)}>Remove</Button>
              </div>
            </Card>
          ))}
          {paginatedTeamMembers.length === 0 && <Alert type="info" message="No team members match current filters." showIcon />}
        </div>
        {pager(safeTeamMemberPage, teamMemberTotalPages, () => setTeamMemberPage((prev) => Math.max(1, prev - 1)), () => setTeamMemberPage((prev) => Math.min(teamMemberTotalPages, prev + 1)))}
      </Modal>
    </Layout>
  );
}
