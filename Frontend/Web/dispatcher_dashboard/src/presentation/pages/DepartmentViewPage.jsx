import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/presentation/components/layout/Layout';
import { Card } from '@/presentation/components/ui/Card';
import { Badge } from '@/presentation/components/ui/Badge';
import { Button } from '@/presentation/components/ui/Button';
import { AlertCircle, Users, FileText, Loader2, ExternalLink } from 'lucide-react';
import { useTheme } from '@/presentation/context/ThemeContext';
import { getDispatches } from '@/data/api/dispatches.api';
import { getResponderTeams } from '@/data/api/responders.api';
import { ROLES } from '@/core/constants';

function toTitleCase(value) {
  return String(value || '')
    .split(/[-_\s]+/)
    .map((part) => (part ? `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}` : ''))
    .join(' ');
}

export function DepartmentViewPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const departmentCode = useMemo(() => {
    const code = user.department_code ?? user.departmentId ?? user.department_id ?? '';
    return String(code).trim().toLowerCase();
  }, [user.department_code, user.departmentId, user.department_id]);
  const departmentName = user.department || (departmentCode ? toTitleCase(departmentCode) : 'Your department');

  const [dispatches, setDispatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loadingDispatches, setLoadingDispatches] = useState(true);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [dispatchesError, setDispatchesError] = useState(null);

  useEffect(() => {
    if (!departmentCode) {
      setLoadingDispatches(false);
      setLoadingTeams(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoadingDispatches(true);
      setDispatchesError(null);
      try {
        const list = await getDispatches({ limit: 200, offset: 0, department_code: departmentCode });
        if (!cancelled) setDispatches(Array.isArray(list) ? list : []);
      } catch (err) {
        if (!cancelled) {
          setDispatches([]);
          setDispatchesError(err.message || 'Could not load assigned incidents.');
        }
      } finally {
        if (!cancelled) setLoadingDispatches(false);
      }
    })();

    return () => { cancelled = true; };
  }, [departmentCode]);

  useEffect(() => {
    if (!departmentCode) return;

    let cancelled = false;

    (async () => {
      setLoadingTeams(true);
      try {
        const list = await getResponderTeams({ limit: 100, offset: 0, department_code: departmentCode });
        if (!cancelled) setTeams(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setTeams([]);
      } finally {
        if (!cancelled) setLoadingTeams(false);
      }
    })();

    return () => { cancelled = true; };
  }, [departmentCode]);

  const assignedIncidentsByReport = useMemo(() => {
    const byReport = new Map();
    for (const d of dispatches) {
      const reportId = d.report_id;
      if (reportId == null) continue;
      if (!byReport.has(reportId)) {
        byReport.set(reportId, {
          report_id: reportId,
          team_name: d.team_name,
          department_name: d.department_name,
          response_status: d.response_status,
          assignment_group_id: d.assignment_group_id,
        });
      }
    }
    return Array.from(byReport.values());
  }, [dispatches]);

  const departmentTeams = useMemo(() => {
    if (!departmentCode) return [];
    const code = departmentCode;
    return teams.filter(
      (t) => String(t?.department_code || '').trim().toLowerCase() === code
    );
  }, [teams, departmentCode]);

  const panelClass = `rounded-2xl border overflow-hidden transition-all duration-300 ${isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'}`;
  const headerClass = `flex items-center gap-3 px-4 py-3 border-b ${isLight ? 'border-gray-200/80 bg-gray-50/50' : 'border-white/10 bg-white/5'}`;

  return (
    <Layout>
      <div className="flex flex-col gap-6 p-6 bg-background min-h-full">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Department View</h1>
          <p className="text-sm text-muted mt-1">{departmentName}</p>
        </div>

        {!departmentCode ? (
          <Card className={`p-6 ${isLight ? 'bg-card border-border' : 'bg-card/80 border-border'}`}>
            <div className="flex items-center gap-3 text-muted">
              <AlertCircle className="w-6 h-6 flex-shrink-0" />
              <p>No department assigned. Contact an administrator.</p>
            </div>
          </Card>
        ) : (
          <>
            {/* Assigned incidents */}
            <div className={panelClass}>
              <div className={headerClass}>
                <FileText className={`w-5 h-5 flex-shrink-0 ${isLight ? 'text-gray-600' : 'text-foreground/80'}`} />
                <span className="font-semibold text-foreground">Assigned incidents</span>
              </div>
              <div className={`p-4 ${isLight ? 'bg-white' : 'bg-card/40'}`}>
                {loadingDispatches ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted" />
                  </div>
                ) : dispatchesError ? (
                  <div className="flex items-center gap-3 py-4 text-muted text-sm">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{dispatchesError}</span>
                  </div>
                ) : assignedIncidentsByReport.length === 0 ? (
                  <p className="py-6 text-center text-muted text-sm">No incidents assigned to your department.</p>
                ) : (
                  <ul className="space-y-2">
                    {assignedIncidentsByReport.map((item) => (
                      <li
                        key={`${item.report_id}-${item.assignment_group_id || ''}`}
                        className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 ${isLight ? 'border-gray-200 bg-gray-50/80' : 'border-white/10 bg-white/5'}`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">Incident #{item.report_id}</span>
                          {item.team_name && (
                            <Badge variant="outline" className="text-xs">
                              {item.team_name}
                            </Badge>
                          )}
                          {item.response_status && (
                            <Badge variant="outline" className="text-xs capitalize">
                              {String(item.response_status).replace(/_/g, ' ')}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/incidents/${item.report_id}`)}
                          className="shrink-0"
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Assigned teams */}
            <div className={panelClass}>
              <div className={headerClass}>
                <Users className={`w-5 h-5 flex-shrink-0 ${isLight ? 'text-gray-600' : 'text-foreground/80'}`} />
                <span className="font-semibold text-foreground">Assigned teams</span>
              </div>
              <div className={`p-4 ${isLight ? 'bg-white' : 'bg-card/40'}`}>
                {loadingTeams ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted" />
                  </div>
                ) : departmentTeams.length === 0 ? (
                  <p className="py-6 text-center text-muted text-sm">No teams in your department.</p>
                ) : (
                  <ul className="space-y-2">
                    {departmentTeams.map((team) => (
                      <li
                        key={team.team_id || team.team_name}
                        className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 ${isLight ? 'border-gray-200 bg-gray-50/80' : 'border-white/10 bg-white/5'}`}
                      >
                        <span className="font-medium text-foreground">{team.team_name || 'Unnamed team'}</span>
                        <Badge
                          variant={team.team_status === 'available' ? 'default' : 'outline'}
                          className="text-xs capitalize"
                        >
                          {String(team.team_status || '—').replace(/_/g, ' ')}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
