import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './App.css';

// Types
interface UrbanityScore {
  [code: string]: number; // code -> score (0-100)
}

interface RegionInfo {
  name: string;
  prefecture: string;
  code: string;
  score: number;
}

function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<RegionInfo | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [urbanityData, setUrbanityData] = useState<UrbanityScore | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Load urbanity data (night light scores)
  useEffect(() => {
    fetch('/data/urbanity-score.json')
      .then((res) => res.json())
      .then((data: UrbanityScore) => {
        setUrbanityData(data);
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

        // Add GeoJSON source for all Japan municipalities (with embedded scores)
        fetch('/data/japan-with-scores.geojson')
          .then((res) => res.json())
          .then((geojson) => {
            if (!map.current) return;

            // Add source
            map.current.addSource('municipalities', {
              type: 'geojson',
              data: geojson
            });

            // Add fill layer with night light color scale (dark to bright)
            map.current.addLayer({
              id: 'municipalities-fill',
              type: 'fill',
              source: 'municipalities',
              paint: {
                'fill-color': [
                  'interpolate',
                  ['linear'],
                  ['coalesce', ['get', 'score'], 0],
                  0, '#0c0c1e',   // 暗い: 深い紺色（夜空）
                  25, '#1a1a4e', // やや暗い
                  50, '#f59e0b', // 中間: アンバー
                  75, '#fbbf24', // 明るい: イエロー
                  100, '#fef3c7' // 最も明るい: クリームホワイト
                ],
                'fill-opacity': 0.85
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
                  // Build municipality name from N03 fields
                  // N03_003: city (市区), N03_004: ward/town (区町村)
                  const cityName = props.N03_003 || '';
                  const wardName = props.N03_004 || '';
                  const name = cityName + (wardName && wardName !== cityName ? wardName : '');

                  setSelectedRegion({
                    name: name || '不明',
                    prefecture: props.N03_001 || '',
                    code: props.N03_007 || '',
                    score: props.score || 0
                  });
                  setSelectedCode(props.N03_007);
                }
              }
            });

            // Zoom to Japan view after loading
            map.current.flyTo({
              center: [137.0, 38.0],
              zoom: 5
            });
            setIsLoading(false);
          })
          .catch((err) => {
            console.error('Failed to load municipalities:', err);
            setIsLoading(false);
          });

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
            'line-color': '#ffffff',
            'line-width': 5
          },
          filter: ['==', ['get', 'N03_007'], '']
        });
      }
    }

    // Update filter to highlight selected municipality
    if (mapInstance.getLayer('municipalities-highlight')) {
      mapInstance.setFilter('municipalities-highlight', ['==', ['get', 'N03_007'], selectedCode]);
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

  // Get color for score (night light theme)
  const getScoreColor = (score: number): string => {
    if (score >= 75) return '#fef3c7'; // Very bright
    if (score >= 50) return '#fbbf24'; // Bright
    if (score >= 25) return '#f59e0b'; // Medium
    return '#1a1a4e'; // Dark
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
          <p className="legend__title">夜間光輝度</p>
          <div className="legend__gradient-container">
            <div className="legend__gradient" style={{
              background: 'linear-gradient(to right, #0c0c1e, #1a1a4e, #f59e0b, #fbbf24, #fef3c7)'
            }} />
            {selectedRegion && (
              <div
                className="legend__indicator"
                style={{ left: `${selectedRegion.score}%` }}
              />
            )}
          </div>
          <div className="legend__labels">
            <span>暗い</span>
            <span></span>
            <span></span>
            <span>明るい</span>
          </div>
        </div>
      </aside>

      {/* Map */}
      <div className="map-container" ref={mapContainer} />
    </div>
  );
}

export default App;
