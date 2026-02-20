import Map, { Marker } from 'react-map-gl/mapbox';
import { MAPBOX_ACCESS_TOKEN } from '@/core/config/app.config';
import { MapPin } from 'lucide-react';

export function IncidentMap({ latitude, longitude, className = '' }) {

  if (!MAPBOX_ACCESS_TOKEN) {
    return (
      <div
        className={`flex items-center justify-center bg-muted/30 rounded-lg border border-border text-muted ${className}`}
      >
        <p className="text-sm">Map unavailable. Set VITE_MAPBOX_ACCESS_TOKEN in .env</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ minHeight: 192 }}>
      <Map
        mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
        initialViewState={{
          longitude,
          latitude,
          zoom: 14,
        }}
        style={{ width: '100%', height: '100%', minHeight: 192, borderRadius: 8 }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
      >
        <Marker longitude={longitude} latitude={latitude} anchor="bottom">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white shadow-lg">
            <MapPin className="w-4 h-4" />
          </div>
        </Marker>
      </Map>
    </div>
  );
}
