import { Layout } from '@/presentation/components/layout/Layout';
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
import {
  ArrowLeft,
  Truck,
  Users as UsersIcon,
  ClipboardList,
  Wrench,
  Award,
  AlertCircle,
  CheckCircle,
  Plus,
  Pencil,
  Trash2,
  Building2,
  Phone,
  Activity,
  LayoutGrid,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { departments, units as initialUnits, personnel as initialPersonnel, incidents } from '@/data/mock/mockData';
import Swal from 'sweetalert2';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';

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

  const { theme } = useTheme();
  const isLight = theme === 'light';
  const panelClass = `rounded-2xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'}`;
  const headerClass = `flex items-center gap-3 px-4 py-3 border-b ${isLight ? 'border-gray-200/80 bg-gray-50/50' : 'border-white/10 bg-white/5'}`;
  const iconBoxClass = (accent = 'primary') =>
    `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100' : 'neumorphic-dark-inset bg-white/10'} ${
      accent === 'primary' ? 'text-primary' : accent === 'secondary' ? 'text-secondary' : 'text-foreground'
    }`;
  const iconSmClass = (accent = 'primary') =>
    `w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100' : 'neumorphic-dark-inset bg-white/10'} ${accent === 'primary' ? 'text-primary' : 'text-foreground'}`;

  if (!department) {
    return (
      <Layout>
        <div className="p-8">
          <p className="text-foreground">Department not found</p>
          <Button variant="outline" className="mt-4 rounded-xl" onClick={() => navigate('/departments')}>Back to Departments</Button>
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
        <div className={`mb-6 rounded-2xl border overflow-hidden ${isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'}`}>
          <div className="flex items-center gap-4 p-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/departments')}
              className={`gap-2 rounded-xl ${isLight ? 'hover:bg-gray-100 text-foreground' : 'hover:bg-white/10 text-foreground'}`}
            >
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'}`}>
                <ArrowLeft className="w-4 h-4" strokeWidth={2} />
              </span>
              Back to Departments
            </Button>
          </div>
        </div>

        <div className={`mb-6 rounded-2xl border overflow-hidden ${isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'}`}>
          <div className="p-6">
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">{department.name}</h1>
            <p className="text-muted mt-1">{department.type} Response Department</p>
          </div>
        </div>

        <div className={`mb-6 ${panelClass}`}>
          <div className={`${headerClass} rounded-t-2xl`}>
            <span className={iconBoxClass('primary')}>
              <LayoutGrid className="w-5 h-5" strokeWidth={2} />
            </span>
            <span className="font-medium text-foreground">Overview</span>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className={`rounded-xl p-4 ${isLight ? 'bg-gray-50/80' : 'bg-white/5'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className={iconSmClass('primary')}>
                    <Building2 className="w-4 h-4" strokeWidth={2} />
                  </span>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted">Department Type</p>
                </div>
                <p className="font-semibold text-foreground">{department.type}</p>
              </div>
              <div className={`rounded-xl p-4 ${isLight ? 'bg-gray-50/80' : 'bg-white/5'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className={iconSmClass('primary')}>
                    <UsersIcon className="w-4 h-4" strokeWidth={2} />
                  </span>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted">Officer-in-Charge</p>
                </div>
                <p className="font-semibold text-foreground">Chief Roberto Santos</p>
                <p className="text-xs text-muted mt-0.5 flex items-center gap-1">
                  <Phone className="w-3 h-3" strokeWidth={2} />
                  +63 917 123 4567
                </p>
              </div>
              <div className={`rounded-xl p-4 ${isLight ? 'bg-gray-50/80' : 'bg-white/5'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className={iconSmClass('primary')}>
                    <Activity className="w-4 h-4" strokeWidth={2} />
                  </span>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted">Status</p>
                </div>
                <Badge className="bg-severity-resolved/20 text-severity-resolved border-severity-resolved/40 rounded-lg">Available</Badge>
              </div>
              <div className={`rounded-xl p-4 ${isLight ? 'bg-gray-50/80' : 'bg-white/5'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className={iconSmClass('primary')}>
                    <Truck className="w-4 h-4" strokeWidth={2} />
                  </span>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted">Operational Units</p>
                </div>
                <p className="font-semibold text-primary">
                  {deptUnits.filter(u => u.maintenanceStatus === 'Operational').length}/{deptUnits.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="units" className="w-full">
          <div className={`mb-4 rounded-xl p-1 ${isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'}`}>
            <TabsList className={`grid w-full max-w-md grid-cols-3 rounded-xl border-0 bg-transparent p-0 gap-1 ${isLight ? '' : ''}`}>
              <TabsTrigger value="units" className="rounded-lg">Units</TabsTrigger>
              <TabsTrigger value="personnel" className="rounded-lg">Personnel</TabsTrigger>
              <TabsTrigger value="tasks" className="rounded-lg">Active Tasks</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="units" className="mt-6">
            <div className={panelClass}>
              <div className={headerClass}>
                <span className={iconBoxClass('primary')}>
                  <Truck className="w-5 h-5" strokeWidth={2} />
                </span>
                <span className="font-medium text-foreground flex-1">Department Units & Resources</span>
                <Button onClick={openAddUnit} className="rounded-xl gap-2 bg-primary hover:bg-primary-hover text-white font-medium" size="default">
                  <Plus className="w-4 h-4" strokeWidth={2} />
                  Add Unit
                </Button>
              </div>
              <div className="p-4 space-y-3">
                {deptUnits.map((unit) => (
                  <div
                    key={unit.id}
                    className={`rounded-xl border p-4 transition-all duration-200 ${isLight ? 'bg-gray-50/80 border-gray-200/80 hover:border-gray-300' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 flex items-center gap-3">
                        <span className={iconSmClass('primary')}>
                          <Truck className="w-4 h-4" strokeWidth={2} />
                        </span>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-semibold text-foreground">{unit.name}</p>
                            {unit.maintenanceStatus === 'Under Maintenance' && (
                              <span className={iconSmClass()} title="Under Maintenance">
                                <Wrench className="w-3.5 h-3.5 text-amber-500" strokeWidth={2} />
                              </span>
                            )}
                            {unit.maintenanceStatus === 'Out of Service' && (
                              <span className={iconSmClass()} title="Out of Service">
                                <AlertCircle className="w-3.5 h-3.5 text-primary" strokeWidth={2} />
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted">{unit.type}</p>
                          {unit.assignedIncident && (
                            <p className="text-xs text-primary mt-1">
                              Assigned: <Button variant="link" className="p-0 h-auto text-xs text-primary" onClick={(e) => { e.stopPropagation(); navigate(`/incidents/${unit.assignedIncident}`); }}>
                                {unit.assignedIncident}
                              </Button>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`${getStatusColor(unit.status)} rounded-lg`}>{unit.status}</Badge>
                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 min-w-[36px] rounded-lg text-foreground/80 hover:bg-primary/15 hover:text-primary" onClick={(e) => openEditUnit(unit, e)} title="Edit unit" aria-label="Edit unit">
                          <Pencil className="w-4 h-4" strokeWidth={2} />
                        </Button>
                        <Button variant="ghost" size="sm" className={`h-9 w-9 p-0 min-w-[36px] rounded-lg ${isLight ? 'text-foreground/80 hover:bg-red-500/10 hover:text-red-600' : 'text-foreground/80 hover:bg-red-500/20 hover:text-red-400'}`} onClick={(e) => handleDeleteUnit(unit.id, e)} title="Delete unit" aria-label="Delete unit">
                          <Trash2 className="w-4 h-4" strokeWidth={2} />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className={`rounded-lg p-3 ${isLight ? 'bg-white/80 border border-gray-200/80' : 'bg-white/5 border border-white/10'}`}>
                        <p className="text-muted mb-0.5">Last Maintenance</p>
                        <p className="font-medium text-foreground">{unit.lastMaintenance || '—'}</p>
                      </div>
                      <div className={`rounded-lg p-3 ${isLight ? 'bg-white/80 border border-gray-200/80' : 'bg-white/5 border border-white/10'}`}>
                        <p className="text-muted mb-0.5">Next Scheduled</p>
                        <p className="font-medium text-foreground">{unit.nextMaintenance || '—'}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {deptUnits.length === 0 && (
                  <p className="text-center text-muted py-8">No units yet. Add one to get started.</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="personnel" className="mt-6">
            <div className={panelClass}>
              <div className={headerClass}>
                <span className={iconBoxClass('primary')}>
                  <UsersIcon className="w-5 h-5" strokeWidth={2} />
                </span>
                <span className="font-medium text-foreground flex-1">Department Personnel</span>
                <Button onClick={openAddPersonnel} className="rounded-xl gap-2 bg-primary hover:bg-primary-hover text-white font-medium" size="default">
                  <Plus className="w-4 h-4" strokeWidth={2} />
                  Add Personnel
                </Button>
              </div>
              <div className="p-4 space-y-3">
                {deptPersonnel.map((person, index) => (
                  <div
                    key={person.id || index}
                    className={`rounded-xl border p-4 transition-all duration-200 ${isLight ? 'bg-gray-50/80 border-gray-200/80 hover:border-gray-300' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className={iconSmClass('primary')}>
                          <UsersIcon className="w-4 h-4" strokeWidth={2} />
                        </span>
                        <div>
                          <p className="font-semibold text-foreground">{person.name}</p>
                          <p className="text-sm text-muted">{person.role}</p>
                          <p className="text-xs text-muted mt-0.5">Unit: {person.unit}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`${getStatusColor(person.status)} rounded-lg`}>{person.status}</Badge>
                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 min-w-[36px] rounded-lg text-foreground/80 hover:bg-primary/15 hover:text-primary" onClick={(e) => openEditPersonnel(person, e)} title="Edit personnel" aria-label="Edit personnel">
                          <Pencil className="w-4 h-4" strokeWidth={2} />
                        </Button>
                        <Button variant="ghost" size="sm" className={`h-9 w-9 p-0 min-w-[36px] rounded-lg ${isLight ? 'text-foreground/80 hover:bg-red-500/10 hover:text-red-600' : 'text-foreground/80 hover:bg-red-500/20 hover:text-red-400'}`} onClick={(e) => handleDeletePersonnel(person, e)} title="Remove personnel" aria-label="Remove personnel">
                          <Trash2 className="w-4 h-4" strokeWidth={2} />
                        </Button>
                      </div>
                    </div>

                    {person.certifications && person.certifications.length > 0 && (
                      <div className="mb-3">
                        <Label className="text-xs text-muted mb-2 flex items-center gap-2">
                          <span className={iconSmClass()}>
                            <Award className="w-3.5 h-3.5" strokeWidth={2} />
                          </span>
                          Certifications
                        </Label>
                        <div className="space-y-2">
                          {person.certifications.map((cert, idx) => (
                            <div key={idx} className={`flex items-center justify-between p-3 rounded-lg ${isLight ? 'bg-white/80 border border-gray-200/80' : 'bg-white/5 border border-white/10'}`}>
                              <div className="flex-1">
                                <p className="text-xs font-medium text-foreground">{cert.name}</p>
                                <p className="text-xs text-muted">Valid until: {cert.validUntil}</p>
                              </div>
                              {getCertificationStatus(cert.status)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {person.specialSkills && person.specialSkills.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted mb-2 block">Special Skills</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {person.specialSkills.map((skill, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30 rounded-lg">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {deptPersonnel.length === 0 && (
                  <p className="text-center text-muted py-8">No personnel yet. Add one to get started.</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="mt-6">
            <div className={panelClass}>
              <div className={headerClass}>
                <span className={iconBoxClass('primary')}>
                  <ClipboardList className="w-5 h-5" strokeWidth={2} />
                </span>
                <span className="font-medium text-foreground">Active Tasks</span>
              </div>
              <div className="p-4 space-y-3">
                {deptIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    className={`rounded-xl border p-4 cursor-pointer transition-all duration-200 ${isLight ? 'bg-gray-50/80 border-gray-200/80 hover:bg-gray-100/80 hover:border-gray-300' : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'}`}
                    onClick={() => navigate(`/incidents/${incident.id}`)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-semibold text-foreground">{incident.id}</p>
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 rounded-lg">
                        {incident.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted mb-1">{incident.description}</p>
                    <p className="text-xs text-muted">Barangay: {incident.barangay}</p>
                  </div>
                ))}
                {deptIncidents.length === 0 && (
                  <div className="text-center py-12">
                    <span className={`inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-4 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-severity-resolved' : 'neumorphic-dark-inset bg-white/10 text-severity-resolved'}`}>
                      <CheckCircle className="w-7 h-7" strokeWidth={2} />
                    </span>
                    <p className="text-muted">No active tasks at this time</p>
                  </div>
                )}
              </div>
            </div>
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
            <div className={`px-6 py-4 border-t flex justify-between items-center gap-3 rounded-b-2xl ${isLight ? 'bg-gray-50/90 border-gray-200' : 'bg-white/5 border-border'}`}>
              <Button type="button" onClick={handleSaveUnit} className="rounded-xl bg-primary hover:bg-primary-hover text-white font-medium px-5 py-2.5">
                {editingUnit ? 'Save Changes' : 'Add Unit'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setUnitDialogOpen(false)} className="rounded-xl font-medium px-5 py-2.5 text-foreground hover:bg-muted/50 hover:text-foreground">
                Cancel
              </Button>
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
            <div className={`px-6 py-4 border-t flex justify-between items-center gap-3 rounded-b-2xl ${isLight ? 'bg-gray-50/90 border-gray-200' : 'bg-white/5 border-border'}`}>
              <Button type="button" onClick={handleSavePersonnel} className="rounded-xl bg-primary hover:bg-primary-hover text-white font-medium px-5 py-2.5">
                {editingPersonnel ? 'Save Changes' : 'Add Personnel'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setPersonnelDialogOpen(false)} className="rounded-xl font-medium px-5 py-2.5 text-foreground hover:bg-muted/50 hover:text-foreground">
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
