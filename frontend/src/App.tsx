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

              {/* Breakdown */}
              <div className="breakdown">
                <div className="breakdown__item">
                  <div className="breakdown__label">
                    <span>コンビニ密度</span>
                    <span>{selectedRegion.cvs}</span>
                  </div>
                  <div className="breakdown__bar">
                    <div
                      className="breakdown__fill breakdown__fill--cvs"
                      style={{ width: `${selectedRegion.cvs}%` }}
                    />
                  </div>
                </div>

                <div className="breakdown__item">
                  <div className="breakdown__label">
                    <span>スーパー密度</span>
                    <span>{selectedRegion.super}</span>
                  </div>
                  <div className="breakdown__bar">
                    <div
                      className="breakdown__fill breakdown__fill--super"
                      style={{ width: `${selectedRegion.super}%` }}
                    />
                  </div>
                </div>

                <div className="breakdown__item">
                  <div className="breakdown__label">
                    <span>飲食店密度</span>
                    <span>{selectedRegion.restaurant}</span>
                  </div>
                  <div className="breakdown__bar">
                    <div
                      className="breakdown__fill breakdown__fill--restaurant"
                      style={{ width: `${selectedRegion.restaurant}%` }}
                    />
                  </div>
                </div>
              </div>
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
          <div className="legend__gradient" />
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
