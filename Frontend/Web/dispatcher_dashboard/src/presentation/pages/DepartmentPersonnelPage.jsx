import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/presentation/components/layout/Layout';
import { Card } from '@/presentation/components/ui/Card';
import { Badge } from '@/presentation/components/ui/Badge';
import { Button } from '@/presentation/components/ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/presentation/components/ui/Dialog';
import { Users, CheckCircle, AlertCircle, Clock, UserPlus, Eye, MapPin, X, UserCheck, Truck } from 'lucide-react';
import { personnel as mockPersonnel, incidents as mockIncidents, units as mockUnits } from '@/data/mock/mockData';
import { ROLES } from '@/core/constants';
import { useTheme } from '@/presentation/context/ThemeContext';
import Swal from 'sweetalert2';

const ASSIGNMENTS_STORAGE_KEY = 'rescuelink_incident_personnel_assignments';
const VEHICLE_ASSIGNMENTS_STORAGE_KEY = 'rescuelink_incident_vehicle_assignments';

function getStoredAssignments() {
  try {
    const raw = localStorage.getItem(ASSIGNMENTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getStoredVehicleAssignments() {
  try {
    const raw = localStorage.getItem(VEHICLE_ASSIGNMENTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function DepartmentPersonnelPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const departmentId = user.departmentId || user.department_id;

  const [assignments, setAssignments] = useState(getStoredAssignments);
  const [vehicleAssignments, setVehicleAssignments] = useState(getStoredVehicleAssignments);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assigningIncidentId, setAssigningIncidentId] = useState(null);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [assigningIncidentIdVehicle, setAssigningIncidentIdVehicle] = useState(null);

  useEffect(() => {
    const role = user.role || '';
    if (role !== ROLES.DEPARTMENT_ADMIN && role !== ROLES.PERSONNEL) {
      navigate('/dashboard', { replace: true });
    }
  }, [user.role, navigate]);

  useEffect(() => {
    try {
      localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(assignments));
    } catch (_) {}
  }, [assignments]);

  useEffect(() => {
    try {
      localStorage.setItem(VEHICLE_ASSIGNMENTS_STORAGE_KEY, JSON.stringify(vehicleAssignments));
    } catch (_) {}
  }, [vehicleAssignments]);

  const list = (mockPersonnel && departmentId && mockPersonnel[departmentId]) ? mockPersonnel[departmentId] : [];
  const availableCount = list.filter((p) => p.status === 'Available').length;
  const onDutyCount = list.filter((p) => p.status === 'On Duty').length;

  const departmentIncidents = (mockIncidents || []).filter((inc) => inc.assignedDepartmentId === departmentId);
  const activeDepartmentIncidents = departmentIncidents.filter((i) => i.status !== 'Resolved' && i.status !== 'resolved');
  const unitsList = (departmentId && mockUnits && mockUnits[departmentId]) ? mockUnits[departmentId] : [];
  const getAssignment = useCallback((incidentId) => assignments[incidentId] || null, [assignments]);
  const getVehicleAssignment = useCallback((incidentId) => vehicleAssignments[incidentId] || null, [vehicleAssignments]);
  const setVehicleAssignment = useCallback((incidentId, vehicleId, vehicleName) => {
    setVehicleAssignments((prev) => ({ ...prev, [incidentId]: { vehicleId, name: vehicleName } }));
    setVehicleModalOpen(false);
    setAssigningIncidentIdVehicle(null);
    Swal.fire({
      icon: 'success',
      title: 'Vehicle assigned',
      html: `<strong>${vehicleName}</strong> has been assigned to incident <strong>${incidentId}</strong>.`,
      timer: 2500,
      showConfirmButton: false,
      timerProgressBar: true,
      customClass: { popup: 'rounded-2xl shadow-xl' },
    });
  }, []);
  const setAssignment = useCallback((incidentId, personnelKey, name) => {
    setAssignments((prev) => ({ ...prev, [incidentId]: { personnelKey, name } }));
    setAssignModalOpen(false);
    setAssigningIncidentId(null);
    Swal.fire({
      icon: 'success',
      title: 'Personnel assigned',
      html: `<strong>${name}</strong> has been assigned to incident <strong>${incidentId}</strong>.`,
      timer: 2500,
      showConfirmButton: false,
      timerProgressBar: true,
      customClass: { popup: 'rounded-2xl shadow-xl' },
    });
  }, []);
  const openAssignModal = (incidentId) => { setAssigningIncidentId(incidentId); setAssignModalOpen(true); };
  const closeAssignModal = () => { setAssignModalOpen(false); setAssigningIncidentId(null); };
  const openVehicleAssignModal = (incidentId) => { setAssigningIncidentIdVehicle(incidentId); setVehicleModalOpen(true); };
  const closeVehicleAssignModal = () => { setVehicleModalOpen(false); setAssigningIncidentIdVehicle(null); };

  const getStatusBadge = (status) => {
    const s = String(status || '').toLowerCase();
    if (s.includes('available')) return <Badge className="bg-green-500/20 text-green-400">Available</Badge>;
    if (s.includes('duty') || s.includes('busy')) return <Badge className="bg-amber-500/20 text-amber-400">On Duty</Badge>;
    return <Badge className="bg-muted text-muted-foreground">{status || '—'}</Badge>;
  };

  const heroCardClass = `rounded-3xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80 border-gray-200/80 shadow-[8px_8px_24px_rgba(209,213,219,0.5),-8px_-8px_24px_rgba(255,255,255,0.9)]' : 'glass neumorphic-dark bg-card/60 border-white/10 shadow-[8px_8px_24px_rgba(0,0,0,0.35),-6px_-6px_20px_rgba(19,65,120,0.2)]'}`;
  const heroIconClass = `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'}`;

  if (user.role !== ROLES.DEPARTMENT_ADMIN && user.role !== ROLES.PERSONNEL) return null;

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className={heroCardClass}>
          <div className="p-8 flex flex-wrap items-center gap-6">
            <div className={heroIconClass}>
              <Users className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Personnel Management</h1>
              <p className="text-muted mt-1">{user.department || 'Department'} — Team Members</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 rounded-2xl border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Total Personnel</p>
                <p className="text-2xl font-bold text-foreground">{list.length}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>
          <Card className="p-4 rounded-2xl border border-border">
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
          <Card className="p-4 rounded-2xl border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">On Duty</p>
                <p className="text-2xl font-bold text-foreground">{onDutyCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-amber-400" />
              </div>
            </div>
          </Card>
        </div>

        <Card className="rounded-2xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-xl font-semibold text-foreground">Team Members</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={isLight ? 'bg-gray-50 border-b border-gray-200' : 'bg-muted/30 border-b border-border'}>
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Role</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Unit</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.map((p, idx) => (
                  <tr key={idx} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-foreground">{p.name}</td>
                    <td className="px-6 py-4 text-sm text-muted">{p.role}</td>
                    <td className="px-6 py-4 text-sm text-muted">{p.unit || '—'}</td>
                    <td className="px-6 py-4">{getStatusBadge(p.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {list.length === 0 && (
          <div className="text-center py-12 text-muted">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg">No personnel listed for this department</p>
          </div>
        )}

        {/* Assign Personnel to Incidents — Dept Admin only */}
        {user.role === ROLES.DEPARTMENT_ADMIN && (
          <Card className="rounded-2xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">Assign Personnel to Incidents</h2>
              <p className="text-sm text-muted mt-0.5">Assign team members to new or assigned incidents</p>
            </div>
            <div className="overflow-x-auto">
              {activeDepartmentIncidents.length === 0 ? (
                <div className="p-8 text-center text-muted text-sm">No incidents assigned to your department that need assignment</div>
              ) : (
                <table className="w-full">
                  <thead className={isLight ? 'bg-gray-50 border-b border-gray-200' : 'bg-muted/30 border-b border-border'}>
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Incident ID</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Type</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Location</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Assigned To</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Vehicle</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {activeDepartmentIncidents.map((incident) => (
                      <tr key={incident.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-6 py-3">
                          <button type="button" onClick={() => navigate(`/incidents/${incident.id}`)} className="text-sm font-medium text-primary hover:underline">
                            {incident.id}
                          </button>
                        </td>
                        <td className="px-6 py-3 text-sm text-foreground capitalize">{incident.emergencyType}</td>
                        <td className="px-6 py-3 text-sm text-muted">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-4 h-4" /> {incident.barangay}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <Badge className="bg-indigo-500/20 text-indigo-400">{incident.status}</Badge>
                        </td>
                        <td className="px-6 py-3 text-sm text-muted">{getAssignment(incident.id) ? getAssignment(incident.id).name : '—'}</td>
                        <td className="px-6 py-3 text-sm text-muted">{getVehicleAssignment(incident.id) ? getVehicleAssignment(incident.id).name : '—'}</td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openAssignModal(incident.id)} className="text-primary" title="Assign personnel">
                              <UserPlus className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => openVehicleAssignModal(incident.id)} className="text-primary" title="Assign vehicle">
                              <Truck className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => navigate(`/incidents/${incident.id}`)} className="text-primary" title="View details">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        )}

        {/* Assign Personnel Modal */}
        <Dialog open={assignModalOpen} onOpenChange={(open) => !open && closeAssignModal()} className="max-w-md">
          <DialogContent className={`max-w-md rounded-2xl overflow-hidden ${isLight ? 'glass neumorphic-light bg-white/95 border-gray-200/80' : 'glass neumorphic-dark bg-card/95 border-white/10'}`}>
            <div className={`flex items-center justify-between border-b ${isLight ? 'border-gray-200/80 pb-4' : 'border-white/10 pb-4'}`}>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-foreground">Assign personnel</DialogTitle>
                <p className="text-sm text-muted mt-1">
                  {assigningIncidentId ? `Select an available team member for ${assigningIncidentId}` : 'Select a team member'}
                </p>
              </DialogHeader>
              <button
                type="button"
                onClick={closeAssignModal}
                className={`p-2 rounded-xl transition-colors ${isLight ? 'hover:bg-gray-100 text-gray-500' : 'hover:bg-white/10 text-muted'}`}
                aria-label="Close"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>
            <div className="mt-4 space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {list.map((p, idx) => {
                const personnelKey = `${departmentId}-${idx}`;
                const isAvailable = String(p.status || '').toLowerCase() === 'available';
                const Wrapper = isAvailable ? 'button' : 'div';
                const wrapperProps = isAvailable
                  ? { type: 'button', onClick: () => setAssignment(assigningIncidentId, personnelKey, p.name) }
                  : {};
                return (
                  <Wrapper
                    key={personnelKey}
                    {...wrapperProps}
                    className={`w-full text-left flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all duration-200 ${
                      isAvailable
                        ? isLight
                          ? 'border-gray-200/80 bg-white hover:bg-primary/5 hover:border-primary/30 cursor-pointer shadow-sm'
                          : 'border-white/10 bg-white/5 hover:bg-primary/10 hover:border-primary/30 cursor-pointer'
                        : isLight
                          ? 'border-gray-200/60 bg-gray-50/50 opacity-60 cursor-not-allowed'
                          : 'border-white/5 bg-white/5 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isAvailable ? (isLight ? 'bg-green-500/15 text-green-600' : 'bg-green-500/20 text-green-400') : (isLight ? 'bg-amber-500/15 text-amber-600' : 'bg-amber-500/20 text-amber-400')}`}>
                      {isAvailable ? <UserCheck className="w-5 h-5" strokeWidth={2} /> : <Clock className="w-5 h-5" strokeWidth={2} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">{p.name}</p>
                      <p className="text-sm text-muted">{p.role} · {p.unit}</p>
                    </div>
                    <span className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium ${isAvailable ? 'bg-green-500/20 text-green-600' : 'bg-amber-500/20 text-amber-600'}`}>
                      {p.status}
                    </span>
                  </Wrapper>
                );
              })}
            </div>
            {list.length === 0 && <p className="text-sm text-muted py-6 text-center">No personnel in this department</p>}
            {list.length > 0 && list.every((p) => String(p.status || '').toLowerCase() !== 'available') && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-3 text-center">No available personnel. Only &quot;Available&quot; can be assigned.</p>
            )}
          </DialogContent>
        </Dialog>

        {/* Assign Vehicle Modal */}
        <Dialog open={vehicleModalOpen} onOpenChange={(open) => !open && closeVehicleAssignModal()} className="max-w-md">
          <DialogContent className={`max-w-md rounded-2xl overflow-hidden ${isLight ? 'glass neumorphic-light bg-white/95 border-gray-200/80' : 'glass neumorphic-dark bg-card/95 border-white/10'}`}>
            <div className={`flex items-center justify-between border-b ${isLight ? 'border-gray-200/80 pb-4' : 'border-white/10 pb-4'}`}>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-foreground">Assign vehicle</DialogTitle>
                <p className="text-sm text-muted mt-1">
                  {assigningIncidentIdVehicle ? `Select an available vehicle for ${assigningIncidentIdVehicle}` : 'Select a vehicle'}
                </p>
              </DialogHeader>
              <button type="button" onClick={closeVehicleAssignModal} className={`p-2 rounded-xl transition-colors ${isLight ? 'hover:bg-gray-100 text-gray-500' : 'hover:bg-white/10 text-muted'}`} aria-label="Close">
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>
            <div className="mt-4 space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {unitsList.map((u) => {
                const isAvailable = String(u.status || '').toLowerCase() === 'available';
                const Wrapper = isAvailable ? 'button' : 'div';
                const wrapperProps = isAvailable ? { type: 'button', onClick: () => setVehicleAssignment(assigningIncidentIdVehicle, u.id, u.name) } : {};
                return (
                  <Wrapper
                    key={u.id}
                    {...wrapperProps}
                    className={`w-full text-left flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all duration-200 ${
                      isAvailable
                        ? isLight ? 'border-gray-200/80 bg-white hover:bg-primary/5 hover:border-primary/30 cursor-pointer shadow-sm' : 'border-white/10 bg-white/5 hover:bg-primary/10 hover:border-primary/30 cursor-pointer'
                        : isLight ? 'border-gray-200/60 bg-gray-50/50 opacity-60 cursor-not-allowed' : 'border-white/5 bg-white/5 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isAvailable ? (isLight ? 'bg-green-500/15 text-green-600' : 'bg-green-500/20 text-green-400') : (isLight ? 'bg-amber-500/15 text-amber-600' : 'bg-amber-500/20 text-amber-400')}`}>
                      {isAvailable ? <Truck className="w-5 h-5" strokeWidth={2} /> : <Clock className="w-5 h-5" strokeWidth={2} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">{u.name}</p>
                      <p className="text-sm text-muted">{u.type} · {u.id}</p>
                    </div>
                    <span className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium ${isAvailable ? 'bg-green-500/20 text-green-600' : 'bg-amber-500/20 text-amber-600'}`}>{u.status}</span>
                  </Wrapper>
                );
              })}
            </div>
            {unitsList.length === 0 && <p className="text-sm text-muted py-6 text-center">No vehicles in this department</p>}
            {unitsList.length > 0 && unitsList.every((u) => String(u.status || '').toLowerCase() !== 'available') && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-3 text-center">No available vehicles. Only &quot;Available&quot; can be assigned.</p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
