import { Layout } from '@/presentation/components/layout/Layout';
import { Breadcrumb } from '@/presentation/components/common/Breadcrumb';
import { Badge } from '@/presentation/components/ui/Badge';
import { Button } from '@/presentation/components/ui/Button';
import { SlidersHorizontal, Map, Link2, MapPin } from 'lucide-react';
import { incidents as mockIncidents, barangays } from '@/data/mock/mockData';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';
import { getIncidents, normalizeIncidentStatus } from '@/data/api/incidents.api';
import { isVolunteerResolved } from '@/core/utils/incidentDisplay';
import { DEV_MODE } from '@/core/config/app.config';
import { useIncidentWebSocketStatus } from '@/presentation/context/IncidentWebSocketContext';
import { MapContainer, Marker, Popup, TileLayer, Tooltip } from 'react-leaflet';
import L from 'leaflet';

const POLLING_INTERVAL_MS = 60000;
const POLLING_WHEN_WS_CONNECTED_MS = 120000;
const ACTIVE_STATUSES = new Set(['pending', 'verified', 'in_progress']);
const DAGUPAN_CENTER = [16.043, 120.333];

function mapApiIncidentToMap(api) {
  const typeMap = { fire: 'Fire', medical: 'Medical', police: 'Police', disaster: 'Disaster', sos: 'SOS', other: 'Other' };
  const emergencyType = typeMap[api.incident_type?.toLowerCase()] || (api.incident_type ? String(api.incident_type).charAt(0).toUpperCase() + String(api.incident_type).slice(1) : 'Unknown');
  const severityMap = { high: 'Critical', critical: 'Critical', medium: 'Warning', low: 'Low' };
  const severity = severityMap[api.severity_level?.toLowerCase()] || 'Warning';
  const canonicalStatus = normalizeIncidentStatus(api.status);
  let timeReported = '-';
  if (api.created_at) {
    const d = new Date(api.created_at);
    timeReported = d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  }

  return {
    id: api.report_id,
    emergencyType,
    severity,
    barangay: api.barangay || '-',
    reporterName: [api.reporter_first_name, api.reporter_last_name].filter(Boolean).join(' ').trim() || 'Reporter',
    timeReported,
    status: canonicalStatus,
    responderStatus: api.responder_status || null,
    location: {
      lat: Number(api.latitude),
      lng: Number(api.longitude),
    },
  };
}

function getSeverityMarkerIcon(severity) {
  let fill = '#64748b';
  if (severity === 'Critical') fill = '#dc2626';
  if (severity === 'Warning') fill = '#d97706';
  if (severity === 'Low') fill = '#16a34a';

  return L.divIcon({
    className: 'incident-marker',
    html: `<svg viewBox="0 0 32 32" width="30" height="30" xmlns="http://www.w3.org/2000/svg"><path fill="${fill}" stroke="#ffffff" stroke-width="2" d="M16 2C9.4 2 4 7.4 4 14c0 8.3 9.1 15.6 11 16.9a2 2 0 0 0 2 0C18.9 29.6 28 22.3 28 14c0-6.6-5.4-12-12-12z"/><circle cx="16" cy="14" r="4" fill="#ffffff"/></svg>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -26],
  });
}

function buildMapLinks(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { openStreetMap: null, googleMaps: null };
  }
  return {
    openStreetMap: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`,
    googleMaps: `https://www.google.com/maps?q=${lat},${lng}`,
  };
}

export function MapViewPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { isConnected: wsConnected } = useIncidentWebSocketStatus();
  const isLight = theme === 'light';
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [filterDepartment, setFilterDepartment] = useState('All');
  const [filterBarangay, setFilterBarangay] = useState('All');
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
      const data = await getIncidents({ limit: 60, offset: 0 });
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
    const intervalMs = wsConnected ? POLLING_WHEN_WS_CONNECTED_MS : POLLING_INTERVAL_MS;
    const interval = setInterval(fetchIncidents, intervalMs);
    const handleIncidentUpdated = () => fetchIncidents();
    window.addEventListener('incident:updated', handleIncidentUpdated);
    return () => {
      clearInterval(interval);
      window.removeEventListener('incident:updated', handleIncidentUpdated);
    };
  }, [fetchIncidents, wsConnected]);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      if (isVolunteerResolved(inc.responderStatus)) return false;
      if (!ACTIVE_STATUSES.has(inc.status)) return false;
      if (!Number.isFinite(Number(inc.location?.lat)) || !Number.isFinite(Number(inc.location?.lng))) return false;
      if (filterDepartment !== 'All' && inc.emergencyType !== filterDepartment) return false;
      if (filterBarangay !== 'All' && inc.barangay !== filterBarangay) return false;
      return true;
    });
  }, [incidents, filterDepartment, filterBarangay]);

  const getSeverityBadgeColor = (severity) => {
    switch (severity) {
      case 'Critical': return 'bg-primary/20 text-primary border-primary/50';
      case 'Warning': return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'Low': return 'bg-severity-resolved/20 text-severity-resolved border-emerald-500/40';
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
    ...barangays.map((b) => ({ value: b, label: b })),
  ];

  const panelClass = () =>
    `rounded-2xl border transition-all duration-300 ${
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
      <div className="flex flex-col p-4 md:p-6 gap-4">
        <div className="w-full max-w-7xl mx-auto flex flex-col gap-4">
          <Breadcrumb items={[{ label: 'Home', path: '/dashboard' }, { label: 'Map' }]} />
          <div className={`${panelClass()} overflow-visible`}>
            <div className="p-4 md:p-5 flex flex-wrap items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBoxClass()}`}>
                <Map className="w-5 h-5" strokeWidth={2} />
              </div>
              <div className="min-w-[180px]">
                <h1 className="text-xl md:text-2xl font-bold text-foreground">Emergency Map</h1>
                <p className="text-sm text-muted">Active incidents across Dagupan City</p>
              </div>
              <span className="ml-auto text-xs text-muted">
                {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}` : 'Loading latest data...'}
              </span>
            </div>
          </div>

          <div className={panelClass()}>
            <div className={headerClass()}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBoxClass()}`}>
                <SlidersHorizontal className="w-4 h-4" strokeWidth={2} />
              </div>
              <h2 className="text-base font-semibold text-foreground">Dagupan City Map</h2>
              <p className="ml-auto text-xs text-muted">Showing only active incidents (pending, verified, in progress).</p>
            </div>
            <div className="px-3 pt-3 pb-2 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted mb-1.5 block">Department</label>
                <select
                  value={filterDepartment}
                  onChange={(event) => setFilterDepartment(event.target.value)}
                  style={{ colorScheme: isLight ? 'light' : 'dark' }}
                  className={`w-full h-10 rounded-md px-3 text-sm border appearance-none ${isLight ? 'bg-gray-50/80 border-gray-200 text-gray-900' : 'bg-slate-900 border-slate-700 text-slate-100'}`}
                >
                  {departmentOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted mb-1.5 block">Barangay</label>
                <select
                  value={filterBarangay}
                  onChange={(event) => setFilterBarangay(event.target.value)}
                  style={{ colorScheme: isLight ? 'light' : 'dark' }}
                  className={`w-full h-10 rounded-md px-3 text-sm border appearance-none ${isLight ? 'bg-gray-50/80 border-gray-200 text-gray-900' : 'bg-slate-900 border-slate-700 text-slate-100'}`}
                >
                  {barangayOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-3 pb-2">
              <div className={`rounded-lg border px-3 py-2 text-xs flex items-center gap-4 ${isLight ? 'bg-white/95 border-gray-200 text-gray-700' : 'bg-card/95 border-white/20 text-muted'}`}>
                <p className="font-semibold">Severity Legend</p>
                <div className="flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-600" />Critical</div>
                <div className="flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-600" />Warning</div>
                <div className="flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-600" />Low</div>
              </div>
            </div>
            <div className="p-3 pt-1 min-h-[560px] relative">
              {error && (
                <div className="absolute top-4 left-5 z-[999] rounded-lg border border-primary/40 bg-primary/15 px-3 py-2 text-xs text-primary">
                  {error}
                </div>
              )}
              {loading && (
                <div className="absolute top-4 right-5 z-[999] rounded-lg border border-border/60 bg-card/70 px-3 py-1.5 text-xs text-muted">
                  Loading incidents...
                </div>
              )}

              <div className="h-[58vh] min-h-[420px] rounded-xl overflow-hidden border border-border/50">
                <MapContainer center={DAGUPAN_CENTER} zoom={13} style={{ width: '100%', height: '100%' }}>
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />

                  {filteredIncidents.map((incident) => {
                    const links = buildMapLinks(incident.location.lat, incident.location.lng);
                    return (
                      <Marker
                        key={incident.id}
                        position={[incident.location.lat, incident.location.lng]}
                        icon={getSeverityMarkerIcon(incident.severity)}
                        eventHandlers={{
                          click: () => navigate(`/incidents/${incident.id}`),
                        }}
                      >
                        <Tooltip direction="top" offset={[0, -18]} opacity={0.95}>
                          <div className="text-xs">
                            <div className="font-semibold">{incident.emergencyType}</div>
                            <div>Reporter: {incident.reporterName}</div>
                          </div>
                        </Tooltip>
                        <Popup>
                          <div className="space-y-2 min-w-[220px]">
                            <p className="font-semibold text-sm">Incident #{incident.id}</p>
                            <p className="text-xs">{incident.emergencyType}</p>
                            <p className="text-xs">Reporter: {incident.reporterName}</p>
                            <p className="text-xs">Barangay: {incident.barangay}</p>
                            <p className="text-xs">Reported: {incident.timeReported}</p>
                            <Badge className={`${getSeverityBadgeColor(incident.severity)} border rounded-lg px-2 py-0.5 text-[10px] font-semibold`}>
                              {incident.severity.toUpperCase()}
                            </Badge>
                            <div className="pt-1 flex flex-wrap items-center gap-1.5">
                              {links.openStreetMap && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[10px]"
                                  onClick={() => window.open(links.openStreetMap, '_blank', 'noopener,noreferrer')}
                                >
                                  <MapPin className="w-3 h-3 mr-1" />
                                  OSM
                                </Button>
                              )}
                              {links.googleMaps && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[10px]"
                                  onClick={() => window.open(links.googleMaps, '_blank', 'noopener,noreferrer')}
                                >
                                  <Link2 className="w-3 h-3 mr-1" />
                                  Google
                                </Button>
                              )}
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              </div>

              {!loading && filteredIncidents.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="rounded-lg border border-border/70 bg-card/90 px-4 py-2 text-sm text-muted">No active incidents for current filters.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
