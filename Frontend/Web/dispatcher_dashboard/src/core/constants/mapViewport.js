import L from 'leaflet';

/** Southern/western corner of Philippines viewport (lat, lng). */
export const PHILIPPINES_BOUNDS_SW = [4.0, 115.8];

/** Northern/eastern corner of Philippines viewport (lat, lng). */
export const PHILIPPINES_BOUNDS_NE = [21.5, 127.2];

export const PHILIPPINES_MIN_ZOOM = 5;

export const PHILIPPINES_MAX_ZOOM = 18;

export const PHILIPPINES_BOUNDS = L.latLngBounds(
  PHILIPPINES_BOUNDS_SW,
  PHILIPPINES_BOUNDS_NE,
);

/** Spread onto react-leaflet MapContainer. */
export function leafletMapViewportProps() {
  return {
    minZoom: PHILIPPINES_MIN_ZOOM,
    maxZoom: PHILIPPINES_MAX_ZOOM,
    maxBounds: PHILIPPINES_BOUNDS,
    maxBoundsViscosity: 1.0,
  };
}
