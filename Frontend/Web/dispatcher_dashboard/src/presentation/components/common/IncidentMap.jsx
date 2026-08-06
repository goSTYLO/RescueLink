import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Icon } from 'leaflet';
import { MapPin } from 'lucide-react';
import L from 'leaflet';

// Create custom marker icon
const customIcon = new Icon({
  iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234F46E5" width="32" height="32"><path d="M12 2C6.48 2 2 6.48 2 12c0 5.52 3.48 10.34 8 11.81V21c0-1.1.9-2 2-2s2 .9 2 2v2.81C18.52 22.34 22 17.52 22 12 22 6.48 17.52 2 12 2zm0 10c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>',
  shadowUrl: null,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

export function IncidentMap({ latitude, longitude, className = '' }) {
  // Validate coordinates
  if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
    return (
      <div
        className={`flex items-center justify-center bg-muted/30 rounded-lg border border-border text-muted ${className}`}
        style={{ minHeight: 192 }}
      >
        <p className="text-sm">Location not available</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ minHeight: 192, borderRadius: 8, overflow: 'hidden' }}>
      <MapContainer
        center={[latitude, longitude]}
        zoom={14}
        style={{ width: '100%', height: '100%', minHeight: 192 }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <Marker position={[latitude, longitude]} icon={customIcon}>
          <Popup>
            <div className="text-sm font-medium">Incident Location</div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
