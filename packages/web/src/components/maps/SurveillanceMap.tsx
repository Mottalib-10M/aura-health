import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MapFeature {
  coordinates: { latitude: number; longitude: number };
  caseCount: number;
  diseaseName: string;
  alertLevel: 'watch' | 'warning' | 'alert' | 'emergency';
  region?: string;
  city?: string;
}

export interface SurveillanceMapProps {
  /** GeoJSON features for disease clusters */
  features: MapFeature[];
  /** Map center coordinates */
  center?: [number, number]; // [lng, lat]
  /** Initial zoom level */
  zoom?: number;
  /** Height of the map */
  height?: string;
  /** Called when a feature is clicked */
  onFeatureClick?: (feature: MapFeature) => void;
  /** Time slider value (ISO date string) */
  selectedDate?: string;
  /** Minimum and maximum dates for the time slider */
  dateRange?: { min: string; max: string };
  /** Called when the time slider changes */
  onDateChange?: (date: string) => void;
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// Alert level configuration
// ---------------------------------------------------------------------------

const alertLevelConfig = {
  watch: { color: '#22c55e', label: 'Watch', radius: 12 },
  warning: { color: '#eab308', label: 'Warning', radius: 18 },
  alert: { color: '#f97316', label: 'Alert', radius: 24 },
  emergency: { color: '#ef4444', label: 'Emergency', radius: 32 },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SurveillanceMap({
  features,
  center = [69.2401, 41.2995], // Tashkent, Uzbekistan
  zoom = 5,
  height = '500px',
  onFeatureClick,
  selectedDate,
  dateRange,
  onDateChange,
  className,
}: SurveillanceMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Convert features to a stable key for memoization
  const featuresKey = useMemo(
    () => JSON.stringify(features.map((f) => [f.coordinates.latitude, f.coordinates.longitude, f.caseCount])),
    [features],
  );

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center,
      zoom,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

    map.on('load', () => {
      setIsLoaded(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Only re-initialize on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers when features change
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    features.forEach((feature) => {
      const config = alertLevelConfig[feature.alertLevel];
      const scaleFactor = Math.min(Math.log2(feature.caseCount + 1) / 3, 2.5);
      const radius = config.radius * scaleFactor;

      // Create marker element
      const el = document.createElement('div');
      el.className = 'surveillance-marker';
      el.style.width = `${radius * 2}px`;
      el.style.height = `${radius * 2}px`;
      el.style.borderRadius = '50%';
      el.style.backgroundColor = config.color;
      el.style.opacity = '0.6';
      el.style.border = `2px solid ${config.color}`;
      el.style.cursor = 'pointer';
      el.style.transition = 'transform 0.2s, opacity 0.2s';
      el.setAttribute('role', 'button');
      el.setAttribute(
        'aria-label',
        `${feature.diseaseName}: ${feature.caseCount} cases in ${feature.city ?? feature.region ?? 'Unknown'} - ${config.label} level`,
      );

      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.2)';
        el.style.opacity = '0.9';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
        el.style.opacity = '0.6';
      });

      // Create popup
      const popup = new maplibregl.Popup({ offset: 15, closeButton: false })
        .setHTML(`
          <div style="font-family: Inter, system-ui, sans-serif; padding: 4px;">
            <p style="font-weight: 600; margin: 0 0 4px 0; font-size: 13px;">${feature.diseaseName}</p>
            <p style="margin: 0 0 2px 0; font-size: 12px; color: #64748b;">
              ${feature.city ? `${feature.city}, ` : ''}${feature.region ?? ''}
            </p>
            <p style="margin: 0 0 2px 0; font-size: 12px;">
              <strong>${feature.caseCount.toLocaleString()}</strong> cases
            </p>
            <p style="margin: 0; font-size: 11px; color: ${config.color}; font-weight: 500;">
              ${config.label} Level
            </p>
          </div>
        `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([feature.coordinates.longitude, feature.coordinates.latitude])
        .setPopup(popup)
        .addTo(mapRef.current!);

      el.addEventListener('click', () => {
        onFeatureClick?.(feature);
      });

      markersRef.current.push(marker);
    });
    // featuresKey used as a stable dependency proxy
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, featuresKey, onFeatureClick]);

  // Time slider handler
  const handleTimeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!dateRange || !onDateChange) return;
      const minTime = new Date(dateRange.min).getTime();
      const maxTime = new Date(dateRange.max).getTime();
      const value = Number(e.target.value);
      const date = new Date(minTime + (value / 100) * (maxTime - minTime));
      onDateChange(date.toISOString().split('T')[0]);
    },
    [dateRange, onDateChange],
  );

  const sliderValue = useMemo(() => {
    if (!dateRange || !selectedDate) return 100;
    const minTime = new Date(dateRange.min).getTime();
    const maxTime = new Date(dateRange.max).getTime();
    const currentTime = new Date(selectedDate).getTime();
    return ((currentTime - minTime) / (maxTime - minTime)) * 100;
  }, [dateRange, selectedDate]);

  return (
    <div className={cn('relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700', className)}>
      {/* Map container */}
      <div ref={mapContainer} style={{ height }} />

      {/* Legend */}
      <div className="absolute bottom-12 left-3 z-10 rounded-lg bg-white/90 p-3 shadow-lg backdrop-blur dark:bg-slate-800/90">
        <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
          Alert Levels
        </p>
        <div className="space-y-1.5">
          {Object.entries(alertLevelConfig).map(([level, config]) => (
            <div key={level} className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: config.color, opacity: 0.7 }}
              />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {config.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Time slider */}
      {dateRange && onDateChange && (
        <div className="absolute bottom-3 left-1/2 z-10 flex w-80 -translate-x-1/2 items-center gap-3 rounded-lg bg-white/90 px-4 py-2 shadow-lg backdrop-blur dark:bg-slate-800/90">
          <span className="text-2xs text-slate-500">
            {new Date(dateRange.min).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={sliderValue}
            onChange={handleTimeChange}
            className="flex-1 accent-primary-600"
            aria-label="Select date for temporal view"
          />
          <span className="text-2xs text-slate-500">
            {new Date(dateRange.max).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
        </div>
      )}

      {/* Loading overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-900">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
            <span className="text-sm text-slate-500">Loading map...</span>
          </div>
        </div>
      )}
    </div>
  );
}
