import { Layout } from '@/presentation/components/layout/Layout';
import { Badge } from '@/presentation/components/ui/Badge';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Label } from '@/presentation/components/ui/Label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/presentation/components/ui/Tabs';
import { Combobox } from '@/presentation/components/ui/Combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/presentation/components/ui/Dialog';
import { ArrowLeft, Shield, Users, Link2, MapPin } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import Swal from 'sweetalert2';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';
import { Breadcrumb } from '@/presentation/components/common/Breadcrumb';
import { normalizeRole, ROLES } from '@/core/constants';
import { getDepartmentById } from '@/data/api/departments.api';
import {
  addTeamMember,
  getResponders,
  getResponderTeams,
  getTeamMembers,
  removeTeamMember,
  updateResponderStatus,
  updateResponderTeamStatus,
} from '@/data/api/responders.api';

const AVAILABILITY_OPTIONS = ['available', 'standby', 'busy', 'off-duty'];

function normalizeStatus(value) {
  const next = String(value || '').trim().toLowerCase();
  return AVAILABILITY_OPTIONS.includes(next) ? next : 'available';
}

function toTitleCase(value) {
  return String(value || '')
    .split('-')
    .map((part) => (part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : ''))
    .join(' ');
}

export function DepartmentDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
  const normalizedRole = normalizeRole(currentUser?.role);
  const canManageMembership = normalizedRole === ROLES.SUPER_ADMIN;
  const canUpdateStatuses = (
    normalizedRole === ROLES.SUPER_ADMIN
    || normalizedRole === ROLES.DISPATCHER
  );

  const [department, setDepartment] = useState(null);
  const [loadingDepartment, setLoadingDepartment] = useState(true);
  const [resourceLoading, setResourceLoading] = useState(true);

  const [teams, setTeams] = useState([]);
  const [responders, setResponders] = useState([]);
  const [teamMembersByTeamId, setTeamMembersByTeamId] = useState({});

  const [teamSearch, setTeamSearch] = useState('');
  const [teamStatusFilter, setTeamStatusFilter] = useState('all');
  const [teamPage, setTeamPage] = useState(1);
  const teamsPerPage = 5;

  const [responderSearch, setResponderSearch] = useState('');
  const [responderStatusFilter, setResponderStatusFilter] = useState('all');
  const [responderPage, setResponderPage] = useState(1);
  const respondersPerPage = 5;

  const [manageMembersDialogOpen, setManageMembersDialogOpen] = useState(false);
  const [selectedTeamForMembers, setSelectedTeamForMembers] = useState(null);
  const [memberForm, setMemberForm] = useState({ responder_id: '' });
  const [teamMemberSearch, setTeamMemberSearch] = useState('');
  const [teamMemberStatusFilter, setTeamMemberStatusFilter] = useState('all');
  const [teamMemberPage, setTeamMemberPage] = useState(1);
  const teamMembersPerPage = 5;

  const departmentId = Number(id);
  const departmentCode = String(department?.code || '').trim().toLowerCase();
  const departmentName = String(department?.name || '').trim().toLowerCase();
  const departmentLatitude = Number(department?.latitude);
  const departmentLongitude = Number(department?.longitude);
  const departmentAddress = String(department?.address || '').trim();
  const hasDepartmentCoordinates = Number.isFinite(departmentLatitude) && Number.isFinite(departmentLongitude);
  const mapOpenStreetUrl = hasDepartmentCoordinates
    ? `https://www.openstreetmap.org/?mlat=${departmentLatitude}&mlon=${departmentLongitude}#map=15/${departmentLatitude}/${departmentLongitude}`
    : null;
  const mapAddressSearchUrl = !hasDepartmentCoordinates && departmentAddress
    ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(departmentAddress)}`
    : null;
  const departmentMarkerIcon = useMemo(() => L.divIcon({
    className: 'department-marker',
    html: '<svg viewBox="0 0 32 32" width="30" height="30" xmlns="http://www.w3.org/2000/svg"><path fill="#0f4c81" stroke="#ffffff" stroke-width="2" d="M16 2C9.4 2 4 7.4 4 14c0 8.3 9.1 15.6 11 16.9a2 2 0 0 0 2 0C18.9 29.6 28 22.3 28 14c0-6.6-5.4-12-12-12z"/><circle cx="16" cy="14" r="4" fill="#ffffff"/></svg>',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
  }), []);

  const panelClass = `rounded-2xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'}`;
  const headerClass = `flex items-center gap-3 px-4 py-3 border-b ${isLight ? 'border-gray-200/80 bg-gray-50/50' : 'border-white/10 bg-white/5'}`;

  const loadDepartment = useCallback(async () => {
    if (!Number.isFinite(departmentId) || departmentId <= 0) {
      setDepartment(null);
      setLoadingDepartment(false);
      return;
    }

    setLoadingDepartment(true);
    try {
      const row = await getDepartmentById(departmentId);
      setDepartment(row || null);
    } catch (error) {
      setDepartment(null);
      Swal.fire({
        icon: 'error',
        title: 'Could not load department',
        text: error.message || 'Please try again later.',
        confirmButtonColor: '#134178',
      });
    } finally {
      setLoadingDepartment(false);
    }
  }, [departmentId]);

  const loadResponderResources = useCallback(async () => {
    setResourceLoading(true);
    try {
      const [teamRows, responderRows] = await Promise.all([
        getResponderTeams({ limit: 300, offset: 0 }),
        getResponders({ limit: 500, offset: 0 }),
      ]);
      setTeams(Array.isArray(teamRows) ? teamRows : []);
      setResponders(Array.isArray(responderRows) ? responderRows : []);
    } catch (error) {
      setTeams([]);
      setResponders([]);
      Swal.fire({
        icon: 'error',
        title: 'Could not load team resources',
        text: error.message || 'Please try again later.',
        confirmButtonColor: '#134178',
      });
    } finally {
      setResourceLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDepartment();
    loadResponderResources();
  }, [loadDepartment, loadResponderResources]);

  const departmentTeams = useMemo(() => {
    if (!departmentCode) return [];
    return teams.filter((team) => String(team?.department_code || '').trim().toLowerCase() === departmentCode);
  }, [teams, departmentCode]);

  useEffect(() => {
    const teamIds = departmentTeams.map((team) => Number(team.team_id)).filter((teamId) => Number.isFinite(teamId));
    if (teamIds.length === 0) {
      setTeamMembersByTeamId({});
      return;
    }

    let cancelled = false;
    Promise.all(teamIds.map(async (teamId) => {
      try {
        const members = await getTeamMembers(teamId);
        return [teamId, Array.isArray(members) ? members : []];
      } catch {
        return [teamId, []];
      }
    })).then((entries) => {
      if (cancelled) return;
      setTeamMembersByTeamId(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [departmentTeams]);

  const filteredTeams = useMemo(() => {
    const query = teamSearch.trim().toLowerCase();
    return departmentTeams.filter((team) => {
      const status = normalizeStatus(team.team_status);
      const teamName = String(team.team_name || '');
      const members = teamMembersByTeamId[team.team_id] || [];
      const memberNames = members.map((entry) => String(entry?.name || '')).join(' ');

      if (teamStatusFilter !== 'all' && status !== teamStatusFilter) return false;
      if (!query) return true;
      return `${teamName} ${status} ${memberNames}`.toLowerCase().includes(query);
    });
  }, [departmentTeams, teamMembersByTeamId, teamSearch, teamStatusFilter]);

  const teamTotalPages = Math.max(1, Math.ceil(filteredTeams.length / teamsPerPage));
  const safeTeamPage = Math.min(teamPage, teamTotalPages);
  const paginatedTeams = useMemo(() => {
    const start = (safeTeamPage - 1) * teamsPerPage;
    return filteredTeams.slice(start, start + teamsPerPage);
  }, [filteredTeams, safeTeamPage]);

  useEffect(() => {
    setTeamPage(1);
  }, [teamSearch, teamStatusFilter]);
  useEffect(() => {
    if (teamPage > teamTotalPages) setTeamPage(teamTotalPages);
  }, [teamPage, teamTotalPages]);

  const departmentResponders = useMemo(() => {
    const teamNames = new Set(departmentTeams.map((team) => String(team.team_name || '').trim()).filter(Boolean));
    const members = Object.values(teamMembersByTeamId).flat();
    const map = new Map();

    members.forEach((member) => {
      const responderId = Number(member?.responder_id);
      if (!Number.isFinite(responderId)) return;
      map.set(responderId, member);
    });

    responders.forEach((responder) => {
      const responderId = Number(responder?.responder_id);
      if (!Number.isFinite(responderId)) return;
      const responderTeam = String(responder?.team_name || '').trim();
      const responderOrg = String(responder?.organization || '').trim().toLowerCase();
      const belongsToTeam = responderTeam && teamNames.has(responderTeam);
      const belongsToDepartmentOrg = departmentName && responderOrg === departmentName;
      if (belongsToTeam || belongsToDepartmentOrg) {
        map.set(responderId, responder);
      }
    });

    return Array.from(map.values());
  }, [departmentTeams, teamMembersByTeamId, responders, departmentName]);

  const filteredResponders = useMemo(() => {
    const query = responderSearch.trim().toLowerCase();
    return departmentResponders.filter((responder) => {
      const status = normalizeStatus(responder.availability_status);
      const name = String(responder.name || '');
      const teamName = String(responder.team_name || '');
      if (responderStatusFilter !== 'all' && status !== responderStatusFilter) return false;
      if (!query) return true;
      return `${name} ${status} ${teamName}`.toLowerCase().includes(query);
    });
  }, [departmentResponders, responderSearch, responderStatusFilter]);

  const responderTotalPages = Math.max(1, Math.ceil(filteredResponders.length / respondersPerPage));
  const safeResponderPage = Math.min(responderPage, responderTotalPages);
  const paginatedResponders = useMemo(() => {
    const start = (safeResponderPage - 1) * respondersPerPage;
    return filteredResponders.slice(start, start + respondersPerPage);
  }, [filteredResponders, safeResponderPage]);

  useEffect(() => {
    setResponderPage(1);
  }, [responderSearch, responderStatusFilter]);
  useEffect(() => {
    if (responderPage > responderTotalPages) setResponderPage(responderTotalPages);
  }, [responderPage, responderTotalPages]);

  const selectedTeamMembers = selectedTeamForMembers?.team_id
    ? (teamMembersByTeamId[selectedTeamForMembers.team_id] || [])
    : [];

  const selectedTeamMembersFiltered = useMemo(() => {
    const query = teamMemberSearch.trim().toLowerCase();
    return selectedTeamMembers.filter((member) => {
      const status = normalizeStatus(member.availability_status);
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

  useEffect(() => {
    setTeamMemberPage(1);
  }, [teamMemberSearch, teamMemberStatusFilter, selectedTeamForMembers?.team_id]);
  useEffect(() => {
    if (teamMemberPage > teamMemberTotalPages) setTeamMemberPage(teamMemberTotalPages);
  }, [teamMemberPage, teamMemberTotalPages]);

  const assignableResponderOptions = useMemo(() => {
    if (!selectedTeamForMembers?.team_id) return [];
    const assignedIds = new Set(selectedTeamMembers.map((member) => Number(member.responder_id)));
    return responders
      .filter((responder) => !assignedIds.has(Number(responder.responder_id)))
      .map((responder) => ({
        value: String(responder.responder_id),
        label: `${responder.name} • ${toTitleCase(normalizeStatus(responder.availability_status))}`,
      }));
  }, [responders, selectedTeamForMembers, selectedTeamMembers]);

  const handleUpdateTeamStatus = async (teamId, teamStatus) => {
    if (!canUpdateStatuses) {
      Swal.fire({ icon: 'warning', title: 'Not allowed', text: 'Your account cannot update statuses.' });
      return;
    }
    try {
      await updateResponderTeamStatus(teamId, teamStatus);
      await loadResponderResources();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Update failed', text: error.message || 'Please try again.' });
    }
  };

  const handleUpdateResponderStatus = async (responderId, status) => {
    if (!canUpdateStatuses) {
      Swal.fire({ icon: 'warning', title: 'Not allowed', text: 'Your account cannot update statuses.' });
      return;
    }
    try {
      await updateResponderStatus(responderId, status);
      await loadResponderResources();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Update failed', text: error.message || 'Please try again.' });
    }
  };

  const handleMapMember = async () => {
    if (!canManageMembership) {
      Swal.fire({ icon: 'warning', title: 'Not allowed', text: 'Only admins can assign team members.' });
      return;
    }
    if (!selectedTeamForMembers?.team_id || !memberForm.responder_id) return;
    try {
      await addTeamMember(Number(selectedTeamForMembers.team_id), Number(memberForm.responder_id));
      setMemberForm({ responder_id: '' });
      await loadResponderResources();
      const members = await getTeamMembers(Number(selectedTeamForMembers.team_id));
      setTeamMembersByTeamId((prev) => ({
        ...prev,
        [Number(selectedTeamForMembers.team_id)]: Array.isArray(members) ? members : [],
      }));
      Swal.fire({ icon: 'success', title: 'Member assigned', timer: 1200, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Assign failed', text: error.message || 'Please try again.' });
    }
  };

  const handleRemoveMember = async (responderId) => {
    if (!canManageMembership) {
      Swal.fire({ icon: 'warning', title: 'Not allowed', text: 'Only admins can remove team members.' });
      return;
    }
    if (!selectedTeamForMembers?.team_id) return;
    try {
      await removeTeamMember(Number(selectedTeamForMembers.team_id), Number(responderId));
      await loadResponderResources();
      const members = await getTeamMembers(Number(selectedTeamForMembers.team_id));
      setTeamMembersByTeamId((prev) => ({
        ...prev,
        [Number(selectedTeamForMembers.team_id)]: Array.isArray(members) ? members : [],
      }));
      Swal.fire({ icon: 'success', title: 'Member removed', timer: 1200, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Remove failed', text: error.message || 'Please try again.' });
    }
  };

  if (loadingDepartment) {
    return (
      <Layout>
        <div className="p-3 md:p-4 max-w-7xl mx-auto">
          <Breadcrumb items={[{ label: 'Home', path: '/dashboard' }, { label: 'Departments', path: '/departments' }, { label: 'Loading...' }]} />
          <div className="p-6 text-sm text-muted">Loading department...</div>
        </div>
      </Layout>
    );
  }

  if (!department) {
    return (
      <Layout>
        <div className="p-3 md:p-4 max-w-7xl mx-auto">
          <Breadcrumb items={[{ label: 'Home', path: '/dashboard' }, { label: 'Departments', path: '/departments' }, { label: 'Not found' }]} />
          <div className="p-6">
          <p className="text-foreground">Department not found.</p>
          <Button className="mt-3" variant="outline" onClick={() => navigate('/departments')}>
            Back to Departments
          </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const teamRangeStart = filteredTeams.length === 0 ? 0 : (safeTeamPage - 1) * teamsPerPage + 1;
  const teamRangeEnd = Math.min(safeTeamPage * teamsPerPage, filteredTeams.length);
  const responderRangeStart = filteredResponders.length === 0 ? 0 : (safeResponderPage - 1) * respondersPerPage + 1;
  const responderRangeEnd = Math.min(safeResponderPage * respondersPerPage, filteredResponders.length);

  return (
    <Layout>
      <div className="p-3 md:p-4 max-w-7xl mx-auto space-y-3">
        <Breadcrumb items={[{ label: 'Home', path: '/dashboard' }, { label: 'Departments', path: '/departments' }, { label: department?.name || 'Department' }]} />
        <div className={panelClass}>
          <div className={headerClass}>
            <Button variant="ghost" className="gap-2 rounded-lg" onClick={() => navigate('/departments')}>
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </div>
          <div className="p-3 md:p-4 space-y-2">
            <h1 className="text-xl font-semibold text-foreground">{department.name}</h1>
            <p className="text-xs text-muted">
              {department.type} response department
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="rounded-lg">Department ID: {department.department_id}</Badge>
              <Badge variant="outline" className="rounded-lg">Code: {String(department.code || '').toUpperCase() || 'N/A'}</Badge>
              <Badge variant="outline" className="rounded-lg">Teams: {departmentTeams.length}</Badge>
              <Badge variant="outline" className="rounded-lg">Responders: {departmentResponders.length}</Badge>
            </div>
            {!canManageMembership && (
              <p className="text-xs text-muted">
                Membership assignment is admin-only. This view is read/status-update only for your role.
              </p>
            )}
          </div>
        </div>

        <Tabs defaultValue="teams" className="space-y-3">
          <TabsList className="w-full sm:w-auto sm:inline-flex gap-1">
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="responders">Responders</TabsTrigger>
            <TabsTrigger value="map">Map</TabsTrigger>
          </TabsList>

          <TabsContent value="teams">
            <div className={panelClass}>
              <div className={headerClass}>
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${isLight ? 'bg-gray-100 text-primary' : 'bg-white/10 text-primary'}`}>
                  <Shield className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-semibold text-foreground flex-1">Department Teams</h3>
              </div>
              <div className="p-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                    {AVAILABILITY_OPTIONS.map((status) => (
                      <option key={`team-status-${status}`} value={status}>{toTitleCase(status)}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span>Showing {teamRangeStart}-{teamRangeEnd} of {filteredTeams.length}</span>
                  <span>{teamsPerPage} per page</span>
                </div>

                {resourceLoading && (
                  <div className="text-xs text-muted border border-border/60 rounded-lg p-2.5">Loading team resources...</div>
                )}

                {!resourceLoading && paginatedTeams.map((team) => {
                  const members = teamMembersByTeamId[team.team_id] || [];
                  return (
                    <div key={team.team_id} className="border border-border/60 rounded-lg p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground truncate">{team.team_name}</p>
                        <select
                          className="px-2 py-1 border border-border rounded bg-card text-foreground text-xs"
                          value={normalizeStatus(team.team_status)}
                          disabled={!canUpdateStatuses}
                          onChange={(event) => handleUpdateTeamStatus(team.team_id, event.target.value)}
                        >
                          {AVAILABILITY_OPTIONS.map((status) => (
                            <option key={`team-update-${status}`} value={status}>{toTitleCase(status)}</option>
                          ))}
                        </select>
                      </div>
                      <p className="text-[11px] text-muted mt-1">
                        Supported: {Array.isArray(team.supported_incident_types) && team.supported_incident_types.length
                          ? team.supported_incident_types.join(', ')
                          : 'all'}
                      </p>
                      <p className="text-[11px] text-muted mt-1">Members: {members.length}</p>
                      {members.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {members.slice(0, 6).map((member) => (
                            <span key={`${team.team_id}-${member.responder_id}`} className="text-[10px] px-1.5 py-0.5 rounded border border-border/60 text-muted">
                              {member.name} • {toTitleCase(normalizeStatus(member.availability_status))}
                            </span>
                          ))}
                          {members.length > 6 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded border border-border/60 text-muted">
                              +{members.length - 6} more
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
                          <Link2 className="w-3.5 h-3.5 mr-1" />
                          Assign Members
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {!resourceLoading && paginatedTeams.length === 0 && (
                  <div className="text-xs text-muted border border-border/60 rounded-lg p-2.5">
                    No teams found for this department.
                  </div>
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
          </TabsContent>

          <TabsContent value="responders">
            <div className={panelClass}>
              <div className={headerClass}>
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${isLight ? 'bg-gray-100 text-primary' : 'bg-white/10 text-primary'}`}>
                  <Users className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-semibold text-foreground flex-1">Department Responders</h3>
              </div>
              <div className="p-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                    {AVAILABILITY_OPTIONS.map((status) => (
                      <option key={`responder-status-${status}`} value={status}>{toTitleCase(status)}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span>Showing {responderRangeStart}-{responderRangeEnd} of {filteredResponders.length}</span>
                  <span>{respondersPerPage} per page</span>
                </div>

                {!resourceLoading && paginatedResponders.map((responder) => (
                  <div key={responder.responder_id} className="border border-border/60 rounded-lg p-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{responder.name}</p>
                      <p className="text-[11px] text-muted truncate">{responder.team_name || 'Unassigned team'}</p>
                    </div>
                    <select
                      className="px-2 py-1 border border-border rounded bg-card text-foreground text-xs"
                      value={normalizeStatus(responder.availability_status)}
                      disabled={!canUpdateStatuses}
                      onChange={(event) => handleUpdateResponderStatus(responder.responder_id, event.target.value)}
                    >
                      {AVAILABILITY_OPTIONS.map((status) => (
                        <option key={`responder-update-${status}`} value={status}>{toTitleCase(status)}</option>
                      ))}
                    </select>
                  </div>
                ))}

                {!resourceLoading && paginatedResponders.length === 0 && (
                  <div className="text-xs text-muted border border-border/60 rounded-lg p-2.5">
                    No responders found for this department.
                  </div>
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
          </TabsContent>

          <TabsContent value="map">
            <div className={panelClass}>
              <div className={headerClass}>
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${isLight ? 'bg-gray-100 text-primary' : 'bg-white/10 text-primary'}`}>
                  <MapPin className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-semibold text-foreground flex-1">Department Location</h3>
              </div>
              <div className="p-3 space-y-2">
                {hasDepartmentCoordinates ? (
                  <>
                    <div className="rounded-lg overflow-hidden border border-border/60 h-[300px] sm:h-[360px]">
                      <MapContainer center={[departmentLatitude, departmentLongitude]} zoom={15} style={{ width: '100%', height: '100%' }}>
                        <TileLayer
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        />
                        <Marker position={[departmentLatitude, departmentLongitude]} icon={departmentMarkerIcon} />
                      </MapContainer>
                    </div>
                    <div className="text-xs text-muted">
                      <p>Address: {departmentAddress || 'Not provided'}</p>
                      <p>Latitude: {departmentLatitude.toFixed(6)} | Longitude: {departmentLongitude.toFixed(6)}</p>
                      <a href={mapOpenStreetUrl} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                        Open in OpenStreetMap
                      </a>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-muted border border-border/60 rounded-lg p-3 space-y-1.5">
                    <p>Address: {departmentAddress || 'Not provided'}</p>
                    <p>This department has no map coordinates yet. Update its address/location from the Departments page.</p>
                    {mapAddressSearchUrl && (
                      <a href={mapAddressSearchUrl} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                        Search this address in OpenStreetMap
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={manageMembersDialogOpen} onOpenChange={setManageMembersDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Assign Members - {selectedTeamForMembers ? `${String(selectedTeamForMembers.department_code || '').toUpperCase()} • ${selectedTeamForMembers.team_name}` : 'Team'}
            </DialogTitle>
            <DialogDescription>
              Add or remove members for this team. Availability is shown for assignment decisions.
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
                disabled={!selectedTeamForMembers?.team_id || !memberForm.responder_id || !canManageMembership}
                onClick={handleMapMember}
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
                {AVAILABILITY_OPTIONS.map((status) => (
                  <option key={`dialog-member-status-${status}`} value={status}>{toTitleCase(status)}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2 max-h-64 overflow-auto">
              {paginatedTeamMembers.map((member) => (
                <div key={`assigned-member-${member.responder_id}`} className="border border-border/60 rounded-lg p-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{member.name}</p>
                    <p className="text-[11px] text-muted">Status: {toTitleCase(normalizeStatus(member.availability_status))}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-7 text-[11px] px-2.5"
                    disabled={!canManageMembership}
                    onClick={() => handleRemoveMember(member.responder_id)}
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
