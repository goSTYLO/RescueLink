import { Layout } from '@/presentation/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/Card';
import { Badge } from '@/presentation/components/ui/Badge';
import { Button } from '@/presentation/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/presentation/components/ui/Tabs';
import { Label } from '@/presentation/components/ui/Label';
import { Input } from '@/presentation/components/ui/Input';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/presentation/components/ui/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/Select';
import { ArrowLeft, Truck, Users as UsersIcon, ClipboardList, Wrench, Award, AlertCircle, CheckCircle, AlertTriangle, Plus, Pencil, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { departments, units as initialUnits, personnel as initialPersonnel, incidents } from '@/data/mock/mockData';
import Swal from 'sweetalert2';

const UNIT_STATUS_OPTIONS = ['Available', 'On Dispatch', 'On Duty', 'Busy', 'Under Maintenance', 'Out of Service'];
const MAINTENANCE_STATUS_OPTIONS = ['Operational', 'Under Maintenance', 'Out of Service'];
const PERSONNEL_STATUS_OPTIONS = ['Available', 'On Duty', 'On Leave', 'Off Duty'];

export function DepartmentDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const department = departments.find(d => d.id === id);

  const [deptUnits, setDeptUnits] = useState([]);
  const [deptPersonnel, setDeptPersonnel] = useState([]);
  useEffect(() => {
    const list = initialUnits[id || ''] || [];
    setDeptUnits(list.map(u => ({ ...u })));
    const plist = (initialPersonnel[id || ''] || []).map((p, i) => ({ ...p, id: p.id || `person-${i}` }));
    setDeptPersonnel(plist);
  }, [id]);

  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [unitForm, setUnitForm] = useState({
    name: '', type: '', status: 'Available', maintenanceStatus: 'Operational',
    lastMaintenance: '', nextMaintenance: '', maintenanceNotes: '',
  });

  const [personnelDialogOpen, setPersonnelDialogOpen] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState(null);
  const [unitStatusOpen, setUnitStatusOpen] = useState(false);
  const [unitMaintenanceOpen, setUnitMaintenanceOpen] = useState(false);
  const [personnelUnitOpen, setPersonnelUnitOpen] = useState(false);
  const [personnelStatusOpen, setPersonnelStatusOpen] = useState(false);
  useEffect(() => { if (!unitDialogOpen) { setUnitStatusOpen(false); setUnitMaintenanceOpen(false); } }, [unitDialogOpen]);
  useEffect(() => { if (!personnelDialogOpen) { setPersonnelUnitOpen(false); setPersonnelStatusOpen(false); } }, [personnelDialogOpen]);
  const [personnelForm, setPersonnelForm] = useState({
    name: '', role: '', unit: '', status: 'Available',
    specialSkills: '', certifications: [],
  });

  const deptIncidents = incidents.filter(i => i.status === 'In Progress');

  if (!department) {
    return (
      <Layout>
        <div className="p-8">
          <p>Department not found</p>
        </div>
      </Layout>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Available': return 'bg-severity-resolved/20 text-severity-resolved border-emerald-500/40';
      case 'On Dispatch': case 'On Duty': return 'bg-secondary/30 text-secondary-light border-secondary/50';
      case 'Busy': return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'Under Maintenance': return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'Out of Service': return 'bg-primary/20 text-primary border-primary/50';
      default: return 'bg-card text-muted border-[rgba(19,65,120,0.35)]';
    }
  };

  const getCertificationStatus = (status) => {
    switch (status) {
      case 'Valid': return <Badge variant="outline" className="bg-severity-resolved/20 text-severity-resolved border-emerald-500/40 text-xs">Valid</Badge>;
      case 'Expiring Soon': return <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-xs">Expiring Soon</Badge>;
      case 'Expired': return <Badge variant="outline" className="bg-primary/20 text-primary border-primary/50 text-xs">Expired</Badge>;
      default: return null;
    }
  };

  const openAddUnit = () => {
    setEditingUnit(null);
    setUnitForm({
      name: '', type: '', status: 'Available', maintenanceStatus: 'Operational',
      lastMaintenance: '', nextMaintenance: '', maintenanceNotes: '',
    });
    setUnitDialogOpen(true);
  };

  const openEditUnit = (unit, e) => {
    e?.stopPropagation();
    setEditingUnit(unit);
    setUnitForm({
      name: unit.name,
      type: unit.type,
      status: unit.status,
      maintenanceStatus: unit.maintenanceStatus || 'Operational',
      lastMaintenance: unit.lastMaintenance || '',
      nextMaintenance: unit.nextMaintenance || '',
      maintenanceNotes: unit.maintenanceNotes || '',
    });
    setUnitDialogOpen(true);
  };

  const handleSaveUnit = () => {
    if (!unitForm.name.trim()) {
      Swal.fire({ icon: 'error', title: 'Validation failed', text: 'Please enter unit name.', confirmButtonColor: '#134178' });
      return;
    }
    if (editingUnit) {
      setDeptUnits(prev =>
        prev.map(u =>
          u.id === editingUnit.id
            ? {
                ...u,
                name: unitForm.name.trim(),
                type: unitForm.type.trim() || u.type,
                status: unitForm.status,
                maintenanceStatus: unitForm.maintenanceStatus,
                lastMaintenance: unitForm.lastMaintenance || u.lastMaintenance,
                nextMaintenance: unitForm.nextMaintenance || u.nextMaintenance,
                maintenanceNotes: unitForm.maintenanceNotes || undefined,
              }
            : u
        )
      );
      Swal.fire({ icon: 'success', title: 'Unit updated', text: 'Unit details have been saved.', timer: 2000, showConfirmButton: false, timerProgressBar: true });
    } else {
      const newId = (unitForm.name.trim().toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '') || `unit-${Date.now()}`).slice(0, 12);
      setDeptUnits(prev => [
        ...prev,
        {
          id: newId,
          name: unitForm.name.trim(),
          type: unitForm.type.trim() || 'Unit',
          status: unitForm.status,
          assignedIncident: null,
          maintenanceStatus: unitForm.maintenanceStatus,
          lastMaintenance: unitForm.lastMaintenance || '',
          nextMaintenance: unitForm.nextMaintenance || '',
          maintenanceNotes: unitForm.maintenanceNotes || undefined,
          activeTaskCount: 0,
        },
      ]);
      Swal.fire({ icon: 'success', title: 'Unit added', text: 'The new unit has been added.', timer: 2000, showConfirmButton: false, timerProgressBar: true });
    }
    setUnitDialogOpen(false);
  };

  const handleDeleteUnit = (unitId, e) => {
    e?.stopPropagation();
    Swal.fire({
      title: 'Delete unit?',
      text: 'This action cannot be undone. The unit will be removed.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
      customClass: { popup: 'rounded-2xl shadow-xl', title: 'text-foreground text-xl', htmlContainer: 'text-muted', confirmButton: 'rounded-xl px-5 py-2.5 font-medium', cancelButton: 'rounded-xl px-5 py-2.5 font-medium' },
    }).then((result) => {
      if (result.isConfirmed) {
        setDeptUnits(prev => prev.filter(u => u.id !== unitId));
        Swal.fire({ icon: 'success', title: 'Unit deleted', text: 'The unit has been removed.', timer: 2000, showConfirmButton: false, timerProgressBar: true });
      }
    });
  };

  const openAddPersonnel = () => {
    setEditingPersonnel(null);
    setPersonnelForm({
      name: '', role: '', unit: deptUnits[0]?.id || '', status: 'Available',
      specialSkills: '', certifications: [],
    });
    setPersonnelDialogOpen(true);
  };

  const openEditPersonnel = (person, e) => {
    e?.stopPropagation();
    setEditingPersonnel(person);
    setPersonnelForm({
      name: person.name,
      role: person.role,
      unit: person.unit || '',
      status: person.status,
      specialSkills: (person.specialSkills || []).join(', '),
      certifications: (person.certifications || []).map(c => ({ ...c })),
    });
    setPersonnelDialogOpen(true);
  };

  const handleSavePersonnel = () => {
    if (!personnelForm.name.trim()) {
      Swal.fire({ icon: 'error', title: 'Validation failed', text: 'Please enter personnel name.', confirmButtonColor: '#134178' });
      return;
    }
    const skills = personnelForm.specialSkills
      ? personnelForm.specialSkills.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    const payload = {
      name: personnelForm.name.trim(),
      role: personnelForm.role.trim() || 'Staff',
      unit: personnelForm.unit || (deptUnits[0]?.id),
      status: personnelForm.status,
      specialSkills: skills,
      certifications: personnelForm.certifications || [],
    };
    if (editingPersonnel) {
      setDeptPersonnel(prev =>
        prev.map(p =>
          (p.id && p.id === editingPersonnel.id) || (p.name === editingPersonnel.name && p.role === editingPersonnel.role)
            ? { ...p, ...payload, id: p.id }
            : p
        )
      );
      Swal.fire({ icon: 'success', title: 'Personnel updated', text: 'Personnel details have been saved.', timer: 2000, showConfirmButton: false, timerProgressBar: true });
    } else {
      setDeptPersonnel(prev => [
        ...prev,
        { ...payload, id: `person-${Date.now()}` },
      ]);
      Swal.fire({ icon: 'success', title: 'Personnel added', text: 'The new personnel has been added.', timer: 2000, showConfirmButton: false, timerProgressBar: true });
    }
    setPersonnelDialogOpen(false);
  };

  const handleDeletePersonnel = (person, e) => {
    e?.stopPropagation();
    Swal.fire({
      title: 'Remove personnel?',
      text: `Remove ${person.name} from the department roster? This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, remove',
      cancelButtonText: 'Cancel',
      customClass: { popup: 'rounded-2xl shadow-xl', title: 'text-foreground text-xl', htmlContainer: 'text-muted', confirmButton: 'rounded-xl px-5 py-2.5 font-medium', cancelButton: 'rounded-xl px-5 py-2.5 font-medium' },
    }).then((result) => {
      if (result.isConfirmed) {
        setDeptPersonnel(prev =>
          prev.filter(p =>
            person.id ? p.id !== person.id : (p.name !== person.name || p.role !== person.role)
          )
        );
        Swal.fire({ icon: 'success', title: 'Personnel removed', text: 'The person has been removed from the roster.', timer: 2000, showConfirmButton: false, timerProgressBar: true });
      }
    });
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/departments')} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Departments
          </Button>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-foreground">{department.name}</h1>
          <p className="text-gray-600 mt-1">{department.type} Response Department</p>
        </div>

        <Card className="mb-6" hover={false}>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Department Type</p>
                <p className="font-semibold text-foreground">{department.type}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Officer-in-Charge</p>
                <p className="font-semibold text-foreground">Chief Roberto Santos</p>
                <p className="text-xs text-gray-500">+63 917 123 4567</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Status</p>
                <Badge className="bg-green-100 text-green-700 border-green-200">Available</Badge>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Operational Units</p>
                <p className="font-semibold text-[#134178]">
                  {deptUnits.filter(u => u.maintenanceStatus === 'Operational').length}/{deptUnits.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="units" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="units">Units</TabsTrigger>
            <TabsTrigger value="personnel">Personnel</TabsTrigger>
            <TabsTrigger value="tasks">Active Tasks</TabsTrigger>
          </TabsList>

          <TabsContent value="units" className="mt-6">
            <Card hover={false}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="w-5 h-5" />
                    Department Units & Resources
                  </CardTitle>
                  <Button
                    onClick={openAddUnit}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm text-white bg-[#134178] hover:bg-[#0f3256] focus:ring-2 focus:ring-[#134178] focus:ring-offset-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Unit
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {deptUnits.map((unit) => (
                    <div key={unit.id} className="p-4 bg-secondary/20 rounded-lg border border-border">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-foreground">{unit.name}</p>
                            {unit.maintenanceStatus === 'Under Maintenance' && (
                              <Wrench className="w-4 h-4 text-orange-600" />
                            )}
                            {unit.maintenanceStatus === 'Out of Service' && (
                              <AlertCircle className="w-4 h-4 text-red-600" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{unit.type}</p>
                          {unit.assignedIncident && (
                            <p className="text-xs text-blue-600 mt-1">
                              Assigned: <Button 
                                variant="link" 
                                className="p-0 h-auto text-xs text-blue-600"
                                onClick={() => navigate(`/incidents/${unit.assignedIncident}`)}
                              >
                                {unit.assignedIncident}
                              </Button>
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge className={getStatusColor(unit.status)}>
                            {unit.status}
                          </Badge>
                          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 min-w-[36px] text-[#134178] hover:bg-blue-50" onClick={(e) => openEditUnit(unit, e)} title="Edit unit" aria-label="Edit unit">
                            <Pencil className="w-5 h-5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 min-w-[36px] text-red-600 hover:bg-red-50" onClick={(e) => handleDeleteUnit(unit.id, e)} title="Delete unit" aria-label="Delete unit">
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-2 bg-card rounded border border-border">
                          <p className="text-gray-600 mb-1">Last Maintenance</p>
                          <p className="font-medium text-foreground">{unit.lastMaintenance}</p>
                        </div>
                        <div className="p-2 bg-card rounded border border-border">
                          <p className="text-gray-600 mb-1">Next Scheduled</p>
                          <p className="font-medium text-foreground">{unit.nextMaintenance}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {deptUnits.length === 0 && (
                    <p className="text-center text-gray-500 py-6">No units yet. Add one to get started.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="personnel" className="mt-6">
            <Card hover={false}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <UsersIcon className="w-5 h-5" />
                    Department Personnel
                  </CardTitle>
                  <Button
                    onClick={openAddPersonnel}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm text-white bg-[#134178] hover:bg-[#0f3256] focus:ring-2 focus:ring-[#134178] focus:ring-offset-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Personnel
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {deptPersonnel.map((person, index) => (
                    <div key={person.id || index} className="p-4 bg-secondary/20 rounded-lg border border-border">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-foreground">{person.name}</p>
                          <p className="text-sm text-gray-600">{person.role}</p>
                          <p className="text-xs text-gray-500 mt-1">Unit: {person.unit}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge className={getStatusColor(person.status)}>
                            {person.status}
                          </Badge>
                          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 min-w-[36px] text-[#134178] hover:bg-blue-50" onClick={(e) => openEditPersonnel(person, e)} title="Edit personnel" aria-label="Edit personnel">
                            <Pencil className="w-5 h-5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 min-w-[36px] text-red-600 hover:bg-red-50" onClick={(e) => handleDeletePersonnel(person, e)} title="Remove personnel" aria-label="Remove personnel">
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>

                      {person.certifications && person.certifications.length > 0 && (
                        <div className="mb-3">
                          <Label className="text-xs text-gray-600 mb-2 flex items-center gap-1">
                            <Award className="w-3 h-3" />
                            Certifications
                          </Label>
                          <div className="space-y-2">
                            {person.certifications.map((cert, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 bg-card rounded border border-border">
                                <div className="flex-1">
                                  <p className="text-xs font-medium text-foreground">{cert.name}</p>
                                  <p className="text-xs text-gray-500">Valid until: {cert.validUntil}</p>
                                </div>
                                {getCertificationStatus(cert.status)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {person.specialSkills && person.specialSkills.length > 0 && (
                        <div>
                          <Label className="text-xs text-gray-600 mb-2 block">Special Skills</Label>
                          <div className="flex flex-wrap gap-1">
                            {person.specialSkills.map((skill, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {deptPersonnel.length === 0 && (
                    <p className="text-center text-gray-500 py-6">No personnel yet. Add one to get started.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5" />
                  Active Tasks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {deptIncidents.map((incident) => (
                    <div
                      key={incident.id}
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={() => navigate(`/incidents/${incident.id}`)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-semibold text-gray-900">{incident.id}</p>
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                          {incident.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{incident.description}</p>
                      <p className="text-xs text-gray-500">Barangay: {incident.barangay}</p>
                    </div>
                  ))}
                  {deptIncidents.length === 0 && (
                    <div className="text-center py-12">
                      <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                      <p className="text-gray-600">No active tasks at this time</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Unit Add/Edit Dialog */}
        <Dialog open={unitDialogOpen} onOpenChange={setUnitDialogOpen}>
          <DialogContent className="w-full p-0 overflow-hidden rounded-2xl shadow-2xl border border-border">
            <div className="bg-gradient-to-br from-secondary to-secondary-hover px-6 py-5">
              <DialogTitle className="text-lg font-semibold text-white m-0">
                {editingUnit ? 'Edit Unit' : 'Add Unit'}
              </DialogTitle>
              <DialogDescription className="!text-white/80 mt-1 text-sm">
                {editingUnit ? 'Update unit details below.' : 'Enter the new unit details.'}
              </DialogDescription>
            </div>
            <div className="p-6 space-y-4 w-full min-w-0 bg-card">
              <div className="w-full min-w-0">
                <Label className="block text-sm font-medium text-foreground mb-2">Name</Label>
                <Input
                  value={unitForm.name}
                  onChange={(e) => setUnitForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Fire Truck 01"
                  className="w-full min-w-0 rounded-xl border-border focus:border-secondary focus:ring-secondary/20"
                />
              </div>
              <div className="w-full min-w-0">
                <Label className="block text-sm font-medium text-foreground mb-2">Type</Label>
                <Input
                  value={unitForm.type}
                  onChange={(e) => setUnitForm(f => ({ ...f, type: e.target.value }))}
                  placeholder="e.g. Fire Truck, Patrol, Ambulance"
                  className="w-full min-w-0 rounded-xl border-border focus:border-secondary focus:ring-secondary/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 w-full min-w-0">
                <div className="min-w-0 flex flex-col">
                  <Label className="block text-sm font-medium text-foreground mb-2">Status</Label>
                  <Select value={unitForm.status} onValueChange={(v) => setUnitForm(f => ({ ...f, status: v }))}>
                    {({ value }) => (
                      <>
                        <SelectTrigger
                          isOpen={unitStatusOpen}
                          onClick={() => setUnitStatusOpen(o => !o)}
                          className="w-full min-w-0 px-4 py-3 rounded-xl border-2 border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary"
                        >
                          <SelectValue value={value} options={UNIT_STATUS_OPTIONS.map(o => ({ value: o, label: o }))} />
                        </SelectTrigger>
                        <SelectContent isOpen={unitStatusOpen} className="rounded-xl border-2 border-border shadow-lg bg-card">
                          {UNIT_STATUS_OPTIONS.map(opt => (
                            <SelectItem key={opt} value={opt} onSelect={(v) => { setUnitForm(f => ({ ...f, status: v })); setUnitStatusOpen(false); }}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </>
                    )}
                  </Select>
                </div>
                <div className="min-w-0 flex flex-col">
                  <Label className="block text-sm font-medium text-foreground mb-2">Maintenance</Label>
                  <Select value={unitForm.maintenanceStatus} onValueChange={(v) => setUnitForm(f => ({ ...f, maintenanceStatus: v }))}>
                    {({ value }) => (
                      <>
                        <SelectTrigger
                          isOpen={unitMaintenanceOpen}
                          onClick={() => setUnitMaintenanceOpen(o => !o)}
                          className="w-full min-w-0 px-4 py-3 rounded-xl border-2 border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary"
                        >
                          <SelectValue value={value} options={MAINTENANCE_STATUS_OPTIONS.map(o => ({ value: o, label: o }))} />
                        </SelectTrigger>
                        <SelectContent isOpen={unitMaintenanceOpen} className="rounded-xl border-2 border-border shadow-lg bg-card">
                          {MAINTENANCE_STATUS_OPTIONS.map(opt => (
                            <SelectItem key={opt} value={opt} onSelect={(v) => { setUnitForm(f => ({ ...f, maintenanceStatus: v })); setUnitMaintenanceOpen(false); }}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </>
                    )}
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 w-full min-w-0">
                <div className="min-w-0 flex flex-col">
                  <Label className="block text-sm font-medium text-foreground mb-2">Last Maintenance</Label>
                  <Input
                    type="date"
                    value={unitForm.lastMaintenance}
                    onChange={(e) => setUnitForm(f => ({ ...f, lastMaintenance: e.target.value }))}
                    className="w-full min-w-0 rounded-xl border-border focus:border-secondary focus:ring-secondary/20"
                  />
                </div>
                <div className="min-w-0 flex flex-col">
                  <Label className="block text-sm font-medium text-foreground mb-2">Next Maintenance</Label>
                  <Input
                    type="date"
                    value={unitForm.nextMaintenance}
                    onChange={(e) => setUnitForm(f => ({ ...f, nextMaintenance: e.target.value }))}
                    className="w-full min-w-0 rounded-xl border-border focus:border-secondary focus:ring-secondary/20"
                  />
                </div>
              </div>
              <div className="w-full min-w-0">
                <Label className="block text-sm font-medium text-foreground mb-2">Maintenance Notes (optional)</Label>
                <Input
                  value={unitForm.maintenanceNotes}
                  onChange={(e) => setUnitForm(f => ({ ...f, maintenanceNotes: e.target.value }))}
                  placeholder="e.g. Routine engine check"
                  className="w-full min-w-0 rounded-xl border-border focus:border-secondary focus:ring-secondary/20"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-secondary/20 border-t border-border flex justify-start gap-3 rounded-b-2xl">
              <button type="button" onClick={handleSaveUnit} className="px-5 py-2.5 rounded-xl font-medium text-sm text-white bg-secondary hover:bg-secondary-hover focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background">
                {editingUnit ? 'Save Changes' : 'Add Unit'}
              </button>
              <button type="button" onClick={() => setUnitDialogOpen(false)} className="px-4 py-2.5 rounded-xl font-medium text-sm text-foreground bg-card border border-border hover:bg-secondary/30 focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background">
                Cancel
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Personnel Add/Edit Dialog */}
        <Dialog open={personnelDialogOpen} onOpenChange={setPersonnelDialogOpen}>
          <DialogContent className="w-full p-0 overflow-hidden rounded-2xl shadow-2xl border border-border">
            <div className="bg-gradient-to-br from-secondary to-secondary-hover px-6 py-5">
              <DialogTitle className="text-lg font-semibold text-white m-0">
                {editingPersonnel ? 'Edit Personnel' : 'Add Personnel'}
              </DialogTitle>
              <DialogDescription className="!text-white/80 mt-1 text-sm">
                {editingPersonnel ? 'Update personnel details below.' : 'Enter the new personnel details.'}
              </DialogDescription>
            </div>
            <div className="p-6 space-y-4 w-full min-w-0 bg-card">
              <div className="w-full min-w-0">
                <Label className="block text-sm font-medium text-foreground mb-2">Name</Label>
                <Input
                  value={personnelForm.name}
                  onChange={(e) => setPersonnelForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. SFO3 Ramon Cruz"
                  className="w-full min-w-0 rounded-xl border-border focus:border-secondary focus:ring-secondary/20"
                />
              </div>
              <div className="w-full min-w-0">
                <Label className="block text-sm font-medium text-foreground mb-2">Role</Label>
                <Input
                  value={personnelForm.role}
                  onChange={(e) => setPersonnelForm(f => ({ ...f, role: e.target.value }))}
                  placeholder="e.g. Fire Officer, Patrol Officer"
                  className="w-full min-w-0 rounded-xl border-border focus:border-secondary focus:ring-secondary/20"
                />
              </div>
              <div className="w-full min-w-0">
                <Label className="block text-sm font-medium text-foreground mb-2">Unit</Label>
                <Select value={personnelForm.unit} onValueChange={(v) => setPersonnelForm(f => ({ ...f, unit: v }))}>
                  {({ value }) => (
                    <>
                      <SelectTrigger
                        isOpen={personnelUnitOpen}
                        onClick={() => setPersonnelUnitOpen(o => !o)}
                        className="w-full min-w-0 px-4 py-3 rounded-xl border-2 border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary"
                      >
                        <SelectValue placeholder="Select unit" value={value} options={[{ value: '', label: 'Select unit' }, ...deptUnits.map(u => ({ value: u.id, label: u.name }))]} />
                      </SelectTrigger>
                      <SelectContent isOpen={personnelUnitOpen} className="rounded-xl border-2 border-border shadow-lg bg-card">
                        <SelectItem value="" onSelect={(v) => { setPersonnelForm(f => ({ ...f, unit: v })); setPersonnelUnitOpen(false); }}>Select unit</SelectItem>
                        {deptUnits.map(u => (
                          <SelectItem key={u.id} value={u.id} onSelect={(v) => { setPersonnelForm(f => ({ ...f, unit: v })); setPersonnelUnitOpen(false); }}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </>
                  )}
                </Select>
              </div>
              <div className="w-full min-w-0">
                <Label className="block text-sm font-medium text-foreground mb-2">Status</Label>
                <Select value={personnelForm.status} onValueChange={(v) => setPersonnelForm(f => ({ ...f, status: v }))}>
                  {({ value }) => (
                    <>
                      <SelectTrigger
                        isOpen={personnelStatusOpen}
                        onClick={() => setPersonnelStatusOpen(o => !o)}
                        className="w-full min-w-0 px-4 py-3 rounded-xl border-2 border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary"
                      >
                        <SelectValue value={value} options={PERSONNEL_STATUS_OPTIONS.map(o => ({ value: o, label: o }))} />
                      </SelectTrigger>
                      <SelectContent isOpen={personnelStatusOpen} className="rounded-xl border-2 border-border shadow-lg bg-card">
                        {PERSONNEL_STATUS_OPTIONS.map(opt => (
                          <SelectItem key={opt} value={opt} onSelect={(v) => { setPersonnelForm(f => ({ ...f, status: v })); setPersonnelStatusOpen(false); }}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </>
                  )}
                </Select>
              </div>
              <div className="w-full min-w-0">
                <Label className="block text-sm font-medium text-foreground mb-2">Special Skills (comma-separated)</Label>
                <Input
                  value={personnelForm.specialSkills}
                  onChange={(e) => setPersonnelForm(f => ({ ...f, specialSkills: e.target.value }))}
                  placeholder="e.g. Search & Rescue, First Aid"
                  className="w-full min-w-0 rounded-xl border-border focus:border-secondary focus:ring-secondary/20"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-secondary/20 border-t border-border flex justify-start gap-3 rounded-b-2xl">
              <button type="button" onClick={handleSavePersonnel} className="px-5 py-2.5 rounded-xl font-medium text-sm text-white bg-secondary hover:bg-secondary-hover focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background">
                {editingPersonnel ? 'Save Changes' : 'Add Personnel'}
              </button>
              <button type="button" onClick={() => setPersonnelDialogOpen(false)} className="px-4 py-2.5 rounded-xl font-medium text-sm text-foreground bg-card border border-border hover:bg-secondary/30 focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background">
                Cancel
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
