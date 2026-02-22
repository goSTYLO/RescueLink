import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/presentation/components/layout/Layout';
import { Card } from '@/presentation/components/ui/Card';
import { Badge } from '@/presentation/components/ui/Badge';
import { Truck, CheckCircle, Navigation, AlertCircle, Wrench } from 'lucide-react';
import { units as mockUnits } from '@/data/mock/mockData';
import { ROLES } from '@/core/constants';
import { useTheme } from '@/presentation/context/ThemeContext';

export function DepartmentVehiclesPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const departmentId = user.departmentId || user.department_id;

  useEffect(() => {
    const role = user.role || '';
    if (role !== ROLES.DEPARTMENT_ADMIN && role !== ROLES.PERSONNEL) {
      navigate('/dashboard', { replace: true });
    }
  }, [user.role, navigate]);

  const list = (mockUnits && departmentId && mockUnits[departmentId]) ? mockUnits[departmentId] : [];
  const availableCount = list.filter((u) => u.status === 'Available').length;
  const deployedCount = list.filter((u) => u.status === 'On Dispatch' || u.status === 'Busy').length;
  const maintenanceCount = list.filter((u) => u.status === 'Under Maintenance' || u.status === 'Out of Service').length;

  const getStatusBadge = (status) => {
    const s = String(status || '').toLowerCase();
    if (s.includes('available')) return <Badge className="bg-green-500/20 text-green-400">Available</Badge>;
    if (s.includes('dispatch') || s.includes('busy') || s.includes('route')) return <Badge className="bg-amber-500/20 text-amber-400">Deployed</Badge>;
    if (s.includes('maintenance') || s.includes('service')) return <Badge className="bg-red-500/20 text-red-400">Maintenance</Badge>;
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
              <Truck className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Vehicle Management</h1>
              <p className="text-muted mt-1">{user.department || 'Department'} — Fleet Status</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 rounded-2xl border border-border">
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
                <p className="text-sm text-muted">Deployed</p>
                <p className="text-2xl font-bold text-foreground">{deployedCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Navigation className="w-6 h-6 text-amber-400" />
              </div>
            </div>
          </Card>
          <Card className="p-4 rounded-2xl border border-border">
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

        <Card className="rounded-2xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-xl font-semibold text-foreground">Fleet</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={isLight ? 'bg-gray-50 border-b border-gray-200' : 'bg-muted/30 border-b border-border'}>
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Unit ID</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Type</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Assigned Incident</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-foreground">{u.id}</td>
                    <td className="px-6 py-4 text-sm text-muted">{u.name}</td>
                    <td className="px-6 py-4 text-sm text-muted">{u.type || '—'}</td>
                    <td className="px-6 py-4">{getStatusBadge(u.status)}</td>
                    <td className="px-6 py-4 text-sm text-muted">{u.assignedIncident || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {list.length === 0 && (
          <div className="text-center py-12 text-muted">
            <Truck className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg">No vehicles listed for this department</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
