import { Layout } from '@/presentation/components/layout/Layout';
import { SelectParentIncidentDialog } from '@/presentation/components/common/SelectParentIncidentDialog';
import { VolunteerStatusBadge } from '@/presentation/components/common/VolunteerStatusBadge';
import { BackupRequestedBadge } from '@/presentation/components/common/BackupRequestedBadge';
import { BackupRequestDialog } from '@/presentation/components/common/BackupRequestDialog';
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
  X, ThumbsUp, Link2, ChevronDown, ChevronUp, LayoutList, HandHelping
} from 'lucide-react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
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
import { getIncidentById, getIncidentAudioUrl, getIncidentMediaUrl, getIncidentWithAi, reclassifyIncident, updateIncidentStatus, verifyIncident, getCoordinationNotes, addCoordinationNote, getIncidentDuplicates, getPotentialDuplicates, linkDuplicate, unlinkDuplicate, clearDuplicateFlag, acknowledgeBackupRequest, getIncidentEscalations, createIncidentEscalation, updateIncidentEscalationStatus } from '@/data/api/incidents.api';
import { getResponders, getResponderTeams, updateResponderStatus, updateResponderTeamStatus, getTeamMembers } from '@/data/api/responders.api';
import { createDispatch, undoDepartmentNotification, confirmSuggestion, reassignTeam } from '@/data/api/dispatches.api';
import { getDepartments } from '@/data/api/departments.api';
import { DEV_MODE } from '@/core/config/app.config';
import { getAuthToken } from '@/core/auth/session';
import { ROLES, normalizeRole, getRoleDisplayLabel } from '@/core/constants';
import { normalizeIncidentTaskType, doesTeamSupportIncidentType } from '@/core/utils/incidentClassification';
import { formatIncidentTypeLabel, incidentTypesFromApi, formatIncidentTypesLabel, isIncidentEffectivelyResolved, isIncidentClosed, hasOpenBackupUi, getBackupDialogCapabilities, getAutoAssignmentBadge, getSuggestedTeamName } from '@/core/utils/incidentDisplay';
import { IncidentTypeChips } from '@/presentation/components/common/IncidentTypeChips';
import { Loader2 } from 'lucide-react';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';
import { Breadcrumb } from '@/presentation/components/common/Breadcrumb';
import Swal from 'sweetalert2';
import { IncidentEscalationModal } from '@/presentation/components/incidents/IncidentEscalationModal';
import { IncidentEscalationSection } from '@/presentation/components/incidents/IncidentEscalationSection';

// Feature flag — mirrors USE_BLOCKCHAIN in Backend/.env
const USE_BLOCKCHAIN = import.meta.env.VITE_USE_BLOCKCHAIN === 'true';

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

  const typeMap = { fire: 'Fire', medical: 'Medical', police: 'Police', disaster: 'Disaster', accident: 'Accident', other: 'Other', sos: 'SOS' };
  const emergencyType = typeMap[api.incident_type?.toLowerCase()] || (api.incident_type ? String(api.incident_type).charAt(0).toUpperCase() + String(api.incident_type).slice(1) : '—');
  const incidentTypes = incidentTypesFromApi(api);
  const emergencyTypesLabel = formatIncidentTypesLabel(api);

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

  const assignedDepartmentList = Array.isArray(api.assigned_departments)
    ? api.assigned_departments
      .map((item) => String(item || '').trim())
      .filter(Boolean)
    : [];
  const singleAssignedDepartment = String(api.assigned_department || '').trim();
  if (singleAssignedDepartment && !assignedDepartmentList.includes(singleAssignedDepartment)) {
    assignedDepartmentList.unshift(singleAssignedDepartment);
  }
  const leadDepartment = String(api.lead_department || '').trim() || assignedDepartmentList[0] || null;

  return {
    id: api.report_id,
    reporterName,
    reporterPhone: api.reporter_phone || '—',
    barangay: api.barangay || '—',
    emergencyType,
    emergencyTypesLabel,
    incidentTypes,
    severity,
    status,
    responderStatus: api.responder_status || null,
    acceptedByUserId: api.accepted_by_user_id ?? null,
    acceptedByName: api.accepted_by_name || null,
    acceptedByPhone: api.accepted_by_phone || null,
    acceptedAt: api.accepted_at || null,
    hasPendingBackup: Boolean(api.has_pending_backup),
    pendingBackupRequestId: api.pending_backup_request_id ?? null,
    hasOpenBackupRequest: Boolean(api.has_open_backup_request),
    activeBackupRequestId: api.active_backup_request_id ?? null,
    openBackupStatus: api.open_backup_status || null,
    latestBackupStatus: api.latest_backup_status || null,
    backupVolunteers: Array.isArray(api.backup_volunteers) ? api.backup_volunteers : [],
    backupVolunteerCount: api.backup_volunteer_count ?? (Array.isArray(api.backup_volunteers) ? api.backup_volunteers.length : 0),
    pendingBackupTarget: api.pending_backup_target || null,
    pendingBackupBroadcastCount: api.pending_backup_broadcast_count ?? null,
    description: api.description || 'No description provided.',
    location: { lat: api.latitude, lng: api.longitude },
    aiSuggestion: null,
    aiConfidenceScore: aiClassification?.confidence_score ?? api.primary_confidence ?? null,
    aiMaxConfidenceScore: aiClassification?.max_confidence_score ?? null,
    aiSttConfidence: aiClassification?.stt_confidence ?? api.stt_confidence ?? null,
    aiFallbackUsed: Boolean(aiClassification?.fallback_used),
    aiKeywordPromoted: Boolean(aiClassification?.keyword_promoted),
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
    mediaPaths: (() => {
      const raw = api.media_paths;
      if (Array.isArray(raw)) return raw;
      if (typeof raw === 'string' && raw.trim()) {
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch { return []; }
      }
      return [];
    })(),
    verified: api.verified ?? false,
    reporterConfirmedAt: api.reporter_confirmed_at || null,
    reporterConfirmedByUserId: api.reporter_confirmed_by_user_id ?? null,
    resolvedByUserId: api.resolved_by_user_id ?? null,
    closedAt: api.closed_at || null,
    closedByUserId: api.closed_by_user_id ?? null,
    closureMethod: api.closure_method || null,
    closureNotes: api.closure_notes || null,
    highPriority: normalizedSeverity === 'high',
    isDuplicate: Boolean(api.is_duplicate),
    flaggedForReview: Boolean(api.flagged_for_review),
    parentReportId: api.parent_report_id ?? null,
    duplicateCluster: Array.isArray(api.duplicate_cluster) ? api.duplicate_cluster : [],
    possibleDuplicates: [],
    closureData: api.closed_at
      ? {
        closedBy: api.closed_by_user_id ? `User #${api.closed_by_user_id}` : 'System',
        closedAt: api.closed_at,
        outcome: api.closure_method || 'closed',
      }
      : null,
    timeReported,
    assignedDepartment: singleAssignedDepartment || null,
    assignedDepartmentId: api.assigned_department_code || null,
    assignedDepartments: assignedDepartmentList,
    leadDepartment,
    assignedTeamName: api.assigned_team_name || null,
    assignedTeamDepartmentCode: api.assigned_team_department_code || api.assigned_department_code || null,
    assignedTeamRoster: Array.isArray(api.assigned_team_roster) ? api.assigned_team_roster : [],
    dispatches: Array.isArray(api.dispatches) ? api.dispatches : [],
    autoAssignmentStatus: String(api.auto_assignment_status || 'none').toLowerCase(),
    suggestedDepartmentCode: api.suggested_department_code || null,
    suggestedTeamName: api.suggested_team_name || null,
    autoAssignmentReason: api.auto_assignment_reason || null,
    autoAssignmentMismatch: Boolean(api.auto_assignment_mismatch),
    timeline: api.timeline || [],
    estimatedEtaMinutes: api.estimated_eta_minutes != null ? Number(api.estimated_eta_minutes) : null,
    estimatedArrivalAt: api.estimated_arrival_at || null,
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
  const [searchParams, setSearchParams] = useSearchParams();
  const detailsTab = searchParams.get('tab') || 'details';
  const [activeTab, setActiveTab] = useState(detailsTab);

  useEffect(() => {
    if (detailsTab) setActiveTab(detailsTab);
  }, [detailsTab]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', newTab);
      return next;
    }, { replace: true });
  };
  const focusDispatch = searchParams.get('focus') === 'dispatch';
  const focusAssign = searchParams.get('focus') === 'assign';
  const dispatchSectionRef = useRef(null);
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

  const fetchIncident = useCallback(async (opts = {}) => {
    const { silent = false } = opts;
    const numericId = /^\d+$/.test(String(id));
    if (numericId) {
      if (!getAuthToken()) {
        navigate(`/login?next=${encodeURIComponent(`/incidents/${id}`)}`, { replace: true });
        return;
      }
      if (!silent) setLoading(true);
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
        if (err?.message === 'No authentication token found') {
          navigate(`/login?next=${encodeURIComponent(`/incidents/${id}`)}`, { replace: true });
          return;
        }
        setError(err.message || 'Failed to fetch incident');
        setIncident(null);
      } finally {
        if (!silent) setLoading(false);
      }
    } else {
      const mockIncident = mockIncidents.find(i => i.id === id);
      setIncident(mockIncident || null);
      setLoading(false);
      setError(mockIncident ? null : 'Incident not found');
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchIncident();
  }, [fetchIncident]);

  const [justUpdatedAt, setJustUpdatedAt] = useState(null);
  useEffect(() => {
    const handleUpdated = (e) => {
      const incidentId = e?.detail?.incidentId ?? e?.detail?.report_id;
      if (incidentId != null && String(incidentId) === String(id)) {
        fetchIncident({ silent: true });
        setJustUpdatedAt(Date.now());
      }
    };
    window.addEventListener('incident:updated', handleUpdated);
    return () => window.removeEventListener('incident:updated', handleUpdated);
  }, [id, fetchIncident]);

  useEffect(() => {
    if (!justUpdatedAt) return;
    const t = setTimeout(() => setJustUpdatedAt(null), 4000);
    return () => clearTimeout(t);
  }, [justUpdatedAt]);

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

  // Fetch media files when incident has mediaPaths
  const [mediaUrls, setMediaUrls] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState(null);
  const [mediaLightboxIndex, setMediaLightboxIndex] = useState(null);
  const [mediaRetryingIndex, setMediaRetryingIndex] = useState(null);
  const mediaUrlRefs = useRef([]);

  useEffect(() => {
    const numericId = /^\d+$/.test(String(id));
    if (!numericId || !id || !incident?.mediaPaths?.length) {
      setMediaUrls([]);
      setMediaLoading(false);
      return;
    }
    setMediaLoading(true);
    setMediaError(null);
    const mediaCount = incident.mediaPaths.length;
    const loadedUrls = new Array(mediaCount).fill(null);
    let loadedCount = 0;

    incident.mediaPaths.forEach((path, idx) => {
      getIncidentMediaUrl(id, idx)
        .then(({ url, contentType }) => {
          loadedUrls[idx] = { url, contentType, path };
          mediaUrlRefs.current[idx] = url;
          loadedCount++;
          if (loadedCount === mediaCount) {
            setMediaUrls([...loadedUrls]);
            setMediaLoading(false);
          }
        })
        .catch((err) => {
          loadedUrls[idx] = { error: err.message || 'Failed to load', path };
          loadedCount++;
          if (loadedCount === mediaCount) {
            setMediaUrls([...loadedUrls]);
            setMediaLoading(false);
          }
        });
    });

    return () => {
      mediaUrlRefs.current.forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
      mediaUrlRefs.current = [];
    };
  }, [id, incident?.mediaPaths]);

  const retryMediaFetch = useCallback(async (idx) => {
    if (!id || !incident?.mediaPaths?.[idx]) return;
    setMediaRetryingIndex(idx);
    try {
      const { url, contentType } = await getIncidentMediaUrl(id, idx);
      setMediaUrls((prev) => {
        const next = [...prev];
        next[idx] = { url, contentType, path: incident.mediaPaths[idx] };
        return next;
      });
      mediaUrlRefs.current[idx] = url;
    } catch (err) {
      setMediaUrls((prev) => {
        const next = [...prev];
        next[idx] = { error: err.message || 'Failed to load', path: incident.mediaPaths[idx] };
        return next;
      });
    } finally {
      setMediaRetryingIndex(null);
    }
  }, [id, incident?.mediaPaths]);

  // Use API timeline for numeric IDs, mock for non-numeric IDs
  const isNumericId = /^\d+$/.test(String(id));
  const timeline = isNumericId
    ? (incident?.timeline || [])
    : (incidentTimelines[id || ''] || []);
  // Real escalations loaded from API; mock escalationHistory only for non-numeric (dev) IDs
  const [escalations, setEscalations] = useState([]);
  const [escalationsLoading, setEscalationsLoading] = useState(false);
  const [escalationModalOpen, setEscalationModalOpen] = useState(false);
  const [coordination, setCoordination] = useState([]);
  const review = postIncidentReviews[id || ''];
  const duplicateCluster = incident?.duplicateCluster ?? [];

  // Get current user role
  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
  const isAdmin = normalizeRole(currentUser.role) === ROLES.SUPER_ADMIN;
  const isSupervisor = currentUser.role === 'Supervisor' || isAdmin;

  const roleLower = String(currentUser.role || '').toLowerCase();
  const normalizedRole = normalizeRole(currentUser.role);
  const canVerifyIncident = (
    normalizedRole === ROLES.SUPER_ADMIN
    || normalizedRole === ROLES.DISPATCHER
  );
  const canCloseIncident = canVerifyIncident;
  const effectivelyResolved = isIncidentEffectivelyResolved(incident);
  const canNotifyDepartment = (
    normalizedRole === ROLES.SUPER_ADMIN
    || normalizedRole === ROLES.DISPATCHER
  );
  const incidentIsClosed = isIncidentClosed(incident);
  const canUpdateResponderStatuses = (
    normalizedRole === ROLES.DEPARTMENT_ADMIN
    || normalizedRole === ROLES.DEPARTMENT_HEAD
  );
  const canSelectTeamForDepartment = (
    normalizedRole === ROLES.DEPARTMENT_ADMIN
    || normalizedRole === ROLES.DEPARTMENT_HEAD
    || normalizedRole === ROLES.PERSONNEL
  );
  const canConfirmOrReassign = (
    normalizedRole === ROLES.SUPER_ADMIN
    || normalizedRole === ROLES.DISPATCHER
    || normalizedRole === ROLES.DEPARTMENT_ADMIN
    || normalizedRole === ROLES.DEPARTMENT_HEAD
  );
  const autoStatus = String(incident?.autoAssignmentStatus || '').toLowerCase();
  const autoBadge = getAutoAssignmentBadge(incident);
  const isSuggested = autoStatus === 'suggested';
  const isAutoApplied = autoStatus === 'auto_applied' || autoStatus === 'confirmed' || autoStatus === 'overridden';
  const canManualReclassify = (
    normalizedRole === ROLES.SUPER_ADMIN
    || ['dispatcher', 'supervisor', 'admin', 'super-admin', 'superadmin'].includes(roleLower)
  );
  const canMarkResolved = (
    normalizedRole === ROLES.DEPARTMENT_ADMIN
    || normalizedRole === ROLES.DEPARTMENT_HEAD
  );
  const canManageDuplicates = (
    normalizedRole === ROLES.SUPER_ADMIN
    || normalizedRole === ROLES.DISPATCHER
  );
  const canSaveToBlockchain = canVerifyIncident
    && incidentIsClosed
    && Boolean(incident?.reporterConfirmedAt);

  // Who can request inter-department assistance
  const canRequestEscalation = (
    normalizedRole === ROLES.SUPER_ADMIN
    || normalizedRole === ROLES.DISPATCHER
    || normalizedRole === ROLES.DEPARTMENT_ADMIN
    || normalizedRole === ROLES.DEPARTMENT_HEAD
  ) && !incidentIsClosed;
  const currentUserDeptId = currentUser?.departmentId ?? currentUser?.department_id ?? null;

  // Count active escalation requests for the badge
  const activeEscalationsCount = escalations.filter((e) => e.status === 'pending' || e.status === 'accepted').length;

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

  const renderAiConfidenceMeta = (className = '') => {
    const primaryPct = getConfidencePercent(incident?.aiConfidenceScore);
    const sttPct = getConfidencePercent(incident?.aiSttConfidence);
    const maxPct = getConfidencePercent(incident?.aiMaxConfidenceScore);
    const hasBadges = incident?.aiKeywordPromoted || incident?.aiFallbackUsed;
    if (primaryPct == null && sttPct == null && !hasBadges) return null;

    return (
      <div className={`space-y-1.5 ${className}`}>
        {primaryPct != null && (
          <p className="text-xs text-muted">Primary model confidence: {primaryPct}%</p>
        )}
        {sttPct != null && (
          <p className="text-xs text-muted">STT confidence: {sttPct}%</p>
        )}
        {maxPct != null && primaryPct != null && maxPct !== primaryPct && (
          <p className="text-xs text-muted">Max model confidence: {maxPct}%</p>
        )}
        {hasBadges && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {incident.aiKeywordPromoted && (
              <Badge variant="outline" className="rounded-lg text-[10px] border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                Keyword-assisted
              </Badge>
            )}
            {incident.aiFallbackUsed && (
              <Badge variant="outline" className="rounded-lg text-[10px] border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300">
                Keyword fallback
              </Badge>
            )}
          </div>
        )}
      </div>
    );
  };

  // State for dialogs
  const [escalateDialogOpen, setEscalateDialogOpen] = useState(false);
  const [addDepartmentDialogOpen, setAddDepartmentDialogOpen] = useState(false);
  const [closureDialogOpen, setClosureDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [browseParentDialogOpen, setBrowseParentDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resolveLoading, setResolveLoading] = useState(false);
  const [closeLoading, setCloseLoading] = useState(false);
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [acknowledgingBackup, setAcknowledgingBackup] = useState(false);
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
  const [undoNotifyDialogOpen, setUndoNotifyDialogOpen] = useState(false);
  const [undoDepartmentCode, setUndoDepartmentCode] = useState('');
  const [assignTeamDialogOpen, setAssignTeamDialogOpen] = useState(false);
  const [assignTeamName, setAssignTeamName] = useState('');
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [reassignTeamName, setReassignTeamName] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [reassignLoading, setReassignLoading] = useState(false);
  const [assignTeamSelectOpen, setAssignTeamSelectOpen] = useState(false);
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
  const [potentialDuplicatesList, setPotentialDuplicatesList] = useState([]);
  const [duplicateDialogLoading, setDuplicateDialogLoading] = useState(false);
  const [linkDuplicateInProgress, setLinkDuplicateInProgress] = useState(false);
  const [relatedReportsExpanded, setRelatedReportsExpanded] = useState(false);
  const [mediaEvidenceExpanded, setMediaEvidenceExpanded] = useState(true);

  const displayDuplicates = incident?.isDuplicate ? duplicateCluster : potentialDuplicatesList;
  const closedRelatedReport = duplicateCluster.find((r) => r.report_id !== incident?.id && String(r.status || '').toLowerCase() === 'closed');

  const departmentNameByCode = departmentList.reduce((acc, dept) => {
    const code = String(dept?.code || '').trim();
    if (code) {
      acc[code.toLowerCase()] = dept?.name || code;
    }
    return acc;
  }, {});

  const teamSummaryByDepartment = responderTeams.reduce((acc, team) => {
    const code = String(team?.department_code || '').trim().toLowerCase();
    if (!code) return acc;
    const status = String(team?.team_status || 'available').trim().toLowerCase();
    if (!acc[code]) {
      acc[code] = { available: 0, standby: 0, busy: 0, offDuty: 0, other: 0, total: 0 };
    }
    acc[code].total += 1;
    if (status.includes('available')) acc[code].available += 1;
    else if (status.includes('standby')) acc[code].standby += 1;
    else if (status.includes('busy') || status.includes('deployed')) acc[code].busy += 1;
    else if (status.includes('off')) acc[code].offDuty += 1;
    else acc[code].other += 1;
    return acc;
  }, {});

  const timelineDepartmentState = (incident?.timeline || []).reduce((acc, event) => {
    if (event?.type !== 'assigned' || !event?.detail || typeof event.detail !== 'object') return acc;
    const code = String(event.detail.department_code || '').trim();
    if (!code) return acc;
    const key = code.toLowerCase();
    const name = String(event.detail.department_name || '').trim() || departmentNameByCode[key] || code;
    const hasTeam = String(event.detail.team_name || '').trim() !== '';
    const existing = acc[key] || {
      code,
      name,
      notified: false,
      hasTeamAssigned: false,
    };
    existing.notified = true;
    existing.name = existing.name || name;
    if (hasTeam) existing.hasTeamAssigned = true;
    acc[key] = existing;
    return acc;
  }, {});

  if (incident?.assignedDepartmentId) {
    const fallbackCode = String(incident.assignedDepartmentId).trim();
    const fallbackKey = fallbackCode.toLowerCase();
    if (!timelineDepartmentState[fallbackKey]) {
      timelineDepartmentState[fallbackKey] = {
        code: fallbackCode,
        name: incident?.assignedDepartment || departmentNameByCode[fallbackKey] || fallbackCode,
        notified: true,
        hasTeamAssigned: Boolean(incident?.assignedTeamName),
      };
    }
  }

  const notifiedDepartments = Object.values(timelineDepartmentState);
  const notifiedDepartmentCodes = new Set(notifiedDepartments.map((dept) => String(dept.code || '').toLowerCase()));
  const availableNotifyDepartments = departmentList.filter((dept) => !notifiedDepartmentCodes.has(String(dept.code || '').toLowerCase()));
  const assignedDepartmentCodeForTeamActions = incident?.assignedDepartmentId || notifiedDepartments[0]?.code || incident?.assignedTeamDepartmentCode || incident?.suggestedDepartmentCode || '';
  const hasSuggestedTeam = Boolean(incident?.suggestedTeamName);
  const showNotifyDepartmentButton = canNotifyDepartment && !incidentIsClosed && notifiedDepartments.length === 0 && availableNotifyDepartments.length > 0 && !isAutoApplied && !isSuggested;
  const showUndoNotifyButton = canNotifyDepartment && !incidentIsClosed && notifiedDepartments.length > 0 && !isAutoApplied && autoStatus !== 'suggested';
  const showSelectTeamButton = !incident?.assignedTeamName && !incidentIsClosed && !isAutoApplied && (
    (canSelectTeamForDepartment && !isSuggested)
    || (canConfirmOrReassign && (isSuggested || autoStatus === 'dept_notified'))
  );

  const openNotifyDepartmentDialog = useCallback(() => {
    const defaultCode = getDefaultSectorByIncidentType(incident?.emergencyType);
    const inList = availableNotifyDepartments.some(
      (d) => String(d.code || '').toLowerCase() === String(defaultCode || '').toLowerCase()
    );
    setNotifyDepartment(inList ? defaultCode : (availableNotifyDepartments[0]?.code ?? ''));
    setNotifyDialogOpen(true);
  }, [availableNotifyDepartments, incident?.emergencyType]);

  useEffect(() => {
    if (!focusDispatch || !incident || detailsTab !== 'details') return;
    const timer = setTimeout(() => {
      dispatchSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (showNotifyDepartmentButton) {
        openNotifyDepartmentDialog();
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [focusDispatch, incident, detailsTab, showNotifyDepartmentButton, openNotifyDepartmentDialog]);

  useEffect(() => {
    if (!focusAssign || !incident || detailsTab !== 'details') return;
    const timer = setTimeout(() => {
      if (showSelectTeamButton && assignedDepartmentCodeForTeamActions) {
        const preferred = responderTeams.find(
          (team) => String(team.department_code || '').toLowerCase() === String(assignedDepartmentCodeForTeamActions || '').toLowerCase()
        );
        setAssignTeamName(preferred?.team_name || '');
        setAssignTeamDialogOpen(true);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [focusAssign, incident, detailsTab, showSelectTeamButton, assignedDepartmentCodeForTeamActions, responderTeams]);

  useEffect(() => {
    const token = getAuthToken();
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
    const u = JSON.parse(sessionStorage.getItem('user') || '{}');
    const role = normalizeRole(u.role);
    // Dispatchers, super-admins, dept-admins, and dept-heads all need department list for escalations
    const canListDepartments = [
      ROLES.SUPER_ADMIN, ROLES.DISPATCHER, ROLES.DEPARTMENT_ADMIN, ROLES.DEPARTMENT_HEAD,
    ].includes(role);
    if (!canListDepartments) {
      setDepartmentList([]);
      return;
    }
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

  // Load coordination notes: use API for numeric IDs, sessionStorage for mock IDs
  useEffect(() => {
    const isNumericId = /^\d+$/.test(String(id));
    const fallbackNotes = coordinationNotes[id || ''] || [];

    if (isNumericId) {
      // For real incidents (numeric IDs), fetch from API
      let cancelled = false;
      getCoordinationNotes(id)
        .then((notes) => {
          if (cancelled) return;
          // Map API response to expected shape if needed
          const mappedNotes = notes.map((n) => ({
            ...n,
            author: n.author || n.author_name,
            roleLabel: n.roleLabel || getRoleDisplayLabel(n.role || n.author_role),
          }));
          setCoordination(mappedNotes);
        })
        .catch((err) => {
          if (cancelled) return;
          console.error('Failed to load coordination notes:', err);
          // Fallback to empty on error
          setCoordination([]);
        });
      return () => { cancelled = true; };
    }

    // For mock incidents (non-numeric IDs), use sessionStorage
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

  // Load escalations from API for numeric incident IDs
  useEffect(() => {
    const isNumericId = /^\d+$/.test(String(id));
    if (!isNumericId) {
      setEscalations(escalationHistory[id || ''] || []);
      return;
    }
    const token = getAuthToken();
    if (!token || !canRequestEscalation) {
      setEscalations([]);
      return;
    }
    let cancelled = false;
    setEscalationsLoading(true);
    getIncidentEscalations(id)
      .then((rows) => { if (!cancelled) setEscalations(rows); })
      .catch(() => { if (!cancelled) setEscalations([]); })
      .finally(() => { if (!cancelled) setEscalationsLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleCreateEscalation(payload) {
    const row = await createIncidentEscalation(id, payload);
    setEscalations((prev) => [row, ...prev]);
    window.dispatchEvent(new CustomEvent('incident:updated', { detail: { incidentId: id } }));
    Swal.fire({
      icon: 'success',
      title: 'Assistance Requested',
      text: 'Your inter-department assistance request has been sent.',
      timer: 2500,
      showConfirmButton: false,
      timerProgressBar: true,
    });
  }

  async function handleEscalationStatusUpdate(escalationId, status, responseNotes) {
    const updated = await updateIncidentEscalationStatus(id, escalationId, { status, response_notes: responseNotes });
    setEscalations((prev) => prev.map((e) => (e.id === escalationId ? updated : e)));
    window.dispatchEvent(new CustomEvent('incident:updated', { detail: { incidentId: id, status } }));
  }

  // Persist coordination notes to sessionStorage only for mock IDs
  useEffect(() => {
    const isNumericId = /^\d+$/.test(String(id));
    if (!isNumericId) {
      sessionStorage.setItem(coordinationStorageKey, JSON.stringify(coordination));
    }
  }, [coordination, coordinationStorageKey, id]);

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

  // Must be declared before early returns to satisfy Rules of Hooks
  const loadPotentialDuplicates = useCallback(async () => {
    const numericId = /^\d+$/.test(String(id));
    if (!numericId) return;
    setDuplicateDialogLoading(true);
    try {
      const res = await getPotentialDuplicates(id);
      setPotentialDuplicatesList(res?.potential_duplicates ?? []);
    } catch {
      setPotentialDuplicatesList([]);
    } finally {
      setDuplicateDialogLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (duplicateDialogOpen && !incident?.isDuplicate) {
      loadPotentialDuplicates();
    }
  }, [duplicateDialogOpen, incident?.isDuplicate, loadPotentialDuplicates]);

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
  const tryCreateDispatchAssignment = async (departmentCode, teamName) => {
    const numericId = /^\d+$/.test(String(id));
    if (!numericId || !departmentCode || !teamName) return null;
    const token = getAuthToken();
    if (!token) return null;

    const departmentMeta = departmentList.find((d) => String(d.code || '').toLowerCase() === String(departmentCode || '').toLowerCase());
    return createDispatch({
      report_id: Number(id),
      department_code: departmentCode,
      department_name: departmentMeta?.name || null,
      team_name: teamName,
      default_department_code: getDefaultSectorByIncidentType(incident?.emergencyType),
      was_default_department: getDefaultSectorByIncidentType(incident?.emergencyType) === departmentCode,
      response_status: 'assigned',
    });
  };

  const tryCreateDepartmentOnlyAssignment = async (departmentCode) => {
    const numericId = /^\d+$/.test(String(id));
    if (!numericId || !departmentCode) return null;
    const token = getAuthToken();
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

  const openUndoNotifyDialog = () => {
    setUndoDepartmentCode(notifiedDepartments[0]?.code || '');
    setUndoNotifyDialogOpen(true);
  };

  const handleNotifyDepartment = async () => {
    const selectedCode = notifyDepartment;
    const selectedDept = departmentList.find((d) => String(d.code || '').toLowerCase() === String(selectedCode || '').toLowerCase());
    const selectedDepartment = selectedDept?.name || null;

    if (!selectedCode || !selectedDepartment) {
      await Swal.fire({
        icon: 'warning',
        title: 'Select department',
        text: 'Please choose a sector before assigning the incident.',
        confirmButtonColor: '#134178',
      });
      return;
    }

    if (notifiedDepartmentCodes.has(String(selectedCode || '').toLowerCase())) {
      await Swal.fire({
        icon: 'info',
        title: 'Already notified',
        text: `${selectedDepartment} is already notified for this incident.`,
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
        assignedTeamName: null,
        assignedTeamDepartmentCode: null,
        assignedDepartments: [...new Set([...existingDepartments, selectedDepartment])],
      };
    });

    setNotifyDialogOpen(false);

    try {
      await tryCreateDepartmentOnlyAssignment(selectedCode);
      await fetchIncident();
      window.dispatchEvent(new CustomEvent('incident:updated', { detail: { incidentId: id } }));
    } catch (dispatchError) {
      await Swal.fire({
        icon: 'warning',
        title: 'Assignment failed',
        text: dispatchError.message || 'Could not assign incident.',
        confirmButtonColor: '#134178',
      });
      return;
    }

    const successText = `${selectedDepartment} has been notified and will select the response team.`;

    await Swal.fire({
      icon: 'success',
      title: 'Assignment successful',
      text: successText,
      timer: 2200,
      showConfirmButton: false,
      timerProgressBar: true,
    });
  };

  const handleUndoDepartmentNotification = async () => {
    const selectedCode = String(undoDepartmentCode || '').trim();
    if (!selectedCode) {
      await Swal.fire({
        icon: 'warning',
        title: 'Select department',
        text: 'Please choose a notified department to undo.',
        confirmButtonColor: '#134178',
      });
      return;
    }

    const selectedDepartment = notifiedDepartments.find((item) => String(item.code || '').toLowerCase() === selectedCode.toLowerCase());
    if (selectedDepartment?.hasTeamAssigned) {
      await Swal.fire({
        icon: 'info',
        title: 'Cannot undo',
        text: 'You can no longer undo notification once a team is assigned by the department.',
        confirmButtonColor: '#134178',
      });
      return;
    }

    try {
      await undoDepartmentNotification({ report_id: Number(id), department_code: selectedCode });
      setUndoNotifyDialogOpen(false);
      await fetchIncident();
      window.dispatchEvent(new CustomEvent('incident:updated', { detail: { incidentId: id } }));
      await Swal.fire({
        icon: 'success',
        title: 'Notification undone',
        text: `${selectedDepartment?.name || selectedCode} is no longer notified for this incident.`,
        timer: 2200,
        showConfirmButton: false,
        timerProgressBar: true,
      });
    } catch (err) {
      await Swal.fire({
        icon: 'error',
        title: 'Undo failed',
        text: err.message || 'Could not undo department notification.',
        confirmButtonColor: '#134178',
      });
    }
  };

  const handleConfirmSuggestion = async () => {
    const teamName = getSuggestedTeamName(incident) || assignTeamName;
    const departmentCode = incident?.suggestedDepartmentCode || assignedDepartmentCodeForTeamActions || '';
    const departmentName = departmentNameByCode[String(departmentCode).toLowerCase()] || departmentCode;
    const proceed = await Swal.fire({
      icon: 'question',
      title: 'Confirm suggested team?',
      text: teamName
        ? `Assign ${teamName}${departmentName ? ` (${departmentName})` : ''} to this incident.`
        : 'Assign the suggested team to this incident.',
      showCancelButton: true,
      confirmButtonText: teamName ? `Confirm ${teamName}` : 'Confirm',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#134178',
    });
    if (!proceed.isConfirmed) return;
    try {
      await confirmSuggestion({
        report_id: Number(id),
        department_code: departmentCode || undefined,
        team_name: teamName || undefined,
      });
      await fetchIncident();
      window.dispatchEvent(new CustomEvent('incident:updated', { detail: { incidentId: id } }));
      await Swal.fire({
        icon: 'success',
        title: 'Suggestion confirmed',
        text: `${teamName || 'Team'} has been assigned.`,
        timer: 2200,
        showConfirmButton: false,
        timerProgressBar: true,
      });
    } catch (err) {
      await Swal.fire({
        icon: 'error',
        title: 'Confirm failed',
        text: err.message || 'Could not confirm the suggested team.',
        confirmButtonColor: '#134178',
      });
    }
  };

  const handleReassignTeam = async () => {
    if (!reassignReason || reassignReason.trim().length < 10) {
      await Swal.fire({
        icon: 'warning',
        title: 'Reason required',
        text: 'Enter at least 10 characters explaining the reassignment.',
        confirmButtonColor: '#134178',
      });
      return;
    }
    setReassignLoading(true);
    try {
      await reassignTeam({
        report_id: Number(id),
        department_code: incident?.assignedTeamDepartmentCode || assignedDepartmentCodeForTeamActions || undefined,
        team_name: reassignTeamName || undefined,
        reason: reassignReason.trim(),
      });
      setReassignDialogOpen(false);
      setReassignReason('');
      await fetchIncident();
      window.dispatchEvent(new CustomEvent('incident:updated', { detail: { incidentId: id } }));
      await Swal.fire({
        icon: 'success',
        title: 'Team reassigned',
        timer: 2200,
        showConfirmButton: false,
        timerProgressBar: true,
      });
    } catch (err) {
      await Swal.fire({
        icon: 'error',
        title: 'Reassign failed',
        text: err.message || 'Could not reassign the team.',
        confirmButtonColor: '#134178',
      });
    } finally {
      setReassignLoading(false);
    }
  };

  const selectedTeamMeta = responderTeams.find(
    (team) =>
      String(team.department_code || '').toLowerCase() === String(notifyDepartment || '').toLowerCase()
      && String(team.team_name || '') === String(notifyTeamName || '')
  );

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

  const openAssignTeamDialog = () => {
    const preferred = responderTeams.find(
      (team) => String(team.department_code || '').toLowerCase() === String(assignedDepartmentCodeForTeamActions || '').toLowerCase()
    );
    setAssignTeamName(preferred?.team_name || '');
    setAssignTeamDialogOpen(true);
  };

  const handleAssignTeamToIncident = async () => {
    const departmentCode = assignedDepartmentCodeForTeamActions;
    if (!departmentCode || !assignTeamName) return;
    try {
      await tryCreateDispatchAssignment(departmentCode, assignTeamName);
      setAssignTeamDialogOpen(false);
      await fetchIncident();
      window.dispatchEvent(new CustomEvent('incident:updated', { detail: { incidentId: id } }));
      await Swal.fire({
        icon: 'success',
        title: 'Team assigned',
        text: `${assignTeamName} has been assigned to this incident.`,
        timer: 2200,
        showConfirmButton: false,
        timerProgressBar: true,
      });
    } catch (err) {
      await Swal.fire({
        icon: 'error',
        title: 'Assignment failed',
        text: err.message || 'Could not assign team for this incident.',
        confirmButtonColor: '#134178',
      });
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

  const handleAddDepartment = async () => {
    if (!additionalDepartment) return;
    const selectedSector = activeSectors.find((dept) => dept.id === additionalDepartment);
    const selectedDepartmentName = selectedSector?.name || additionalDepartment;
    const proceed = await Swal.fire({
      icon: 'question',
      title: 'Add supporting department?',
      text: `Notify ${selectedDepartmentName} to assist. This will not replace the primary assigned team.`,
      showCancelButton: true,
      confirmButtonText: 'Notify department',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#134178',
    });
    if (!proceed.isConfirmed) return;
    try {
      await tryCreateDepartmentOnlyAssignment(additionalDepartment);
      setAddDepartmentDialogOpen(false);
      setAdditionalDepartment('');
      await fetchIncident();
      window.dispatchEvent(new CustomEvent('incident:updated', { detail: { incidentId: id } }));
      await Swal.fire({
        icon: 'success',
        title: 'Department added',
        text: `${selectedDepartmentName} has been notified to assist.`,
        timer: 1800,
        showConfirmButton: false,
        timerProgressBar: true,
      });
    } catch (err) {
      await Swal.fire({
        icon: 'error',
        title: 'Could not add department',
        text: err.message || 'The department may already be notified, or a primary team lock blocked this.',
        confirmButtonColor: '#134178',
      });
    }
  };

  const handleCloseIncident = async () => {
    const numericId = /^\d+$/.test(String(id));
    if (!numericId || !incident || closeLoading) return;

    const confirm = await Swal.fire({
      icon: 'warning',
      title: 'Close this incident?',
      text: 'This marks the incident closed for all parties. This action is permanent.',
      showCancelButton: true,
      confirmButtonText: 'Close incident',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#134178',
    });
    if (!confirm.isConfirmed) return;

    setCloseLoading(true);
    try {
      await updateIncidentStatus(id, 'closed', {
        closure_notes: closureOutcome.trim(),
        closure_method: closureClassification.trim(),
      });
      setClosureDialogOpen(false);
      setClosureOutcome('');
      setClosureClassification('');
      await fetchIncident({ silent: true });
      window.dispatchEvent(new CustomEvent('incident:updated', { detail: { incidentId: id } }));
      await Swal.fire({
        icon: 'success',
        title: 'Incident closed',
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      await Swal.fire({
        icon: 'error',
        title: 'Failed to close incident',
        text: err.message || 'Could not close incident.',
        confirmButtonColor: '#134178',
      });
    } finally {
      setCloseLoading(false);
    }
  };

  const handleAcknowledgeBackup = async () => {
    const numericId = /^\d+$/.test(String(id));
    const backupId = incident?.activeBackupRequestId;
    if (!numericId || !backupId) return;
    if (String(incident?.openBackupStatus || '').toLowerCase() === 'acknowledged') {
      await Swal.fire({
        icon: 'info',
        title: 'Already acknowledged',
        text: 'This backup request was already acknowledged. Notify a department or assign a backup team.',
        confirmButtonColor: '#134178',
      });
      return;
    }
    setAcknowledgingBackup(true);
    try {
      await acknowledgeBackupRequest(id, backupId);
      setBackupDialogOpen(false);
      await fetchIncident({ silent: true });
      window.dispatchEvent(new CustomEvent('incident:updated', { detail: { incidentId: id } }));
      await Swal.fire({
        icon: 'success',
        title: 'Backup acknowledged',
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      await Swal.fire({
        icon: 'error',
        title: 'Acknowledge failed',
        text: err.message || 'Could not acknowledge backup request.',
        confirmButtonColor: '#134178',
      });
    } finally {
      setAcknowledgingBackup(false);
    }
  };

  const handleAssignTeamBackup = () => {
    setBackupDialogOpen(false);
    openAssignTeamDialog();
  };

  const backupDialogCapabilities = getBackupDialogCapabilities(incident, currentUser.role);

  const handleDispatchBackup = () => {
    setBackupDialogOpen(false);
    dispatchSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (showNotifyDepartmentButton) {
      openNotifyDepartmentDialog();
      return;
    }
    if ((notifiedDepartments?.length ?? 0) > 0) {
      void Swal.fire({
        icon: 'info',
        title: 'Department already notified',
        text: 'The department has been notified. They can assign a backup team from their dashboard or the assignment section below.',
        confirmButtonColor: '#134178',
      });
    }
  };

  const handleMarkDuplicate = async (parentReportId) => {
    const numericId = /^\d+$/.test(String(id));
    if (!numericId) return;
    const assignmentStatus = String(incident?.autoAssignmentStatus || '').toLowerCase();
    const hasAssignment = Boolean(incident?.assignedTeamName)
      || ['auto_applied', 'confirmed', 'overridden', 'dept_notified'].includes(assignmentStatus);
    if (hasAssignment) {
      const proceed = await Swal.fire({
        icon: 'warning',
        title: 'This incident already has an assignment',
        text: 'Linking as a duplicate will not release the current team or department notify. Reassign or undo notify first if this child should stop being worked.',
        showCancelButton: true,
        confirmButtonText: 'Link anyway',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#134178',
      });
      if (!proceed.isConfirmed) return;
    }
    setLinkDuplicateInProgress(true);
    try {
      await linkDuplicate(id, parentReportId);
      setDuplicateDialogOpen(false);
      setPotentialDuplicatesList([]);
      await fetchIncident({ silent: true });
      window.dispatchEvent(new CustomEvent('incident:updated', { detail: { incidentId: id } }));
      Swal.fire({ icon: 'success', title: 'Marked as duplicate', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Failed', text: err.message || 'Could not link duplicate' });
    } finally {
      setLinkDuplicateInProgress(false);
    }
  };

  const handleUnlinkDuplicate = async () => {
    const numericId = /^\d+$/.test(String(id));
    if (!numericId) return;
    try {
      await unlinkDuplicate(id);
      setDuplicateDialogOpen(false);
      await fetchIncident({ silent: true });
      window.dispatchEvent(new CustomEvent('incident:updated', { detail: { incidentId: id } }));
      Swal.fire({ icon: 'success', title: 'Unlinked from duplicate', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Failed', text: err.message || 'Could not unlink' });
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
    if (!incident?.assignedTeamName) {
      await Swal.fire({
        icon: 'warning',
        title: 'Assign team first',
        text: 'You cannot mark this incident as done until a team is assigned.',
        confirmButtonColor: '#134178',
      });
      return;
    }
    setResolveLoading(true);
    try {
      await updateIncidentStatus(id, 'resolved', {
        closure_notes: closureOutcome.trim(),
        closure_method: closureClassification.trim(),
      });
      setClosureDialogOpen(false);
      setClosureOutcome('');
      setClosureClassification('');
      await fetchIncident();
      window.dispatchEvent(new CustomEvent('incident:updated', { detail: { incidentId: id } }));
      await Swal.fire({
        icon: 'success',
        title: 'Marked resolved',
        text: 'Waiting for the citizen to confirm before this incident closes.',
        timer: 1800,
        showConfirmButton: false,
        timerProgressBar: true,
      });
    } catch (err) {
      await Swal.fire({
        icon: 'error',
        title: 'Failed to mark incident as resolved',
        text: err.message || 'Could not mark incident as resolved.',
        confirmButtonColor: '#134178',
      });
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

  const handleAddCoordinationNote = async () => {
    const trimmed = coordinationNote.trim();
    if (!trimmed) return;
    const isNumericId = /^\d+$/.test(String(id));
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    const author = user?.name || user?.username || user?.email || 'Dispatcher';
    const department = incident?.assignedDepartment || user?.department || 'Operations';
    const role = user?.role || 'dispatcher';
    const roleLabel = getRoleDisplayLabel(role);

    if (isNumericId) {
      // For real incidents, call the API
      try {
        const newNote = await addCoordinationNote(id, { note: trimmed });
        // Map the response to the expected shape
        const mappedNote = {
          ...newNote,
          author: newNote.author || newNote.author_name || author,
          role: newNote.role || newNote.author_role || role,
          roleLabel: newNote.roleLabel || roleLabel,
          department: newNote.department || department,
          timestamp: newNote.timestamp || new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
        };
        setCoordination((prev) => [mappedNote, ...prev]);
        setCoordinationNote('');
      } catch (err) {
        console.error('Failed to add coordination note:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err.message || 'Failed to add coordination note. Please try again.',
        });
      }
      return;
    }

    // For mock incidents, use local state only
    const now = new Date();
    setCoordination((prev) => ([
      {
        department,
        timestamp: now.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
        note: trimmed,
        author,
        role,
        roleLabel,
        source: 'Dispatcher UI',
      },
      ...prev,
    ]));
    setCoordinationNote('');
  };

  const panelClass = `rounded-2xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'}`;
  const headerClass = `flex items-center gap-3 px-4 py-3 border-b ${isLight ? 'border-gray-200/80 bg-gray-50/50' : 'border-white/10 bg-white/5'}`;
  const iconBoxClass = `w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'}`;
  const incidentLatitude = Number(incident?.location?.lat);
  const incidentLongitude = Number(incident?.location?.lng);
  const hasIncidentCoordinates = Number.isFinite(incidentLatitude) && Number.isFinite(incidentLongitude);
  const incidentMapOpenStreetUrl = hasIncidentCoordinates
    ? `https://www.openstreetmap.org/?mlat=${incidentLatitude}&mlon=${incidentLongitude}#map=16/${incidentLatitude}/${incidentLongitude}`
    : null;
  const incidentMapGoogleUrl = hasIncidentCoordinates
    ? `https://www.google.com/maps?q=${incidentLatitude},${incidentLongitude}`
    : null;
  const renderPrimaryActions = ({ compact = false } = {}) => (
    <>
      {canSaveToBlockchain && (
        <Button
          className={`gap-2 bg-[#134178] hover:bg-[#0f3256] ${compact ? 'h-8 px-3 text-xs rounded-lg' : ''}`}
          onClick={() => setVerifyDialogOpen(true)}
        >
          <CheckCircle className="w-4 h-4" />
          {USE_BLOCKCHAIN ? 'Save to Blockchain' : 'Create Audit Entry'}
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
      {hasOpenBackupUi(incident) && canNotifyDepartment && (
        <Button
          variant="outline"
          className={`gap-2 rounded-xl border-amber-500/40 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-500/10 ${compact ? 'h-8 px-3 text-xs rounded-lg' : ''}`}
          onClick={handleDispatchBackup}
        >
          <Shield className="w-4 h-4" />
          Send Backup
        </Button>
      )}
      {canConfirmOrReassign && isSuggested && hasSuggestedTeam && !incidentIsClosed && (
        <Button
          className={`gap-2 bg-[#134178] hover:bg-[#0f3256] ${compact ? 'h-8 px-3 text-xs rounded-lg' : ''}`}
          onClick={handleConfirmSuggestion}
        >
          <Users className="w-4 h-4" />
          {getSuggestedTeamName(incident)
            ? `Confirm ${getSuggestedTeamName(incident)}`
            : 'Confirm suggested team'}
        </Button>
      )}
      {canConfirmOrReassign && isAutoApplied && !incidentIsClosed && (
        <Button
          variant="outline"
          className={`gap-2 rounded-xl ${compact ? 'h-8 px-3 text-xs rounded-lg' : ''}`}
          onClick={() => {
            setReassignTeamName(incident?.assignedTeamName || '');
            setReassignDialogOpen(true);
          }}
        >
          <Users className="w-4 h-4" />
          Reassign Team
        </Button>
      )}
      {showUndoNotifyButton && (
        <Button
          variant="outline"
          className={`gap-2 rounded-xl ${compact ? 'h-8 px-3 text-xs rounded-lg' : ''}`}
          onClick={openUndoNotifyDialog}
        >
          <X className="w-4 h-4" />
          Undo Notified Department
        </Button>
      )}
      {showSelectTeamButton && assignedDepartmentCodeForTeamActions && (
        <Button
          variant="outline"
          className={`gap-2 rounded-xl ${compact ? 'h-8 px-3 text-xs rounded-lg' : ''}`}
          onClick={openAssignTeamDialog}
        >
          <Users className="w-4 h-4" />
          Select Team
        </Button>
      )}
      {canUpdateResponderStatuses && incident?.assignedTeamName && !incidentIsClosed && (
        <Button
          variant="outline"
          className={`gap-2 rounded-xl ${compact ? 'h-8 px-3 text-xs rounded-lg' : ''}`}
          onClick={openStatusDialog}
        >
          <Users className="w-4 h-4" />
          Update Team/Responder Status
        </Button>
      )}
      {canMarkResolved && incident.status === 'In Progress' && Boolean(incident?.assignedTeamName) && (
        <Button
          className={`gap-2 bg-severity-resolved hover:bg-severity-resolved/90 ${compact ? 'h-8 px-3 text-xs rounded-lg' : ''}`}
          onClick={() => setClosureDialogOpen(true)}
          disabled={resolveLoading}
        >
          {resolveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Mark Resolved
        </Button>
      )}
      {canCloseIncident && effectivelyResolved && (
        <Button
          variant="outline"
          className={`gap-2 rounded-xl border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10 ${compact ? 'h-8 px-3 text-xs rounded-lg' : ''}`}
          onClick={() => setClosureDialogOpen(true)}
          disabled={closeLoading}
        >
          {closeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
          Close Incident
        </Button>
      )}
      {canManageDuplicates && !incidentIsClosed && (
        <Button
          variant="outline"
          className={`gap-2 rounded-xl ${isLight ? 'text-amber-600 border-amber-200 hover:bg-amber-50' : 'text-amber-400 border-amber-500/40 hover:bg-amber-500/20'} ${compact ? 'h-8 px-3 text-xs rounded-lg' : ''}`}
          onClick={() => setDuplicateDialogOpen(true)}
        >
          <Merge className="w-4 h-4" />
          {incident?.isDuplicate ? 'View Duplicate Cluster' : 'Mark as Possible Duplicate'}
        </Button>
      )}
      {effectivelyResolved && !incident.reporterConfirmedAt && (
        <Badge variant="outline" className="rounded-lg border-border">
          Awaiting reporter confirmation or dispatcher close
        </Badge>
      )}
    </>
  );

  return (
    <Layout>
      <div className="p-4 md:p-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Breadcrumb items={[{ label: 'Home', path: '/dashboard' }, { label: 'Incidents', path: '/dashboard' }, { label: `Incident #${incident?.id ?? id}` }]} />
          {justUpdatedAt && (
            <span className="text-xs text-muted animate-pulse">Updated just now</span>
          )}
        </div>
        <div ref={dispatchSectionRef} className={`sticky top-2 z-30 mb-3 rounded-2xl border px-3 py-2 ${isLight ? 'bg-white/95 border-gray-200/80 backdrop-blur' : 'bg-card/90 border-white/10 backdrop-blur'}`}>
          <div className="flex flex-wrap items-center gap-2">
            {renderPrimaryActions({ compact: true })}
          </div>
          {incidentIsClosed && (
            <p className="text-xs text-muted italic">Operational actions are disabled for closed incidents.</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {duplicateCluster.length > 1 && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 border ${isLight ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-amber-500/40 bg-amber-500/10 text-amber-300'}`}>
                <AlertCircle className="w-3 h-3" />
                {duplicateCluster.length} related report(s)
              </span>
            )}
            {(incident?.isDuplicate || incident?.flaggedForReview) && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 border ${isLight ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-orange-500/40 bg-orange-500/10 text-orange-300'}`}>
                <AlertTriangle className="w-3 h-3" />
                {incident?.isDuplicate ? 'Duplicate' : 'Possible Duplicate'}
              </span>
            )}
            {canManualReclassify && !incidentIsClosed && (
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
          {canManualReclassify && !incidentIsClosed && manualReclassInfoExpanded && (
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
                  {(incident.isDuplicate || incident.flaggedForReview) && (
                    <Badge variant="outline" className={`rounded-lg ${incident.isDuplicate ? 'bg-card text-muted border-border' : 'bg-orange-500/10 text-orange-600 border-orange-500/40'}`}>
                      <Copy className="w-3 h-3 mr-1" />
                      {incident.isDuplicate ? 'Duplicate' : 'Possible Duplicate'}
                    </Badge>
                  )}
                </div>
                <div className="mt-2">
                  <IncidentTypeChips incidentTypes={incident.incidentTypes} />
                </div>
                {incident.timeReported && (
                  <p className="text-sm text-muted mt-0.5">Reported: {incident.timeReported}</p>
                )}
                {incident.acceptedByUserId && (
                  <div className="mt-2 text-sm text-foreground">
                    <span className="text-muted">Volunteer responder: </span>
                    <span className="font-medium">{incident.acceptedByName || 'Volunteer'}</span>
                    {incident.acceptedByPhone && (
                      <span className="text-muted"> · {incident.acceptedByPhone}</span>
                    )}
                  </div>
                )}
                {incident.backupVolunteers?.length > 0 && (
                  <div className="mt-3 rounded-lg border border-indigo-500/30 bg-indigo-500/5 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">Backup volunteers</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {incident.backupVolunteers.map((vol) => (
                        <li key={vol.user_id || vol.name} className="flex items-center justify-between gap-2">
                          <span>{vol.name || 'Volunteer'}</span>
                          <span className="text-xs text-muted">{vol.responder_status || 'Assigned'}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`${getStatusColor(incident.status)} rounded-lg px-3 py-1`}>
                  {incident.status}
                </Badge>
                {autoBadge && (
                  <Badge className={`${autoBadge.className} border rounded-lg px-3 py-1`}>
                    {autoBadge.label}
                  </Badge>
                )}
                {incident.autoAssignmentMismatch && (
                  <Badge className="bg-orange-500/20 text-orange-700 border border-orange-500/40 rounded-lg px-3 py-1">
                    Type/team mismatch
                  </Badge>
                )}
                <VolunteerStatusBadge responderStatus={incident.responderStatus} className="rounded-lg px-3 py-1" />
                {hasOpenBackupUi(incident) && (
                  <BackupRequestedBadge
                    status={incident.openBackupStatus || 'pending'}
                    onClick={() => setBackupDialogOpen(true)}
                  />
                )}
                <Badge className={`${getSeverityColor(incident.severity)} rounded-lg px-3 py-1`}>
                  {incident.severity}
                </Badge>
                <Badge variant="outline" className="rounded-lg border-border">
                  {incident.verified ? 'Verified' : 'Not Verified'}
                </Badge>
                {getConfidencePercent(incident.aiConfidenceScore) != null && (
                  <Badge variant="outline" className="rounded-lg border-border">
                    Model {getConfidencePercent(incident.aiConfidenceScore)}% ({getConfidenceLabel(incident.aiConfidenceScore)})
                  </Badge>
                )}
                {getConfidencePercent(incident.aiSttConfidence) != null && (
                  <Badge variant="outline" className="rounded-lg border-border">
                    STT {getConfidencePercent(incident.aiSttConfidence)}%
                  </Badge>
                )}
                {incident.aiKeywordPromoted && (
                  <Badge variant="outline" className="rounded-lg border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                    Keyword-assisted
                  </Badge>
                )}
                {incident.aiFallbackUsed && (
                  <Badge variant="outline" className="rounded-lg border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300">
                    Keyword fallback
                  </Badge>
                )}
                {effectivelyResolved && (
                  <Badge variant="outline" className="rounded-lg border-border">
                    {incident.reporterConfirmedAt ? 'Reporter confirmed' : 'Awaiting reporter confirmation or dispatcher close'}
                  </Badge>
                )}
                {incident.status === 'Closed' && (
                  <Badge variant="outline" className="rounded-lg border-border">
                    {incident.reporterConfirmedAt ? 'Closed after reporter confirmation' : 'Closed by dispatcher'}
                  </Badge>
                )}
              </div>
            </div>

            {latestVerificationMeta?.tx_hash && (
              <div className={`p-3 rounded-xl border ${isLight ? 'bg-emerald-50/80 border-emerald-200/80' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                <p className="text-xs uppercase tracking-wide text-muted font-semibold mb-1">
                  {USE_BLOCKCHAIN ? 'Latest Blockchain Verification' : 'Latest Audit Finalization'}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="outline" className="rounded-lg border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    {USE_BLOCKCHAIN ? 'Blockchain Verified' : 'Audit Entry Created'}
                  </Badge>
                  {latestVerificationMeta.block_number != null && (
                    <span className="text-foreground">Block #{latestVerificationMeta.block_number}</span>
                  )}
                  <span className="font-mono text-muted" title={latestVerificationMeta.tx_hash}>
                    {latestVerificationMeta.tx_hash.length > 12
                      ? `${latestVerificationMeta.tx_hash.slice(0, 10)}...`
                      : latestVerificationMeta.tx_hash}
                  </span>
                </div>
              </div>
            )}

            <div className={`flex flex-wrap items-center gap-3 p-3 rounded-xl border text-sm ${isLight ? 'bg-gray-50/70 border-gray-200/80' : 'bg-white/5 border-white/10'}`}>
              <span className="rounded-lg border border-border px-3 py-1 font-medium"><strong>Status:</strong> {incident.status}</span>
              <span className="rounded-lg border border-border px-3 py-1 font-medium"><strong>Severity:</strong> {incident.severity}</span>
              <span className="rounded-lg border border-border px-3 py-1 font-medium inline-flex items-center gap-2">
                <strong>Type:</strong>
                <IncidentTypeChips incidentTypes={incident.incidentTypes} compact />
              </span>
              <span className="rounded-lg border border-border px-3 py-1 truncate max-w-[220px] font-medium" title={incident.reporterName}><strong>Reporter:</strong> {incident.reporterName}</span>
              <span className="rounded-lg border border-border px-3 py-1 truncate max-w-[220px] font-medium" title={incident.reporterPhone}><strong>Contact:</strong> {incident.reporterPhone}</span>
              <span className="rounded-lg border border-border px-3 py-1 truncate max-w-[220px] font-medium" title={incident.barangay}><strong>Barangay:</strong> {incident.barangay}</span>
              {(incident?.isDuplicate || incident?.flaggedForReview) && (
                <span className={`inline-flex items-center gap-1 rounded-lg px-3 py-1 font-semibold border ${isLight ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-orange-500/40 bg-orange-500/10 text-orange-300'}`}>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {incident?.isDuplicate ? 'Duplicate' : 'Possible Duplicate'}
                </span>
              )}
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
              {incident.incidentTypes?.length > 0 && (
                <div className={`mt-3 p-2.5 rounded-lg border ${isLight ? 'bg-indigo-50/80 border-indigo-200/80' : 'bg-indigo-500/10 border-indigo-500/30'}`}>
                  <p className="text-xs text-foreground mb-2"><strong>AI incident types:</strong></p>
                  <IncidentTypeChips incidentTypes={incident.incidentTypes} />
                  {renderAiConfidenceMeta('mt-2')}
                </div>
              )}
            </div>

            {duplicateCluster.length > 1 && (
              <div className={`rounded-xl border ${isLight ? 'bg-amber-50/70 border-amber-200/80' : 'bg-amber-500/10 border-amber-500/30'}`}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 p-3 text-left hover:opacity-90 transition-opacity"
                  onClick={() => setRelatedReportsExpanded((v) => !v)}
                >
                  <div className="flex items-center gap-2">
                    {relatedReportsExpanded ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
                    <Link2 className="w-4 h-4 text-amber-600" />
                    <p className="text-xs uppercase tracking-wide text-muted font-semibold">Related Reports ({duplicateCluster.length})</p>
                  </div>
                </button>
                {relatedReportsExpanded && (
                  <div className="px-3 pb-3 pt-0 space-y-2">
                    {duplicateCluster.filter((r) => r.report_id !== incident.id).map((report) => (
                      <div key={report.report_id} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border">
                        <Link to={`/incidents/${report.report_id}`} className="font-medium text-primary hover:underline">
                          Report #{report.report_id}
                        </Link>
                        <span className="text-sm text-muted">{report.reporter_name || `User #${report.user_id}`}</span>
                        {report.confidence != null && (
                          <Badge variant="outline">{Math.round((report.confidence || 0) * 100)}% match</Badge>
                        )}
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {!incidentIsClosed && (
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => setDuplicateDialogOpen(true)}>
                          <Merge className="w-3 h-3" />
                          Manage duplicates
                        </Button>
                      )}
                      {closedRelatedReport && !incidentIsClosed && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 text-severity-resolved border-severity-resolved/50"
                          onClick={async () => {
                            try {
                              await updateIncidentStatus(id, 'closed');
                              await fetchIncident();
                              window.dispatchEvent(new CustomEvent('incident:updated', { detail: { incidentId: id } }));
                              Swal.fire({ icon: 'success', title: 'Incident closed', timer: 1500, showConfirmButton: false });
                            } catch (err) {
                              Swal.fire({ icon: 'error', title: 'Failed', text: err.message || 'Could not close' });
                            }
                          }}
                        >
                          <CheckCircle className="w-3 h-3" />
                          Close with related #{closedRelatedReport.report_id}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

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

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className={`grid w-full grid-cols-5 lg:w-auto lg:inline-grid rounded-xl p-1 gap-1 ${isLight ? 'bg-gray-100 border border-gray-200' : 'bg-white/10 border border-white/10'}`}>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="coordination">Coordination</TabsTrigger>
            <TabsTrigger value="escalation" className="relative flex items-center justify-center gap-1.5">
              Escalation
              {activeEscalationsCount > 0 && (
                <span className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white">
                  {activeEscalationsCount}
                </span>
              )}
            </TabsTrigger>
            {review && <TabsTrigger value="review">Review</TabsTrigger>}
          </TabsList>

          {/* DETAILS TAB */}
          <TabsContent value="details" className="space-y-6">
            {/* Pending Assistance Alert Banner for Target Department */}
            {escalations.some((e) => String(e.to_department_id) === String(currentUserDeptId) && e.status === 'pending') && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-400">
                <div className="flex items-center gap-2.5">
                  <HandHelping className="w-5 h-5 text-orange-400 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Inter-Department Assistance Requested</p>
                    <p className="text-xs text-muted">Another agency has requested assistance from your department for this incident.</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs gap-1.5"
                  onClick={() => handleTabChange('escalation')}
                >
                  <HandHelping size={13} />
                  Review & Respond
                </Button>
              </div>
            )}

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
                    {(incidentMapOpenStreetUrl || incidentMapGoogleUrl) && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {incidentMapOpenStreetUrl && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-xs rounded-lg"
                            onClick={() => window.open(incidentMapOpenStreetUrl, '_blank', 'noopener,noreferrer')}
                          >
                            <MapPin className="w-3.5 h-3.5 mr-1.5" />
                            Open in OpenStreetMap
                          </Button>
                        )}
                        {incidentMapGoogleUrl && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-xs rounded-lg"
                            onClick={() => window.open(incidentMapGoogleUrl, '_blank', 'noopener,noreferrer')}
                          >
                            <Link2 className="w-3.5 h-3.5 mr-1.5" />
                            Open in Google Maps
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={`rounded-xl border ${isLight ? 'bg-gray-50/70 border-gray-200/80' : 'bg-white/5 border-white/10'}`}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 p-3 text-left hover:opacity-90 transition-opacity"
                      onClick={() => setMediaEvidenceExpanded((v) => !v)}
                    >
                      <div className="flex items-center gap-2">
                        {mediaEvidenceExpanded ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
                        <p className="text-xs uppercase tracking-wide text-muted font-semibold">Media & Evidence</p>
                      </div>
                    </button>
                    {mediaEvidenceExpanded && (
                    <div className="px-3 pb-3 pt-0 space-y-3">
                      <div className="flex flex-wrap gap-3 justify-center">
                        {mediaLoading ? (
                          <div className="w-full p-6 bg-muted/20 rounded-xl border border-border flex items-center justify-center">
                            <p className="text-sm text-muted">Loading media...</p>
                          </div>
                        ) : mediaError ? (
                          <div className="w-full p-6 bg-muted/20 rounded-xl border border-dashed border-border flex items-center justify-center">
                            <p className="text-sm text-muted">{mediaError}</p>
                          </div>
                        ) : (incident.mediaPaths || []).length > 0 ? (
                          <>
                            {mediaUrls.map((media, idx) => {
                              const isImageByContentType = media?.contentType?.startsWith('image/');
                              const isImageByPath = /\.(jpg|jpeg|png|gif|webp)$/i.test(String(media?.path || ''));
                              const isImage = isImageByContentType || (media?.url && isImageByPath);
                              const isVideoByContentType = media?.contentType?.startsWith('video/');
                              const isVideoByPath = /\.(mp4|webm|mov|avi)$/i.test(String(media?.path || ''));
                              const isVideo = isVideoByContentType || (media?.url && isVideoByPath);
                              return (
                                <div key={idx} className="aspect-square w-32 bg-muted/30 rounded-xl flex items-center justify-center border border-border overflow-hidden">
                                  {media?.url ? (
                                    isImage ? (
                                      <button
                                        type="button"
                                        className="w-full h-full cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-primary/50 flex items-center justify-center p-1"
                                        onClick={() => setMediaLightboxIndex(idx)}
                                      >
                                        <img
                                          src={media.url}
                                          alt={`Media ${idx + 1}`}
                                          className="w-full h-full object-cover rounded-lg"
                                        />
                                      </button>
                                    ) : isVideo ? (
                                      <video
                                        src={media.url}
                                        controls
                                        className="w-full h-full object-cover rounded-lg"
                                      />
                                    ) : (
                                      <a
                                        href={media.url}
                                        download
                                        className="text-sm text-primary hover:underline"
                                      >
                                        Download File {idx + 1}
                                      </a>
                                    )
                                  ) : media?.error ? (
                                    <div className="flex flex-col items-center gap-2 p-4">
                                      <p className="text-sm text-muted">Failed to load</p>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={mediaRetryingIndex === idx}
                                        onClick={() => retryMediaFetch(idx)}
                                      >
                                        {mediaRetryingIndex === idx ? 'Retrying...' : 'Retry'}
                                      </Button>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted">Photo {idx + 1}</p>
                                  )}
                                </div>
                              );
                            })}
                            <Dialog open={mediaLightboxIndex != null} onOpenChange={(open) => !open && setMediaLightboxIndex(null)} zIndex={9999}>
                              <DialogContent className="max-w-[480px] max-h-[420px] p-0 overflow-hidden flex flex-col">
                                {mediaLightboxIndex != null && mediaUrls[mediaLightboxIndex]?.url && (mediaUrls[mediaLightboxIndex]?.contentType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(String(mediaUrls[mediaLightboxIndex]?.path || ''))) && (
                                  <>
                                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                                      <p className="text-sm font-medium text-foreground">Media & Evidence</p>
                                      <button
                                        type="button"
                                        onClick={() => setMediaLightboxIndex(null)}
                                        className="rounded-full p-2 hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        aria-label="Close"
                                      >
                                        <X className="w-5 h-5 text-muted-foreground" />
                                      </button>
                                    </div>
                                    <div className="flex-1 overflow-auto flex items-center justify-center p-4 min-h-0">
                                      <img
                                        src={mediaUrls[mediaLightboxIndex].url}
                                        alt={`Media ${mediaLightboxIndex + 1}`}
                                        className="max-w-full max-h-[320px] object-contain"
                                      />
                                    </div>
                                  </>
                                )}
                              </DialogContent>
                            </Dialog>
                          </>
                        ) : (
                          <div className="w-full p-6 bg-muted/20 rounded-xl border border-dashed border-border flex items-center justify-center">
                            <p className="text-sm text-muted">No photos provided for this incident</p>
                          </div>
                        )}
                      </div>
                    </div>
                    )}
                  </div>

                  <div className={`p-3 rounded-xl border ${isLight ? 'bg-gray-50/70 border-gray-200/80' : 'bg-white/5 border-white/10'}`}>
                    <p className="text-xs uppercase tracking-wide text-muted font-semibold mb-1">Workflow Guide</p>
                    <p className="text-xs text-muted">Pending → Verified → In Progress → Resolved → Closed</p>
                  </div>

                  {/* TEAM & RESPONDER STATUS SECTION */}
                  {(incident?.assignedDepartment || incident?.assignedDepartmentId || incident?.assignedTeamName || (isSuggested && (incident?.suggestedTeamName || incident?.suggestedDepartmentCode))) && (
                    <div className={`p-4 rounded-xl border ${isLight ? 'bg-blue-50/70 border-blue-200/80' : 'bg-blue-500/10 border-blue-500/30'}`}>
                      <div className="flex items-start gap-2 mb-3">
                        <Users className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <p className="text-xs uppercase tracking-wide text-muted font-semibold">Team Assignment & Status</p>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-muted mb-1">Department</p>
                          <p className="text-sm font-medium text-foreground">
                            {incident?.assignedDepartment
                              || departmentNameByCode[String(incident?.suggestedDepartmentCode || '').toLowerCase()]
                              || incident?.suggestedDepartmentCode
                              || '—'}
                          </p>
                        </div>
                        {isSuggested && getSuggestedTeamName(incident) && !incident?.assignedTeamName && (
                          <div>
                            <p className="text-xs text-muted mb-1">Suggested Team</p>
                            <div className={`p-2 rounded-lg border ${isLight ? 'bg-amber-50 border-amber-200/80' : 'bg-amber-500/10 border-amber-500/30'}`}>
                              <p className="text-sm font-medium text-foreground">{getSuggestedTeamName(incident)}</p>
                            </div>
                          </div>
                        )}
                        {incident?.assignedTeamName && (
                          <div>
                            <p className="text-xs text-muted mb-1">Assigned Team</p>
                            <div className={`p-2 rounded-lg border ${isLight ? 'bg-white/50 border-blue-200/50' : 'bg-white/5 border-blue-500/20'}`}>
                              <p className="text-sm font-medium text-foreground">{incident.assignedTeamName}</p>
                            </div>
                          </div>
                        )}
                        {incident?.assignedTeamRoster?.length > 0 && (
                          <div>
                            <p className="text-xs text-muted mb-1">Team Roster</p>
                            <div className="space-y-2">
                              {incident.assignedTeamRoster.map((member) => (
                                <div
                                  key={member.responder_id || member.name}
                                  className={`p-2 rounded-lg border text-sm ${isLight ? 'bg-white/50 border-blue-200/50' : 'bg-white/5 border-blue-500/20'}`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium text-foreground">{member.name || `Responder ${member.responder_id}`}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {member.response_status || 'Assigned'}
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {(incident?.estimatedEtaMinutes != null || incident?.estimatedArrivalAt) && (
                          <div>
                            <p className="text-xs text-muted mb-1">Estimated Arrival</p>
                            <p className="text-sm font-medium text-foreground">
                              {incident?.estimatedEtaMinutes != null
                                ? `~${incident.estimatedEtaMinutes} min${incident?.estimatedArrivalAt ? ` (${new Date(incident.estimatedArrivalAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })})` : ''}`
                                : incident?.estimatedArrivalAt
                                  ? new Date(incident.estimatedArrivalAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                                  : '—'}
                            </p>
                          </div>
                        )}
                        {!incident?.assignedTeamName && !getSuggestedTeamName(incident) && assignedDepartmentCodeForTeamActions && !incidentIsClosed && (
                          <p className="text-xs text-muted">No team assigned yet. Use the top action bar to select a team.</p>
                        )}
                        {canUpdateResponderStatuses && incident?.assignedTeamName && !incidentIsClosed && (
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <p className="text-xs text-muted">Team Members</p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-xs rounded-lg"
                                onClick={openStatusDialog}
                              >
                                <Users className="w-3 h-3 mr-1" />
                                Update Status
                              </Button>
                            </div>
                            {(teamMembersByTeamId[selectedTeamMeta?.team_id] || []).length > 0 ? (
                              <div className="space-y-2">
                                {(teamMembersByTeamId[selectedTeamMeta?.team_id] || []).map((member) => (
                                  <div key={member.responder_id} className={`p-2 rounded-lg border text-sm ${
                                    member.availability_status?.toLowerCase() === 'available'
                                      ? isLight ? 'border-severity-resolved/40 bg-severity-resolved/10' : 'border-emerald-500/30 bg-emerald-500/10'
                                      : isLight ? 'border-amber-200/50 bg-amber-50/50' : 'border-amber-500/20 bg-amber-500/10'
                                  }`}>
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium text-foreground">{member.name || `Responder ${member.responder_id}`}</span>
                                      <Badge 
                                        variant="outline" 
                                        className={`text-xs ${
                                          member.availability_status?.toLowerCase() === 'available'
                                            ? 'border-severity-resolved/60 bg-severity-resolved/20 text-severity-resolved'
                                            : 'border-amber-500/60 bg-amber-500/20 text-amber-300'
                                        }`}
                                      >
                                        {member.availability_status || 'unknown'}
                                      </Badge>
                                    </div>
                                    {Array.isArray(member.supported_incident_types) && member.supported_incident_types.length > 0 && (
                                      <p className="text-xs text-muted mt-1">
                                        Supports: {member.supported_incident_types.join(', ')}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted italic">No team members found</p>
                            )}
                          </div>
                        )}
                        {incidentIsClosed && (
                          <p className="text-xs text-muted italic">Team assignment and status updates are disabled for closed incidents.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {isSupervisor && !incidentIsClosed && incident.status !== 'Resolved' && incident.status !== 'Duplicate' && (
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
                                maxLength={1000}
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

                  {(() => {
                    const assistingDepts = (incident.dispatches || [])
                      .filter((row) => String(row?.responder_source || '').toLowerCase() === 'escalation')
                      .map((row) => row.department_name || row.department_code)
                      .filter(Boolean)
                      .filter((dept, idx, arr) => arr.indexOf(dept) === idx);
                    if (assistingDepts.length === 0) return null;
                    return (
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-wide text-muted font-semibold">Assisting Departments</p>
                        <div className="space-y-2">
                          {assistingDepts.map((dept, idx) => (
                            <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg ${isLight ? 'bg-gray-50' : 'bg-secondary/20'}`}>
                              <div className="w-2 h-2 rounded-full bg-primary" />
                              <span className="text-sm text-foreground">{dept}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

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
                {incident?.incidentTypes?.length > 0 && (
                  <div>
                    <Label>Current classification</Label>
                    <div className="mt-2">
                      <IncidentTypeChips incidentTypes={incident.incidentTypes} />
                    </div>
                  </div>
                )}

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
                    maxLength={500}
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
                <DialogTitle>
                  {USE_BLOCKCHAIN ? 'Save Incident to Blockchain' : 'Finalize & Create Audit Entry'}
                </DialogTitle>
                <DialogDescription>
                  {USE_BLOCKCHAIN
                    ? 'Are you sure you want to save this closed and reporter-confirmed incident to the blockchain for tamper-proof audit? This action cannot be undone.'
                    : 'Create a permanent audit log entry for this closed and reporter-confirmed incident. This action cannot be undone.'}
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
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Confirm Save
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
                  {canMarkResolved
                    ? 'Provide outcome details. The incident stays open until the citizen confirms.'
                    : 'Provide final closure details for this incident. This action is permanent.'}
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
                    maxLength={500}
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
                  onClick={canMarkResolved ? handleMarkResolved : handleCloseIncident}
                  disabled={!closureOutcome || !closureClassification || closeLoading || resolveLoading}
                >
                  {canMarkResolved
                    ? (resolveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mark Resolved')
                    : (closeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Close Incident')}
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
                  Select a department to notify. Team availability is shown to help you choose the best department.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Department</Label>
                  <Select value={notifyDepartment} onValueChange={setNotifyDepartment} open={notifyDeptSelectOpen} onOpenChange={setNotifyDeptSelectOpen}>
                    {({ value, onValueChange, dropdownRect }) => (
                      <>
                        <SelectTrigger isOpen={notifyDeptSelectOpen} onClick={() => setNotifyDeptSelectOpen(o => !o)}>
                          <SelectValue value={value} options={availableNotifyDepartments.map((d) => ({ value: d.code || '', label: d.name || d.code || '—' }))} placeholder="Choose department" />
                        </SelectTrigger>
                        <SelectContent isOpen={notifyDeptSelectOpen} dropdownRect={dropdownRect}>
                          {availableNotifyDepartments.map((dept) => (
                            <SelectItem key={dept.department_id ?? dept.code} value={dept.code || ''} onSelect={(v) => { onValueChange(v); setNotifyDeptSelectOpen(false); }}>
                              {dept.name || dept.code || '—'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </>
                    )}
                  </Select>
                </div>
                {notifyDepartment && (
                  <div className={`rounded-xl border p-3 ${isLight ? 'border-blue-200/80 bg-blue-50/60' : 'border-blue-500/30 bg-blue-500/10'}`}>
                    <p className="text-xs uppercase tracking-wide text-muted font-semibold mb-2">Department Team Status</p>
                    {(() => {
                      const summary = teamSummaryByDepartment[String(notifyDepartment || '').toLowerCase()];
                      if (!summary) {
                        return <p className="text-xs text-muted">No team data available for this department yet.</p>;
                      }
                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <span className="rounded-md border border-severity-resolved/40 bg-severity-resolved/10 px-2 py-1 text-severity-resolved">Available: {summary.available}</span>
                          <span className="rounded-md border border-indigo-500/40 bg-indigo-500/10 px-2 py-1 text-indigo-300">Standby: {summary.standby}</span>
                          <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-400">Busy: {summary.busy}</span>
                          <span className="rounded-md border border-gray-400/40 bg-muted/30 px-2 py-1 text-muted">Off-duty: {summary.offDuty}</span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNotifyDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-[#134178] hover:bg-[#0f3256]"
                  onClick={handleNotifyDepartment}
                  disabled={!notifyDepartment || availableNotifyDepartments.length === 0}
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

          <Dialog open={undoNotifyDialogOpen} onOpenChange={setUndoNotifyDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Undo Notified Department</DialogTitle>
                <DialogDescription>
                  Choose a notified department to remove from this incident. Undo is blocked when that department already assigned a team.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Notified Department</Label>
                  <select
                    className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm"
                    value={undoDepartmentCode}
                    onChange={(event) => setUndoDepartmentCode(event.target.value)}
                  >
                    {notifiedDepartments.map((dept) => (
                      <option key={dept.code} value={dept.code}>
                        {dept.name || dept.code}
                        {dept.hasTeamAssigned ? ' (team already assigned)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {(() => {
                  const selected = notifiedDepartments.find((dept) => String(dept.code || '').toLowerCase() === String(undoDepartmentCode || '').toLowerCase());
                  if (!selected) return null;
                  if (!selected.hasTeamAssigned) {
                    return <p className="text-xs text-muted">This department is still in notified state and can be undone.</p>;
                  }
                  return <p className="text-xs text-amber-400">Undo disabled: this department already assigned a team.</p>;
                })()}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setUndoNotifyDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-[#134178] hover:bg-[#0f3256]"
                  onClick={handleUndoDepartmentNotification}
                  disabled={(() => {
                    const selected = notifiedDepartments.find((dept) => String(dept.code || '').toLowerCase() === String(undoDepartmentCode || '').toLowerCase());
                    return !selected || selected.hasTeamAssigned;
                  })()}
                >
                  Undo Notification
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reassign team</DialogTitle>
                <DialogDescription>
                  Releases the current team and assigns another. Reason is required.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Team</Label>
                  <Select value={reassignTeamName} onValueChange={setReassignTeamName}>
                    {({ value, onValueChange, dropdownRect }) => {
                      const candidateTeams = responderTeams.filter((team) =>
                        String(team.department_code || '').toLowerCase() === String(assignedDepartmentCodeForTeamActions || incident?.assignedTeamDepartmentCode || '').toLowerCase()
                      );
                      return (
                        <>
                          <SelectTrigger>
                            <SelectValue
                              value={value}
                              options={candidateTeams.map((team) => ({ value: team.team_name || '', label: `${team.team_name || '—'} (${team.team_status || 'unknown'})` }))}
                              placeholder="Choose replacement team"
                            />
                          </SelectTrigger>
                          <SelectContent dropdownRect={dropdownRect}>
                            {candidateTeams.map((team) => (
                              <SelectItem key={team.team_id || team.team_name} value={team.team_name} onValueChange={onValueChange}>
                                {team.team_name} ({team.team_status || 'unknown'})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </>
                      );
                    }}
                  </Select>
                </div>
                <div>
                  <Label>Reason</Label>
                  <Textarea
                    value={reassignReason}
                    onChange={(event) => setReassignReason(event.target.value)}
                    placeholder="Why is this team being replaced?"
                    minLength={10}
                    maxLength={500}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReassignDialogOpen(false)}>Cancel</Button>
                <Button className="bg-[#134178] hover:bg-[#0f3256]" onClick={handleReassignTeam} disabled={reassignLoading || !reassignTeamName}>
                  {reassignLoading ? 'Saving…' : 'Reassign'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={assignTeamDialogOpen} onOpenChange={setAssignTeamDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Select Team</DialogTitle>
                <DialogDescription>
                  Assign a team for this department notification. Only available or standby teams can be assigned.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Team</Label>
                  <Select value={assignTeamName} onValueChange={setAssignTeamName} open={assignTeamSelectOpen} onOpenChange={setAssignTeamSelectOpen}>
                    {({ value, onValueChange, dropdownRect }) => {
                      const candidateTeams = responderTeams
                        .filter((team) => String(team.department_code || '').toLowerCase() === String(assignedDepartmentCodeForTeamActions || '').toLowerCase())
                        .filter((team) => {
                          const incidentType = incident?.incidentTypeRaw || incident?.emergencyType;
                          return !incidentType || doesTeamSupportIncidentType(team, incidentType);
                        });
                      return (
                        <>
                          <SelectTrigger isOpen={assignTeamSelectOpen} onClick={() => setAssignTeamSelectOpen((open) => !open)}>
                            <SelectValue
                              value={value}
                              options={candidateTeams.map((team) => ({ value: team.team_name || '', label: `${team.team_name || '—'} (${team.team_status || 'unknown'})` }))}
                              placeholder="Choose team"
                            />
                          </SelectTrigger>
                          <SelectContent isOpen={assignTeamSelectOpen} dropdownRect={dropdownRect}>
                            {candidateTeams.map((team) => {
                              const status = String(team.team_status || 'available').toLowerCase();
                              const assignable = status.includes('available') || status.includes('standby');
                              return (
                                <SelectItem
                                  key={`${team.team_id || team.team_name}`}
                                  value={team.team_name || ''}
                                  onSelect={(val) => {
                                    if (!assignable) return;
                                    onValueChange(val);
                                    setAssignTeamSelectOpen(false);
                                  }}
                                >
                                  {team.team_name || '—'} ({team.team_status || 'unknown'}){assignable ? '' : ' - unavailable'}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </>
                      );
                    }}
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAssignTeamDialogOpen(false)}>
                  Cancel
                </Button>
                <Button className="bg-[#134178] hover:bg-[#0f3256]" onClick={handleAssignTeamToIncident} disabled={!assignTeamName}>
                  Assign Team
                </Button>
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
                <div className="relative">
                  {/* Vertical timeline line */}
                  {timeline.length > 1 && (
                    <div className={`absolute left-6 top-8 bottom-8 w-0.5 ${isLight ? 'bg-gray-200' : 'bg-white/10'}`} />
                  )}
                  <div className="space-y-6">
                    {timeline.map((event, idx) => {
                      // Format timestamp
                      let formattedTime = '—';
                      if (event.timestamp) {
                        const d = new Date(event.timestamp);
                        formattedTime = d.toLocaleString('en-US', {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: 'numeric', minute: '2-digit', hour12: true
                        });
                      }

                      // Get icon and color based on event type
                      let IconComponent = AlertCircle;
                      let iconBgClass = isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400';
                      let label = event.label || event.action || 'Event';
                      let detailText = null;

                      switch (event.type) {
                        case 'created':
                          IconComponent = AlertCircle;
                          iconBgClass = isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400';
                          detailText = event.detail || (event.actor ? `Reported by ${event.actor}` : null);
                          break;
                        case 'assigned':
                          IconComponent = Users;
                          iconBgClass = isLight ? 'bg-amber-100 text-amber-600' : 'bg-amber-500/20 text-amber-400';
                          // For mock data compatibility, build label from action/actor if needed
                          if (!event.label && event.action) {
                            label = event.action;
                          }
                          // Show team info from detail if available
                          if (event.detail && typeof event.detail === 'object') {
                            const dept = event.detail.department_name || event.detail.department_code || '';
                            const team = event.detail.team_name || '';
                            detailText = team ? `${dept} (${team})` : dept;
                          }
                          break;
                        case 'resolved':
                          IconComponent = CheckCircle;
                          iconBgClass = isLight ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-500/20 text-emerald-400';
                          if (event.detail && typeof event.detail === 'object' && event.detail.resolved_by_user_id) {
                            detailText = `By User #${event.detail.resolved_by_user_id}`;
                          }
                          break;
                        case 'closed':
                          IconComponent = XCircle;
                          iconBgClass = isLight ? 'bg-gray-100 text-gray-600' : 'bg-gray-500/20 text-gray-400';
                          if (event.detail && typeof event.detail === 'object') {
                            const method = event.detail.closure_method;
                            if (method) {
                              detailText = `Method: ${method.replace(/_/g, ' ')}`;
                            }
                          }
                          break;
                        default:
                          // Legacy mock data support - map old shape to new
                          if (event.action && !event.type) {
                            if (event.action.toLowerCase().includes('assign')) {
                              IconComponent = Users;
                              iconBgClass = isLight ? 'bg-amber-100 text-amber-600' : 'bg-amber-500/20 text-amber-400';
                            } else if (event.action.toLowerCase().includes('verified')) {
                              IconComponent = CheckCircle;
                              iconBgClass = isLight ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-500/20 text-emerald-400';
                            }
                            detailText = event.actor ? `${event.actor}${event.actorRole ? ` (${event.actorRole})` : ''}` : null;
                            if (event.notes) {
                              detailText = detailText ? `${detailText} — ${event.notes}` : event.notes;
                            }
                          }
                          break;
                      }

                      return (
                        <div key={idx} className="flex gap-4 relative">
                          {/* Icon node */}
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${iconBgClass}`}>
                            <IconComponent className="w-5 h-5" />
                          </div>
                          {/* Event card */}
                          <div className={`flex-1 p-4 rounded-xl border ${isLight ? 'bg-white border-gray-200' : 'bg-white/5 border-white/10'}`}>
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <p className="font-semibold text-foreground">{label}</p>
                                {detailText && (
                                  <p className="text-sm text-muted mt-1">{detailText}</p>
                                )}
                              </div>
                              <span className="text-xs text-muted whitespace-nowrap">
                                {formattedTime}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {timeline.length === 0 && (
                      <div className="text-center py-12">
                        <Clock className={`w-12 h-12 mx-auto mb-3 ${isLight ? 'text-gray-300' : 'text-gray-600'}`} />
                        <p className="text-muted">No timeline events yet</p>
                        <p className="text-sm text-muted mt-1">Timeline will be updated as the incident progresses</p>
                      </div>
                    )}
                  </div>
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
                      <p className="text-sm text-foreground mb-3">{note.note}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">{note.author}</span>
                        <span className="text-xs text-muted">·</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 rounded-md">
                          {note.roleLabel || getRoleDisplayLabel(note.role) || 'Unknown'}
                        </Badge>
                        {note.source && (
                          <span className="text-xs text-muted">({note.source})</span>
                        )}
                      </div>
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
                    maxLength={500}
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

          {/* ESCALATION TAB — Real inter-department assistance requests */}
          <TabsContent value="escalation">
            <div className={panelClass}>
              <div className={headerClass}>
                <div className={iconBoxClass}><HandHelping className="w-4 h-4" /></div>
                <h2 className="text-base font-semibold text-foreground">
                  Inter-Department Assistance
                  {activeEscalationsCount > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-orange-500 text-[10px] font-bold text-white">
                      {activeEscalationsCount}
                    </span>
                  )}
                </h2>
              </div>
              <div className="p-4">
                {/* Request button in tab header */}
                {canRequestEscalation && (
                  <div className="flex justify-end mb-4">
                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={() => setEscalationModalOpen(true)}
                    >
                      <HandHelping size={14} />
                      Request Assistance
                    </Button>
                  </div>
                )}
                <IncidentEscalationSection
                  escalations={escalations}
                  loading={escalationsLoading}
                  currentUserRole={currentUser.role}
                  currentUserDeptId={currentUserDeptId}
                  onStatusUpdate={handleEscalationStatusUpdate}
                />
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
              <DialogTitle>{incident?.isDuplicate ? 'Duplicate Cluster' : 'Mark as Possible Duplicate'}</DialogTitle>
              <DialogDescription>
                {incident?.isDuplicate
                  ? 'This incident is linked to the following related reports. You can unlink or close with a related report.'
                  : 'Review similar incidents and link this report as a duplicate if it describes the same incident.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
              {duplicateDialogLoading ? (
                <p className="text-muted">Loading potential duplicates...</p>
              ) : displayDuplicates.length === 0 ? (
                <p className="text-muted">{incident?.isDuplicate ? 'No related reports.' : 'No potential duplicates found.'}</p>
              ) : (
                displayDuplicates.map((dup) => (
                  <div key={dup.report_id} className="p-4 border border-border rounded-lg flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link to={`/incidents/${dup.report_id}`} className="font-medium text-primary hover:underline">
                          Report #{dup.report_id}
                        </Link>
                        {dup.confidence != null && (
                          <Badge variant="outline">{Math.round((dup.confidence || 0) * 100)}% match</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted">{dup.reporter_name || `User #${dup.user_id}`}</p>
                      {dup.description && <p className="text-sm text-foreground mt-1 line-clamp-2">{dup.description}</p>}
                      {dup.created_at && (
                        <p className="text-xs text-muted mt-1">
                          {new Date(dup.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!incident?.isDuplicate && dup.report_id !== Number(id) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          disabled={linkDuplicateInProgress}
                          onClick={() => handleMarkDuplicate(dup.report_id)}
                        >
                          {linkDuplicateInProgress ? <Loader2 className="w-3 h-3 animate-spin" /> : <Merge className="w-3 h-3" />}
                          Link as duplicate
                        </Button>
                      )}
                      {incident?.isDuplicate && dup.report_id !== Number(id) && String(dup.status || '').toLowerCase() === 'closed' && incident.status !== 'Closed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2 text-severity-resolved border-severity-resolved/50"
                          onClick={async () => {
                            try {
                              await updateIncidentStatus(id, 'closed');
                              setDuplicateDialogOpen(false);
                              await fetchIncident();
                              window.dispatchEvent(new CustomEvent('incident:updated', { detail: { incidentId: id } }));
                              Swal.fire({ icon: 'success', title: 'Incident closed', timer: 1500, showConfirmButton: false });
                            } catch (err) {
                              Swal.fire({ icon: 'error', title: 'Failed', text: err.message || 'Could not close' });
                            }
                          }}
                        >
                          <CheckCircle className="w-3 h-3" />
                          Close with #{dup.report_id}
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            <DialogFooter className="flex-wrap gap-2">
              {!incident?.isDuplicate && (
                <Button
                  variant="outline"
                  className="gap-2 text-amber-600 border-amber-200"
                  onClick={() => {
                    setDuplicateDialogOpen(false);
                    setBrowseParentDialogOpen(true);
                  }}
                >
                  <LayoutList className="w-4 h-4" />
                  Browse incidents
                </Button>
              )}
              {incident?.isDuplicate && (
                <Button variant="outline" className="text-amber-600 border-amber-200" onClick={handleUnlinkDuplicate}>
                  Unlink from duplicate
                </Button>
              )}
              <Button variant="outline" onClick={async () => {
                if (!incident?.isDuplicate && incident?.flaggedForReview) {
                  const numericId = /^\d+$/.test(String(id));
                  if (numericId) {
                    try {
                      await clearDuplicateFlag(id);
                      setDuplicateDialogOpen(false);
                      await fetchIncident({ silent: true });
                      window.dispatchEvent(new CustomEvent('incident:updated', { detail: { incidentId: id } }));
                      Swal.fire({ icon: 'success', title: 'Marked as not a duplicate', timer: 1500, showConfirmButton: false });
                    } catch (err) {
                      Swal.fire({ icon: 'error', title: 'Failed', text: err.message || 'Could not clear duplicate flag' });
                    }
                  } else {
                    setDuplicateDialogOpen(false);
                  }
                } else {
                  setDuplicateDialogOpen(false);
                }
              }}>
                {incident?.isDuplicate ? 'Close' : 'Not a Duplicate'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <BackupRequestDialog
          open={backupDialogOpen}
          onOpenChange={setBackupDialogOpen}
          incidentId={incident?.id ?? id}
          onAcknowledge={handleAcknowledgeBackup}
          onDispatch={handleDispatchBackup}
          onAssignTeam={handleAssignTeamBackup}
          acknowledging={acknowledgingBackup}
          target={incident?.pendingBackupTarget}
          broadcastCount={incident?.pendingBackupBroadcastCount}
          backupVolunteers={incident?.backupVolunteers || []}
          openBackupStatus={incident?.openBackupStatus || 'pending'}
          canAcknowledge={backupDialogCapabilities.canAcknowledge}
          canNotifyDepartment={backupDialogCapabilities.canNotifyDepartment}
          canAssignTeam={backupDialogCapabilities.canAssignTeam}
        />

        <SelectParentIncidentDialog
          open={browseParentDialogOpen}
          onOpenChange={setBrowseParentDialogOpen}
          currentIncidentId={id}
          loading={linkDuplicateInProgress}
          onSelect={async (parentId) => {
            await handleMarkDuplicate(parentId);
            setBrowseParentDialogOpen(false);
          }}
        />

        {/* Inter-department assistance request modal */}
        <IncidentEscalationModal
          open={escalationModalOpen}
          onOpenChange={setEscalationModalOpen}
          departments={departmentList}
          ownDepartmentId={currentUserDeptId}
          onSubmit={handleCreateEscalation}
        />
      </div>
    </Layout>
  );
}
