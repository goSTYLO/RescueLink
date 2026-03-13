import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/presentation/components/layout/Layout';
import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';
import { Badge } from '@/presentation/components/ui/Badge';
import { ClipboardList, Eye, MapPin } from 'lucide-react';
import { getIncidents } from '@/data/api/incidents.api';
import { mapApiIncidentToDisplay } from '@/core/utils/incidentDisplay';
import { ROLES } from '@/core/constants';
import { useTheme } from '@/presentation/context/ThemeContext';

function mapApiIncidentToRow(api) {
  return mapApiIncidentToDisplay(api);
}

export function AssignedIncidentsPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user.role !== ROLES.DEPARTMENT_HEAD) {
      navigate(user.role === ROLES.DEPARTMENT_ADMIN ? '/department/dashboard' : '/dashboard', { replace: true });
    }
  }, [user.role, navigate]);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getIncidents({ limit: 100, offset: 0, withMeta: false });
      const list = Array.isArray(result) ? result : (result?.items || []);
      setIncidents(list.map(mapApiIncidentToRow));
    } catch (err) {
      setError(err.message || 'Failed to load incidents');
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user.role !== ROLES.DEPARTMENT_HEAD) return;
    fetchIncidents();
    const intervalId = setInterval(fetchIncidents, 30000);
    const handleUpdated = () => fetchIncidents();
    window.addEventListener('incident:updated', handleUpdated);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('incident:updated', handleUpdated);
    };
  }, [user.role, fetchIncidents]);

  const getSeverityColor = (severity) => {
    switch (String(severity).toLowerCase()) {
      case 'critical': return 'bg-primary/20 text-primary border-primary/50';
      case 'warning': return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'resolved':
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/40';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusBadge = (status) => {
    const s = String(status || '').toLowerCase();
    const map = {
      new: 'bg-blue-500/20 text-blue-400',
      verified: 'bg-purple-500/20 text-purple-400',
      'in progress': 'bg-indigo-500/20 text-indigo-400',
      assigned: 'bg-indigo-500/20 text-indigo-400',
      resolved: 'bg-green-500/20 text-green-400',
      closed: 'bg-emerald-700/20 text-emerald-300',
    };
    const cls = map[s] || 'bg-muted text-muted-foreground';
    return <Badge className={cls}>{status || '—'}</Badge>;
  };

  const getTypeIcon = (type) => {
    const icons = { Fire: '🔥', Medical: '🏥', Police: '👮', Disaster: '⚠️' };
    return icons[String(type)] || '📋';
  };

  const heroCardClass = `rounded-3xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80 border-gray-200/80 shadow-[8px_8px_24px_rgba(209,213,219,0.5),-8px_-8px_24px_rgba(255,255,255,0.9)]' : 'glass neumorphic-dark bg-card/60 border-white/10 shadow-[8px_8px_24px_rgba(0,0,0,0.35),-6px_-6px_20px_rgba(19,65,120,0.2)]'}`;
  const heroIconClass = `w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary'}`;

  if (user.role !== ROLES.DEPARTMENT_HEAD) return null;

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className={heroCardClass}>
          <div className="p-8 flex flex-wrap items-center gap-6">
            <div className={heroIconClass}>
              <ClipboardList className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Assigned Incidents</h1>
              <p className="text-muted mt-1">{user.department || 'Department'} — incidents assigned to your department</p>
            </div>
          </div>
        </div>

        {error && (
          <Card className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10">
            <p className="text-sm text-foreground">{error}</p>
          </Card>
        )}

        <Card className="rounded-2xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-xl font-semibold text-foreground">Assigned Incidents</h2>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-muted">Loading incidents...</div>
            ) : (
              <table className="w-full">
                <thead className={isLight ? 'bg-gray-50 border-b border-gray-200' : 'bg-muted/30 border-b border-border'}>
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Incident ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Location</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Severity</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Reported</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {incidents.map((incident) => (
                    <tr key={incident.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => navigate(`/incidents/${incident.id}`)} className="text-sm font-medium text-primary hover:underline">
                          {incident.id}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="inline-flex items-center gap-1">
                          {getTypeIcon(incident.emergencyType)}
                          <span className="capitalize text-foreground">{incident.emergencyType}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4 text-muted" />
                          {incident.barangay}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={getSeverityColor(incident.severity)}>{String(incident.severity || '—')}</Badge>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(incident.status)}</td>
                      <td className="px-4 py-3 text-sm text-muted">{incident.timeReported || '—'}</td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/incidents/${incident.id}`)} className="text-primary" title="View details">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {!loading && incidents.length === 0 && !error && (
          <div className="text-center py-12 text-muted">
            <p className="text-lg">No incidents assigned to your department yet</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
