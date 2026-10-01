import { useEffect, useState } from 'react';
import { GeoJSON } from 'react-leaflet';

const BOUNDARY_STYLE = {
  color: '#4F46E5',
  weight: 2,
  fillColor: '#4F46E5',
  fillOpacity: 0.08,
};

let cachedGeo = null;
let loadPromise = null;

function loadDagupanGeojson() {
  if (cachedGeo) return Promise.resolve(cachedGeo);
  if (!loadPromise) {
    loadPromise = fetch('/geojson/dagupan.geojson')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load Dagupan boundary');
        return res.json();
      })
      .then((data) => {
        cachedGeo = data;
        return data;
      });
  }
  return loadPromise;
}

export function DagupanBoundaryLayer() {
  const [geo, setGeo] = useState(cachedGeo);

  useEffect(() => {
    if (geo) return undefined;
    let cancelled = false;
    loadDagupanGeojson()
      .then((data) => {
        if (!cancelled) setGeo(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [geo]);

  if (!geo) return null;

  return <GeoJSON data={geo} style={BOUNDARY_STYLE} />;
}
