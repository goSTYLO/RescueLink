import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { Label } from '../components/ui/Label';
import { Separator } from '../components/ui/Separator';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/Alert';
import { 
  ArrowLeft, MapPin, Phone, User, CheckCircle, XCircle, Bell, 
  Clock, AlertTriangle, TrendingUp, Users, Shield, FileText,
  MessageSquare, Wrench, Award, Star, AlertCircle, Copy, Merge,
  X, ThumbsUp
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  incidents, 
  incidentTimelines, 
  escalationHistory, 
  coordinationNotes,
  postIncidentReviews,
  departments,
  units
} from '../data/mockData';
import { useState } from 'react';

export function IncidentDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const incident = incidents.find(i => i.id === id);
  const timeline = incidentTimelines[id || ''] || [];
  const escalations = escalationHistory[id || ''] || [];
  const coordination = coordinationNotes[id || ''] || [];
  const review = postIncidentReviews[id || ''];
  const possibleDuplicates = incidents.filter(i => incident?.possibleDuplicates?.includes(i.id));

  // Get current user role
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = currentUser.role === 'Admin';
  const isSupervisor = currentUser.role === 'Supervisor' || isAdmin;

  // State for dialogs
  const [escalateDialogOpen, setEscalateDialogOpen] = useState(false);
  const [addDepartmentDialogOpen, setAddDepartmentDialogOpen] = useState(false);
  const [closureDialogOpen, setClosureDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);

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

  if (!incident) {
    return (
      <Layout>
        <div className="p-8">
          <p>Incident not found</p>
        </div>
      </Layout>
    );
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'Critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'Warning': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Resolved': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getWorkloadColor = (count) => {
    if (count === 0) return 'text-green-600';
    if (count <= 2) return 'text-amber-600';
    return 'text-red-600';
  };

  const getWorkloadBadge = (count) => {
    if (count === 0) return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Available</Badge>;
    if (count <= 2) return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Moderate Load ({count})</Badge>;
    return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Overloaded ({count})</Badge>;
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
            onClick={() => navigate('/dashboard')}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </div>

        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-semibold text-gray-900">{incident.id}</h1>
                {incident.highPriority && (
                  <Badge className="bg-red-100 text-red-700 border-red-300">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    High Priority
                  </Badge>
                )}
                {incident.status === 'Duplicate' && (
                  <Badge variant="outline" className="bg-gray-100 text-gray-700">
                    <Copy className="w-3 h-3 mr-1" />
                    Duplicate
                  </Badge>
                )}
              </div>
              <p className="text-gray-600 mt-1">{incident.emergencyType} Incident</p>
            </div>
            <Badge className={getSeverityColor(incident.severity)}>
              {incident.severity}
            </Badge>
          </div>
        </div>

        {/* Duplicate Warning */}
        {possibleDuplicates.length > 0 && incident.status !== 'Duplicate' && (
          <Alert className="mb-6 border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-900">Possible Duplicate Detected</AlertTitle>
            <AlertDescription className="text-amber-800">
              This incident may be related to {possibleDuplicates.length} other report(s). 
              <Button 
                variant="link" 
                className="text-amber-700 underline p-0 ml-2 h-auto"
                onClick={() => setDuplicateDialogOpen(true)}
              >
                Review duplicates
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="details" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
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
                <Card>
                  <CardHeader>
                    <CardTitle>Reporter Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-gray-600" />
                      <div>
                        <p className="text-sm text-gray-600">Name</p>
                        <p className="font-medium text-gray-900">{incident.reporterName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-gray-600" />
                      <div>
                        <p className="text-sm text-gray-600">Phone Number</p>
                        <p className="font-medium text-gray-900">{incident.reporterPhone}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Location */}
                <Card>
                  <CardHeader>
                    <CardTitle>Location Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start gap-3 mb-4">
                      <MapPin className="w-5 h-5 text-[#134178] mt-1" />
                      <div>
                        <p className="font-medium text-gray-900">{incident.barangay}</p>
                        <p className="text-sm text-gray-600">Barangay, Dagupan City</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Coordinates: {incident.location.lat}, {incident.location.lng}
                        </p>
                      </div>
                    </div>
                    <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                      <p className="text-gray-500">Interactive Map (GPS: {incident.location.lat}, {incident.location.lng})</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Incident Description */}
                <Card>
                  <CardHeader>
                    <CardTitle>Incident Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700">{incident.description}</p>
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-sm text-blue-900"><strong>AI Suggestion:</strong> {incident.aiSuggestion}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Media */}
                <Card>
                  <CardHeader>
                    <CardTitle>Media & Evidence</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-sm text-gray-600 mb-2">Voice Recording</p>
                        <div className="flex items-center gap-3">
                          <div className="h-2 flex-1 bg-[#134178]/20 rounded-full"></div>
                          <span className="text-xs text-gray-500">1:23</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
                          <p className="text-sm text-gray-500">Photo 1</p>
                        </div>
                        <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
                          <p className="text-sm text-gray-500">Photo 2</p>
                        </div>
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
                          <span className="font-medium text-gray-900">{incident.leadDepartment}</span>
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <Label className="text-sm text-gray-600 mb-2 block">Supporting Departments</Label>
                        <div className="space-y-2">
                          {incident.assignedDepartments
                            .filter(dept => dept !== incident.leadDepartment)
                            .map((dept, idx) => (
                              <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                <div className="w-2 h-2 rounded-full bg-[#134178]"></div>
                                <span className="text-sm text-gray-900">{dept}</span>
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
                {/* Status */}
                <Card>
                  <CardHeader>
                    <CardTitle>Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Current Status</p>
                      <Badge variant="outline" className="border-gray-300">{incident.status}</Badge>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Verified</p>
                      <div className="flex items-center gap-2">
                        {incident.verified ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-green-700">Verified</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 text-red-600" />
                            <span className="text-sm text-red-700">Not Verified</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Time Reported</p>
                      <p className="text-sm font-medium text-gray-900">{incident.timeReported}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Department */}
                <Card>
                  <CardHeader>
                    <CardTitle>Primary Department</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium text-gray-900">{incident.assignedDepartment}</p>
                    <p className="text-sm text-gray-600 mt-1">{incident.emergencyType} Response Team</p>
                  </CardContent>
                </Card>

                {/* Escalation Controls (Supervisor/Admin Only) */}
                {isSupervisor && incident.status !== 'Resolved' && incident.status !== 'Duplicate' && (
                  <Card className="border-amber-200">
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

                {/* Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!incident.verified && (
                      <Button className="w-full bg-[#134178] hover:bg-[#0f3256] gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Verify Incident
                      </Button>
                    )}
                    <Button variant="outline" className="w-full gap-2">
                      <Phone className="w-4 h-4" />
                      Contact Reporter
                    </Button>
                    <Button variant="outline" className="w-full gap-2">
                      <Bell className="w-4 h-4" />
                      Notify Responders
                    </Button>
                    
                    {/* Duplicate Handling */}
                    {possibleDuplicates.length > 0 && (
                      <Button 
                        variant="outline" 
                        className="w-full gap-2 text-amber-600 border-amber-200 hover:bg-amber-50"
                        onClick={() => setDuplicateDialogOpen(true)}
                      >
                        <Merge className="w-4 h-4" />
                        Review Duplicates ({possibleDuplicates.length})
                      </Button>
                    )}

                    <Button 
                      variant="outline" 
                      className="w-full gap-2 text-red-600 border-red-200 hover:bg-red-50"
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
                              <Select value={closureClassification} onValueChange={setClosureClassification}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select classification" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Successful Response">Successful Response</SelectItem>
                                  <SelectItem value="Partial Success">Partial Success</SelectItem>
                                  <SelectItem value="False Alarm">False Alarm</SelectItem>
                                  <SelectItem value="Duplicate Report">Duplicate Report</SelectItem>
                                  <SelectItem value="No Action Required">No Action Required</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setClosureDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button 
                              className="bg-green-600 hover:bg-green-700"
                              onClick={handleCloseIncident}
                              disabled={!closureOutcome || !closureClassification}
                            >
                              Close Incident
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </CardContent>
                </Card>

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
                            <p className="font-medium text-gray-900">{event.action}</p>
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
                    <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant="outline" className="text-xs">
                          {note.department}
                        </Badge>
                        <span className="text-xs text-gray-500">{note.timestamp}</span>
                      </div>
                      <p className="text-sm text-gray-900 mb-1">{note.note}</p>
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
                    <div key={idx} className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-gray-100 text-gray-700">
                            {esc.fromSeverity}
                          </Badge>
                          <TrendingUp className="w-4 h-4 text-amber-600" />
                          <Badge className={getSeverityColor(esc.toSeverity)}>
                            {esc.toSeverity}
                          </Badge>
                        </div>
                        <span className="text-xs text-gray-500">{esc.timestamp}</span>
                      </div>
                      <p className="text-sm text-gray-900 mb-1">
                        <strong>Escalated by:</strong> {esc.escalatedBy}
                      </p>
                      <p className="text-sm text-gray-700">
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
                      <p className="font-medium text-gray-900">{review.responseTime}</p>
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
                          <span className="text-sm text-gray-700">{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Separator />

                  {/* Supervisor Remarks */}
                  <div>
                    <Label className="text-sm text-gray-600 mb-2 block">Supervisor Remarks</Label>
                    <p className="text-sm text-gray-700 p-3 bg-blue-50 rounded-lg border border-blue-100">
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
                          <span className="text-sm text-gray-700">{rec}</span>
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
                  <div className="pt-4 border-t border-gray-200">
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
                <div key={dup.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-900">{dup.id}</p>
                      <p className="text-sm text-gray-600">{dup.emergencyType} - {dup.barangay}</p>
                    </div>
                    <Badge className={getSeverityColor(dup.severity)}>
                      {dup.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{dup.description}</p>
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
