import { Layout } from '@/presentation/components/layout/Layout';
import { Breadcrumb } from '@/presentation/components/common/Breadcrumb';
import { Alert, Button, Card, Select, Tag } from 'antd';
import { SlidersHorizontal, Map, Link2, MapPin } from 'lucide-react';
import { incidents as mockIncidents, barangays } from '@/data/mock/mockData';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getIncidents, normalizeIncidentStatus } from '@/data/api/incidents.api';
import { isVolunteerResolved } from '@/core/utils/incidentDisplay';
import { DEV_MODE } from '@/core/config/app.config';
import { getAuthToken } from '@/core/auth/session';
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

function severityTagColor(severity) {
  if (severity === 'Critical') return 'red';
  if (severity === 'Warning') return 'gold';
  if (severity === 'Low') return 'green';
  return 'default';
}

export function MapViewPage() {
  const navigate = useNavigate();
  const { isConnected: wsConnected } = useIncidentWebSocketStatus();
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
    const token = getAuthToken();
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

  return (
    <Layout>
      <div className="p-4 max-w-7xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Breadcrumb items={[{ label: 'Home', path: '/dashboard' }, { label: 'Map' }]} />
        <Card
          size="small"
          title={(
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Map size={18} />
              Emergency Map
            </span>
          )}
          extra={(
            <span style={{ fontSize: 12, opacity: 0.7 }}>
              {lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
                : 'Loading latest data...'}
            </span>
          )}
        >
          <p style={{ margin: 0, opacity: 0.75 }}>Active incidents across Dagupan City</p>
        </Card>

        <Card
          size="small"
          title={(
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <SlidersHorizontal size={16} />
              Dagupan City Map
            </span>
          )}
          extra={<span style={{ fontSize: 12, opacity: 0.7 }}>Showing only active incidents (pending, verified, in progress).</span>}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4, opacity: 0.7 }}>Department</div>
              <Select
                style={{ width: '100%' }}
                value={filterDepartment}
                onChange={setFilterDepartment}
                options={departmentOptions}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4, opacity: 0.7 }}>Barangay</div>
              <Select
                style={{ width: '100%' }}
                value={filterBarangay}
                onChange={setFilterBarangay}
                options={barangayOptions}
                showSearch
                optionFilterProp="label"
              />
            </div>
          </div>

          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message={(
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <strong>Severity Legend</strong>
                <span><Tag color="red">Critical</Tag></span>
                <span><Tag color="gold">Warning</Tag></span>
                <span><Tag color="green">Low</Tag></span>
              </span>
            )}
          />

          <div style={{ position: 'relative', minHeight: 420 }}>
            {error && (
              <Alert type="error" showIcon message={error} style={{ position: 'absolute', top: 8, left: 8, zIndex: 999, maxWidth: 320 }} />
            )}
            {loading && (
              <Alert type="info" showIcon message="Loading incidents..." style={{ position: 'absolute', top: 8, right: 8, zIndex: 999 }} />
            )}

            <div style={{ height: '58vh', minHeight: 420, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)' }}>
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
                        <div style={{ fontSize: 12 }}>
                          <div style={{ fontWeight: 600 }}>{incident.emergencyType}</div>
                          <div>Reporter: {incident.reporterName}</div>
                        </div>
                      </Tooltip>
                      <Popup>
                        <div style={{ minWidth: 220 }}>
                          <p style={{ fontWeight: 600, marginBottom: 4 }}>Incident #{incident.id}</p>
                          <p style={{ fontSize: 12, margin: '2px 0' }}>{incident.emergencyType}</p>
                          <p style={{ fontSize: 12, margin: '2px 0' }}>Reporter: {incident.reporterName}</p>
                          <p style={{ fontSize: 12, margin: '2px 0' }}>Barangay: {incident.barangay}</p>
                          <p style={{ fontSize: 12, margin: '2px 0' }}>Reported: {incident.timeReported}</p>
                          <Tag color={severityTagColor(incident.severity)}>{incident.severity.toUpperCase()}</Tag>
                          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {links.openStreetMap && (
                              <Button
                                icon={<MapPin size={12} />}
                                onClick={() => window.open(links.openStreetMap, '_blank', 'noopener,noreferrer')}
                              >
                                OSM
                              </Button>
                            )}
                            {links.googleMaps && (
                              <Button
                                icon={<Link2 size={12} />}
                                onClick={() => window.open(links.googleMaps, '_blank', 'noopener,noreferrer')}
                              >
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
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <Alert type="info" message="No active incidents for current filters." showIcon />
              </div>
            )}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
