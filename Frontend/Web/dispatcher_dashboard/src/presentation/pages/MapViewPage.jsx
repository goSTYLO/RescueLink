import { Layout } from '@/presentation/components/layout/Layout';
import { Badge } from '@/presentation/components/ui/Badge';
import { Button } from '@/presentation/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/Select';
import { MapPin, SlidersHorizontal, Map, ChevronRight } from 'lucide-react';
import { incidents as mockIncidents, barangays } from '@/data/mock/mockData';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';
import { getIncidents, normalizeIncidentStatus } from '@/data/api/incidents.api';
import { DEV_MODE } from '@/core/config/app.config';

const POLLING_INTERVAL_MS = 30000;

function mapApiIncidentToMap(api) {
  const typeMap = { fire: 'Fire', medical: 'Medical', police: 'Police', disaster: 'Disaster' };
  const emergencyType = typeMap[api.incident_type?.toLowerCase()] || (api.incident_type ? String(api.incident_type).charAt(0).toUpperCase() + String(api.incident_type).slice(1) : 'Unknown');
  const severityMap = { high: 'Critical', medium: 'Warning', low: 'Low' };
  const severity = severityMap[api.severity_level?.toLowerCase()] || 'Warning';
  const canonicalStatus = normalizeIncidentStatus(api.status);
  let timeReported = '—';
  if (api.created_at) {
    const d = new Date(api.created_at);
    timeReported = d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  }

  return {
    id: api.report_id,
    emergencyType,
    severity,
    barangay: api.barangay || '—',
    timeReported,
    status: canonicalStatus,
    location: {
      lat: Number(api.latitude),
      lng: Number(api.longitude),
    },
  };
}

const MAP_FILTER_STATE_KEY = 'map:filters:v1';

export function MapViewPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const persistedMapState = (() => {
    try {
      return JSON.parse(sessionStorage.getItem(MAP_FILTER_STATE_KEY) || '{}');
    } catch {
      return {};
    }
  })();
  const [filterDepartment, setFilterDepartment] = useState(persistedMapState.filterDepartment || 'All');
  const [filterBarangay, setFilterBarangay] = useState(persistedMapState.filterBarangay || 'All');
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const popupTimerRef = useRef(null);
  const [selectStates, setSelectStates] = useState({
    department: false,
    barangay: false,
  });
  const rateLimitUntilRef = useRef(0);

  const fetchIncidents = useCallback(async () => {
    if (Date.now() < rateLimitUntilRef.current) {
      return;
    }
    const token = sessionStorage.getItem('token');
    if (DEV_MODE && !token) {
      setIncidents(mockIncidents);
      setError(null);
      setLoading(false);
      setLastUpdated(new Date());
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getIncidents({ limit: 150, offset: 0 });
      const mapped = Array.isArray(data) ? data.map(mapApiIncidentToMap) : [];
      setIncidents(mapped);
      setLastUpdated(new Date());
    } catch (err) {
      const message = err.message || 'Failed to load incidents';
      if (message.toLowerCase().includes('rate limited')) {
        rateLimitUntilRef.current = Date.now() + 30000;
      }
      setError(message);
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, POLLING_INTERVAL_MS);
    const handleIncidentUpdated = () => fetchIncidents();
    window.addEventListener('incident:updated', handleIncidentUpdated);
    return () => {
      clearInterval(interval);
      window.removeEventListener('incident:updated', handleIncidentUpdated);
    };
  }, [fetchIncidents]);

  useEffect(() => {
    sessionStorage.setItem(MAP_FILTER_STATE_KEY, JSON.stringify({
      filterDepartment,
      filterBarangay,
    }));
  }, [filterDepartment, filterBarangay]);

  const handleMarkerClick = (incident) => {
    if (selectedIncident?.id === incident.id && showPopup) {
      setShowPopup(false);
      if (popupTimerRef.current) {
        clearTimeout(popupTimerRef.current);
        popupTimerRef.current = null;
      }
    } else {
      setSelectedIncident(incident);
      setShowPopup(true);
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
      popupTimerRef.current = setTimeout(() => {
        setShowPopup(false);
        popupTimerRef.current = null;
      }, 5000);
    }
  };

  useEffect(() => {
    return () => {
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    };
  }, []);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      if (filterDepartment !== 'All' && inc.emergencyType !== filterDepartment) return false;
      if (filterBarangay !== 'All' && inc.barangay !== filterBarangay) return false;
      return true;
    });
  }, [incidents, filterDepartment, filterBarangay]);

  useEffect(() => {
    if (!selectedIncident && filteredIncidents.length > 0) {
      setSelectedIncident(filteredIncidents[0]);
      return;
    }
    if (selectedIncident && !filteredIncidents.some((inc) => inc.id === selectedIncident.id)) {
      setSelectedIncident(filteredIncidents[0] || null);
      setShowPopup(false);
    }
  }, [filteredIncidents, selectedIncident]);

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'Critical': return 'bg-primary';
      case 'Warning': return 'bg-amber-500';
      case 'Resolved': return 'bg-severity-resolved';
      default: return 'bg-muted';
    }
  };

  const getSeverityBadgeColor = (severity) => {
    switch (severity) {
      case 'Critical': return 'bg-primary/20 text-primary border-primary/50';
      case 'Warning': return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'Resolved': return 'bg-severity-resolved/20 text-severity-resolved border-emerald-500/40';
      default: return 'bg-card text-muted border-[rgba(19,65,120,0.35)]';
    }
  };

  const departmentOptions = [
    { value: 'All', label: 'All Departments' },
    { value: 'Fire', label: 'Fire Department' },
    { value: 'Medical', label: 'Medical Services' },
    { value: 'Police', label: 'Police' },
    { value: 'Disaster', label: 'DRRMO' },
  ];

  const barangayOptions = [
    { value: 'All', label: 'All Barangays' },
    ...barangays.map(b => ({ value: b, label: b })),
  ];

  const panelClass = () =>
    `rounded-2xl border overflow-hidden transition-all duration-300 ${
      isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'
    }`;
  const headerClass = () =>
    `flex items-center gap-3 px-4 py-3 border-b ${
      isLight ? 'border-gray-200/80 bg-gray-50/50' : 'border-white/10 bg-white/5'
    }`;
  const iconBoxClass = () =>
    isLight ? 'neumorphic-light-inset bg-gray-100 text-primary' : 'neumorphic-dark-inset bg-white/10 text-primary';

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-6rem)] p-4 md:p-6 gap-4 min-h-0">
        <div className="w-full max-w-7xl mx-auto flex-1 min-h-0 flex flex-col gap-4">
          <div className={panelClass()}>
            <div className="p-4 md:p-5 flex flex-wrap items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBoxClass()}`}>
                <Map className="w-5 h-5" strokeWidth={2} />
              </div>
              <div className="min-w-[180px]">
                <h1 className="text-xl md:text-2xl font-bold text-foreground">Emergency Map</h1>
                <p className="text-sm text-muted">Live incidents across Dagupan City</p>
              </div>
              <span className="ml-auto text-xs text-muted">
                {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Loading latest data...'}
              </span>
            </div>
          </div>
          <div className={`relative overflow-visible rounded-2xl border transition-all duration-300 ${selectStates.department || selectStates.barangay ? 'z-20' : ''} ${isLight ? 'glass neumorphic-light bg-white/80' : 'glass neumorphic-dark bg-card/60'}`}>
            <div className={headerClass()}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBoxClass()}`}>
                <SlidersHorizontal className="w-4 h-4" strokeWidth={2} />
              </div>
              <h2 className="text-base font-semibold text-foreground">Filters</h2>
              <span className="ml-auto text-xs text-muted">{filteredIncidents.length} visible</span>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted mb-1.5 block">Department</label>
                <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                  {({ value }) => (
                    <>
                      <SelectTrigger
                        isOpen={selectStates.department}
                        onClick={() => setSelectStates((s) => ({ department: !s.department, barangay: false }))}
                        className={isLight ? 'bg-gray-50/80 border-gray-200' : 'bg-white/5 border-white/10'}
                      >
                        <SelectValue placeholder="All Departments" value={value} options={departmentOptions} />
                      </SelectTrigger>
                      <SelectContent isOpen={selectStates.department}>
                        {departmentOptions.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            onSelect={(val) => {
                              setFilterDepartment(val);
                              setSelectStates((s) => ({ ...s, department: false }));
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
              <div>
                <label className="text-xs font-medium text-muted mb-1.5 block">Barangay</label>
                <Select value={filterBarangay} onValueChange={setFilterBarangay}>
                  {({ value }) => (
                    <>
                      <SelectTrigger
                        isOpen={selectStates.barangay}
                        onClick={() => setSelectStates((s) => ({ department: false, barangay: !s.barangay }))}
                        className={isLight ? 'bg-gray-50/80 border-gray-200' : 'bg-white/5 border-white/10'}
                      >
                        <SelectValue placeholder="All Barangays" value={value} options={barangayOptions} />
                      </SelectTrigger>
                      <SelectContent isOpen={selectStates.barangay} className="max-h-[240px]">
                        {barangayOptions.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            onSelect={(val) => {
                              setFilterBarangay(val);
                              setSelectStates((s) => ({ ...s, barangay: false }));
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
            </div>
          </div>

          <div className={`${panelClass()} flex-1 min-h-0`}>
            <div className={headerClass()}>
              <h2 className="text-base font-semibold text-foreground">Dagupan City Map</h2>
              <p className="ml-auto text-xs text-muted">Live channel unavailable - refreshes every 30 seconds.</p>
            </div>
            <div className="p-3 h-full">
              <div className="relative w-full h-full min-h-[360px] bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-secondary/20 dark:to-secondary/10 rounded-xl overflow-hidden border border-border/50">
                {error && (
                  <div className="absolute top-3 left-3 z-40 rounded-lg border border-primary/40 bg-primary/15 px-3 py-2 text-xs text-primary">
                    {error}
                  </div>
                )}
                {loading && (
                  <div className="absolute top-3 right-3 z-40 rounded-lg border border-border/60 bg-card/70 px-3 py-1.5 text-xs text-muted">
                    Loading incidents...
                  </div>
                )}
                <div className="absolute inset-0">
                  {filteredIncidents.map((incident, index) => {
                    const isSelected = selectedIncident?.id === incident.id;
                    const markerLeft = 15 + (index % 4) * 25;
                    const markerTop = 20 + Math.floor(index / 4) * 30;
                    return (
                      <div
                        key={incident.id}
                        className="absolute cursor-pointer"
                        style={{
                          left: `${markerLeft}%`,
                          top: `${markerTop}%`,
                          transform: 'translate(-50%, -50%)',
                        }}
                        onClick={() => handleMarkerClick(incident)}
                      >
                        <div
                          className={`relative w-7 h-7 rounded-full ${getSeverityColor(incident.severity)} shadow-lg flex items-center justify-center transition-transform hover:scale-110 ${
                            isSelected && showPopup ? 'ring-2 ring-offset-2 ring-primary z-20' : 'z-10'
                          }`}
                        >
                          <MapPin className="w-4 h-4 text-white" />
                        </div>
                        {isSelected && showPopup && (
                          <div
                            className="absolute z-30 animate-fade-in"
                            style={{
                              left: '50%',
                              top: 'calc(100% + 10px)',
                              transform: 'translateX(-50%)',
                              width: '240px',
                            }}
                          >
                            <div className={`rounded-xl border shadow-lg overflow-hidden ${isLight ? 'glass bg-white/95' : 'glass bg-card'}`}>
                              <div className="p-3">
                                <p className="font-semibold text-foreground text-sm mb-1">{incident.id}</p>
                                <p className="text-sm text-foreground mb-1">{incident.emergencyType}</p>
                                <p className="text-xs text-muted mb-1">Barangay: {incident.barangay}</p>
                                <p className="text-xs text-muted mb-2">Time: {incident.timeReported}</p>
                                <div className="flex items-center justify-between gap-2">
                                  <Badge className={`${getSeverityBadgeColor(incident.severity)} border rounded-lg px-2 py-0.5 text-xs font-semibold`}>
                                    {incident.severity.toUpperCase()}
                                  </Badge>
                                  <Button
                                    size="sm"
                                    className="rounded-lg bg-primary hover:bg-primary-hover text-white gap-1"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      navigate(`/incidents/${incident.id}`);
                                    }}
                                  >
                                    Details
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {!loading && filteredIncidents.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-sm text-muted">No incidents found for the selected filters.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
