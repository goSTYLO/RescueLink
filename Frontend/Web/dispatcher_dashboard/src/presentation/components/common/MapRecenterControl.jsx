import { useMap } from 'react-leaflet';
import { LocateFixed } from 'lucide-react';

/**
 * Must be rendered inside MapContainer. Leaflet-positioned recenter control.
 */
export function MapRecenterControl({ center, zoom }) {
  const map = useMap();
  const lat = Number(center?.[0]);
  const lng = Number(center?.[1]);
  const z = Number(zoom);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(z)) {
    return null;
  }

  return (
    <div className="leaflet-top leaflet-right" style={{ pointerEvents: 'auto', marginTop: 8, marginRight: 8 }}>
      <div className="leaflet-control">
        <button
          type="button"
          aria-label="Recenter map"
          title="Recenter map"
          onClick={() => map.setView([lat, lng], z)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 34,
            height: 34,
            border: 'none',
            borderRadius: 4,
            background: '#fff',
            boxShadow: '0 1px 5px rgba(0,0,0,0.35)',
            cursor: 'pointer',
            color: '#334155',
          }}
        >
          <LocateFixed size={18} />
        </button>
      </div>
    </div>
  );
}
