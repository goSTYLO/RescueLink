import { Layout } from '@/presentation/components/layout/Layout';
import { IncidentMap } from '@/presentation/components/common/IncidentMap';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/Card';
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
import { getResponders } from '@/data/api/responders.api';
import { createDispatch } from '@/data/api/dispatches.api';
import { DEV_MODE } from '@/core/config/app.config';
import { Loader2 } from 'lucide-react';

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

  // Load responders for assignment dropdown
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (DEV_MODE && !token) return;

    let cancelled = false;
    const loadResponders = async () => {
      setRespondersLoading(true);
      try {
        const data = await getResponders({ limit: 200, offset: 0 });
        if (!cancelled) {
          setResponders(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) {
          setResponders([]);
        }
      } finally {
        if (!cancelled) {
          setRespondersLoading(false);
        }
      }
    };

    loadResponders();
    return () => {
      cancelled = true;
    };
  }, []);

  const timeline = incidentTimelines[id || ''] || [];
  const escalations = escalationHistory[id || ''] || [];
  const coordination = coordinationNotes[id || ''] || [];
  const review = postIncidentReviews[id || ''];
  const possibleDuplicates = mockIncidents.filter(i => incident?.possibleDuplicates?.includes(i.id));

  // Get current user role
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = currentUser.role === 'Admin';
  const isSupervisor = currentUser.role === 'Supervisor' || isAdmin;

  // State for dialogs
  const [escalateDialogOpen, setEscalateDialogOpen] = useState(false);
  const [addDepartmentDialogOpen, setAddDepartmentDialogOpen] = useState(false);
  const [closureDialogOpen, setClosureDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);

  // State for responder management
  const [responders, setResponders] = useState([]);
  const [respondersLoading, setRespondersLoading] = useState(false);
  const [selectedResponderId, setSelectedResponderId] = useState('');

  // State for forms
  const [newSeverity, setNewSeverity] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [additionalDepartment, setAdditionalDepartment] = useState('');
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

  const handleAssignResponder = async (forceUnverified = false) => {
    const numericId = /^\d+$/.test(String(id));
    if (!numericId || !incident) return;
    if (!selectedResponderId) {
      alert('Please select a responder first.');
      return;
    }

    setAssignLoading(true);
    try {
      await createDispatch({
        report_id: Number(id),
        responder_id: Number(selectedResponderId),
        response_status: 'dispatched',
        force_unverified: forceUnverified,
      });
      setAssignDialogOpen(false);
      setSelectedResponderId('');
      await fetchIncident();
      alert('Responder assigned successfully.');
    } catch (err) {
      if (err.requiresConfirmation && !forceUnverified) {
        const shouldProceed = window.confirm(
          'This incident is not yet verified. Do you want to continue and assign a responder anyway?'
        );
        if (shouldProceed) {
          await handleAssignResponder(true);
          return;
        }
      }
      alert(err.message || 'Failed to assign responder');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleAddCoordinationNote = () => {
    if (coordinationNote.trim()) {
      alert(`Coordination note added: ${coordinationNote}`);
      setCoordinationNote('');
    }
  };

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>

        {/* Compact Header with Status */}
        <div className="mb-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{incident.id}</h1>
            <Badge variant={incident.severity === 'Critical' ? 'destructive' : 'outline'}>
              {incident.severity}
            </Badge>
            <Badge variant="outline" className={incident.verified ? 'text-green-700' : 'text-amber-700'}>
              {incident.verified ? (
                <>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Verified
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Unverified
                </>
              )}
            </Badge>
            {incident.highPriority && (
              <Badge className="bg-primary/20 text-primary border-primary/50">
                <AlertTriangle className="w-3 h-3 mr-1" />
                High Priority
              </Badge>
            )}
            {incident.status === 'Duplicate' && (
              <Badge variant="outline" className="bg-card text-muted border-[rgba(19,65,120,0.35)]">
                <Copy className="w-3 h-3 mr-1" />
                Duplicate
              </Badge>
            )}
          </div>
        </div>
        <p className="text-sm text-muted mb-4">{incident.emergencyType} • Reported: {incident.timeReported}</p>

        {/* Duplicate Warning */}
        {possibleDuplicates.length > 0 && incident.status !== 'Duplicate' && (
          <Alert className="mb-3 border-amber-500/40 bg-amber-500/15">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <AlertTitle className="text-amber-400">Possible Duplicate Detected</AlertTitle>
            <AlertDescription className="text-foreground/90">
              This incident may be related to {possibleDuplicates.length} other report(s). 
              <Button 
                variant="link" 
                className="text-amber-400 underline p-0 ml-2 h-auto"
                onClick={() => setDuplicateDialogOpen(true)}
              >
                Review duplicates
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Quick Actions Bar - Emergency Response Focused */}
        <div className="mb-3 p-3 bg-card border border-border rounded-lg">
          <div className="flex flex-col gap-2">
            {/* Actions Row */}
            <div className="flex gap-2 flex-wrap">
              {!incident.verified && (
                <Button
                  className="flex-1 min-w-[140px] bg-[#134178] hover:bg-[#0f3256] gap-2 text-sm"
                  onClick={() => setVerifyDialogOpen(true)}
                >
                  <CheckCircle className="w-4 h-4" />
                  Verify Incident
                </Button>
              )}
              <Button
                variant="outline"
                className="flex-1 min-w-[140px] gap-2 text-sm"
                onClick={() => setAssignDialogOpen(true)}
              >
                <Bell className="w-4 h-4" />
                Assign Responder
              </Button>
              {possibleDuplicates.length > 0 && (
                <Button 
                  variant="outline" 
                  className="flex-1 min-w-[140px] gap-2 text-sm text-amber-600 border-amber-200 hover:bg-amber-50"
                  onClick={() => setDuplicateDialogOpen(true)}
                >
                  <Merge className="w-4 h-4" />
                  Duplicates ({possibleDuplicates.length})
                </Button>
              )}
              <Button 
                variant="outline" 
                className="flex-1 min-w-[140px] gap-2 text-sm text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleMarkFalse}
              >
                <XCircle className="w-4 h-4" />
                False Report
              </Button>
            </div>
            
            {/* Responder Assignment Status */}
            {/* TODO: Show assigned responder info if available */}
          </div>
        </div>

        {/* Dialogs for Quick Actions */}
        {/* Verify Dialog */}
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
                variant="outline"
                onClick={() => setVerifyDialogOpen(false)}
                disabled={verifyLoading}
              >
                Cancel
              </Button>
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
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Responder</DialogTitle>
              <DialogDescription>
                Select a responder to assign for this incident dispatch.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="responderSelect">Responder</Label>
                <select
                  id="responderSelect"
                  value={selectedResponderId}
                  onChange={(e) => setSelectedResponderId(e.target.value)}
                  className="w-full mt-2 px-3 py-2 border border-[rgba(19,65,120,0.35)] rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                  disabled={assignLoading || respondersLoading}
                >
                  <option value="">Select responder</option>
                  {responders.map((responder) => (
                    <option key={responder.responder_id} value={String(responder.responder_id)}>
                      {responder.name} {responder.organization ? `(${responder.organization})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {!incident.verified && (
                <Alert className="border-amber-500/40 bg-amber-500/15">
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                  <AlertDescription className="text-foreground/90">
                    This incident is not verified yet. Assigning will require manual confirmation.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)} disabled={assignLoading}>
                Cancel
              </Button>
              <Button
                onClick={() => handleAssignResponder(false)}
                disabled={!selectedResponderId || assignLoading || respondersLoading}
                className="gap-2 bg-[#134178] hover:bg-[#0f3256]"
              >
                {assignLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  'Assign'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Tabs defaultValue="details" className="space-y-3">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid text-xs">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="coordination">Coordination</TabsTrigger>
            <TabsTrigger value="escalation">Escalation</TabsTrigger>
            {review && <TabsTrigger value="review">Review</TabsTrigger>}
          </TabsList>

          {/* DETAILS TAB */}
          <TabsContent value="details" className="space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* Left Column - Details */}
              <div className="lg:col-span-2 space-y-3">
                {/* Reporter + Location on one row compact */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {/* Reporter Info */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Reporter</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted" />
                        <div>
                          <p className="text-xs text-muted">Name</p>
                          <p className="font-medium text-foreground">{incident.reporterName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted" />
                        <div>
                          <p className="text-xs text-muted">Phone</p>
                          <p className="font-medium text-foreground">{incident.reporterPhone}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Location */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Location</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-[#134178] mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-foreground">{incident.barangay}</p>
                          <p className="text-xs text-gray-600">Coordinates: {incident.location.lat}, {incident.location.lng}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Incident Description */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Description</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p className="text-foreground">{incident.description}</p>
                    {incident.aiSuggestion && (
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <p className="text-sm text-blue-900"><strong>AI Suggestion:</strong> {incident.aiSuggestion}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Voice Transcription */}
                {incident.transcription && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Voice Transcription</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-foreground whitespace-pre-wrap">{incident.transcription}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Media */}
                <Card>
                  <CardHeader>
                    <CardTitle>Media & Evidence</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="p-4 bg-secondary/20 rounded-lg border border-border">
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
                            <div key={idx} className="aspect-video bg-muted/30 rounded-lg flex items-center justify-center border border-border">
                              <p className="text-sm text-muted">Photo {idx + 1}</p>
                            </div>
                          ))
                        ) : (
                          <div className="col-span-2 p-6 bg-muted/20 rounded-lg border border-dashed border-border flex items-center justify-center">
                            <p className="text-sm text-muted">No photos provided for this incident</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Cross-Department Info */}
                {incident.assignedDepartments && incident.assignedDepartments.length > 1 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Multi-Department Coordination
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-sm text-gray-600">Lead Department</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Shield className="w-4 h-4 text-[#134178]" />
                          <span className="font-medium text-foreground">{incident.leadDepartment}</span>
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <Label className="text-sm text-gray-600 mb-2 block">Supporting Departments</Label>
                        <div className="space-y-2">
                          {incident.assignedDepartments
                            .filter(dept => dept !== incident.leadDepartment)
                            .map((dept, idx) => (
                              <div key={idx} className="flex items-center gap-2 p-2 bg-secondary/20 rounded-lg">
                                <div className="w-2 h-2 rounded-full bg-[#134178]"></div>
                                <span className="text-sm text-foreground">{dept}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Closure Information (if closed) */}
                {incident.closureData && (
                  <Card className="border-green-200 bg-green-50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-900">
                        <CheckCircle className="w-5 h-5" />
                        Incident Closure Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-sm text-green-700">Closed By</Label>
                        <p className="font-medium text-green-900">{incident.closureData.closedBy}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-green-700">Closed At</Label>
                        <p className="text-sm text-green-900">{incident.closureData.closedAt}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-green-700">Outcome</Label>
                        <p className="text-sm text-green-900">{incident.closureData.outcome}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-green-700">Classification</Label>
                        <Badge className="bg-green-100 text-green-800 border-green-300">
                          {incident.closureData.classification}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right Column - Actions */}
              <div className="space-y-6">
                {/* Escalation Controls (Supervisor/Admin Only) */}
                {isSupervisor && incident.status !== 'Resolved' && incident.status !== 'Duplicate' && (
                  <Card className="border-amber-500/30">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-amber-900">
                        <TrendingUp className="w-5 h-5" />
                        Escalation Controls
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
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
                              <Select value={newSeverity} onValueChange={setNewSeverity}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select severity" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Critical">Critical</SelectItem>
                                  <SelectItem value="Warning">Warning</SelectItem>
                                  <SelectItem value="Low">Low</SelectItem>
                                </SelectContent>
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
                            <Button variant="outline" onClick={() => setEscalateDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button 
                              className="bg-amber-600 hover:bg-amber-700"
                              onClick={handleEscalate}
                              disabled={!newSeverity || !escalationReason}
                            >
                              Confirm Escalation
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
                              <Select value={additionalDepartment} onValueChange={setAdditionalDepartment}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Choose department" />
                                </SelectTrigger>
                                <SelectContent>
                                  {departments.map(dept => (
                                    <SelectItem key={dept.id} value={dept.name}>
                                      {dept.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setAddDepartmentDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button 
                              className="bg-[#134178] hover:bg-[#0f3256]"
                              onClick={handleAddDepartment}
                              disabled={!additionalDepartment}
                            >
                              Add Department
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
                    </CardContent>
                  </Card>
                )}

                {/* Notes */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      className="w-full resize-none"
                      rows={4}
                      placeholder="Add quick notes about this incident..."
                    />
                    <Button className="w-full mt-3 bg-[#134178] hover:bg-[#0f3256]">
                      Save Notes
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* TIMELINE TAB */}
          <TabsContent value="timeline">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Incident Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {timeline.map((event, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-[#134178]"></div>
                        {idx < timeline.length - 1 && (
                          <div className="w-0.5 h-full min-h-[40px] bg-gray-300"></div>
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-foreground">{event.action}</p>
                            <p className="text-sm text-gray-600">
                              {event.actor} ({event.actorRole})
                            </p>
                            {event.notes && (
                              <p className="text-sm text-gray-500 mt-1 italic">{event.notes}</p>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {event.timestamp}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {timeline.length === 0 && (
                    <p className="text-center text-gray-500 py-8">No timeline events yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* COORDINATION TAB */}
          <TabsContent value="coordination">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Cross-Department Coordination
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Coordination Notes */}
                <div className="space-y-3">
                  {coordination.map((note, idx) => (
                    <div key={idx} className="p-4 bg-secondary/20 rounded-lg border border-border">
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant="outline" className="text-xs">
                          {note.department}
                        </Badge>
                        <span className="text-xs text-gray-500">{note.timestamp}</span>
                      </div>
                      <p className="text-sm text-foreground mb-1">{note.note}</p>
                      <p className="text-xs text-gray-600">— {note.author}</p>
                    </div>
                  ))}
                  {coordination.length === 0 && (
                    <p className="text-center text-gray-500 py-4">No coordination notes yet</p>
                  )}
                </div>

                <Separator />

                {/* Add Coordination Note */}
                <div>
                  <Label>Add Coordination Note</Label>
                  <Textarea 
                    placeholder="Share updates with other departments..."
                    value={coordinationNote}
                    onChange={(e) => setCoordinationNote(e.target.value)}
                    rows={3}
                    className="mt-2"
                  />
                  <Button 
                    className="w-full mt-3 bg-[#134178] hover:bg-[#0f3256]"
                    onClick={handleAddCoordinationNote}
                  >
                    Add Note
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ESCALATION TAB */}
          <TabsContent value="escalation">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Escalation History
                </CardTitle>
              </CardHeader>
              <CardContent>
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
                        <span className="text-xs text-gray-500">{esc.timestamp}</span>
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
                    <p className="text-center text-gray-500 py-8">No escalations recorded</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* REVIEW TAB (Only shown if review exists) */}
          {review && (
            <TabsContent value="review">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ThumbsUp className="w-5 h-5" />
                    Post-Incident Review
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Response Time */}
                  <div>
                    <Label className="text-sm text-gray-600">Response Time</Label>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="font-medium text-foreground">{review.responseTime}</p>
                      <Badge className={
                        review.responseTimeRating === 'Excellent' ? 'bg-green-100 text-green-700' :
                        review.responseTimeRating === 'Good' ? 'bg-blue-100 text-blue-700' :
                        review.responseTimeRating === 'Fair' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }>
                        {review.responseTimeRating}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  {/* Issues Encountered */}
                  <div>
                    <Label className="text-sm text-gray-600 mb-2 block">Issues Encountered</Label>
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

                  {/* Supervisor Remarks */}
                  <div>
                    <Label className="text-sm text-gray-600 mb-2 block">Supervisor Remarks</Label>
                    <p className="text-sm text-foreground p-3 bg-primary/10 rounded-lg border border-primary/20">
                      {review.supervisorRemarks}
                    </p>
                  </div>

                  <Separator />

                  {/* Recommendations */}
                  <div>
                    <Label className="text-sm text-gray-600 mb-2 block">Recommendations</Label>
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

                  {/* Overall Rating */}
                  <div>
                    <Label className="text-sm text-gray-600 mb-2 block">Overall Rating</Label>
                    <div className="flex items-center gap-2">
                      {[...Array(5)].map((_, idx) => (
                        <Star 
                          key={idx} 
                          className={`w-5 h-5 ${
                            idx < review.overallRating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
                          }`}
                        />
                      ))}
                      <span className="ml-2 text-sm text-gray-600">
                        {review.overallRating} / 5.0
                      </span>
                    </div>
                  </div>

                  {/* Review Metadata */}
                  <div className="pt-4 border-t border-border">
                    <p className="text-xs text-gray-500">
                      Reviewed by {review.reviewedBy} on {review.reviewDate}
                    </p>
                  </div>
                </CardContent>
              </Card>
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
              <Button variant="outline" onClick={() => setDuplicateDialogOpen(false)}>
                Not a Duplicate
              </Button>
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
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
