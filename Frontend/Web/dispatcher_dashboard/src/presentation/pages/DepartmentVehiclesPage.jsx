import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/presentation/components/layout/Layout';
import { Card } from '@/presentation/components/ui/Card';
import { Badge } from '@/presentation/components/ui/Badge';
import { Button } from '@/presentation/components/ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/presentation/components/ui/Dialog';
import { Input } from '@/presentation/components/ui/Input';
import { Label } from '@/presentation/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/Select';
import { Truck, CheckCircle, Navigation, Wrench, Plus } from 'lucide-react';
import { getDepartmentUnits, createDepartmentUnit } from '@/data/api/departments.api';
import { ROLES } from '@/core/constants';
import { useTheme } from '@/presentation/context/ThemeContext';

const DEFAULT_ADD_FORM = { name: '', type: '', status: 'Available' };

export function DepartmentVehiclesPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const departmentId = user.departmentId ?? user.department_id;

  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState(DEFAULT_ADD_FORM);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState('');
  const [typeSelectOpen, setTypeSelectOpen] = useState(false);
  const [statusSelectOpen, setStatusSelectOpen] = useState(false);

  const VEHICLE_TYPES = [
    { value: 'medical', label: 'Medical' },
    { value: 'fire', label: 'Fire' },
    { value: 'crime', label: 'Crime' },
    { value: 'other', label: 'Other' },
  ];
  const VEHICLE_STATUSES = [
    { value: 'Available', label: 'Available' },
    { value: 'On Dispatch', label: 'On Dispatch' },
    { value: 'Busy', label: 'Busy' },
    { value: 'Under Maintenance', label: 'Under Maintenance' },
    { value: 'Out of Service', label: 'Out of Service' },
  ];

  const fetchUnits = useCallback(async () => {
    if (!departmentId) return;
    setLoading(true);
    setError('');
    try {
      const rows = await getDepartmentUnits(departmentId);
      const list = (Array.isArray(rows) ? rows : []).map((u) => ({
        id: u.unit_id,
        name: u.name,
        type: u.type,
        status: u.status || 'Available',
      }));
      setUnits(list);
    } catch (e) {
      setError(e?.message || 'Failed to load vehicles');
      setUnits([]);
    } finally {
      setLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    const role = user.role || '';
    if (role !== ROLES.DEPARTMENT_ADMIN && role !== ROLES.PERSONNEL) {
      navigate('/dashboard', { replace: true });
    }
  }, [user.role, navigate]);

  useEffect(() => {
    if (departmentId && (user.role === ROLES.DEPARTMENT_ADMIN || user.role === ROLES.PERSONNEL)) {
      fetchUnits();
    }
  }, [departmentId, user.role, fetchUnits]);

  useEffect(() => {
    const handleIncidentUpdated = () => fetchUnits();
    window.addEventListener('incident:updated', handleIncidentUpdated);
    return () => window.removeEventListener('incident:updated', handleIncidentUpdated);
  }, [fetchUnits]);

  const list = units;
  const availableCount = list.filter((u) => u.status === 'Available').length;
  const deployedCount = list.filter((u) => u.status === 'On Dispatch' || u.status === 'Busy').length;
  const maintenanceCount = list.filter((u) => u.status === 'Under Maintenance' || u.status === 'Out of Service').length;

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const name = (addForm.name || '').trim();
    if (name.length < 2) {
      setAddError('Name must be at least 2 characters');
      return;
    }
    setAddSubmitting(true);
    setAddError('');
    try {
      await createDepartmentUnit(departmentId, {
        name,
        type: addForm.type?.trim() || undefined,
        status: addForm.status || 'Available',
      });
      setAddModalOpen(false);
      setAddForm(DEFAULT_ADD_FORM);
      await fetchUnits();
    } catch (e) {
      setAddError(e?.message || 'Failed to add vehicle');
    } finally {
      setAddSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = String(status || '').toLowerCase();
    if (s.includes('available')) return <Badge className="bg-green-500/20 text-green-400">Available</Badge>;
    if (s.includes('dispatch') || s.includes('busy') || s.includes('route')) return <Badge className="bg-amber-500/20 text-amber-400">Deployed</Badge>;
    if (s.includes('maintenance') || s.includes('service')) return <Badge className="bg-red-500/20 text-red-400">Maintenance</Badge>;
    return <Badge className="bg-muted text-muted-foreground">{status || '—'}</Badge>;
  };

  const heroCardClass = `rounded-md border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80 border-gray-200/80 shadow-[8px_8px_24px_rgba(209,213,219,0.5),-8px_-8px_24px_rgba(255,255,255,0.9)]' : 'glass neumorphic-dark bg-card/60 border-white/10 shadow-[8px_8px_24px_rgba(0,0,0,0.35),-6px_-6px_20px_rgba(19,65,120,0.2)]'}`;
  const heroIconClass = `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'}`;

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className={heroCardClass}>
          <div className="p-8 flex flex-wrap items-center gap-6">
            <div className={heroIconClass}>
              <Truck className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Vehicle Management</h1>
              <p className="text-muted mt-1">{user.department || 'Department'} — Fleet Status</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 rounded-md border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Total Vehicles</p>
                <p className="text-2xl font-bold text-foreground">{list.length}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Truck className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>
          <Card className="p-4 rounded-md border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Available</p>
                <p className="text-2xl font-bold text-foreground">{availableCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </Card>
          <Card className="p-4 rounded-md border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Deployed</p>
                <p className="text-2xl font-bold text-foreground">{deployedCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Navigation className="w-6 h-6 text-amber-400" />
              </div>
            </div>
          </Card>
          <Card className="p-4 rounded-md border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Maintenance</p>
                <p className="text-2xl font-bold text-foreground">{maintenanceCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                <Wrench className="w-6 h-6 text-red-400" />
              </div>
            </div>
          </Card>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive text-sm">
            {error}
          </div>
        )}

        <Card className="rounded-md border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xl font-semibold text-foreground">Fleet</h2>
            {user.role === ROLES.DEPARTMENT_ADMIN && (
              <Button type="button" size="sm" onClick={() => { setAddError(''); setAddForm(DEFAULT_ADD_FORM); setAddModalOpen(true); }}>
                <Plus className="w-4 h-4 mr-1" />
                Add vehicle
              </Button>
            )}
          </div>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading vehicles…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={isLight ? 'bg-gray-50 border-b border-gray-200' : 'bg-muted/30 border-b border-border'}>
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Unit ID</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Type</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {list.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-foreground">{u.id}</td>
                      <td className="px-6 py-4 text-sm text-muted">{u.name}</td>
                      <td className="px-6 py-4 text-sm text-muted">{u.type || '—'}</td>
                      <td className="px-6 py-4">{getStatusBadge(u.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {!loading && list.length === 0 && !error && (
          <div className="text-center py-12 text-muted">
            <Truck className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg">No vehicles listed for this department</p>
          </div>
        )}

        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className={isLight ? 'bg-white border-gray-200' : 'bg-card border-border'}>
            <DialogHeader>
              <DialogTitle>Add vehicle</DialogTitle>
              <DialogDescription>Add a new unit to your department fleet. Name is required.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              {addError && <p className="text-sm text-destructive">{addError}</p>}
              <div>
                <Label htmlFor="add-vehicle-name">Name *</Label>
                <Input
                  id="add-vehicle-name"
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Ambulance 1"
                  minLength={2}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Type (optional)</Label>
                <Select
                  value={addForm.type || ''}
                  onValueChange={(v) => setAddForm((f) => ({ ...f, type: v }))}
                  open={typeSelectOpen}
                  onOpenChange={setTypeSelectOpen}
                >
                  {({ value, onValueChange, dropdownRect }) => (
                    <>
                      <SelectTrigger isOpen={typeSelectOpen} onClick={() => setTypeSelectOpen((o) => !o)} className="mt-1">
                        <SelectValue value={value} options={VEHICLE_TYPES} placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent isOpen={typeSelectOpen} dropdownRect={dropdownRect}>
                        {VEHICLE_TYPES.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            onSelect={(v) => { onValueChange(v); setTypeSelectOpen(false); }}
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </>
                  )}
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={addForm.status || 'Available'}
                  onValueChange={(v) => setAddForm((f) => ({ ...f, status: v }))}
                  open={statusSelectOpen}
                  onOpenChange={setStatusSelectOpen}
                >
                  {({ value, onValueChange, dropdownRect }) => (
                    <>
                      <SelectTrigger isOpen={statusSelectOpen} onClick={() => setStatusSelectOpen((o) => !o)} className="mt-1">
                        <SelectValue value={value} options={VEHICLE_STATUSES} placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent isOpen={statusSelectOpen} dropdownRect={dropdownRect}>
                        {VEHICLE_STATUSES.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            onSelect={(v) => { onValueChange(v); setStatusSelectOpen(false); }}
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </>
                  )}
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddModalOpen(false)} disabled={addSubmitting}>Cancel</Button>
                <Button type="submit" disabled={addSubmitting}>{addSubmitting ? 'Adding…' : 'Add vehicle'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
