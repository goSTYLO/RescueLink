import { Layout } from '@/presentation/components/layout/Layout';
import { Badge } from '@/presentation/components/ui/Badge';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Label } from '@/presentation/components/ui/Label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/presentation/components/ui/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/Select';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '@/data/api/departments.api';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import {
  Flame,
  Shield,
  HeartPulse,
  MountainSnow,
  Building2,
  PlusCircle,
  PenLine,
  Trash2,
  LayoutGrid,
  Network,
  AlertCircle,
  Users,
  ChevronRight,
} from 'lucide-react';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';

const DEPARTMENT_TYPES = [
  { value: 'Fire', label: 'Fire' },
  { value: 'Police', label: 'Police' },
  { value: 'Medical', label: 'Medical' },
  { value: 'Disaster', label: 'Disaster' },
  { value: 'Community', label: 'Community' },
];

export function DepartmentsPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [departments, setDepartments] = useState([]);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [typeSelectOpen, setTypeSelectOpen] = useState(false);
  useEffect(() => {
    if (!dialogOpen) setTypeSelectOpen(false);
  }, [dialogOpen]);

  const mapDepartment = (dept) => ({
    id: dept.code || String(dept.department_id),
    departmentId: dept.department_id,
    name: dept.name,
    type: dept.type,
    color: dept.color || 'gray',
    statusRaw: dept.status || 'active',
    unitsCount: Number(dept.units_count ?? dept.total_units ?? 0),
    availableUnits: Number(dept.available_units ?? 0),
    personnelCount: Number(dept.personnel_count ?? 0),
    activeTaskCount: Number(dept.active_task_count ?? 0),
    activeIncidents: Number(dept.active_incidents ?? 0),
  });

  const loadDepartments = async () => {
    setIsLoadingDepartments(true);
    try {
      const rows = await getDepartments();
      setDepartments(Array.isArray(rows) ? rows.map(mapDepartment) : []);
    } catch (error) {
      setDepartments([]);
      Swal.fire({
        icon: 'error',
        title: 'Could not load departments',
        text: error.message || 'Please try again later.',
        confirmButtonColor: '#134178',
      });
    } finally {
      setIsLoadingDepartments(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);
  const [form, setForm] = useState({
    name: '',
    type: 'Fire',
    color: 'red',
    unitsCount: 0,
    personnelCount: 0,
    activeTaskCount: 0,
  });

  const heroCardClass = `rounded-3xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80 border-gray-200/80 shadow-[8px_8px_24px_rgba(209,213,219,0.5),-8px_-8px_24px_rgba(255,255,255,0.9)]' : 'glass neumorphic-dark bg-card/60 border-white/10 shadow-[8px_8px_24px_rgba(0,0,0,0.35),-6px_-6px_20px_rgba(19,65,120,0.2)]'}`;
  const heroIconClass = `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'}`;
  const panelClass = `rounded-2xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'}`;
  const headerClass = `flex items-center gap-3 px-4 py-3 border-b ${isLight ? 'border-gray-200/80 bg-gray-50/50' : 'border-white/10 bg-white/5'}`;
  const iconBoxClass = (accent = 'primary') =>
    `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100' : 'neumorphic-dark-inset bg-white/10'} ${
      accent === 'primary' ? 'text-primary' : accent === 'secondary' ? 'text-secondary' : 'text-foreground'
    }`;

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

  const getStatusColor = (status) => {
    switch (status) {
      case 'Available': return 'bg-severity-resolved/20 text-severity-resolved border-severity-resolved/40';
      case 'Partially Busy': return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'Critical Load': return 'bg-primary/20 text-primary border-primary/50';
      default: return 'bg-card text-muted border-border';
    }
  };

  const totalActiveIncidents = departments.reduce((sum, dept) => sum + (dept.activeIncidents || 0), 0);
  const totalAvailableUnits = departments.reduce((sum, dept) => sum + (dept.availableUnits || 0), 0);

  const openAddDialog = () => {
    setEditingDept(null);
    setForm({ name: '', type: 'Fire', color: 'red', unitsCount: 0, personnelCount: 0, activeTaskCount: 0 });
    setDialogOpen(true);
  };

  const openEditDialog = (dept, e) => {
    e?.stopPropagation();
    setEditingDept(dept);
    setForm({
      name: dept.name,
      type: dept.type,
      color: dept.color || 'red',
      unitsCount: dept.unitsCount ?? 0,
      personnelCount: dept.personnelCount ?? 0,
      activeTaskCount: dept.activeTaskCount ?? 0,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Swal.fire({ icon: 'error', title: 'Validation failed', text: 'Please enter a department name.', confirmButtonColor: '#134178' });
      return;
    }
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        color: form.color,
        status: 'active',
      };

      if (editingDept) {
        await updateDepartment(editingDept.departmentId, payload);
        Swal.fire({ icon: 'success', title: 'Department updated', text: 'Department details have been saved.', timer: 2000, showConfirmButton: false, timerProgressBar: true });
      } else {
        await createDepartment(payload);
        Swal.fire({ icon: 'success', title: 'Department added', text: 'The new department has been added.', timer: 2000, showConfirmButton: false, timerProgressBar: true });
      }
      await loadDepartments();
      setDialogOpen(false);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: editingDept ? 'Update failed' : 'Create failed',
        text: error.message || 'Please try again later.',
        confirmButtonColor: '#134178',
      });
    }
  };

  const handleDelete = (deptId, e) => {
    e?.stopPropagation();
    Swal.fire({
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
        const target = departments.find((d) => d.id === deptId);
        if (!target?.departmentId) return;
        deleteDepartment(target.departmentId)
          .then(() => loadDepartments())
          .then(() => {
            Swal.fire({ icon: 'success', title: 'Department deleted', text: 'The department has been removed.', timer: 2000, showConfirmButton: false, timerProgressBar: true });
          })
          .catch((error) => {
            Swal.fire({ icon: 'error', title: 'Delete failed', text: error.message || 'Please try again later.', confirmButtonColor: '#134178' });
          });
      }
    });
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className={`${heroCardClass} mb-6`}>
          <div className="p-8 flex flex-wrap items-center gap-6">
            <div className={heroIconClass}>
              <Network className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Department Management</h1>
              <p className="text-muted mt-1">Centralized view of all emergency departments</p>
            </div>
          </div>
        </div>

        {/* Summary – glass + neumorphism, modern stat cards */}
        <div className={`mb-6 ${panelClass}`}>
          <div className={headerClass}>
            <div className={iconBoxClass('primary')}>
              <LayoutGrid className="w-5 h-5" strokeWidth={2} />
            </div>
            <h2 className="text-base font-semibold text-foreground">Overview</h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className={`flex items-center gap-4 p-4 rounded-xl border ${isLight ? 'bg-gray-50/80 border-gray-200' : 'bg-white/5 border-border'}`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isLight ? 'bg-primary/15' : 'bg-primary/20'}`}>
                  <AlertCircle className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted uppercase tracking-wider">Total Active Incidents</p>
                  <p className="text-2xl font-bold text-foreground mt-0.5">{totalActiveIncidents}</p>
                </div>
              </div>
              <div className={`flex items-center gap-4 p-4 rounded-xl border ${isLight ? 'bg-gray-50/80 border-gray-200' : 'bg-white/5 border-border'}`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isLight ? 'bg-secondary/20' : 'bg-secondary/30'}`}>
                  <Users className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted uppercase tracking-wider">Total Available Units</p>
                  <p className="text-2xl font-bold text-foreground mt-0.5">{totalAvailableUnits}</p>
                </div>
              </div>
              <div className={`flex items-center gap-4 p-4 rounded-xl border ${isLight ? 'bg-gray-50/80 border-gray-200' : 'bg-white/5 border-border'}`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isLight ? 'bg-severity-resolved/20' : 'bg-severity-resolved/30'}`}>
                  <Shield className="w-6 h-6 text-severity-resolved" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted uppercase tracking-wider">City-wide Alert Level</p>
                  <Badge className="mt-1.5 rounded-lg bg-severity-resolved/20 text-severity-resolved border-severity-resolved/40 font-medium">Normal</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 flex justify-end">
          <Button
            type="button"
            onClick={openAddDialog}
            className="gap-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium shadow-sm hover:shadow-md transition-all duration-200 px-5 py-2.5"
          >
            <PlusCircle className="w-5 h-5" strokeWidth={2} />
            Add Department
          </Button>
        </div>

        {/* Department cards – glass + neumorphism */}
        {isLoadingDepartments && <p className="text-sm text-muted mb-4">Loading departments...</p>}
        {!isLoadingDepartments && departments.length === 0 && <p className="text-sm text-muted mb-4">No departments found.</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept) => {
            const Icon = getDepartmentIcon(dept.type);
            const stats = getDepartmentStats(dept);
            const totalUnitsDisplay = dept.unitsCount ?? 0;
            const availableFromUnits = stats.availableUnits;

            return (
              <div
                key={dept.id}
                className={`${panelClass} cursor-pointer hover:shadow-lg transition-all duration-300`}
                onClick={() => navigate(`/departments/${dept.id}`)}
              >
                <div className={headerClass}>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'
                  }`}>
                    <Icon className="w-5 h-5" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-foreground truncate" title={dept.name}>{dept.name}</h3>
                    <p className="text-sm text-muted truncate">{dept.type} Response</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 min-w-[36px] rounded-lg text-foreground/80 hover:bg-primary/15 hover:text-primary"
                      onClick={(e) => openEditDialog(dept, e)}
                      title="Edit"
                      aria-label="Edit department"
                    >
                      <PenLine className="w-4 h-4" strokeWidth={2} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-9 w-9 p-0 min-w-[36px] rounded-lg text-foreground/80 ${isLight ? 'hover:bg-red-500/10 hover:text-red-600' : 'hover:bg-red-500/20 hover:text-red-400'}`}
                      onClick={(e) => handleDelete(dept.id, e)}
                      title="Delete"
                      aria-label="Delete department"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={2} />
                    </Button>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted">Status</span>
                    <Badge className={`${getStatusColor(stats.status)} rounded-lg px-2.5 py-1 text-xs font-medium`}>{stats.status}</Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">Active Incidents</span>
                      <span className="font-semibold text-foreground">{stats.activeIncidents}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">Units</span>
                      <span className="font-semibold text-primary">{`${availableFromUnits}/${Math.max(totalUnitsDisplay, 1)}`}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">Personnel</span>
                      <span className="font-semibold text-foreground">{dept.personnelCount ?? stats.totalUnits}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">Active Tasks</span>
                      <span className="font-semibold text-foreground">{dept.activeTaskCount ?? 0}</span>
                    </div>
                  </div>
                  <Button
                    className="w-full rounded-xl gap-2 bg-primary hover:bg-primary-hover text-white font-medium"
                    onClick={(e) => { e.stopPropagation(); navigate(`/departments/${dept.id}`); }}
                  >
                    View Department
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={`max-w-lg w-full !p-0 overflow-visible rounded-2xl border-0 shadow-2xl ${isLight ? 'bg-white border border-gray-200/90 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)]' : 'bg-card border border-white/20 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)]'}`}>
          <div className={`px-6 py-5 rounded-t-2xl ${isLight ? 'bg-gradient-to-br from-primary via-primary to-primary-hover' : 'bg-gradient-to-br from-primary/95 via-primary to-primary-hover'}`}>
            <DialogTitle className="text-lg font-semibold text-white m-0 tracking-tight">
              {editingDept ? 'Edit Department' : 'Add Department'}
            </DialogTitle>
            <DialogDescription className="!text-white/90 mt-1 text-sm">
              {editingDept ? 'Update department details below.' : 'Enter the new department details.'}
            </DialogDescription>
          </div>
          <div className={`p-6 space-y-5 w-full min-w-0 overflow-visible ${isLight ? 'bg-white' : 'bg-card'}`}>
            <div className="w-full min-w-0">
              <Label className="block text-sm font-medium text-foreground mb-2">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Bureau of Fire Protection"
                className={`w-full rounded-xl border-2 py-2.5 transition-colors focus:ring-2 focus:ring-primary/30 focus:border-primary ${isLight ? 'border-gray-200 hover:border-gray-300' : 'border-border bg-white/5 hover:border-white/20'}`}
              />
            </div>
            <div className="w-full min-w-0">
              <Label className="block text-sm font-medium text-foreground mb-2">Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))} open={typeSelectOpen} onOpenChange={setTypeSelectOpen}>
                {({ value, dropdownRect }) => (
                  <>
                    <SelectTrigger isOpen={typeSelectOpen} onClick={() => setTypeSelectOpen((o) => !o)} className={`w-full rounded-xl py-2.5 border-2 transition-colors ${isLight ? 'bg-gray-50/80 border-gray-200 hover:border-gray-300' : 'bg-white/5 border-border hover:border-white/20'}`}>
                      <SelectValue placeholder="Select type" value={value} options={DEPARTMENT_TYPES} />
                    </SelectTrigger>
                    <SelectContent isOpen={typeSelectOpen} dropdownRect={dropdownRect} className="rounded-xl border-2 border-border shadow-xl bg-card py-1">
                      {DEPARTMENT_TYPES.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} onSelect={(v) => { setForm((f) => ({ ...f, type: v })); setTypeSelectOpen(false); }}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </>
                )}
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4 w-full min-w-0">
              <div className="min-w-0 flex flex-col">
                <Label className="block text-sm font-medium text-foreground mb-2">Units</Label>
                <Input type="number" min={0} value={form.unitsCount} onChange={(e) => setForm((f) => ({ ...f, unitsCount: parseInt(e.target.value, 10) || 0 }))} placeholder="0" className={`w-full rounded-xl border-2 py-2.5 focus:ring-2 focus:ring-primary/30 focus:border-primary ${isLight ? 'border-gray-200' : 'border-border bg-white/5'}`} />
              </div>
              <div className="min-w-0 flex flex-col">
                <Label className="block text-sm font-medium text-foreground mb-2">Personnel</Label>
                <Input type="number" min={0} value={form.personnelCount} onChange={(e) => setForm((f) => ({ ...f, personnelCount: parseInt(e.target.value, 10) || 0 }))} placeholder="0" className={`w-full rounded-xl border-2 py-2.5 focus:ring-2 focus:ring-primary/30 focus:border-primary ${isLight ? 'border-gray-200' : 'border-border bg-white/5'}`} />
              </div>
              <div className="min-w-0 flex flex-col">
                <Label className="block text-sm font-medium text-foreground mb-2">Active Tasks</Label>
                <Input type="number" min={0} value={form.activeTaskCount} onChange={(e) => setForm((f) => ({ ...f, activeTaskCount: parseInt(e.target.value, 10) || 0 }))} placeholder="0" className={`w-full rounded-xl border-2 py-2.5 focus:ring-2 focus:ring-primary/30 focus:border-primary ${isLight ? 'border-gray-200' : 'border-border bg-white/5'}`} />
              </div>
            </div>
          </div>
          <div className={`px-6 py-4 border-t flex justify-between items-center gap-3 rounded-b-2xl ${isLight ? 'bg-gray-50/90 border-t border-gray-200' : 'bg-white/[0.03] border-t border-border'}`}>
            <Button type="button" onClick={handleSave} className="rounded-xl bg-primary hover:bg-primary-hover text-white font-medium px-5 py-2.5 shadow-md hover:shadow-lg transition-all duration-200">
              {editingDept ? 'Save Changes' : 'Add Department'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl font-medium px-5 py-2.5 border-2 text-foreground hover:bg-muted/50 hover:text-foreground transition-all duration-200">
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
