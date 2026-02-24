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
import { Alert, AlertDescription, AlertTitle } from '@/presentation/components/ui/Alert';
import { 
  ArrowLeft, MapPin, Phone, User, CheckCircle, XCircle, Bell, 
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
import { getIncidentById, getIncidentAudioUrl, verifyIncident } from '@/data/api/incidents.api';
import { DEV_MODE } from '@/core/config/app.config';
import { ROLES, normalizeRole } from '@/core/constants';
import { Loader2 } from 'lucide-react';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';
import Swal from 'sweetalert2';

function mapApiToIncidentDetails(api) {
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
    transcription: api.transcription || null,
    audioPath: api.audio_path || null,
    mediaPaths: Array.isArray(api.media_paths) ? api.media_paths : [],
    verified: api.verified ?? false,
    highPriority: api.severity_level === 'high',
    possibleDuplicates: [],
    closureData: null,
    timeReported,
  };
}

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

  const fetchIncident = useCallback(async () => {
    const numericId = /^\d+$/.test(String(id));
    if (numericId) {
      setLoading(true);
      setError(null);
      try {
        const data = await getIncidentById(id);
        setIncident(mapApiToIncidentDetails(data));
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
  const coordination = coordinationNotes[id || ''] || [];
  const review = postIncidentReviews[id || ''];
  const possibleDuplicates = mockIncidents.filter(i => incident?.possibleDuplicates?.includes(i.id));

  // Get current user role
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = normalizeRole(currentUser.role) === ROLES.SUPER_ADMIN;
  const isSupervisor = currentUser.role === 'Supervisor' || isAdmin;

  // State for dialogs
  const [escalateDialogOpen, setEscalateDialogOpen] = useState(false);
  const [addDepartmentDialogOpen, setAddDepartmentDialogOpen] = useState(false);
  const [closureDialogOpen, setClosureDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);

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
  const [closureOutcome, setClosureOutcome] = useState('');
  const [closureClassification, setClosureClassification] = useState('');
  const [coordinationNote, setCoordinationNote] = useState('');

  // Get all units for workload display
  const getAllUnits = () => {
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

  const getDepartmentContactPhone = (departmentName) => {
    const normalized = String(departmentName || '').toLowerCase();
    if (!normalized) return null;

    if (normalized.includes('bfp') || normalized.includes('fire')) return '+63 75 523 1234';
    if (normalized.includes('pnp') || normalized.includes('police')) return '+63 75 522 5678';
    if (normalized.includes('health') || normalized.includes('hospital') || normalized.includes('medical')) return '+63 75 523 9012';
    if (normalized.includes('drrmo') || normalized.includes('disaster')) return '+63 75 524 3456';
    if (normalized.includes('barangay')) return '+63 75 522 7890';

    return null;
  };

  const openNotifyRespondersDialog = () => {
    const defaultDepartment =
      incident?.assignedDepartment
      || (Array.isArray(incident?.assignedDepartments) ? incident.assignedDepartments[0] : null)
      || departments?.[0]?.name
      || '';

    setNotifyDepartment(defaultDepartment);
    setNotifyDialogOpen(true);
  };

  const handleNotifyResponders = async () => {
    const selectedDepartment = notifyDepartment;
    const departmentExists = departments.some((dept) => dept.name === selectedDepartment);

    if (!selectedDepartment || !departmentExists) {
      await Swal.fire({
        icon: 'warning',
        title: 'Select response team',
        text: 'Please choose a department before notifying responders.',
        confirmButtonColor: '#134178',
      });
      return;
    }

    const responderPhone = getDepartmentContactPhone(selectedDepartment);

    if (!responderPhone || responderPhone === '—') {
      await Swal.fire({
        icon: 'warning',
        title: 'No contact available',
        text: `Responder contact number is not available for ${selectedDepartment}.`,
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
        assignedDepartments: [...new Set([...existingDepartments, selectedDepartment])],
      };
    });

    setNotifyDialogOpen(false);

    const cleanPhone = String(responderPhone).replace(/\s+/g, '');

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(responderPhone);
      }
    } catch (_) {
      // clipboard can fail in non-secure contexts; continue with dial intent
    }

    const dialWindow = window.open(`tel:${cleanPhone}`, '_blank', 'noopener,noreferrer');
    if (!dialWindow) {
      await Swal.fire({
        icon: 'info',
        title: 'Manual call required',
        text: `Your browser blocked the dial intent. Please call ${responderPhone} manually.`,
        confirmButtonColor: '#134178',
      });
      return;
    }

    await Swal.fire({
      icon: 'success',
      title: 'Response team notified',
      text: `${selectedDepartment} has been assigned and notified.`,
      timer: 2200,
      showConfirmButton: false,
      timerProgressBar: true,
    });
  };

  const handleEscalate = () => {
    // Mock escalation
    alert(`Incident escalated to ${newSeverity}. Reason: ${escalationReason}`);
    setEscalateDialogOpen(false);
  };

  const handleAddDepartment = () => {
    // Mock add department
    alert(`Added ${additionalDepartment} to incident`);
    setAddDepartmentDialogOpen(false);
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
      await verifyIncident(id);
      setVerifyDialogOpen(false);
      await fetchIncident();
    } catch (err) {
      alert(err.message || 'Failed to verify incident');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleAddCoordinationNote = () => {
    if (coordinationNote.trim()) {
      alert(`Coordination note added: ${coordinationNote}`);
      setCoordinationNote('');
    }
  };

  const panelClass = `rounded-2xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'}`;
  const headerClass = `flex items-center gap-3 px-4 py-3 border-b ${isLight ? 'border-gray-200/80 bg-gray-50/50' : 'border-white/10 bg-white/5'}`;
  const iconBoxClass = `w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'}`;

  return (
    <Layout>
      <div className="p-4 md:p-6">
        {/* Header with back + incident title – glass */}
        <div className={`mb-6 rounded-2xl border overflow-hidden ${isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'}`}>
          <div className={`flex items-center gap-4 px-4 py-3 border-b ${isLight ? 'border-gray-200/80 bg-gray-50/50' : 'border-white/10 bg-white/5'}`}>
            <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 rounded-xl">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </div>
          <div className="p-4 md:p-5 space-y-4">
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
              </div>
            </div>

            <div className={`grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 p-3 rounded-xl border ${isLight ? 'bg-gray-50/70 border-gray-200/80' : 'bg-white/5 border-white/10'}`}>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted">Status</p>
                <p className="text-sm font-semibold text-foreground">{incident.status}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted">Severity</p>
                <p className="text-sm font-semibold text-foreground">{incident.severity}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted">Type</p>
                <p className="text-sm font-semibold text-foreground">{incident.emergencyType}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted">Reporter</p>
                <p className="text-sm font-semibold text-foreground truncate" title={incident.reporterName}>{incident.reporterName}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted">Contact</p>
                <p className="text-sm font-semibold text-foreground truncate" title={incident.reporterPhone}>{incident.reporterPhone}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted">Barangay</p>
                <p className="text-sm font-semibold text-foreground truncate" title={incident.barangay}>{incident.barangay}</p>
              </div>
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
            </div>

            <div className="flex flex-wrap gap-2">
              {!incident.verified && (
                <Button
                  className="gap-2 bg-[#134178] hover:bg-[#0f3256]"
                  onClick={() => setVerifyDialogOpen(true)}
                >
                  <CheckCircle className="w-4 h-4" />
                  Verify Incident
                </Button>
              )}
              <Button variant="outline" className="gap-2 rounded-xl" onClick={openNotifyRespondersDialog}>
                <Bell className="w-4 h-4" />
                Notify Responders
              </Button>
              {possibleDuplicates.length > 0 && (
                <Button
                  variant="outline"
                  className={`gap-2 rounded-xl ${isLight ? 'text-amber-600 border-amber-200 hover:bg-amber-50' : 'text-amber-400 border-amber-500/40 hover:bg-amber-500/20'}`}
                  onClick={() => setDuplicateDialogOpen(true)}
                >
                  <Merge className="w-4 h-4" />
                  Review Duplicates ({possibleDuplicates.length})
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Duplicate Warning */}
        {possibleDuplicates.length > 0 && incident.status !== 'Duplicate' && (
          <Alert className={`mb-6 rounded-xl border ${isLight ? 'border-amber-500/40 bg-amber-500/15' : 'border-amber-500/30 bg-amber-500/10'}`}>
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-600 dark:text-amber-400">Possible Duplicate Detected</AlertTitle>
            <AlertDescription className="text-foreground/90">
              This incident may be related to {possibleDuplicates.length} other report(s).{' '}
              <Button variant="link" className="text-amber-600 dark:text-amber-400 underline p-0 ml-2 h-auto" onClick={() => setDuplicateDialogOpen(true)}>
                Review duplicates
              </Button>
            </AlertDescription>
          </Alert>
        )}

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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Details */}
              <div className="lg:col-span-2 space-y-6">
                {/* Reporter Info */}
                <div className={panelClass}>
                  <div className={headerClass}>
                    <div className={iconBoxClass}><User className="w-4 h-4" /></div>
                    <h2 className="text-base font-semibold text-foreground">Reporter Information</h2>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-muted" />
                      <div>
                        <p className="text-sm text-muted">Name</p>
                        <p className="font-medium text-foreground">{incident.reporterName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-muted" />
                      <div>
                        <p className="text-sm text-muted">Phone Number</p>
                        <p className="font-medium text-foreground">{incident.reporterPhone}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className={panelClass}>
                  <div className={headerClass}>
                    <div className={iconBoxClass}><MapPin className="w-4 h-4" /></div>
                    <h2 className="text-base font-semibold text-foreground">Location Details</h2>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start gap-3 mb-4">
                      <MapPin className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">{incident.barangay}</p>
                        <p className="text-sm text-muted">Barangay, Dagupan City</p>
                        <p className="text-xs text-muted mt-1">
                          Coordinates: {incident.location.lat}, {incident.location.lng}
                        </p>
                      </div>
                    </div>
                    <IncidentMap
                      latitude={incident.location.lat}
                      longitude={incident.location.lng}
                      className="w-full h-48 rounded-xl overflow-hidden border border-border"
                    />
                  </div>
                </div>

                {/* Voice Transcription */}
                {incident.transcription && (
                  <div className={panelClass}>
                    <div className={headerClass}>
                      <div className={iconBoxClass}><FileText className="w-4 h-4" /></div>
                      <h2 className="text-base font-semibold text-foreground">Voice Transcription</h2>
                    </div>
                    <div className="p-4">
                      <p className="text-foreground whitespace-pre-wrap">{incident.transcription}</p>
                    </div>
                  </div>
                )}

                {/* Media */}
                <div className={panelClass}>
                  <div className={headerClass}>
                    <div className={iconBoxClass}><FileText className="w-4 h-4" /></div>
                    <h2 className="text-base font-semibold text-foreground">Media & Evidence</h2>
                  </div>
                  <div className="p-4">
                    <div className="space-y-3">
                      <div className={`p-4 rounded-xl border ${isLight ? 'bg-gray-50/80 border-gray-200' : 'bg-secondary/20 border-border'}`}>
                        <p className="text-sm text-muted mb-2">Voice Recording</p>
                        {audioLoading && (
                          <div className="flex items-center gap-2 text-muted text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading audio...
                          </div>
                        )}
                        {audioError && (
                          <p className="text-sm text-primary">{audioError}</p>
                        )}
                        {audioUrl && !audioLoading && (
                          <audio
                            controls
                            src={audioUrl}
                            className="w-full h-10"
                            preload="metadata"
                          >
                            Your browser does not support the audio element.
                          </audio>
                        )}
                        {!incident.audioPath && !audioLoading && !audioError && (
                          <p className="text-sm text-muted">No voice recording available</p>
                        )}
                      </div>
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
                </div>

                {/* Cross-Department Info */}
                {incident.assignedDepartments && incident.assignedDepartments.length > 1 && (
                  <div className={panelClass}>
                    <div className={headerClass}>
                      <div className={iconBoxClass}><Users className="w-4 h-4" /></div>
                      <h2 className="text-base font-semibold text-foreground">Multi-Department Coordination</h2>
                    </div>
                    <div className="p-4 space-y-4">
                      <div>
                        <Label className="text-sm text-muted">Lead Department</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Shield className="w-4 h-4 text-primary" />
                          <span className="font-medium text-foreground">{incident.leadDepartment}</span>
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <Label className="text-sm text-muted mb-2 block">Supporting Departments</Label>
                        <div className="space-y-2">
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
                    </div>
                  </div>
                )}

                {/* Closure Information (if closed) */}
                {incident.closureData && (
                  <div className={`${panelClass} ${isLight ? 'border-severity-resolved/40' : 'border-severity-resolved/30'}`}>
                    <div className={headerClass}>
                      <div className={`${iconBoxClass} ${isLight ? '!bg-severity-resolved/20 !text-severity-resolved' : '!bg-severity-resolved/20 !text-severity-resolved'}`}><CheckCircle className="w-4 h-4" /></div>
                      <h2 className="text-base font-semibold text-foreground">Incident Closure Information</h2>
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <Label className="text-sm text-muted">Closed By</Label>
                        <p className="font-medium text-foreground">{incident.closureData.closedBy}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted">Closed At</Label>
                        <p className="text-sm text-foreground">{incident.closureData.closedAt}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted">Outcome</Label>
                        <p className="text-sm text-foreground">{incident.closureData.outcome}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted">Classification</Label>
                        <Badge className="bg-severity-resolved/20 text-severity-resolved border-severity-resolved/40 rounded-lg">
                          {incident.closureData.classification}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Actions */}
              <div className="space-y-6">
                {/* Status */}
                <div className={panelClass}>
                  <div className={headerClass}>
                    <div className={iconBoxClass}><Clock className="w-4 h-4" /></div>
                    <h2 className="text-base font-semibold text-foreground">Status</h2>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <p className="text-sm text-muted mb-1">Workflow Status</p>
                      <Badge className={`${getStatusColor(incident.status)} rounded-lg`}>{incident.status}</Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted mb-1">Verification</p>
                      <div className="flex items-center gap-2">
                        {incident.verified ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-severity-resolved" />
                            <span className="text-sm text-severity-resolved">Verified</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 text-primary" />
                            <span className="text-sm text-primary">Not Verified</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted mb-1">Workflow State Guide</p>
                      <p className="text-xs text-muted">Pending → Verified → In Progress → Resolved</p>
                    </div>
                  </div>
                </div>

                {/* Department */}
                <div className={panelClass}>
                  <div className={headerClass}>
                    <div className={iconBoxClass}><Shield className="w-4 h-4" /></div>
                    <h2 className="text-base font-semibold text-foreground">Primary Department</h2>
                  </div>
                  <div className="p-4">
                    <p className="font-medium text-foreground">{incident.assignedDepartment}</p>
                    <p className="text-sm text-muted mt-1">{incident.emergencyType} Response Team</p>
                  </div>
                </div>

                {/* Escalation Controls (Supervisor/Admin Only) */}
                {isSupervisor && incident.status !== 'Resolved' && incident.status !== 'Duplicate' && (
                  <div className={`${panelClass} ${isLight ? 'border-amber-500/30' : 'border-amber-500/40'}`}>
                    <div className={headerClass}>
                      <div className={`${iconBoxClass} ${isLight ? '!bg-amber-500/20 !text-amber-600' : '!bg-amber-500/20 !text-amber-400'}`}><TrendingUp className="w-4 h-4" /></div>
                      <h2 className="text-base font-semibold text-foreground">Escalation Controls</h2>
                    </div>
                    <div className="p-4 space-y-3">
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
                                      <SelectValue value={value} options={departments.map(d => ({ value: d.name, label: d.name }))} placeholder="Choose department" />
                                    </SelectTrigger>
                                    <SelectContent isOpen={additionalDeptSelectOpen} dropdownRect={dropdownRect}>
                                      {departments.map(dept => (
                                        <SelectItem key={dept.id} value={dept.name} onSelect={(v) => { onValueChange(v); setAdditionalDeptSelectOpen(false); }}>
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
                  </div>
                )}

                {/* Actions */}
                <div className={panelClass}>
                  <div className={headerClass}>
                    <div className={iconBoxClass}><Wrench className="w-4 h-4" /></div>
                    <h2 className="text-base font-semibold text-foreground">Quick Actions</h2>
                  </div>
                  <div className="p-4 space-y-3">
                    {!incident.verified && (
                      <>
                        <Button
                          className="w-full bg-[#134178] hover:bg-[#0f3256] gap-2"
                          onClick={() => setVerifyDialogOpen(true)}
                        >
                          <CheckCircle className="w-4 h-4" />
                          Verify Incident
                        </Button>
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
                      </>
                    )}
                    <Button variant="outline" className="w-full gap-2 rounded-xl" onClick={openNotifyRespondersDialog}>
                      <Bell className="w-4 h-4" />
                      Notify Responders
                    </Button>
                    
                    {/* Duplicate Handling */}
                    {possibleDuplicates.length > 0 && (
                      <Button 
                        variant="outline" 
                        className={`w-full gap-2 rounded-xl ${isLight ? 'text-amber-600 border-amber-200 hover:bg-amber-50' : 'text-amber-400 border-amber-500/40 hover:bg-amber-500/20'}`}
                        onClick={() => setDuplicateDialogOpen(true)}
                      >
                        <Merge className="w-4 h-4" />
                        Review Duplicates ({possibleDuplicates.length})
                      </Button>
                    )}

                    <Button 
                      variant="outline" 
                      className={`w-full gap-2 rounded-xl ${isLight ? 'text-primary border-primary/40 hover:bg-primary/10' : 'text-primary border-primary/50 hover:bg-primary/20'}`}
                      onClick={handleMarkFalse}
                    >
                      <XCircle className="w-4 h-4" />
                      Mark as False Report
                    </Button>

                    {/* Formal Closure (Supervisor/Admin Only) */}
                    {isSupervisor && incident.status === 'Resolved' && !incident.closureData && (
                      <Dialog open={closureDialogOpen} onOpenChange={setClosureDialogOpen}>
                        <DialogTrigger asChild>
                          <Button className="w-full bg-green-600 hover:bg-green-700 gap-2">
                            <FileText className="w-4 h-4" />
                            Formally Close Incident
                          </Button>
                        </DialogTrigger>
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
                                    <SelectTrigger isOpen={closureClassSelectOpen} onClick={() => setClosureClassSelectOpen(o => !o)}>
                                      <SelectValue value={value} options={[
                                        { value: 'Successful Response', label: 'Successful Response' },
                                        { value: 'Partial Success', label: 'Partial Success' },
                                        { value: 'False Alarm', label: 'False Alarm' },
                                        { value: 'Duplicate Report', label: 'Duplicate Report' },
                                        { value: 'No Action Required', label: 'No Action Required' }
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
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div className={panelClass}>
                  <div className={headerClass}>
                    <div className={iconBoxClass}><FileText className="w-4 h-4" /></div>
                    <h2 className="text-base font-semibold text-foreground">Quick Notes</h2>
                  </div>
                  <div className="p-4">
                    <Textarea
                      className={`w-full resize-none rounded-xl ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-white/5 border-border'}`}
                      rows={4}
                      placeholder="Add quick notes about this incident..."
                    />
                    <Button className="w-full mt-3 rounded-xl bg-primary hover:bg-primary-hover">
                      Save Notes
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* DIALOGS - Rendered outside cards for proper z-index and portal behavior */}
          <Dialog open={notifyDialogOpen} onOpenChange={setNotifyDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Notify Response Team</DialogTitle>
                <DialogDescription>
                  Assign and notify the selected response team for this incident.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Select Department / Team</Label>
                  <Select value={notifyDepartment} onValueChange={setNotifyDepartment} open={notifyDeptSelectOpen} onOpenChange={setNotifyDeptSelectOpen}>
                    {({ value, onValueChange, dropdownRect }) => (
                      <>
                        <SelectTrigger isOpen={notifyDeptSelectOpen} onClick={() => setNotifyDeptSelectOpen(o => !o)}>
                          <SelectValue value={value} options={departments.map(d => ({ value: d.name, label: d.name }))} placeholder="Choose department" />
                        </SelectTrigger>
                        <SelectContent isOpen={notifyDeptSelectOpen} dropdownRect={dropdownRect}>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.name} onSelect={(v) => { onValueChange(v); setNotifyDeptSelectOpen(false); }}>
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
                <Button variant="outline" onClick={() => setNotifyDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-[#134178] hover:bg-[#0f3256]"
                  onClick={handleNotifyResponders}
                  disabled={!notifyDepartment}
                >
                  Assign & Notify
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
                      <p className="text-xs text-muted">— {note.author}</p>
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
