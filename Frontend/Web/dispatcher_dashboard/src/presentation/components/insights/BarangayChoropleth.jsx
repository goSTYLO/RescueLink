import { useEffect, useMemo, useState } from 'react';
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet';
import { getBarangaysGeojson } from '@/data/api/analytics.api';
import { choroplethFill } from '@/presentation/components/insights/insightsColors';
import { formatBarangayTypeSummary } from '@/presentation/components/insights/BarangayTypesCell';
import { DAGUPAN_CENTER, DAGUPAN_MAP_ZOOM } from '@/core/constants/dagupanMap';
import { leafletMapViewportProps } from '@/core/constants/mapViewport';
import { MapRecenterControl } from '@/presentation/components/common/MapRecenterControl';

function norm(value) {
  return String(value || '').trim().toLowerCase();
}

function titleCase(value) {
  const s = String(value || '').replace(/_/g, ' ').trim();
  if (!s) return 'Unknown';
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function BarangayChoropleth({ barangays, selected, onSelect, isLight = true }) {
  const [geo, setGeo] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getBarangaysGeojson()
      .then((data) => {
        if (!cancelled) setGeo(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Map failed to load');
      });
    return () => { cancelled = true; };
  }, []);

  const counts = useMemo(() => {
    const map = new Map();
    for (const row of barangays || []) {
      map.set(norm(row.key), Number(row.count) || 0);
    }
    return map;
  }, [barangays]);
  const typesByBarangay = useMemo(() => {
    const map = new Map();
    for (const row of barangays || []) {
      map.set(norm(row.key), row.types || []);
    }
    return map;
  }, [barangays]);
  const max = Math.max(1, ...counts.values());
  const selectedNorm = norm(selected);
  const typesSignature = useMemo(
    () => (barangays || []).map((row) => `${norm(row.key)}:${(row.types || []).map((t) => `${t.key}=${t.count}`).join(',')}`).join(';'),
    [barangays]
  );

  const styleFn = (feature) => {
    const name = feature?.properties?.NAME_3;
    const count = counts.get(norm(name)) || 0;
    const isSelected = selectedNorm && norm(name) === selectedNorm;
    return {
      color: isSelected ? '#0f172a' : '#134178',
      weight: isSelected ? 2.5 : 1,
      fillColor: choroplethFill(count, max, isLight),
      fillOpacity: 0.9,
    };
  };

  function onEachFeature(feature, layer) {
    const name = feature?.properties?.NAME_3 || 'Unknown';
    const count = counts.get(norm(name)) || 0;
    const typeSummary = formatBarangayTypeSummary(typesByBarangay.get(norm(name)), titleCase);
    const tip = typeSummary ? `${name}: ${count} — ${typeSummary}` : `${name}: ${count}`;
    layer.bindTooltip(tip);
    layer.on('click', () => onSelect?.(name));
  }

  if (error) {
    return <p className="text-sm text-muted">{error}. Widen the dates or reload.</p>;
  }
  if (!geo) {
    return <p className="text-sm text-muted">Loading map…</p>;
  }

  return (
    <div className="insights-choropleth w-full min-w-0 rounded-lg overflow-hidden border border-[rgba(19,65,120,0.2)] relative z-0 isolate">
      <MapContainer
        center={DAGUPAN_CENTER}
        zoom={DAGUPAN_MAP_ZOOM.overview}
        scrollWheelZoom={false}
        {...leafletMapViewportProps()}
        className="h-full w-full z-0"
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MapRecenterControl center={DAGUPAN_CENTER} zoom={DAGUPAN_MAP_ZOOM.overview} />
        <GeoJSON
          key={`${selected || 'all'}-${max}-${typesSignature}`}
          data={geo}
          style={styleFn}
          onEachFeature={onEachFeature}
        />
      </MapContainer>
    </div>
  );
}
