import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './App.css';

// Types
interface UrbanityScore {
  name: string;
  prefecture: string;
  score: number;
  cvs: number;
  super: number;
  restaurant: number;
}

interface UrbanityData {
  [regionCode: string]: UrbanityScore;
}

function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<UrbanityScore | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [urbanityData, setUrbanityData] = useState<UrbanityData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load urbanity data
  useEffect(() => {
    fetch('/data/urbanity_scores.json')
      .then((res) => res.json())
      .then((data: UrbanityData) => {
        setUrbanityData(data);
        // Set initial selected region (Tokyo Chiyoda)
        if (data['13101']) {
          setSelectedRegion(data['13101']);
        }
      })
      .catch(console.error);
  }, []);

  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            'gsi-pale': {
              type: 'raster',
              tiles: ['https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>',
              maxzoom: 18
            }
          },
          layers: [
            {
              id: 'gsi-pale-layer',
              type: 'raster',
              source: 'gsi-pale',
              minzoom: 0,
              maxzoom: 18
            }
          ]
        },
        center: [139.7671, 35.6812], // Tokyo
        zoom: 5,
        maxBounds: [[122, 24], [154, 46]] // Japan bounds
      });

      map.current.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        'bottom-right'
      );

      map.current.on('error', (e) => {
        console.error('Map error:', e);
      });

      map.current.once('load', () => {
        if (!map.current) return;

        // Add GeoJSON source for Tokyo 23 wards
        fetch('/data/tokyo_municipalities.geojson')
          .then((res) => res.json())
          .then((geojson) => {
            if (!map.current) return;

            // Add source
            map.current.addSource('municipalities', {
              type: 'geojson',
              data: geojson
            });

            // Add fill layer with color based on score
            map.current.addLayer({
              id: 'municipalities-fill',
              type: 'fill',
              source: 'municipalities',
              paint: {
                'fill-color': [
                  'interpolate',
                  ['linear'],
                  ['get', 'score'],
                  0, '#6366f1',   // 田舎: インディゴ
                  50, '#8b5cf6',  // 郊外: バイオレット
                  75, '#f97316',  // 都市: オレンジ
                  100, '#ea580c'  // 大都市: ディープオレンジ
                ],
                'fill-opacity': 0.7
              }
            });

            // Add border layer
            map.current.addLayer({
              id: 'municipalities-border',
              type: 'line',
              source: 'municipalities',
              paint: {
                'line-color': '#ffffff',
                'line-width': 1
              }
            });

            // Change cursor on hover
            map.current.on('mouseenter', 'municipalities-fill', () => {
              if (map.current) map.current.getCanvas().style.cursor = 'pointer';
            });
            map.current.on('mouseleave', 'municipalities-fill', () => {
              if (map.current) map.current.getCanvas().style.cursor = '';
            });

            // Click handler
            map.current.on('click', 'municipalities-fill', (e) => {
              if (e.features && e.features[0]) {
                const props = e.features[0].properties;
                if (props) {
                  setSelectedRegion({
                    name: props.name,
                    prefecture: props.prefecture,
                    score: props.score,
                    cvs: props.cvs,
                    super: props.super,
                    restaurant: props.restaurant
                  });
                  setSelectedCode(props.code);
                }
              }
            });

            // Zoom to Tokyo after loading
            map.current.flyTo({
              center: [139.75, 35.69],
              zoom: 10
            });
          })
          .catch(console.error);

        setIsLoading(false);
      });

    } catch (error) {
      console.error('Map initialization error:', error);
      setIsLoading(false);
    }

    return () => {
      map.current?.remove();
    };
  }, []);

  // Update highlight when selected region changes
  useEffect(() => {
    if (!map.current || !selectedCode) return;

    const mapInstance = map.current;

    // Check if highlight layer exists, if not create it
    if (!mapInstance.getLayer('municipalities-highlight')) {
      if (mapInstance.getSource('municipalities')) {
        mapInstance.addLayer({
          id: 'municipalities-highlight',
          type: 'line',
          source: 'municipalities',
          paint: {
            'line-color': '#f97316',
            'line-width': 4
          },
          filter: ['==', ['get', 'code'], '']
        });
      }
    }

    // Update filter to highlight selected municipality
    if (mapInstance.getLayer('municipalities-highlight')) {
      mapInstance.setFilter('municipalities-highlight', ['==', ['get', 'code'], selectedCode]);
    }
  }, [selectedCode]);

  // Search handler
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (urbanityData && query.length > 0) {
      const found = Object.entries(urbanityData).find(([, data]) =>
        data.name.includes(query)
      );
      if (found) {
        setSelectedRegion(found[1]);
      }
    }
  };

  // Get color for score
  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'var(--color-metro)';
    if (score >= 75) return 'var(--color-accent)';
    if (score >= 50) return 'var(--color-suburban)';
    return 'var(--color-rural)';
  };

  return (
    <div className="app-container">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
        </div>
      )}

      {/* Sidebar */}
      <aside className="sidebar">
        {/* Brand */}
        <div className="brand">
          <h1 className="brand__logo">URBANITY MAP</h1>
          <p className="brand__tagline">全国市町村の都会度マップ</p>
        </div>

        {/* Search */}
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="市区町村を検索..."
            value={searchQuery}
            onChange={handleSearch}
          />
        </div>

        {/* Info Panel */}
        <div className="info-panel">
          {selectedRegion ? (
            <div className="region-card">
              <h2 className="region-card__name">{selectedRegion.name}</h2>
              <p className="region-card__prefecture">{selectedRegion.prefecture}</p>

              {/* Score Display */}
              <div className="score-display">
                <span
                  className="score-display__value"
                  style={{ color: getScoreColor(selectedRegion.score) }}
                >
                  {selectedRegion.score}
                </span>
                <span className="score-display__max">/ 100</span>
              </div>
              <p className="score-display__label">URBANITY SCORE</p>
            </div>
          ) : (
            <div className="info-panel__empty">
              <div className="info-panel__empty-icon">🗾</div>
              <p>地図上の市区町村をクリック<br />または検索してください</p>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="legend">
          <p className="legend__title">都会度スケール</p>
          <div className="legend__gradient-container">
            <div className="legend__gradient" />
            {selectedRegion && (
              <div
                className="legend__indicator"
                style={{ left: `${selectedRegion.score}%` }}
              />
            )}
          </div>
          <div className="legend__labels">
            <span>田舎</span>
            <span>郊外</span>
            <span>都市</span>
            <span>大都市</span>
          </div>
        </div>
      </aside>

      {/* Map */}
      <div className="map-container" ref={mapContainer} />
    </div>
  );
}

export default App;
