import { Layout } from '@/presentation/components/layout/Layout';
import { Alert, Button, Card, Input, Modal, Select, Tabs, Tag } from 'antd';
import { ArrowLeft, Shield, Users, Link2, MapPin } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import { alertUser } from '@/presentation/feedback/alertUser';
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
import { ResponderStatusTag, statusSelectProps, embeddedStatusSelectProps } from '@/presentation/components/common/ResponderStatusTag';

const AVAILABILITY_OPTIONS = ['available', 'standby', 'busy', 'off-duty'];
const availabilitySelectOptions = AVAILABILITY_OPTIONS.map((status) => ({
  value: status,
  label: status.split('-').map((p) => (p ? `${p.charAt(0).toUpperCase()}${p.slice(1)}` : '')).join(' '),
}));

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
      alertUser({
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
      alertUser({
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

  useEffect(() => {
    const handleIncidentUpdated = () => {
      loadDepartment();
      loadResponderResources();
    };
    window.addEventListener('incident:updated', handleIncidentUpdated);
    return () => window.removeEventListener('incident:updated', handleIncidentUpdated);
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

  useEffect(() => { setTeamPage(1); }, [teamSearch, teamStatusFilter]);
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

  useEffect(() => { setResponderPage(1); }, [responderSearch, responderStatusFilter]);
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
      alertUser({ icon: 'warning', title: 'Not allowed', text: 'Your account cannot update statuses.' });
      return;
    }
    try {
      await updateResponderTeamStatus(teamId, teamStatus);
      await loadResponderResources();
    } catch (error) {
      alertUser({ icon: 'error', title: 'Update failed', text: error.message || 'Please try again.' });
    }
  };

  const handleUpdateResponderStatus = async (responderId, status) => {
    if (!canUpdateStatuses) {
      alertUser({ icon: 'warning', title: 'Not allowed', text: 'Your account cannot update statuses.' });
      return;
    }
    try {
      await updateResponderStatus(responderId, status);
      await loadResponderResources();
    } catch (error) {
      alertUser({ icon: 'error', title: 'Update failed', text: error.message || 'Please try again.' });
    }
  };

  const handleMapMember = async () => {
    if (!canManageMembership) {
      alertUser({ icon: 'warning', title: 'Not allowed', text: 'Only admins can assign team members.' });
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
      alertUser({ icon: 'success', title: 'Member assigned', timer: 1200, showConfirmButton: false });
    } catch (error) {
      alertUser({ icon: 'error', title: 'Assign failed', text: error.message || 'Please try again.' });
    }
  };

  const handleRemoveMember = async (responderId) => {
    if (!canManageMembership) {
      alertUser({ icon: 'warning', title: 'Not allowed', text: 'Only admins can remove team members.' });
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
      alertUser({ icon: 'success', title: 'Member removed', timer: 1200, showConfirmButton: false });
    } catch (error) {
      alertUser({ icon: 'error', title: 'Remove failed', text: error.message || 'Please try again.' });
    }
  };

  if (loadingDepartment) {
    return (
      <Layout>
        <div className="p-4 md:p-6">
          <Breadcrumb items={[{ label: 'Home', path: '/dashboard' }, { label: 'Departments', path: '/departments' }, { label: 'Loading...' }]} />
          <Card size="small" style={{ marginTop: 12 }}>Loading department...</Card>
        </div>
      </Layout>
    );
  }

  if (!department) {
    return (
      <Layout>
        <div className="p-4 md:p-6">
          <Breadcrumb items={[{ label: 'Home', path: '/dashboard' }, { label: 'Departments', path: '/departments' }, { label: 'Not found' }]} />
          <Card size="small" style={{ marginTop: 12 }}>
            <p>Department not found.</p>
            <Button onClick={() => navigate('/departments')}>Back to Departments</Button>
          </Card>
        </div>
      </Layout>
    );
  }

  const teamRangeStart = filteredTeams.length === 0 ? 0 : (safeTeamPage - 1) * teamsPerPage + 1;
  const teamRangeEnd = Math.min(safeTeamPage * teamsPerPage, filteredTeams.length);
  const responderRangeStart = filteredResponders.length === 0 ? 0 : (safeResponderPage - 1) * respondersPerPage + 1;
  const responderRangeEnd = Math.min(safeResponderPage * respondersPerPage, filteredResponders.length);

  const pager = (page, total, onPrev, onNext) => (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 8 }}>
      <Button disabled={page <= 1} onClick={onPrev}>Prev</Button>
      <span style={{ fontSize: 12, opacity: 0.7 }}>Page {page} / {total}</span>
      <Button disabled={page >= total} onClick={onNext}>Next</Button>
    </div>
  );

  return (
    <Layout>
      <div className="p-4 md:p-6 flex flex-col gap-3">
        <Breadcrumb items={[{ label: 'Home', path: '/dashboard' }, { label: 'Departments', path: '/departments' }, { label: department?.name || 'Department' }]} />
        <Card
          size="small"
          title={department.name}
          extra={<Button type="text" icon={<ArrowLeft size={14} />} onClick={() => navigate('/departments')}>Back</Button>}
        >
          <p style={{ marginTop: 0, opacity: 0.75 }}>{department.type} response department</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Tag>Department ID: {department.department_id}</Tag>
            <Tag>Code: {String(department.code || '').toUpperCase() || 'N/A'}</Tag>
            <Tag>Teams: {departmentTeams.length}</Tag>
            <Tag>Responders: {departmentResponders.length}</Tag>
          </div>
          {!canManageMembership && (
            <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 0, marginTop: 8 }}>
              Membership assignment is admin-only. This view is read/status-update only for your role.
            </p>
          )}
        </Card>

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
                      Department Teams
                    </span>
                  )}
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
                    Showing {teamRangeStart}-{teamRangeEnd} of {filteredTeams.length}
                  </div>
                  {resourceLoading && <Alert type="info" message="Loading team resources..." showIcon style={{ marginBottom: 8 }} />}
                  {!resourceLoading && paginatedTeams.map((team) => {
                    const members = teamMembersByTeamId[team.team_id] || [];
                    return (
                      <Card key={team.team_id} size="small" type="inner" style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                          <strong>{team.team_name}</strong>
                          <Select
                            style={{ width: 140 }}
                            value={normalizeStatus(team.team_status)}
                            disabled={!canUpdateStatuses}
                            onChange={(v) => handleUpdateTeamStatus(team.team_id, v)}
                            options={availabilitySelectOptions}
                            {...statusSelectProps}
                          />
                        </div>
                        <p style={{ fontSize: 12, opacity: 0.7, margin: '4px 0' }}>
                          Supported: {Array.isArray(team.supported_incident_types) && team.supported_incident_types.length
                            ? team.supported_incident_types.join(', ')
                            : 'all'}
                        </p>
                        <p style={{ fontSize: 12, opacity: 0.7, margin: '4px 0' }}>Members: {members.length}</p>
                        {members.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {members.slice(0, 6).map((member) => (
                              <ResponderStatusTag key={`${team.team_id}-${member.responder_id}`} status={member.availability_status}>
                                {member.name} • {toTitleCase(normalizeStatus(member.availability_status))}
                              </ResponderStatusTag>
                            ))}
                            {members.length > 6 && <Tag>+{members.length - 6} more</Tag>}
                          </div>
                        ) : (
                          <p style={{ fontSize: 12, opacity: 0.7 }}>No mapped members.</p>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                          <Button
                            icon={<Link2 size={14} />}
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
                      </Card>
                    );
                  })}
                  {!resourceLoading && paginatedTeams.length === 0 && (
                    <Alert type="info" message="No teams found for this department." showIcon />
                  )}
                  {pager(
                    safeTeamPage,
                    teamTotalPages,
                    () => setTeamPage((prev) => Math.max(1, prev - 1)),
                    () => setTeamPage((prev) => Math.min(teamTotalPages, prev + 1)),
                  )}
                </Card>
              ),
            },
            {
              key: 'responders',
              label: 'Responders',
              children: (
                <Card
                  size="small"
                  title={(
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <Users size={16} />
                      Department Responders
                    </span>
                  )}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <Input value={responderSearch} onChange={(e) => setResponderSearch(e.target.value)} placeholder="Search responder/team/status" />
                    <Select
                      value={responderStatusFilter}
                      onChange={setResponderStatusFilter}
                      options={[{ value: 'all', label: 'All status' }, ...availabilitySelectOptions]}
                      {...statusSelectProps}
                    />
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
                    Showing {responderRangeStart}-{responderRangeEnd} of {filteredResponders.length}
                  </div>
                  {!resourceLoading && paginatedResponders.map((responder) => (
                    <Card key={responder.responder_id} size="small" type="inner" style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                        <div>
                          <strong>{responder.name}</strong>
                          <div style={{ fontSize: 12, opacity: 0.7 }}>{responder.team_name || 'Unassigned team'}</div>
                        </div>
                        <Select
                          style={{ width: 140 }}
                          value={normalizeStatus(responder.availability_status)}
                          disabled={!canUpdateStatuses}
                          onChange={(v) => handleUpdateResponderStatus(responder.responder_id, v)}
                          options={availabilitySelectOptions}
                          {...statusSelectProps}
                        />
                      </div>
                    </Card>
                  ))}
                  {!resourceLoading && paginatedResponders.length === 0 && (
                    <Alert type="info" message="No responders found for this department." showIcon />
                  )}
                  {pager(
                    safeResponderPage,
                    responderTotalPages,
                    () => setResponderPage((prev) => Math.max(1, prev - 1)),
                    () => setResponderPage((prev) => Math.min(responderTotalPages, prev + 1)),
                  )}
                </Card>
              ),
            },
            {
              key: 'map',
              label: 'Map',
              children: (
                <Card
                  size="small"
                  title={(
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <MapPin size={16} />
                      Department Location
                    </span>
                  )}
                >
                  {hasDepartmentCoordinates ? (
                    <>
                      <div style={{ height: 360, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)', marginBottom: 8 }}>
                        <MapContainer center={[departmentLatitude, departmentLongitude]} zoom={15} style={{ width: '100%', height: '100%' }}>
                          <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          />
                          <Marker position={[departmentLatitude, departmentLongitude]} icon={departmentMarkerIcon} />
                        </MapContainer>
                      </div>
                      <p style={{ fontSize: 12, opacity: 0.7, margin: 0 }}>Address: {departmentAddress || 'Not provided'}</p>
                      <p style={{ fontSize: 12, opacity: 0.7, margin: '4px 0' }}>
                        Latitude: {departmentLatitude.toFixed(6)} | Longitude: {departmentLongitude.toFixed(6)}
                      </p>
                      <Button type="link" href={mapOpenStreetUrl} target="_blank" rel="noreferrer" style={{ paddingLeft: 0 }}>
                        Open in OpenStreetMap
                      </Button>
                    </>
                  ) : (
                    <Alert
                      type="info"
                      showIcon
                      message={`Address: ${departmentAddress || 'Not provided'}`}
                      description={(
                        <>
                          <p>This department has no map coordinates yet. Update its address/location from the Departments page.</p>
                          {mapAddressSearchUrl && (
                            <Button type="link" href={mapAddressSearchUrl} target="_blank" rel="noreferrer" style={{ paddingLeft: 0 }}>
                              Search this address in OpenStreetMap
                            </Button>
                          )}
                        </>
                      )}
                    />
                  )}
                </Card>
              ),
            },
          ]}
        />
      </div>

      <Modal
        open={manageMembersDialogOpen}
        onCancel={() => setManageMembersDialogOpen(false)}
        title={`Assign Members - ${selectedTeamForMembers ? `${String(selectedTeamForMembers.department_code || '').toUpperCase()} • ${selectedTeamForMembers.team_name}` : 'Team'}`}
        footer={[
          <Button key="close" onClick={() => setManageMembersDialogOpen(false)}>Close</Button>,
        ]}
        width={720}
      >
        <p style={{ opacity: 0.75 }}>Add or remove members for this team. Availability is shown for assignment decisions.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 12 }}>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Select responder"
            value={memberForm.responder_id || undefined}
            onChange={(v) => setMemberForm({ responder_id: v })}
            options={assignableResponderOptions}
            style={{ width: '100%' }}
            {...embeddedStatusSelectProps}
          />
          <Button
            type="primary"
            disabled={!selectedTeamForMembers?.team_id || !memberForm.responder_id || !canManageMembership}
            onClick={handleMapMember}
          >
            Add
          </Button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <Input value={teamMemberSearch} onChange={(e) => setTeamMemberSearch(e.target.value)} placeholder="Search assigned members" />
          <Select
            value={teamMemberStatusFilter}
            onChange={setTeamMemberStatusFilter}
            options={[{ value: 'all', label: 'All status' }, ...availabilitySelectOptions]}
            {...statusSelectProps}
          />
        </div>
        <div style={{ maxHeight: 256, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {paginatedTeamMembers.map((member) => (
            <Card key={`assigned-member-${member.responder_id}`} size="small" type="inner">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div>
                  <strong>{member.name}</strong>
                  <div style={{ fontSize: 12, marginTop: 4 }}><ResponderStatusTag status={member.availability_status}>{toTitleCase(normalizeStatus(member.availability_status))}</ResponderStatusTag></div>
                </div>
                <Button disabled={!canManageMembership} onClick={() => handleRemoveMember(member.responder_id)}>Remove</Button>
              </div>
            </Card>
          ))}
          {paginatedTeamMembers.length === 0 && (
            <Alert type="info" message="No team members match current filters." showIcon />
          )}
        </div>
        {pager(
          safeTeamMemberPage,
          teamMemberTotalPages,
          () => setTeamMemberPage((prev) => Math.max(1, prev - 1)),
          () => setTeamMemberPage((prev) => Math.min(teamMemberTotalPages, prev + 1)),
        )}
      </Modal>
    </Layout>
  );
}
