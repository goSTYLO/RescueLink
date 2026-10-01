import {
  PHILIPPINES_BOUNDS_NE,
  PHILIPPINES_BOUNDS_SW,
  PHILIPPINES_MIN_ZOOM,
  leafletMapViewportProps,
} from './mapViewport';

describe('mapViewport', () => {
  it('exports Philippines bounds aligned with mobile DagupanMap', () => {
    expect(PHILIPPINES_BOUNDS_SW).toEqual([4.0, 115.8]);
    expect(PHILIPPINES_BOUNDS_NE).toEqual([21.5, 127.2]);
    expect(PHILIPPINES_MIN_ZOOM).toBe(5);
  });

  it('leafletMapViewportProps includes bounds and minZoom', () => {
    const props = leafletMapViewportProps();
    expect(props.minZoom).toBe(5);
    expect(props.maxBoundsViscosity).toBe(1.0);
    expect(props.maxBounds).toBeDefined();
  });
});
