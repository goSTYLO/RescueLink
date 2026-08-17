import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/presentation/components/layout/Layout';
import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';
import { Badge } from '@/presentation/components/ui/Badge';
import { Eye, MapPin, Clock, AlertCircle, ClipboardList } from 'lucide-react';
import { incidents as mockIncidents, personnel as mockPersonnelByDept, units as mockUnitsByDept } from '@/data/mock/mockData';
import { ROLES } from '@/core/constants';
import { useTheme } from '@/presentation/context/ThemeContext';

export function DepartmentTasksPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const departmentId = user.departmentId || user.department_id;

  useEffect(() => {
    const role = user.role || '';
    if (role !== ROLES.DEPARTMENT_ADMIN && role !== ROLES.PERSONNEL) {
      navigate('/dashboard', { replace: true });
    }
  }, [user.role, navigate]);

  const activeIncidents = (mockIncidents || []).filter(
    (inc) => inc.assignedDepartmentId === departmentId
      && !['resolved', 'closed'].includes(String(inc.status || '').toLowerCase())
  );

  const getSeverityColor = (severity) => {
    switch (String(severity).toLowerCase()) {
      case 'critical': return 'bg-primary/20 text-primary border-primary/50';
      case 'warning': return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusBadge = (status) => {
    const s = String(status || '').toLowerCase();
    const map = {
      new: 'bg-blue-500/20 text-blue-400',
      verified: 'bg-purple-500/20 text-purple-400',
      'in progress': 'bg-indigo-500/20 text-indigo-400',
      resolved: 'bg-green-500/20 text-green-400',
      closed: 'bg-emerald-700/20 text-emerald-300',
    };
    const cls = map[s] || 'bg-muted text-muted-foreground';
    return <Badge className={cls}>{status || '—'}</Badge>;
  };

  const getTypeIcon = (type) => {
    const icons = { Fire: '🔥', Medical: '🏥', Police: '👮', Disaster: '⚠️', SOS: '🆘' };
    return icons[String(type)] || '📋';
  };

  const deptPersonnel = departmentId && mockPersonnelByDept && mockPersonnelByDept[departmentId] ? mockPersonnelByDept[departmentId] : [];
  const deptUnits = departmentId && mockUnitsByDept && mockUnitsByDept[departmentId] ? mockUnitsByDept[departmentId] : [];

  const heroCardClass = `rounded-3xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80 border-gray-200/80 shadow-[8px_8px_24px_rgba(209,213,219,0.5),-8px_-8px_24px_rgba(255,255,255,0.9)]' : 'glass neumorphic-dark bg-card/60 border-white/10 shadow-[8px_8px_24px_rgba(0,0,0,0.35),-6px_-6px_20px_rgba(19,65,120,0.2)]'}`;
  const heroIconClass = `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'}`;

  if (user.role !== ROLES.DEPARTMENT_ADMIN && user.role !== ROLES.PERSONNEL) return null;

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className={heroCardClass}>
          <div className="p-8 flex flex-wrap items-center gap-6">
            <div className={heroIconClass}>
              <ClipboardList className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Active Tasks</h1>
              <p className="text-muted mt-1">{user.name || user.username || 'User'} — Assigned Incidents</p>
            </div>
          </div>
        </div>

        {activeIncidents.length > 0 && (
          <Card className="bg-amber-500/10 border-amber-500/30 p-4 rounded-2xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground">
                  You have {activeIncidents.length} active task{activeIncidents.length !== 1 ? 's' : ''}
                </h3>
                <p className="text-sm text-muted mt-1">Review incident details and coordinate with your team</p>
              </div>
            </div>
          </Card>
        )}

        <div className="space-y-4">
          {activeIncidents.map((incident) => {
            const assignedPersonnel = deptPersonnel.filter((p) => p.assignedIncident === incident.id || (p.status === 'On Duty' && incident.id));
            const assignedUnits = deptUnits.filter((u) => u.assignedIncident === incident.id);

            return (
              <Card key={incident.id} className="p-6 rounded-2xl border border-border">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-foreground">{incident.id}</h3>
                      {getStatusBadge(incident.status)}
                      <Badge className={getSeverityColor(incident.severity)}>{String(incident.severity || '—')}</Badge>
                    </div>
                    <div className="flex items-center gap-1 text-muted">
                      <span className="text-lg">{getTypeIcon(incident.emergencyType)}</span>
                      <span className="capitalize font-medium text-foreground">{incident.emergencyTypesLabel || incident.emergencyType} Emergency</span>
                    </div>
                  </div>
                  <Button onClick={() => navigate(`/incidents/${incident.id}`)} className="bg-primary hover:bg-primary-hover text-white">
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted mb-1">Location</p>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium text-foreground">{incident.barangay}</p>
                        {incident.location && <p className="text-sm text-muted">{typeof incident.location === 'object' ? `${incident.location.lat}, ${incident.location.lng}` : incident.location}</p>}
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted mb-1">Time Reported</p>
                    <div className="flex items-start gap-2">
                      <Clock className="w-4 h-4 text-muted mt-0.5" />
                      <p className="font-medium text-foreground">{incident.timeReported || '—'}</p>
                    </div>
                  </div>
                </div>

                {incident.description && (
                  <div className="mb-4">
                    <p className="text-sm text-muted mb-1">Description</p>
                    <p className="text-foreground">{incident.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div>
                    <p className="text-sm text-muted mb-2">Assigned Personnel ({assignedPersonnel.length})</p>
                    {assignedPersonnel.length > 0 ? (
                      <div className="space-y-1">
                        {assignedPersonnel.map((p, idx) => (
                          <div key={idx} className="text-sm text-foreground flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                              <span className="text-primary text-xs font-semibold">{(p.name || 'P')[0]}</span>
                            </div>
                            {p.name}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted italic">No personnel assigned yet</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted mb-2">Assigned Units ({assignedUnits.length})</p>
                    {assignedUnits.length > 0 ? (
                      <div className="space-y-1">
                        {assignedUnits.map((u, idx) => (
                          <div key={idx} className="text-sm text-foreground flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                              <span className="text-primary text-xs font-semibold">{(u.id || 'U')[0]}</span>
                            </div>
                            {u.id} — {u.name || u.type}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted italic">No units assigned yet</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {activeIncidents.length === 0 && (
          <Card className="p-12 rounded-2xl border border-border">
            <div className="text-center text-muted">
              <AlertCircle className="w-12 h-12 text-muted mx-auto mb-3" />
              <p className="text-lg font-medium">No Active Tasks</p>
              <p className="text-sm mt-1">You currently have no assigned incidents</p>
            </div>
          </Card>
        )}

        <Card className="p-4 bg-primary/5 border-primary/20 rounded-2xl">
          <h3 className="font-semibold text-foreground mb-2">Task View</h3>
          <ul className="text-sm text-muted space-y-1 list-disc list-inside">
            <li>This page shows all incidents assigned to your department that are not yet resolved or closed</li>
            <li>Click &quot;View Details&quot; to see full incident information</li>
            <li>Coordinate with your team and department admin for task assignments</li>
          </ul>
        </Card>
      </div>
    </Layout>
  );
}
