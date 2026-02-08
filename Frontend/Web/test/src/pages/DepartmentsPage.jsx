import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../components/ui/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { departments as initialDepartments, units, incidents } from '../data/mockData';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { Flame, Shield, Heart, AlertTriangle, Users, Plus, Pencil, Trash2 } from 'lucide-react';

const DEPARTMENT_TYPES = [
  { value: 'Fire', label: 'Fire' },
  { value: 'Police', label: 'Police' },
  { value: 'Medical', label: 'Medical' },
  { value: 'Disaster', label: 'Disaster' },
  { value: 'Community', label: 'Community' },
];

export function DepartmentsPage() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState(
    initialDepartments.map((d) => ({
      ...d,
      personnelCount: (units[d.id] || []).length,
      activeTaskCount: (units[d.id] || []).filter((u) => u.activeTaskCount > 0).length,
    }))
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [typeSelectOpen, setTypeSelectOpen] = useState(false);
  useEffect(() => { if (!dialogOpen) setTypeSelectOpen(false); }, [dialogOpen]);
  const [form, setForm] = useState({
    name: '',
    type: 'Fire',
    color: 'red',
    unitsCount: 0,
    personnelCount: 0,
    activeTaskCount: 0,
  });

  const getDepartmentIcon = (type) => {
    switch (type) {
      case 'Fire': return Flame;
      case 'Police': return Shield;
      case 'Medical': return Heart;
      case 'Disaster': return AlertTriangle;
      default: return Users;
    }
  };

  const getDepartmentStats = (dept) => {
    const deptUnits = units[dept.id] || [];
    const activeIncidents = incidents.filter((i) => i.status === 'In Progress').length;
    const availableUnits = deptUnits.filter((u) => u.status === 'Available').length;
    const totalUnits = deptUnits.length || (dept.unitsCount ?? 0);

    let status = 'Available';
    if (totalUnits === 0) status = 'Available';
    else if (availableUnits === 0) status = 'Critical Load';
    else if (availableUnits < totalUnits / 2) status = 'Partially Busy';

    return {
      activeIncidents,
      availableUnits: totalUnits > 0 ? availableUnits : 0,
      totalUnits: totalUnits || 1,
      status,
    };
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Available': return 'bg-severity-resolved/20 text-severity-resolved border-emerald-500/40';
      case 'Partially Busy': return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'Critical Load': return 'bg-primary/20 text-primary border-primary/50';
      default: return 'bg-card text-muted border-[rgba(19,65,120,0.35)]';
    }
  };

  const totalActiveIncidents = incidents.filter((i) => i.status === 'In Progress').length;
  const totalAvailableUnits = Object.values(units).flat().filter((u) => u.status === 'Available').length;

  const openAddDialog = () => {
    setEditingDept(null);
    setForm({
      name: '',
      type: 'Fire',
      color: 'red',
      unitsCount: 0,
      personnelCount: 0,
      activeTaskCount: 0,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (dept, e) => {
    e?.stopPropagation();
    setEditingDept(dept);
    const deptUnits = units[dept.id] || [];
    setForm({
      name: dept.name,
      type: dept.type,
      color: dept.color || 'red',
      unitsCount: deptUnits.length,
      personnelCount: dept.personnelCount ?? deptUnits.length,
      activeTaskCount: dept.activeTaskCount ?? deptUnits.reduce((s, u) => s + (u.activeTaskCount || 0), 0),
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      Swal.fire({ icon: 'error', title: 'Validation failed', text: 'Please enter a department name.', confirmButtonColor: '#134178' });
      return;
    }

    if (editingDept) {
      setDepartments((prev) =>
        prev.map((d) =>
          d.id === editingDept.id
            ? {
                ...d,
                name: form.name.trim(),
                type: form.type,
                color: form.color,
                unitsCount: form.unitsCount,
                personnelCount: form.personnelCount,
                activeTaskCount: form.activeTaskCount,
              }
            : d
        )
      );
      Swal.fire({ icon: 'success', title: 'Department updated', text: 'Department details have been saved.', timer: 2000, showConfirmButton: false, timerProgressBar: true });
    } else {
      const id = form.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      setDepartments((prev) => [
        ...prev,
        {
          id: id || `dept-${Date.now()}`,
          name: form.name.trim(),
          type: form.type,
          color: form.color,
          unitsCount: form.unitsCount,
          personnelCount: form.personnelCount,
          activeTaskCount: form.activeTaskCount,
        },
      ]);
      Swal.fire({ icon: 'success', title: 'Department added', text: 'The new department has been added.', timer: 2000, showConfirmButton: false, timerProgressBar: true });
    }
    setDialogOpen(false);
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
      customClass: {
        popup: 'rounded-2xl shadow-xl',
        title: 'text-foreground text-xl',
        htmlContainer: 'text-muted',
        confirmButton: 'rounded-xl px-5 py-2.5 font-medium',
        cancelButton: 'rounded-xl px-5 py-2.5 font-medium',
      },
    }).then((result) => {
      if (result.isConfirmed) {
        setDepartments((prev) => prev.filter((d) => d.id !== deptId));
        Swal.fire({ icon: 'success', title: 'Department deleted', text: 'The department has been removed.', timer: 2000, showConfirmButton: false, timerProgressBar: true });
      }
    });
  };

  return (
    <Layout>
      <>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-foreground">Department Management</h1>
          <p className="text-muted mt-1">Centralized view of all emergency departments</p>
        </div>

        {/* Summary Bar - not dynamic */}
        <Card className="mb-6" hover={false}>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-muted mb-1">Total Active Incidents</p>
                <p className="text-3xl font-semibold text-foreground">{totalActiveIncidents}</p>
              </div>
              <div>
                <p className="text-sm text-muted mb-1">Total Available Units</p>
                <p className="text-3xl font-semibold text-[#134178]">{totalAvailableUnits}</p>
              </div>
              <div>
                <p className="text-sm text-muted mb-1">City-wide Alert Level</p>
                <Badge className="bg-green-100 text-green-700 border-green-200 text-lg px-3 py-1">Normal</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mb-6 flex justify-end">
          <button
            type="button"
            onClick={openAddDialog}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm text-white bg-[#134178] hover:bg-[#0f3256] focus:outline-none focus:ring-2 focus:ring-[#134178] focus:ring-offset-2 shadow-sm hover:shadow-md transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Add Department
          </button>
        </div>

        {/* Department Cards - only these are dynamic */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept) => {
            const Icon = getDepartmentIcon(dept.type);
            const stats = getDepartmentStats(dept);
            const totalUnitsDisplay = units[dept.id]?.length ?? dept.unitsCount ?? 0;
            const availableFromUnits = units[dept.id] ? stats.availableUnits : (totalUnitsDisplay - (dept.activeTaskCount || 0));

            return (
              <Card
                key={dept.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/departments/${dept.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-12 h-12 shrink-0 rounded-xl bg-blue-50 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:bg-blue-100">
                        <Icon className="w-6 h-6 text-blue-700" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base truncate" title={dept.name}>{dept.name}</CardTitle>
                        <p className="text-sm text-gray-600 truncate">{dept.type} Response</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 min-w-[36px] text-[#134178] hover:bg-blue-50 focus:ring-[#134178]"
                        onClick={(e) => openEditDialog(dept, e)}
                        title="Edit"
                        aria-label="Edit department"
                      >
                        <Pencil className="w-5 h-5 shrink-0" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 min-w-[36px] text-red-600 hover:bg-red-50 focus:ring-red-500"
                        onClick={(e) => handleDelete(dept.id, e)}
                        title="Delete"
                        aria-label="Delete department"
                      >
                        <Trash2 className="w-5 h-5 shrink-0" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Status</span>
                    <Badge className={getStatusColor(stats.status)}>{stats.status}</Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Active Incidents</span>
                      <span className="font-semibold text-foreground">{stats.activeIncidents}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Units</span>
                      <span className="font-semibold text-[#134178]">
                        {units[dept.id] ? `${stats.availableUnits}/${stats.totalUnits}` : `${dept.unitsCount ?? 0} total`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Personnel</span>
                      <span className="font-semibold text-foreground">{dept.personnelCount ?? stats.totalUnits}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Active Tasks</span>
                      <span className="font-semibold text-foreground">{dept.activeTaskCount ?? 0}</span>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/departments/${dept.id}`);
                    }}
                  >
                    View Department
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Add / Edit Department Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg w-full p-0 overflow-hidden rounded-2xl shadow-2xl border border-border">
          <div className="bg-gradient-to-br from-secondary to-secondary-hover px-6 py-5">
            <DialogTitle className="text-lg font-semibold text-white m-0">
              {editingDept ? 'Edit Department' : 'Add Department'}
            </DialogTitle>
            <DialogDescription className="!text-white/80 mt-1 text-sm">
              {editingDept ? 'Update department details below.' : 'Enter the new department details.'}
            </DialogDescription>
          </div>
          <div className="p-6 space-y-5 w-full min-w-0 overflow-hidden bg-card">
            <div className="w-full min-w-0 overflow-hidden">
              <Label className="block text-sm font-medium text-foreground mb-2">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Bureau of Fire Protection"
                className="w-full max-w-full min-w-0 rounded-xl border-border focus:border-secondary focus:ring-secondary/20 box-border"
              />
            </div>
            <div className="w-full min-w-0">
              <Label className="block text-sm font-medium text-foreground mb-2">Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                {({ value }) => (
                  <>
                    <SelectTrigger
                      isOpen={typeSelectOpen}
                      onClick={() => setTypeSelectOpen((o) => !o)}
                      className="w-full min-w-0 px-4 py-3 rounded-xl border-2 border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-colors"
                    >
                      <SelectValue placeholder="Select type" value={value} options={DEPARTMENT_TYPES} />
                    </SelectTrigger>
                    <SelectContent isOpen={typeSelectOpen} className="rounded-xl border-2 border-border shadow-lg bg-card">
                      {DEPARTMENT_TYPES.map((opt) => (
                        <SelectItem
                          key={opt.value}
                          value={opt.value}
                          onSelect={(v) => {
                            setForm((f) => ({ ...f, type: v }));
                            setTypeSelectOpen(false);
                          }}
                        >
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
                <Input
                  type="number"
                  min={0}
                  value={form.unitsCount}
                  onChange={(e) => setForm((f) => ({ ...f, unitsCount: parseInt(e.target.value, 10) || 0 }))}
                  placeholder="0"
                  className="w-full min-w-0 rounded-xl border-border focus:border-secondary focus:ring-secondary/20"
                />
              </div>
              <div className="min-w-0 flex flex-col">
                <Label className="block text-sm font-medium text-foreground mb-2">Personnel</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.personnelCount}
                  onChange={(e) => setForm((f) => ({ ...f, personnelCount: parseInt(e.target.value, 10) || 0 }))}
                  placeholder="0"
                  className="w-full min-w-0 rounded-xl border-border focus:border-secondary focus:ring-secondary/20"
                />
              </div>
              <div className="min-w-0 flex flex-col">
                <Label className="block text-sm font-medium text-foreground mb-2">Active Tasks</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.activeTaskCount}
                  onChange={(e) => setForm((f) => ({ ...f, activeTaskCount: parseInt(e.target.value, 10) || 0 }))}
                  placeholder="0"
                  className="w-full min-w-0 rounded-xl border-border focus:border-secondary focus:ring-secondary/20"
                />
              </div>
            </div>
          </div>
          <div className="px-6 py-4 bg-secondary/20 border-t border-border flex justify-between gap-3 rounded-b-2xl">
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl font-medium text-sm text-white bg-secondary hover:bg-secondary-hover focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background shadow-sm hover:shadow-md transition-all duration-200"
            >
              {editingDept ? 'Save Changes' : 'Add Department'}
            </button>
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              className="px-4 py-2.5 rounded-xl font-medium text-sm text-foreground bg-card border border-border hover:bg-secondary/30 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background transition-colors"
            >
              Cancel
            </button>
          </div>
        </DialogContent>
      </Dialog>
      </>
    </Layout>
  );
}
