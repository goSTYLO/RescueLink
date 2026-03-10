import { Layout } from '@/presentation/components/layout/Layout';
import { IncidentMap } from '@/presentation/components/common/IncidentMap';
import { Badge } from '@/presentation/components/ui/Badge';
import { Button } from '@/presentation/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/presentation/components/ui/Tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/presentation/components/ui/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/Select';
import { Textarea } from '@/presentation/components/ui/Textarea';
import { Label } from '@/presentation/components/ui/Label';
import { Separator } from '@/presentation/components/ui/Separator';
import { 
  ArrowLeft, MapPin, CheckCircle, XCircle, Bell, 
  Clock, AlertTriangle, TrendingUp, Users, Shield, FileText,
  MessageSquare, Wrench, Award, Star, AlertCircle, Copy, Merge,
  X, ThumbsUp
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  incidents as mockIncidents, 
  incidentTimelines, 
  escalationHistory, 
  coordinationNotes,
  postIncidentReviews,
  departments,
  units
} from '@/data/mock/mockData';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getIncidentById, getIncidentAudioUrl, getIncidentWithAi, reclassifyIncident, updateIncidentStatus, verifyIncident } from '@/data/api/incidents.api';
import { getResponders, getResponderTeams, updateResponderStatus, updateResponderTeamStatus, getTeamMembers } from '@/data/api/responders.api';
import { createDispatch } from '@/data/api/dispatches.api';
import { getDepartments } from '@/data/api/departments.api';
import { DEV_MODE } from '@/core/config/app.config';
import { ROLES, normalizeRole } from '@/core/constants';
import { normalizeIncidentTaskType, doesTeamSupportIncidentType } from '@/core/utils/incidentClassification';
import { Loader2 } from 'lucide-react';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';
import Swal from 'sweetalert2';

function normalizeSeverityToDbLevel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  const map = {
    high: 'high',
    medium: 'medium',
    low: 'low',
    critical: 'high',
    warning: 'medium',
    red: 'high',
    black: 'high',
    yellow: 'medium',
    green: 'low',
  };

  return map[normalized] || null;
}

function mapSeverityToDisplay(value) {
  const level = normalizeSeverityToDbLevel(value);
  const labels = { high: 'Critical', medium: 'Warning', low: 'Low' };
  return labels[level] || (value || '—');
}

function mapApiToIncidentDetails(api, aiClassification = null) {
  const firstName = api.reporter_first_name || '';
  const lastName = api.reporter_last_name || '';
  const reporterName = (firstName || lastName)
    ? [firstName, lastName].filter(Boolean).join(' ').trim()
    : `User #${api.user_id}`;

  const typeMap = { fire: 'Fire', medical: 'Medical', police: 'Police', disaster: 'Disaster', other: 'Other' };
  const emergencyType = typeMap[api.incident_type?.toLowerCase()] || (api.incident_type ? String(api.incident_type).charAt(0).toUpperCase() + String(api.incident_type).slice(1) : '—');

  const normalizedSeverity = normalizeSeverityToDbLevel(api.severity_level);
  const severity = mapSeverityToDisplay(api.severity_level);

  const statusMap = { pending: 'Pending', resolved: 'Resolved', closed: 'Closed', verified: 'Verified', in_progress: 'In Progress' };
  const status = statusMap[api.status?.toLowerCase()] || (api.status || 'Pending');

  let timeReported = '—';
  if (api.created_at) {
    const d = new Date(api.created_at);
    timeReported = d.toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true
    });
  }

  return {
    id: api.report_id,
    reporterName,
    reporterPhone: api.reporter_phone || '—',
    barangay: '—',
    emergencyType,
    severity,
    status,
    description: api.description || 'No description provided.',
    location: { lat: api.latitude, lng: api.longitude },
    aiSuggestion: null,
    aiConfidenceScore: aiClassification?.confidence_score ?? null,
    aiLowConfidenceFlag: Boolean(aiClassification?.low_confidence_flag),
    aiPredictedType: aiClassification?.predicted_type || null,
    aiSecondaryPredictedType: api.secondary_classification || aiClassification?.secondary_predicted_type || null,
    aiPredictedSeverity: aiClassification?.predicted_severity || null,
    aiSecondaryConfidenceScore: api.secondary_confidence ?? aiClassification?.secondary_confidence_score ?? null,
    aiIsOverride: Boolean(aiClassification?.is_override),
    incidentTypeRaw: api.incident_type || null,
    severityRaw: normalizedSeverity || null,
    transcription: api.transcription || null,
    audioPath: api.audio_path || null,
    mediaPaths: Array.isArray(api.media_paths) ? api.media_paths : [],
    verified: api.verified ?? false,
    reporterConfirmedAt: api.reporter_confirmed_at || null,
    reporterConfirmedByUserId: api.reporter_confirmed_by_user_id ?? null,
    resolvedByUserId: api.resolved_by_user_id ?? null,
    closedAt: api.closed_at || null,
    closedByUserId: api.closed_by_user_id ?? null,
    closureMethod: api.closure_method || null,
    closureNotes: api.closure_notes || null,
    highPriority: normalizedSeverity === 'high',
    possibleDuplicates: [],
    closureData: api.closed_at
      ? {
        closedBy: api.closed_by_user_id ? `User #${api.closed_by_user_id}` : 'System',
        closedAt: api.closed_at,
        outcome: api.closure_method || 'closed',
      }
      : null,
    timeReported,
    assignedDepartment: api.assigned_department || null,
    assignedDepartmentId: api.assigned_department_code || null,
    assignedDepartments: api.assigned_department ? [api.assigned_department] : [],
    assignedTeamName: api.assigned_team_name || null,
    assignedTeamDepartmentCode: api.assigned_team_department_code || api.assigned_department_code || null,
  };
}

const normalizeTaskType = normalizeIncidentTaskType;

function getDefaultSectorByIncidentType(typeValue) {
  const normalized = normalizeTaskType(typeValue);
  return normalized === 'police' ? 'pnp' : 'drrmo';
}

const ACTIVE_SECTOR_IDS = new Set(['pnp', 'drrmo']);

export function IncidentDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState(null);
  const audioUrlRef = useRef(null);
  const [latestVerificationMeta, setLatestVerificationMeta] = useState(null);
  const coordinationStorageKey = `incident:${id}:coordination-notes:v1`;

  const fetchIncident = useCallback(async () => {
    const numericId = /^\d+$/.test(String(id));
    if (numericId) {
      setLoading(true);
      setError(null);
      try {
        try {
          const data = await getIncidentWithAi(id);
          setIncident(mapApiToIncidentDetails(data.incident, data.ai_classification));
        } catch {
          const fallbackData = await getIncidentById(id);
          setIncident(mapApiToIncidentDetails(fallbackData));
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch incident');
        setIncident(null);
      } finally {
        setLoading(false);
      }
    } else {
      const mockIncident = mockIncidents.find(i => i.id === id);
      setIncident(mockIncident || null);
      setLoading(false);
      setError(mockIncident ? null : 'Incident not found');
    }
  }, [id]);

  useEffect(() => {
    fetchIncident();
  }, [fetchIncident]);

  // Fetch audio when incident has audio and we're viewing API-sourced incident
  useEffect(() => {
    const numericId = /^\d+$/.test(String(id));
    const hasAudio = incident?.audioPath;
    if (!numericId || !hasAudio || !incident) {
      setAudioUrl(null);
      setAudioError(null);
      return;
    }
    setAudioLoading(true);
    setAudioError(null);
    getIncidentAudioUrl(id)
      .then((url) => {
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = url;
        setAudioUrl(url);
        setAudioLoading(false);
      })
      .catch((err) => {
        setAudioError(err.message || 'Failed to load audio');
        setAudioLoading(false);
      });
    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      setAudioUrl(null);
    };
  }, [id, incident?.audioPath, incident?.id]);

  const timeline = incidentTimelines[id || ''] || [];
  const escalations = escalationHistory[id || ''] || [];
  const [coordination, setCoordination] = useState([]);
  const review = postIncidentReviews[id || ''];
  const possibleDuplicates = mockIncidents.filter(i => incident?.possibleDuplicates?.includes(i.id));

  // Get current user role
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = normalizeRole(currentUser.role) === ROLES.SUPER_ADMIN;
  const isSupervisor = currentUser.role === 'Supervisor' || isAdmin;

  const roleLower = String(currentUser.role || '').toLowerCase();
  const normalizedRole = normalizeRole(currentUser.role);
  const canVerifyIncident = (
    normalizedRole === ROLES.SUPER_ADMIN
    || normalizedRole === ROLES.DISPATCHER
    || normalizedRole === ROLES.DEPARTMENT_ADMIN
  );
  const canNotifyDepartment = (
    normalizedRole === ROLES.SUPER_ADMIN
    || normalizedRole === ROLES.DISPATCHER
  );
  const isAssignedToDepartment = Boolean(
    incident?.assignedDepartment
    || incident?.assignedDepartmentId
    || (Array.isArray(incident?.assignedDepartments) && incident.assignedDepartments.length > 0)
  );
  const showNotifyDepartmentButton = canNotifyDepartment && !isAssignedToDepartment;
  const canUpdateResponderStatuses = (
    normalizedRole === ROLES.DEPARTMENT_ADMIN
    || normalizedRole === ROLES.DEPARTMENT_HEAD
  );
  const canManualReclassify = (
    normalizedRole === ROLES.SUPER_ADMIN
    || ['dispatcher', 'supervisor', 'admin', 'super-admin', 'superadmin'].includes(roleLower)
  );
  const canMarkResolved = (
    normalizedRole === ROLES.SUPER_ADMIN
    || normalizedRole === ROLES.DISPATCHER
    || normalizedRole === ROLES.DEPARTMENT_ADMIN
  );
  const canMarkFalseReport = (
    normalizedRole === ROLES.SUPER_ADMIN
    || normalizedRole === ROLES.DISPATCHER
  );

  const getConfidencePercent = (score) => {
    if (score == null || Number.isNaN(Number(score))) return null;
    const numeric = Number(score);
    const normalized = numeric <= 1 ? numeric * 100 : numeric;
    return Math.max(0, Math.min(100, Math.round(normalized)));
  };

  const getConfidenceLabel = (score) => {
    const pct = getConfidencePercent(score);
    if (pct == null) return 'Unknown';
    if (pct >= 90) return 'High';
    if (pct >= 70) return 'Medium';
    return 'Low';
  };

  // State for dialogs
  const [escalateDialogOpen, setEscalateDialogOpen] = useState(false);
  const [addDepartmentDialogOpen, setAddDepartmentDialogOpen] = useState(false);
  const [closureDialogOpen, setClosureDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resolveLoading, setResolveLoading] = useState(false);
  const [reclassDialogOpen, setReclassDialogOpen] = useState(false);
  const [reclassLoading, setReclassLoading] = useState(false);
  const [manualReclassInfoExpanded, setManualReclassInfoExpanded] = useState(false);

  // Select dropdown state
  const [severitySelectOpen, setSeveritySelectOpen] = useState(false);
  const [additionalDeptSelectOpen, setAdditionalDeptSelectOpen] = useState(false);
  const [notifyDeptSelectOpen, setNotifyDeptSelectOpen] = useState(false);
  const [closureClassSelectOpen, setClosureClassSelectOpen] = useState(false);

  // State for forms
  const [newSeverity, setNewSeverity] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [additionalDepartment, setAdditionalDepartment] = useState('');
  const [notifyDepartment, setNotifyDepartment] = useState('');
  const [notifyTeamName, setNotifyTeamName] = useState('');
  const [notifyTeamSelectOpen, setNotifyTeamSelectOpen] = useState(false);
  const [closureOutcome, setClosureOutcome] = useState('');
  const [closureClassification, setClosureClassification] = useState('');
  const [coordinationNote, setCoordinationNote] = useState('');
  const [reclassType, setReclassType] = useState('');
  const [reclassSeverity, setReclassSeverity] = useState('');
  const [reclassReason, setReclassReason] = useState('');
  const [responders, setResponders] = useState([]);
  const [responderTeams, setResponderTeams] = useState([]);
  const [teamMembersByTeamId, setTeamMembersByTeamId] = useState({});
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [departmentList, setDepartmentList] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    let cancelled = false;
    Promise.all([
      getResponders({ limit: 200, offset: 0 }),
      getResponderTeams({ limit: 200, offset: 0 }),
    ])
      .then(([responderRows, teamRows]) => {
        if (cancelled) return;
        setResponders(Array.isArray(responderRows) ? responderRows : []);
        setResponderTeams(Array.isArray(teamRows) ? teamRows : []);
      })
      .catch(() => {
        if (cancelled) return;
        setResponders([]);
        setResponderTeams([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getDepartments()
      .then((rows) => {
        if (cancelled) return;
        setDepartmentList(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (cancelled) return;
        setDepartmentList([]);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const fallbackNotes = coordinationNotes[id || ''] || [];
    try {
      const stored = JSON.parse(sessionStorage.getItem(coordinationStorageKey) || '[]');
      if (Array.isArray(stored) && stored.length > 0) {
        setCoordination(stored);
        return;
      }
    } catch {
      // Ignore malformed session entries and fallback to defaults.
    }
    setCoordination(fallbackNotes);
  }, [coordinationStorageKey, id]);

  useEffect(() => {
    sessionStorage.setItem(coordinationStorageKey, JSON.stringify(coordination));
  }, [coordination, coordinationStorageKey]);

  useEffect(() => {
    const teams = responderTeams
      .filter((team) => String(team.department_code || '').toLowerCase() === String(notifyDepartment || '').toLowerCase())
      .map((team) => ({ value: team.team_name, label: team.team_name }));
    if (!teams.some((team) => team.value === notifyTeamName)) {
      setNotifyTeamName(teams[0]?.value || '');
    }
  }, [notifyDepartment, notifyTeamName, responderTeams]);

  useEffect(() => {
    if (!statusDialogOpen) return;
    const targetTeamMeta = responderTeams.find(
      (team) =>
        String(team.department_code || '').toLowerCase() === String(notifyDepartment || '').toLowerCase()
        && String(team.team_name || '') === String(notifyTeamName || '')
    );
    if (!targetTeamMeta?.team_id) return;
    if (teamMembersByTeamId[targetTeamMeta.team_id]) return;
    getTeamMembers(targetTeamMeta.team_id)
      .then((members) => {
        setTeamMembersByTeamId((prev) => ({ ...prev, [targetTeamMeta.team_id]: Array.isArray(members) ? members : [] }));
      })
      .catch(() => {
        setTeamMembersByTeamId((prev) => ({ ...prev, [targetTeamMeta.team_id]: [] }));
      });
  }, [statusDialogOpen, notifyDepartment, notifyTeamName, responderTeams, teamMembersByTeamId]);

  // Get all units for workload display
  const getAllUnits = () => {
    if (Array.isArray(responders) && responders.length > 0) {
      return responders.map((responder) => ({
        id: responder.responder_id,
        name: responder.name || `Responder ${responder.responder_id}`,
        type: responder.organization || 'Responder',
        status: responder.availability_status || 'Unknown',
        activeTaskCount: String(responder.availability_status || '').toLowerCase().includes('available') ? 0 : 1,
      }));
    }
    return Object.values(units).flat();
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="p-8">
          <p className="text-primary font-medium">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Back</Button>
        </div>
      </Layout>
    );
  }

  if (!incident) {
    return (
      <Layout>
        <div className="p-8">
          <p>Incident not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Back</Button>
        </div>
      </Layout>
    );
  }

  // Severity: Critical #FF4F52, Warning amber, Resolved muted green (dark theme)
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'Critical': return 'bg-primary/20 text-primary border-primary/50';
      case 'Warning': return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'Resolved': return 'bg-severity-resolved/20 text-severity-resolved border-emerald-500/40';
      default: return 'bg-card text-muted border-[rgba(19,65,120,0.35)]';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending':
      case 'New':
        return 'bg-secondary/30 text-secondary-light border-secondary/50';
      case 'Verified':
        return 'bg-severity-resolved/20 text-severity-resolved border-emerald-500/40';
      case 'In Progress':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'Resolved':
        return 'bg-severity-resolved/20 text-severity-resolved border-emerald-500/40';
      case 'Closed':
        return 'bg-emerald-700/20 text-emerald-300 border-emerald-500/60';
      case 'Duplicate':
        return 'bg-card text-muted border-border';
      default:
        return 'bg-card text-muted border-border';
    }
  };

  const getWorkloadColor = (count) => {
    if (count === 0) return 'text-severity-resolved';
    if (count <= 2) return 'text-amber-400';
    return 'text-primary';
  };

  const getWorkloadBadge = (count) => {
    if (count === 0) return <Badge variant="outline" className="bg-severity-resolved/20 text-severity-resolved border-emerald-500/40">Available</Badge>;
    if (count <= 2) return <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/40">Moderate Load ({count})</Badge>;
    return <Badge variant="outline" className="bg-primary/20 text-primary border-primary/50">Overloaded ({count})</Badge>;
  };

  const activeSectors = departments.filter((dept) => ACTIVE_SECTOR_IDS.has(dept.id));
  const selectedNotifyTeamOptions = responderTeams
    .filter((team) => String(team.department_code || '').toLowerCase() === String(notifyDepartment || '').toLowerCase())
    .map((team) => {
      const supported = Array.isArray(team.supported_incident_types) ? team.supported_incident_types : [];
      const supportText = supported.length ? ` (${supported.join(', ')})` : '';
      return {
        value: team.team_name,
        label: `${team.team_name}${supportText}`,
      };
    });

  const tryCreateDepartmentOnlyAssignment = async (departmentCode) => {
    const numericId = /^\d+$/.test(String(id));
    if (!numericId || !departmentCode) return null;
    const token = localStorage.getItem('token');
    if (!token) return null;

    const departmentMeta = departmentList.find((d) => String(d.code || '').toLowerCase() === String(departmentCode || '').toLowerCase());
    return createDispatch({
      report_id: Number(id),
      department_code: departmentCode,
      department_name: departmentMeta?.name || null,
      default_department_code: getDefaultSectorByIncidentType(incident?.emergencyType),
      was_default_department: getDefaultSectorByIncidentType(incident?.emergencyType) === departmentCode,
      response_status: 'assigned',
    });
  };

  const openNotifyDepartmentDialog = () => {
    const defaultCode = getDefaultSectorByIncidentType(incident?.emergencyType);
    const inList = departmentList.some((d) => String(d.code || '').toLowerCase() === String(defaultCode || '').toLowerCase());
    setNotifyDepartment(inList ? defaultCode : (departmentList[0]?.code ?? ''));
    setNotifyDialogOpen(true);
  };

  const handleNotifyDepartment = async () => {
    const selectedCode = notifyDepartment;
    const selectedDept = departmentList.find((d) => String(d.code || '').toLowerCase() === String(selectedCode || '').toLowerCase());
    const selectedDepartment = selectedDept?.name || null;

    if (!selectedCode || !selectedDepartment) {
      await Swal.fire({
        icon: 'warning',
        title: 'Select department',
        text: 'Please choose a sector before notifying the department.',
        confirmButtonColor: '#134178',
      });
      return;
    }

    setIncident((prev) => {
      if (!prev) return prev;
      const existingDepartments = Array.isArray(prev.assignedDepartments)
        ? prev.assignedDepartments
        : [];
      return {
        ...prev,
        assignedDepartment: selectedDepartment,
        assignedDepartmentId: selectedCode,
        assignedDepartments: [...new Set([...existingDepartments, selectedDepartment])],
      };
    });

    setNotifyDialogOpen(false);

    try {
      await tryCreateDepartmentOnlyAssignment(selectedCode);
    } catch (dispatchError) {
      await Swal.fire({
        icon: 'warning',
        title: 'Assignment failed',
        text: dispatchError.message || 'Could not notify department.',
        confirmButtonColor: '#134178',
      });
      return;
    }

    await Swal.fire({
      icon: 'success',
      title: 'Department notified',
      text: `${selectedDepartment} has been notified. They will select the response team.`,
      timer: 2200,
      showConfirmButton: false,
      timerProgressBar: true,
    });
  };

  const selectedTeamMeta = responderTeams.find(
    (team) =>
      String(team.department_code || '').toLowerCase() === String(notifyDepartment || '').toLowerCase()
      && String(team.team_name || '') === String(notifyTeamName || '')
  );

  const selectedIncidentTaskType = normalizeTaskType(incident?.incidentTypeRaw || incident?.emergencyType);
  const selectedIncidentTypeIsWildcard = selectedIncidentTaskType === 'other';
  const selectedTeamSupportsTask = (() => {
    if (!selectedTeamMeta) return null;
    return doesTeamSupportIncidentType(selectedTeamMeta.supported_incident_types, selectedIncidentTaskType);
  })();

  const openStatusDialog = async () => {
    const deptCode = incident?.assignedTeamDepartmentCode || incident?.assignedDepartmentId || '';
    const teamName = incident?.assignedTeamName || '';
    setNotifyDepartment(deptCode);
    setNotifyTeamName(teamName);
    setStatusDialogOpen(true);
    const teamMeta = responderTeams.find(
      (t) =>
        String(t.department_code || '').toLowerCase() === String(deptCode || '').toLowerCase()
        && String(t.team_name || '') === String(teamName || '')
    );
    if (teamMeta?.team_id && !teamMembersByTeamId[teamMeta.team_id]) {
      try {
        const members = await getTeamMembers(teamMeta.team_id);
        setTeamMembersByTeamId((prev) => ({ ...prev, [teamMeta.team_id]: Array.isArray(members) ? members : [] }));
      } catch {
        setTeamMembersByTeamId((prev) => ({ ...prev, [teamMeta.team_id]: [] }));
      }
    }
  };

  const handleUpdateTeamStatus = async (nextStatus) => {
    if (!selectedTeamMeta?.team_id) return;
    setStatusBusy(true);
    try {
      const updated = await updateResponderTeamStatus(selectedTeamMeta.team_id, nextStatus);
      setResponderTeams((prev) => prev.map((team) => (team.team_id === selectedTeamMeta.team_id ? updated : team)));
    } finally {
      setStatusBusy(false);
    }
  };

  const handleUpdateResponderStatus = async (responderId, nextStatus) => {
    setStatusBusy(true);
    try {
      const updated = await updateResponderStatus(responderId, nextStatus);
      setResponders((prev) => prev.map((responder) => (responder.responder_id === responderId ? updated : responder)));
      if (selectedTeamMeta?.team_id) {
        setTeamMembersByTeamId((prev) => ({
          ...prev,
          [selectedTeamMeta.team_id]: (prev[selectedTeamMeta.team_id] || []).map((member) =>
            member.responder_id === responderId
              ? { ...member, availability_status: updated.availability_status }
              : member
          ),
        }));
      }
    } finally {
      setStatusBusy(false);
    }
  };

  const handleEscalate = () => {
    // Mock escalation
    alert(`Incident escalated to ${newSeverity}. Reason: ${escalationReason}`);
    setEscalateDialogOpen(false);
  };

  const handleAddDepartment = () => {
    if (!additionalDepartment) return;
    const selectedSector = activeSectors.find((dept) => dept.id === additionalDepartment);
    const selectedDepartmentName = selectedSector?.name || additionalDepartment;
    const teamName = responderTeams.find((team) => String(team.department_code || '').toLowerCase() === additionalDepartment)?.team_name || null;

    setIncident((prev) => {
      if (!prev) return prev;
      const existingDepartments = Array.isArray(prev.assignedDepartments)
        ? prev.assignedDepartments
        : [];
      return {
        ...prev,
        assignedDepartment: selectedDepartmentName,
        assignedDepartmentId: additionalDepartment,
        assignedTeamName: teamName || prev?.assignedTeamName || null,
        assignedDepartments: [...new Set([...existingDepartments, selectedDepartmentName])],
      };
    });

    setAddDepartmentDialogOpen(false);
    setAdditionalDepartment('');
    tryCreateDispatchAssignment(additionalDepartment, teamName).catch(() => {});
    Swal.fire({
      icon: 'success',
      title: 'Department added',
      text: `${selectedDepartmentName} has been added to this incident.`,
      timer: 1800,
      showConfirmButton: false,
      timerProgressBar: true,
    });
  };

  const handleCloseIncident = () => {
    // Mock closure
    alert(`Incident closed. Outcome: ${closureOutcome}`);
    setClosureDialogOpen(false);
  };

  const handleMarkDuplicate = (duplicateId) => {
    // Mock duplicate handling
    alert(`Marked ${id} as duplicate of ${duplicateId}`);
    setDuplicateDialogOpen(false);
  };

  const handleMarkFalse = () => {
    if (confirm('Are you sure you want to mark this as a false report?')) {
      alert('Incident marked as false report');
    }
  };

  const handleVerifyIncident = async () => {
    const numericId = /^\d+$/.test(String(id));
    if (!numericId || !incident) return;
    setVerifyLoading(true);
    try {
      const verificationResult = await verifyIncident(id);
      setLatestVerificationMeta(verificationResult?.blockchain || null);
      setVerifyDialogOpen(false);
      await fetchIncident();
      window.dispatchEvent(new CustomEvent('incident:updated', { detail: { incidentId: id } }));
    } catch (err) {
      alert(err.message || 'Failed to verify incident');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleMarkResolved = async () => {
    const numericId = /^\d+$/.test(String(id));
    if (!numericId || !incident) return;
    setResolveLoading(true);
    try {
      await updateIncidentStatus(id, 'resolved');
      await fetchIncident();
      window.dispatchEvent(new CustomEvent('incident:updated', { detail: { incidentId: id } }));
    } catch (err) {
      alert(err.message || 'Failed to mark incident as resolved');
    } finally {
      setResolveLoading(false);
    }
  };

  const openReclassDialog = () => {
    if (!incident) return;
    setReclassType((incident.incidentTypeRaw || '').toLowerCase());
    setReclassSeverity((incident.severityRaw || '').toLowerCase());
    setReclassReason('');
    setReclassDialogOpen(true);
  };

  const handleManualReclassify = async () => {
    const numericId = /^\d+$/.test(String(id));
    if (!numericId || !incident) return;
    if (!reclassType || !reclassSeverity) {
      alert('Please select both incident type and severity.');
      return;
    }

    const trimmedReason = reclassReason.trim();
    if (trimmedReason.length < 10) {
      await Swal.fire({
        icon: 'warning',
        title: 'Reason required',
        text: 'Please provide at least 10 characters explaining the manual override reason.',
        confirmButtonColor: '#134178',
      });
      return;
    }

    const confidencePct = getConfidencePercent(incident.aiConfidenceScore);
    if (confidencePct != null && confidencePct >= 90) {
      const confirmation = await Swal.fire({
        icon: 'warning',
        title: 'High AI Confidence Detected',
        text: `AI confidence is ${confidencePct}%. Are you sure you want to manually reclassify this incident?`,
        showCancelButton: true,
        confirmButtonText: 'Yes, reclassify',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#134178',
      });

      if (!confirmation.isConfirmed) {
        return;
      }
    }

    setReclassLoading(true);
    try {
      await reclassifyIncident(id, {
        incident_type: reclassType,
        severity_level: reclassSeverity,
        reason: trimmedReason,
      });
      setReclassDialogOpen(false);
      await fetchIncident();
      window.dispatchEvent(new CustomEvent('incident:updated', { detail: { incidentId: id } }));
      alert('Incident reclassified successfully.');
    } catch (err) {
      alert(err.message || 'Failed to reclassify incident');
    } finally {
      setReclassLoading(false);
    }
  };

  const handleAddCoordinationNote = () => {
    const trimmed = coordinationNote.trim();
    if (!trimmed) return;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const author = user?.name || user?.username || user?.email || 'Dispatcher';
    const department = incident?.assignedDepartment || user?.department || 'Operations';
    const now = new Date();
    setCoordination((prev) => ([
      {
        department,
        timestamp: now.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
        note: trimmed,
        author,
        source: 'Dispatcher UI',
      },
      ...prev,
    ]));
    setCoordinationNote('');
  };

  const panelClass = `rounded-2xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'}`;
  const headerClass = `flex items-center gap-3 px-4 py-3 border-b ${isLight ? 'border-gray-200/80 bg-gray-50/50' : 'border-white/10 bg-white/5'}`;
  const iconBoxClass = `w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'}`;
  const renderPrimaryActions = ({ compact = false } = {}) => (
    <>
      {!incident.verified && canVerifyIncident && (
        <Button
          className={`gap-2 bg-[#134178] hover:bg-[#0f3256] ${compact ? 'h-8 px-3 text-xs rounded-lg' : ''}`}
          onClick={() => setVerifyDialogOpen(true)}
        >
          <CheckCircle className="w-4 h-4" />
          Verify Incident
        </Button>
      )}
      {showNotifyDepartmentButton && (
        <Button
          variant="outline"
          className={`gap-2 rounded-xl ${compact ? 'h-8 px-3 text-xs rounded-lg' : ''}`}
          onClick={openNotifyDepartmentDialog}
        >
          <Bell className="w-4 h-4" />
          Notify Department
        </Button>
      )}
      {canUpdateResponderStatuses && incident?.assignedTeamName && (
        <Button
          variant="outline"
          className={`gap-2 rounded-xl ${compact ? 'h-8 px-3 text-xs rounded-lg' : ''}`}
          onClick={openStatusDialog}
        >
          <Users className="w-4 h-4" />
          Update Team/Responder Status
        </Button>
      )}
      {canMarkResolved && incident.status === 'In Progress' && (
        <Button
          className={`gap-2 bg-severity-resolved hover:bg-severity-resolved/90 ${compact ? 'h-8 px-3 text-xs rounded-lg' : ''}`}
          onClick={handleMarkResolved}
          disabled={resolveLoading}
        >
          {resolveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Mark Resolved
        </Button>
      )}
      {possibleDuplicates.length > 0 && (
        <Button
          variant="outline"
          className={`gap-2 rounded-xl ${isLight ? 'text-amber-600 border-amber-200 hover:bg-amber-50' : 'text-amber-400 border-amber-500/40 hover:bg-amber-500/20'} ${compact ? 'h-8 px-3 text-xs rounded-lg' : ''}`}
          onClick={() => setDuplicateDialogOpen(true)}
        >
          <Merge className="w-4 h-4" />
          Review Duplicates ({possibleDuplicates.length})
        </Button>
      )}
      {canMarkFalseReport && (
        <Button
          variant="outline"
          className={`gap-2 rounded-xl ${isLight ? 'text-primary border-primary/40 hover:bg-primary/10' : 'text-primary border-primary/50 hover:bg-primary/20'} ${compact ? 'h-8 px-3 text-xs rounded-lg' : ''}`}
          onClick={handleMarkFalse}
        >
          <XCircle className="w-4 h-4" />
          Mark as False Report
        </Button>
      )}
      {isSupervisor && incident.status === 'Resolved' && (
        <Badge variant="outline" className="rounded-lg border-border">
          Awaiting reporter confirmation before auto-close
        </Badge>
      )}
    </>
  );

  return (
    <Layout>
      <div className="p-4 md:p-6">
        <div className={`sticky top-2 z-30 mb-3 rounded-2xl border px-3 py-2 ${isLight ? 'bg-white/95 border-gray-200/80 backdrop-blur' : 'bg-card/90 border-white/10 backdrop-blur'}`}>
          <div className="flex flex-wrap items-center gap-2">
            {renderPrimaryActions({ compact: true })}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {possibleDuplicates.length > 0 && incident.status !== 'Duplicate' && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 border ${isLight ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-amber-500/40 bg-amber-500/10 text-amber-300'}`}>
                <AlertCircle className="w-3 h-3" />
                {possibleDuplicates.length} possible duplicate(s)
              </span>
            )}
            {canManualReclassify && (
              <span className="inline-flex items-center gap-1 text-muted">
                AI confidence: {getConfidencePercent(incident.aiConfidenceScore) ?? 'N/A'}%
                <button
                  type="button"
                  className="underline text-primary"
                  onClick={() => setManualReclassInfoExpanded((prev) => !prev)}
                >
                  {manualReclassInfoExpanded ? 'Hide reclassify hint' : 'Show reclassify hint'}
                </button>
              </span>
            )}
          </div>
          {canManualReclassify && manualReclassInfoExpanded && (
            <div className={`mt-2 rounded-lg border px-2.5 py-2 text-xs ${isLight ? 'border-amber-300/70 bg-amber-50/80 text-amber-800' : 'border-amber-500/40 bg-amber-500/10 text-amber-300'}`}>
              {incident.aiLowConfidenceFlag
                ? 'Low AI confidence detected. Manual review and override are recommended.'
                : 'Manual reclassification is available when operational context differs from AI output.'}{' '}
              <button type="button" className="underline text-primary" onClick={openReclassDialog}>
                Reclassify Incident
              </button>
            </div>
          )}
        </div>

        {/* Header with back + incident title – glass */}
        <div className={`mb-4 rounded-2xl border overflow-hidden ${isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'}`}>
          <div className={`flex items-center gap-4 px-4 py-3 border-b ${isLight ? 'border-gray-200/80 bg-gray-50/50' : 'border-white/10 bg-white/5'}`}>
            <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 rounded-xl">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </div>
          <div className="p-3 md:p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
              <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-semibold text-foreground">{incident.id}</h1>
                  {incident.highPriority && (
                    <Badge className="bg-primary/20 text-primary border-primary/50 rounded-lg">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      High Priority
                    </Badge>
                  )}
                  {incident.status === 'Duplicate' && (
                    <Badge variant="outline" className="bg-card text-muted border-border rounded-lg">
                      <Copy className="w-3 h-3 mr-1" />
                      Duplicate
                    </Badge>
                  )}
                </div>
                <p className="text-muted mt-1">{incident.emergencyType} Incident</p>
                {incident.timeReported && (
                  <p className="text-sm text-muted mt-0.5">Reported: {incident.timeReported}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`${getStatusColor(incident.status)} rounded-lg px-3 py-1`}>
                  {incident.status}
                </Badge>
                <Badge className={`${getSeverityColor(incident.severity)} rounded-lg px-3 py-1`}>
                  {incident.severity}
                </Badge>
                <Badge variant="outline" className="rounded-lg border-border">
                  {incident.verified ? 'Verified' : 'Not Verified'}
                </Badge>
                {getConfidencePercent(incident.aiConfidenceScore) != null && (
                  <Badge variant="outline" className="rounded-lg border-border">
                    AI {getConfidencePercent(incident.aiConfidenceScore)}% ({getConfidenceLabel(incident.aiConfidenceScore)})
                  </Badge>
                )}
                {incident.status === 'Resolved' && (
                  <Badge variant="outline" className="rounded-lg border-border">
                    {incident.reporterConfirmedAt ? 'Reporter confirmed' : 'Awaiting reporter confirmation'}
                  </Badge>
                )}
                {incident.status === 'Closed' && (
                  <Badge variant="outline" className="rounded-lg border-border">
                    Closed after reporter confirmation
                  </Badge>
                )}
                {incident.aiSecondaryPredictedType && (
                  <Badge variant="outline" className="rounded-lg border-border">
                    2nd AI: {incident.aiSecondaryPredictedType}
                    {getConfidencePercent(incident.aiSecondaryConfidenceScore) != null
                      ? ` (${getConfidencePercent(incident.aiSecondaryConfidenceScore)}%)`
                      : ''}
                  </Badge>
                )}
              </div>
            </div>

            {latestVerificationMeta?.tx_hash && (
              <div className={`p-3 rounded-xl border ${isLight ? 'bg-emerald-50/80 border-emerald-200/80' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                <p className="text-xs uppercase tracking-wide text-muted font-semibold mb-1">Latest Blockchain Verification</p>
                <p className="text-sm text-foreground">
                  Tx Hash: <span className="font-mono break-all">{latestVerificationMeta.tx_hash}</span>
                </p>
              </div>
            )}

            <div className={`flex flex-wrap items-center gap-2 p-2.5 rounded-xl border text-xs ${isLight ? 'bg-gray-50/70 border-gray-200/80' : 'bg-white/5 border-white/10'}`}>
              <span className="rounded-full border border-border px-2 py-0.5"><strong>Status:</strong> {incident.status}</span>
              <span className="rounded-full border border-border px-2 py-0.5"><strong>Severity:</strong> {incident.severity}</span>
              <span className="rounded-full border border-border px-2 py-0.5"><strong>Type:</strong> {incident.emergencyType}</span>
              <span className="rounded-full border border-border px-2 py-0.5 truncate max-w-[220px]" title={incident.reporterName}><strong>Reporter:</strong> {incident.reporterName}</span>
              <span className="rounded-full border border-border px-2 py-0.5 truncate max-w-[220px]" title={incident.reporterPhone}><strong>Contact:</strong> {incident.reporterPhone}</span>
              <span className="rounded-full border border-border px-2 py-0.5 truncate max-w-[220px]" title={incident.barangay}><strong>Barangay:</strong> {incident.barangay}</span>
            </div>

            {/* Incident Description - Top Priority */}
            <div className={`p-4 rounded-xl border ${isLight ? 'bg-blue-50/70 border-blue-200/80' : 'bg-blue-500/10 border-blue-500/30'}`}>
              <div className="flex items-start gap-2 mb-2">
                <FileText className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs uppercase tracking-wide text-muted font-semibold">Incident Description</p>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{incident.description}</p>
              {incident.aiSuggestion && (
                <div className={`mt-3 p-2.5 rounded-lg border ${isLight ? 'bg-primary/10 border-primary/20' : 'bg-primary/20 border-primary/30'}`}>
                  <p className="text-xs text-foreground"><strong>AI Suggestion:</strong> {incident.aiSuggestion}</p>
                </div>
              )}
              {incident.aiSecondaryPredictedType && (
                <div className={`mt-3 p-2.5 rounded-lg border ${isLight ? 'bg-indigo-50/80 border-indigo-200/80' : 'bg-indigo-500/10 border-indigo-500/30'}`}>
                  <p className="text-xs text-foreground">
                    <strong>2nd AI classification:</strong> {incident.aiSecondaryPredictedType}
                    {getConfidencePercent(incident.aiSecondaryConfidenceScore) != null
                      ? ` (${getConfidencePercent(incident.aiSecondaryConfidenceScore)}%)`
                      : ''}
                  </p>
                </div>
              )}
            </div>

            <div className={`p-3 rounded-xl border ${isLight ? 'bg-white/80 border-gray-200/80' : 'bg-white/5 border-white/10'}`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-start gap-2 mb-2">
                  <FileText className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-xs uppercase tracking-wide text-muted font-semibold">Audio Intelligence</p>
                </div>
                <Badge variant="outline" className="rounded-md text-[10px]">Transcription + Recording</Badge>
              </div>
              {incident.transcription ? (
                <p className="text-sm text-foreground whitespace-pre-wrap mb-3">{incident.transcription}</p>
              ) : (
                <p className="text-sm text-muted mb-3">No transcription available.</p>
              )}
              {audioLoading && (
                <div className="flex items-center gap-2 text-muted text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading audio...
                </div>
              )}
              {audioError && <p className="text-sm text-primary">{audioError}</p>}
              {audioUrl && !audioLoading && (
                <audio controls src={audioUrl} className="w-full h-10" preload="metadata">
                  Your browser does not support the audio element.
                </audio>
              )}
              {!incident.audioPath && !audioLoading && !audioError && (
                <p className="text-sm text-muted">No voice recording available</p>
              )}
            </div>
          </div>
        </div>

        <Tabs defaultValue="details" className="space-y-6">
          <TabsList className={`grid w-full grid-cols-5 lg:w-auto lg:inline-grid rounded-xl p-1 gap-1 ${isLight ? 'bg-gray-100 border border-gray-200' : 'bg-white/10 border border-white/10'}`}>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="coordination">Coordination</TabsTrigger>
            <TabsTrigger value="escalation">Escalation</TabsTrigger>
            {review && <TabsTrigger value="review">Review</TabsTrigger>}
          </TabsList>

          {/* DETAILS TAB */}
          <TabsContent value="details" className="space-y-6">
            <div className={panelClass}>
                <div className={headerClass}>
                  <div className={iconBoxClass}><MapPin className="w-4 h-4" /></div>
                  <h2 className="text-base font-semibold text-foreground">Secondary Context</h2>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted font-semibold mb-2">Map</p>
                    <IncidentMap
                      latitude={incident.location.lat}
                      longitude={incident.location.lng}
                      className="w-full h-48 rounded-xl overflow-hidden border border-border"
                    />
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted font-semibold mb-2">Media & Evidence</p>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        {(incident.mediaPaths || []).length > 0 ? (
                          (incident.mediaPaths || []).map((path, idx) => (
                            <div key={idx} className="aspect-video bg-muted/30 rounded-xl flex items-center justify-center border border-border">
                              <p className="text-sm text-muted">Photo {idx + 1}</p>
                            </div>
                          ))
                        ) : (
                          <div className="col-span-2 p-6 bg-muted/20 rounded-xl border border-dashed border-border flex items-center justify-center">
                            <p className="text-sm text-muted">No photos provided for this incident</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border ${isLight ? 'bg-gray-50/70 border-gray-200/80' : 'bg-white/5 border-white/10'}`}>
                    <p className="text-xs uppercase tracking-wide text-muted font-semibold mb-1">Workflow Guide</p>
                    <p className="text-xs text-muted">Pending → Verified → In Progress → Resolved → Closed</p>
                  </div>

                  {isSupervisor && incident.status !== 'Resolved' && incident.status !== 'Duplicate' && (
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-muted font-semibold">Escalation Controls</p>
                      <Dialog open={escalateDialogOpen} onOpenChange={setEscalateDialogOpen}>
                        <DialogTrigger asChild>
                          <Button className="w-full bg-amber-600 hover:bg-amber-700 gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            Escalate Severity
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Escalate Incident Severity</DialogTitle>
                            <DialogDescription>
                              Change the severity level of this incident. This action will be logged.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div>
                              <Label>New Severity Level</Label>
                              <Select value={newSeverity} onValueChange={setNewSeverity} open={severitySelectOpen} onOpenChange={setSeveritySelectOpen}>
                                {({ value, onValueChange, dropdownRect }) => (
                                  <>
                                    <SelectTrigger isOpen={severitySelectOpen} onClick={() => setSeveritySelectOpen(o => !o)}>
                                      <SelectValue value={value} options={[
                                        { value: 'Critical', label: 'Critical' },
                                        { value: 'Warning', label: 'Warning' },
                                        { value: 'Low', label: 'Low' }
                                      ]} placeholder="Select severity" />
                                    </SelectTrigger>
                                    <SelectContent isOpen={severitySelectOpen} dropdownRect={dropdownRect}>
                                      <SelectItem value="Critical" onSelect={(v) => { onValueChange(v); setSeveritySelectOpen(false); }}>Critical</SelectItem>
                                      <SelectItem value="Warning" onSelect={(v) => { onValueChange(v); setSeveritySelectOpen(false); }}>Warning</SelectItem>
                                      <SelectItem value="Low" onSelect={(v) => { onValueChange(v); setSeveritySelectOpen(false); }}>Low</SelectItem>
                                    </SelectContent>
                                  </>
                                )}
                              </Select>
                            </div>
                            <div>
                              <Label>Escalation Reason</Label>
                              <Textarea
                                placeholder="Explain why this escalation is necessary..."
                                value={escalationReason}
                                onChange={(e) => setEscalationReason(e.target.value)}
                                rows={3}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              className="bg-amber-600 hover:bg-amber-700"
                              onClick={handleEscalate}
                              disabled={!newSeverity || !escalationReason}
                            >
                              Confirm Escalation
                            </Button>
                            <Button variant="outline" onClick={() => setEscalateDialogOpen(false)}>
                              Cancel
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Dialog open={addDepartmentDialogOpen} onOpenChange={setAddDepartmentDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="w-full gap-2">
                            <Users className="w-4 h-4" />
                            Add Department
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Supporting Department</DialogTitle>
                            <DialogDescription>
                              Add another department to assist with this incident.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div>
                              <Label>Select Department</Label>
                              <Select value={additionalDepartment} onValueChange={setAdditionalDepartment} open={additionalDeptSelectOpen} onOpenChange={setAdditionalDeptSelectOpen}>
                                {({ value, onValueChange, dropdownRect }) => (
                                  <>
                                    <SelectTrigger isOpen={additionalDeptSelectOpen} onClick={() => setAdditionalDeptSelectOpen(o => !o)}>
                                      <SelectValue value={value} options={activeSectors.map((d) => ({ value: d.id, label: d.name }))} placeholder="Choose sector" />
                                    </SelectTrigger>
                                    <SelectContent isOpen={additionalDeptSelectOpen} dropdownRect={dropdownRect}>
                                      {activeSectors.map((dept) => (
                                        <SelectItem key={dept.id} value={dept.id} onSelect={(v) => { onValueChange(v); setAdditionalDeptSelectOpen(false); }}>
                                          {dept.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </>
                                )}
                              </Select>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              className="bg-[#134178] hover:bg-[#0f3256]"
                              onClick={handleAddDepartment}
                              disabled={!additionalDepartment}
                            >
                              Add Department
                            </Button>
                            <Button variant="outline" onClick={() => setAddDepartmentDialogOpen(false)}>
                              Cancel
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => alert('Incident marked as high priority')}
                      >
                        <Star className="w-4 h-4" />
                        {incident.highPriority ? 'Remove Priority' : 'Mark High Priority'}
                      </Button>
                    </div>
                  )}

                  {incident.assignedDepartments && incident.assignedDepartments.length > 1 && (
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-muted font-semibold">Multi-Department Coordination</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Shield className="w-4 h-4 text-primary" />
                          <span className="font-medium text-foreground">Lead: {incident.leadDepartment}</span>
                        </div>
                        {incident.assignedDepartments
                          .filter(dept => dept !== incident.leadDepartment)
                          .map((dept, idx) => (
                            <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg ${isLight ? 'bg-gray-50' : 'bg-secondary/20'}`}>
                              <div className="w-2 h-2 rounded-full bg-primary" />
                              <span className="text-sm text-foreground">{dept}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {(incident.closureData || incident.status === 'Closed') && (
                    <div className={`p-3 rounded-xl border ${isLight ? 'border-severity-resolved/40 bg-severity-resolved/10' : 'border-severity-resolved/30 bg-severity-resolved/10'}`}>
                      <p className="text-xs uppercase tracking-wide text-muted font-semibold mb-2">Closure Information</p>
                      <p className="text-sm text-foreground"><span className="text-muted">Closed By:</span> {incident.closureData?.closedBy || (incident.closedByUserId ? `User #${incident.closedByUserId}` : 'System')}</p>
                      <p className="text-sm text-foreground"><span className="text-muted">Closed At:</span> {incident.closureData?.closedAt || incident.closedAt || '—'}</p>
                      <p className="text-sm text-foreground"><span className="text-muted">Method:</span> {incident.closureData?.outcome || incident.closureMethod || 'auto_from_reporter_confirmation'}</p>
                    </div>
                  )}
                </div>
              </div>
          </TabsContent>

          {/* DIALOGS - Rendered outside cards for proper z-index and portal behavior */}
          <Dialog open={reclassDialogOpen} onOpenChange={setReclassDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Manual Incident Reclassification</DialogTitle>
                <DialogDescription>
                  Override AI classification for incident type and severity. This action is audit logged.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div>
                  <Label>Incident Type</Label>
                  <select
                    value={reclassType}
                    onChange={(e) => setReclassType(e.target.value)}
                    className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                    disabled={reclassLoading}
                  >
                    <option value="">Select incident type</option>
                    <option value="fire">Fire</option>
                    <option value="medical">Medical</option>
                    <option value="police">Police</option>
                    <option value="disaster">Disaster</option>
                  </select>
                </div>

                <div>
                  <Label>Severity</Label>
                  <select
                    value={reclassSeverity}
                    onChange={(e) => setReclassSeverity(e.target.value)}
                    className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                    disabled={reclassLoading}
                  >
                    <option value="">Select severity</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <Label>Reason (required, minimum 10 characters)</Label>
                  <Textarea
                    placeholder="Add context for this manual override..."
                    value={reclassReason}
                    onChange={(e) => setReclassReason(e.target.value)}
                    rows={3}
                    disabled={reclassLoading}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setReclassDialogOpen(false)} disabled={reclassLoading}>
                  Cancel
                </Button>
                <Button onClick={handleManualReclassify} disabled={reclassLoading || !reclassType || !reclassSeverity} className="bg-[#134178] hover:bg-[#0f3256]">
                  {reclassLoading ? (
                    <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Saving...</span>
                  ) : (
                    'Confirm Reclassification'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Verify Incident</DialogTitle>
                <DialogDescription>
                  Are you sure you want to verify this incident? This will record it on the blockchain for tamper-proof audit. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  onClick={handleVerifyIncident}
                  disabled={verifyLoading}
                  className="gap-2 bg-[#134178] hover:bg-[#0f3256]"
                >
                  {verifyLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Confirm Verify
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setVerifyDialogOpen(false)}
                  disabled={verifyLoading}
                >
                  Cancel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={closureDialogOpen} onOpenChange={setClosureDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Close Incident</DialogTitle>
                <DialogDescription>
                  Provide final closure details for this incident. This action is permanent.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Outcome Description</Label>
                  <Textarea
                    placeholder="Describe the final outcome..."
                    value={closureOutcome}
                    onChange={(e) => setClosureOutcome(e.target.value)}
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Classification</Label>
                  <Select value={closureClassification} onValueChange={setClosureClassification} open={closureClassSelectOpen} onOpenChange={setClosureClassSelectOpen}>
                    {({ value, onValueChange, dropdownRect }) => (
                      <>
                        <SelectTrigger isOpen={closureClassSelectOpen} onClick={() => setClosureClassSelectOpen((o) => !o)}>
                          <SelectValue value={value} options={[
                            { value: 'Successful Response', label: 'Successful Response' },
                            { value: 'Partial Success', label: 'Partial Success' },
                            { value: 'False Alarm', label: 'False Alarm' },
                            { value: 'Duplicate Report', label: 'Duplicate Report' },
                            { value: 'No Action Required', label: 'No Action Required' },
                          ]} placeholder="Select classification" />
                        </SelectTrigger>
                        <SelectContent isOpen={closureClassSelectOpen} dropdownRect={dropdownRect}>
                          <SelectItem value="Successful Response" onSelect={(v) => { onValueChange(v); setClosureClassSelectOpen(false); }}>Successful Response</SelectItem>
                          <SelectItem value="Partial Success" onSelect={(v) => { onValueChange(v); setClosureClassSelectOpen(false); }}>Partial Success</SelectItem>
                          <SelectItem value="False Alarm" onSelect={(v) => { onValueChange(v); setClosureClassSelectOpen(false); }}>False Alarm</SelectItem>
                          <SelectItem value="Duplicate Report" onSelect={(v) => { onValueChange(v); setClosureClassSelectOpen(false); }}>Duplicate Report</SelectItem>
                          <SelectItem value="No Action Required" onSelect={(v) => { onValueChange(v); setClosureClassSelectOpen(false); }}>No Action Required</SelectItem>
                        </SelectContent>
                      </>
                    )}
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleCloseIncident}
                  disabled={!closureOutcome || !closureClassification}
                >
                  Close Incident
                </Button>
                <Button variant="outline" onClick={() => setClosureDialogOpen(false)}>
                  Cancel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={notifyDialogOpen} onOpenChange={setNotifyDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Notify Department</DialogTitle>
                <DialogDescription>
                  Assign this incident to a department. The department admin will select the response team.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Department</Label>
                  <Select value={notifyDepartment} onValueChange={setNotifyDepartment} open={notifyDeptSelectOpen} onOpenChange={setNotifyDeptSelectOpen}>
                    {({ value, onValueChange, dropdownRect }) => (
                      <>
                        <SelectTrigger isOpen={notifyDeptSelectOpen} onClick={() => setNotifyDeptSelectOpen(o => !o)}>
                          <SelectValue value={value} options={departmentList.map((d) => ({ value: d.code || '', label: d.name || d.code || '—' }))} placeholder="Choose department" />
                        </SelectTrigger>
                        <SelectContent isOpen={notifyDeptSelectOpen} dropdownRect={dropdownRect}>
                          {departmentList.map((dept) => (
                            <SelectItem key={dept.department_id ?? dept.code} value={dept.code || ''} onSelect={(v) => { onValueChange(v); setNotifyDeptSelectOpen(false); }}>
                              {dept.name || dept.code || '—'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </>
                    )}
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNotifyDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-[#134178] hover:bg-[#0f3256]"
                  onClick={handleNotifyDepartment}
                  disabled={!notifyDepartment}
                >
                  Notify Department
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Team and Responder Status</DialogTitle>
                <DialogDescription>
                  Update availability for the team assigned to this incident. Team and member status affect assignment eligibility.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Assigned team</Label>
                  <p className="text-sm text-muted mt-1">
                    {selectedTeamMeta?.team_name || incident?.assignedTeamName || 'No team assigned'} ({notifyDepartment || incident?.assignedDepartmentId || 'n/a'})
                  </p>
                </div>
                {selectedTeamMeta?.team_id ? (
                  <>
                    <div>
                      <Label>Team Status</Label>
                      <select
                        className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm"
                        value={String(selectedTeamMeta?.team_status || 'available').toLowerCase()}
                        onChange={(event) => handleUpdateTeamStatus(event.target.value)}
                        disabled={statusBusy}
                      >
                        <option value="available">available</option>
                        <option value="standby">standby</option>
                        <option value="busy">busy</option>
                        <option value="off-duty">off-duty</option>
                      </select>
                    </div>
                    <div className="space-y-2 max-h-52 overflow-auto">
                      <Label>Team Members</Label>
                      {(teamMembersByTeamId[selectedTeamMeta.team_id] || []).map((member) => (
                        <div key={member.responder_id} className="grid grid-cols-[1fr_auto] items-center gap-2 p-2 rounded-lg border border-border/60">
                          <div>
                            <p className="text-sm font-medium text-foreground">{member.name || `Responder ${member.responder_id}`}</p>
                            <p className="text-xs text-muted">
                              Supported: {Array.isArray(member.supported_incident_types) && member.supported_incident_types.length
                                ? member.supported_incident_types.join(', ')
                                : 'all'}
                            </p>
                          </div>
                          <select
                            className="px-2 py-1 border border-border rounded bg-card text-foreground text-xs"
                            value={String(member.availability_status || 'available').toLowerCase()}
                            onChange={(event) => handleUpdateResponderStatus(member.responder_id, event.target.value)}
                            disabled={statusBusy}
                          >
                            <option value="available">available</option>
                            <option value="standby">standby</option>
                            <option value="busy">busy</option>
                            <option value="off-duty">off-duty</option>
                          </select>
                        </div>
                      ))}
                      {(teamMembersByTeamId[selectedTeamMeta.team_id] || []).length === 0 && (
                        <p className="text-xs text-muted">No team members found for this team.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted">No team assigned to this incident yet. Assign a team from the department dashboard first.</p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* TIMELINE TAB */}
          <TabsContent value="timeline">
            <div className={panelClass}>
              <div className={headerClass}>
                <div className={iconBoxClass}><Clock className="w-4 h-4" /></div>
                <h2 className="text-base font-semibold text-foreground">Incident Timeline</h2>
              </div>
              <div className="p-4">
                <div className="space-y-4">
                  {timeline.map((event, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-primary" />
                        {idx < timeline.length - 1 && (
                          <div className={`w-0.5 h-full min-h-[40px] ${isLight ? 'bg-gray-300' : 'bg-white/20'}`} />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-foreground">{event.action}</p>
                            <p className="text-sm text-muted">
                              {event.actor} ({event.actorRole})
                            </p>
                            {event.notes && (
                              <p className="text-sm text-muted mt-1 italic">{event.notes}</p>
                            )}
                          </div>
                          <span className="text-xs text-muted whitespace-nowrap">
                            {event.timestamp}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {timeline.length === 0 && (
                    <p className="text-center text-muted py-8">No timeline events yet</p>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* COORDINATION TAB */}
          <TabsContent value="coordination">
            <div className={panelClass}>
              <div className={headerClass}>
                <div className={iconBoxClass}><MessageSquare className="w-4 h-4" /></div>
                <h2 className="text-base font-semibold text-foreground">Cross-Department Coordination</h2>
              </div>
              <div className="p-4 space-y-4">
                {/* Coordination Notes */}
                <div className="space-y-3">
                  {coordination.map((note, idx) => (
                    <div key={idx} className={`p-4 rounded-xl border ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-secondary/20 border-border'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant="outline" className="text-xs rounded-lg">
                          {note.department}
                        </Badge>
                        <span className="text-xs text-muted">{note.timestamp}</span>
                      </div>
                      <p className="text-sm text-foreground mb-1">{note.note}</p>
                      <p className="text-xs text-muted">— {note.author}{note.source ? ` (${note.source})` : ''}</p>
                    </div>
                  ))}
                  {coordination.length === 0 && (
                    <p className="text-center text-muted py-4">No coordination notes yet</p>
                  )}
                </div>

                <Separator />

                <div>
                  <Label className="text-sm text-muted">Add Coordination Note</Label>
                  <Textarea 
                    placeholder="Share updates with other departments..."
                    value={coordinationNote}
                    onChange={(e) => setCoordinationNote(e.target.value)}
                    rows={3}
                    className={`mt-2 rounded-xl ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-white/5 border-border'}`}
                  />
                  <Button 
                    className="w-full mt-3 rounded-xl bg-primary hover:bg-primary-hover"
                    onClick={handleAddCoordinationNote}
                  >
                    Add Note
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ESCALATION TAB */}
          <TabsContent value="escalation">
            <div className={panelClass}>
              <div className={headerClass}>
                <div className={iconBoxClass}><TrendingUp className="w-4 h-4" /></div>
                <h2 className="text-base font-semibold text-foreground">Escalation History</h2>
              </div>
              <div className="p-4">
                <div className="space-y-4">
                  {escalations.map((esc, idx) => (
                    <div key={idx} className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-secondary/30 text-foreground">
                            {esc.fromSeverity}
                          </Badge>
                          <TrendingUp className="w-4 h-4 text-amber-600" />
                          <Badge className={getSeverityColor(esc.toSeverity)}>
                            {esc.toSeverity}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted">{esc.timestamp}</span>
                      </div>
                      <p className="text-sm text-foreground mb-1">
                        <strong>Escalated by:</strong> {esc.escalatedBy}
                      </p>
                      <p className="text-sm text-foreground">
                        <strong>Reason:</strong> {esc.reason}
                      </p>
                    </div>
                  ))}
                  {escalations.length === 0 && (
                    <p className="text-center text-muted py-8">No escalations recorded</p>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* REVIEW TAB (Only shown if review exists) */}
          {review && (
            <TabsContent value="review">
              <div className={panelClass}>
                <div className={headerClass}>
                  <div className={iconBoxClass}><ThumbsUp className="w-4 h-4" /></div>
                  <h2 className="text-base font-semibold text-foreground">Post-Incident Review</h2>
                </div>
                <div className="p-4 space-y-6">
                  <div>
                    <Label className="text-sm text-muted">Response Time</Label>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="font-medium text-foreground">{review.responseTime}</p>
                      <Badge className={`rounded-lg ${
                        review.responseTimeRating === 'Excellent' ? 'bg-severity-resolved/20 text-severity-resolved border-severity-resolved/40' :
                        review.responseTimeRating === 'Good' ? 'bg-secondary/20 text-secondary border-secondary/40' :
                        review.responseTimeRating === 'Fair' ? 'bg-amber-500/20 text-amber-600 border-amber-500/40' :
                        'bg-primary/20 text-primary border-primary/40'
                      }`}>
                        {review.responseTimeRating}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-sm text-muted mb-2 block">Issues Encountered</Label>
                    <ul className="space-y-2">
                      {review.issuesEncountered.map((issue, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-foreground">{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-sm text-muted mb-2 block">Supervisor Remarks</Label>
                    <p className={`text-sm text-foreground p-3 rounded-xl border ${isLight ? 'bg-primary/10 border-primary/20' : 'bg-primary/20 border-primary/30'}`}>
                      {review.supervisorRemarks}
                    </p>
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-sm text-muted mb-2 block">Recommendations</Label>
                    <ul className="space-y-2">
                      {review.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-foreground">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-sm text-muted mb-2 block">Overall Rating</Label>
                    <div className="flex items-center gap-2">
                      {[...Array(5)].map((_, idx) => (
                        <Star 
                          key={idx} 
                          className={`w-5 h-5 ${
                            idx < review.overallRating ? 'fill-amber-400 text-amber-400' : (isLight ? 'text-gray-300' : 'text-muted')
                          }`}
                        />
                      ))}
                      <span className="ml-2 text-sm text-muted">
                        {review.overallRating} / 5.0
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <p className="text-xs text-muted">
                      Reviewed by {review.reviewedBy} on {review.reviewDate}
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>

        {/* Duplicate Handling Dialog */}
        <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Possible Duplicate Reports</DialogTitle>
              <DialogDescription>
                Review these similar incidents and decide if this is a duplicate.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
              {possibleDuplicates.map((dup) => (
                <div key={dup.id} className="p-4 border border-border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-foreground">{dup.id}</p>
                      <p className="text-sm text-gray-600">{dup.emergencyType} - {dup.barangay}</p>
                    </div>
                    <Badge className={getSeverityColor(dup.severity)}>
                      {dup.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground mb-2">{dup.description}</p>
                  <p className="text-xs text-gray-500 mb-3">Reported: {dup.timeReported}</p>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleMarkDuplicate(dup.id)}
                  >
                    <Merge className="w-3 h-3" />
                    Merge with this incident
                  </Button>
                </div>
              ))}
            </div>
            <DialogFooter>
              {canMarkFalseReport && (
                <Button 
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => {
                    if (confirm('Mark this incident as a false report?')) {
                      alert('Incident marked as false report');
                      setDuplicateDialogOpen(false);
                    }
                  }}
                >
                  Mark as False Report
                </Button>
              )}
              <Button variant="outline" onClick={() => setDuplicateDialogOpen(false)}>
                Not a Duplicate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
