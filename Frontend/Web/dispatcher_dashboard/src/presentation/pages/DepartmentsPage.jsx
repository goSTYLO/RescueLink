import { Layout } from '@/presentation/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/Card';
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
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { Flame, Shield, Heart, AlertTriangle, Users, Plus, Pencil, Trash2 } from 'lucide-react';
import { getResponders, createResponder, updateResponder, deleteResponder } from '@/data/api/responders.api';
import { getIncidents } from '@/data/api/incidents.api';

const DEPARTMENT_TYPES = [
  { value: 'Fire', label: 'Fire' },
  { value: 'Police', label: 'Police' },
  { value: 'Medical', label: 'Medical' },
  { value: 'Disaster', label: 'Disaster' },
  { value: 'Community', label: 'Community' },
];

const DEPARTMENT_META_KEY = 'department_meta_v1';

function slugify(value = '') {
  return String(value).toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function inferTypeFromDepartmentName(name = '') {
  const value = name.toLowerCase();
  if (value.includes('fire')) return 'Fire';
  if (value.includes('police')) return 'Police';
  if (value.includes('medical') || value.includes('hospital') || value.includes('health')) return 'Medical';
  if (value.includes('disaster') || value.includes('rescue')) return 'Disaster';
  return 'Community';
}

function getDepartmentMeta() {
  try {
    const raw = localStorage.getItem(DEPARTMENT_META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDepartmentMeta(meta) {
  localStorage.setItem(DEPARTMENT_META_KEY, JSON.stringify(meta));
}

function mapDepartmentsFromResponders(responders = []) {
  const grouped = responders.reduce((acc, responder) => {
    const organization = responder.organization?.trim() || 'Unassigned';
    if (!acc[organization]) acc[organization] = [];
    acc[organization].push(responder);
    return acc;
  }, {});

  const meta = getDepartmentMeta();

  return Object.entries(grouped).map(([name, respondersInDepartment]) => {
    const availableCount = respondersInDepartment.filter(
      (r) => String(r.availability_status || '').toLowerCase() === 'available'
    ).length;
    const activeTaskCount = respondersInDepartment.filter((r) => {
      const status = String(r.availability_status || '').toLowerCase();
      return status === 'busy' || status === 'on dispatch' || status === 'on duty';
    }).length;

    return {
      id: slugify(name) || `dept-${Date.now()}`,
      name,
      type: meta[name]?.type || inferTypeFromDepartmentName(name),
      contact_number: respondersInDepartment[0]?.contact_number || '',
      location: meta[name]?.location || '',
      personnelCount: respondersInDepartment.length,
      availableCount,
      activeTaskCount,
      responders: respondersInDepartment,
    };
  });
}

export function DepartmentsPage() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeIncidentsCount, setActiveIncidentsCount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [typeSelectOpen, setTypeSelectOpen] = useState(false);
  useEffect(() => { if (!dialogOpen) setTypeSelectOpen(false); }, [dialogOpen]);
  const [form, setForm] = useState({
    name: '',
    type: 'Fire',
    contact_number: '',
    location: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [responders, incidents] = await Promise.all([
        getResponders({ limit: 500, offset: 0 }),
        getIncidents({ limit: 200, offset: 0 }),
      ]);

      const departmentList = mapDepartmentsFromResponders(Array.isArray(responders) ? responders : []);
      setDepartments(departmentList);

      const incidentArray = Array.isArray(incidents) ? incidents : [];
      const activeCount = incidentArray.filter((incident) => String(incident.status || '').toLowerCase() !== 'resolved').length;
      setActiveIncidentsCount(activeCount);
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Failed to load departments', text: error.message || 'Please try again.', confirmButtonColor: '#134178' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
    const activeIncidents = dept.activeTaskCount || 0;
    const availableUnits = dept.availableCount || 0;
    const totalUnits = dept.personnelCount || 0;

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

  const totalActiveIncidents = activeIncidentsCount;
  const totalAvailableUnits = departments.reduce((sum, department) => sum + (department.availableCount || 0), 0);

  const openAddDialog = () => {
    setEditingDept(null);
    setForm({
      name: '',
      type: 'Fire',
      contact_number: '',
      location: '',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (dept, e) => {
    e?.stopPropagation();
    setEditingDept(dept);
    setForm({
      name: dept.name,
      type: dept.type,
      contact_number: dept.contact_number || '',
      location: dept.location || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Swal.fire({ icon: 'error', title: 'Validation failed', text: 'Please enter a department name.', confirmButtonColor: '#134178' });
      return;
    }

    try {
      setSaving(true);
      const departmentName = form.name.trim();
      const metadata = getDepartmentMeta();

      if (editingDept) {
        const respondersInDepartment = editingDept.responders || [];

        await Promise.all(
          respondersInDepartment.map((responder) =>
            updateResponder(responder.responder_id, {
              name: responder.name,
              organization: departmentName,
              contact_number: responder.contact_number,
              availability_status: responder.availability_status || 'Available',
            })
          )
        );

        if (respondersInDepartment.length === 0) {
          await createResponder({
            name: `${departmentName} Department Lead`,
            organization: departmentName,
            contact_number: form.contact_number || null,
            availability_status: 'Available',
          });
        } else if (form.contact_number && form.contact_number !== (respondersInDepartment[0]?.contact_number || '')) {
          const lead = respondersInDepartment[0];
          await updateResponder(lead.responder_id, {
            name: lead.name,
            organization: departmentName,
            contact_number: form.contact_number,
            availability_status: lead.availability_status || 'Available',
          });
        }

        if (editingDept.name !== departmentName) {
          delete metadata[editingDept.name];
        }

        metadata[departmentName] = {
          ...(metadata[departmentName] || {}),
          type: form.type,
          location: form.location || '',
        };
        saveDepartmentMeta(metadata);

        Swal.fire({ icon: 'success', title: 'Department updated', text: 'Department details have been saved.', timer: 2000, showConfirmButton: false, timerProgressBar: true });
      } else {
        await createResponder({
          name: `${departmentName} Department Lead`,
          organization: departmentName,
          contact_number: form.contact_number || null,
          availability_status: 'Available',
        });

        metadata[departmentName] = {
          ...(metadata[departmentName] || {}),
          type: form.type,
          location: form.location || '',
        };
        saveDepartmentMeta(metadata);

        Swal.fire({ icon: 'success', title: 'Department added', text: 'The new department has been added.', timer: 2000, showConfirmButton: false, timerProgressBar: true });
      }

      setDialogOpen(false);
      await loadData();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Save failed', text: error.message || 'Unable to save department.', confirmButtonColor: '#134178' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (department, e) => {
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
        (async () => {
          try {
            await Promise.all((department.responders || []).map((responder) => deleteResponder(responder.responder_id)));

            const metadata = getDepartmentMeta();
            delete metadata[department.name];
            saveDepartmentMeta(metadata);

            await loadData();
            Swal.fire({ icon: 'success', title: 'Department deleted', text: 'The department has been removed.', timer: 2000, showConfirmButton: false, timerProgressBar: true });
          } catch (error) {
            Swal.fire({ icon: 'error', title: 'Delete failed', text: error.message || 'Unable to delete department.', confirmButtonColor: '#134178' });
          }
        })();
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
        {loading && (
          <Card className="mb-6" hover={false}>
            <CardContent className="p-6 text-muted">Loading departments...</CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept) => {
            const Icon = getDepartmentIcon(dept.type);
            const stats = getDepartmentStats(dept);
            const totalUnitsDisplay = dept.personnelCount ?? 0;

            return (
              <Card
                key={dept.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/departments/${encodeURIComponent(dept.name)}`)}
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
                        onClick={(e) => handleDelete(dept, e)}
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
                      <span className="font-semibold text-[#134178]">{`${stats.availableUnits}/${stats.totalUnits}`}</span>
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
                      navigate(`/departments/${encodeURIComponent(dept.name)}`);
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
                <Label className="block text-sm font-medium text-foreground mb-2">Contact Number</Label>
                <Input
                  value={form.contact_number}
                  onChange={(e) => setForm((f) => ({ ...f, contact_number: e.target.value }))}
                  placeholder="e.g. +639171234567"
                  className="w-full min-w-0 rounded-xl border-border focus:border-secondary focus:ring-secondary/20"
                />
              </div>
              <div className="min-w-0 flex flex-col col-span-2">
                <Label className="block text-sm font-medium text-foreground mb-2">Location</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="e.g. Dagupan City Operations Center"
                  className="w-full min-w-0 rounded-xl border-border focus:border-secondary focus:ring-secondary/20"
                />
              </div>
            </div>
          </div>
          <div className="px-6 py-4 bg-secondary/20 border-t border-border flex justify-between gap-3 rounded-b-2xl">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl font-medium text-sm text-white bg-secondary hover:bg-secondary-hover focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background shadow-sm hover:shadow-md transition-all duration-200"
            >
              {saving ? 'Saving...' : editingDept ? 'Save Changes' : 'Add Department'}
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
