/**
 * @fileoverview アーバニティマップのメインアプリケーションコンポーネント
 *
 * このファイルは日本全国の市区町村の都会度（夜間光輝度）を
 * MapLibre GL JSを使用してインタラクティブに可視化するメインコンポーネントを定義します。
 *
 * @description
 * - 国土地理院の淡色地図をベースマップとして使用
 * - 夜間光データに基づくコロプレスマップを表示
 * - 市区町村のクリックでスコア詳細を表示
 * - 検索機能による市区町村の検索
 */

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './App.css';

/**
 * アーバニティスコアのマッピング
 *
 * @description
 * 市区町村コードをキーとして、0-100のスコア値を持つオブジェクト
 */
interface UrbanityScore {
  /** 市区町村コード -> スコア (0-100) */
  [code: string]: number;
}

/**
 * 選択された地域の情報
 *
 * @description
 * 地図上でクリックされた市区町村の詳細情報を保持
 */
interface RegionInfo {
  /** 市区町村名 */
  name: string;
  /** 都道府県名 */
  prefecture: string;
  /** 市区町村コード（5桁） */
  code: string;
  /** 都会度スコア（0-100） */
  score: number;
  /** 光害度スコア（0-100） */
  lightPollution: number;
}

/**
 * 検索用市区町村アイテム
 */
interface MunicipalityItem {
  name: string;
  fullName: string;  // 都道府県 + 市区町村名
  prefecture: string;
  code: string;
  score: number;
  lightPollution: number;
  center: [number, number];  // [lng, lat] - 地図ズーム用の中心座標
}

/**
 * 表示モードの定義
 *
 * @description
 * 都会度と光害度の切り替えを管理する
 */
type DisplayMode = 'urbanity' | 'lightPollution';

/**
 * モードごとの設定
 */
const MODE_CONFIG: Record<DisplayMode, {
  label: string;
  tagline: string;
  legendTitle: string;
  legendLabels: [string, string];
  gradient: string;
  scoreProperty: string;
  mapColors: string[];
  scoreLabel: string;
  sliderLabels: { label: string; offset: number }[];
}> = {
  urbanity: {
    label: '都会度',
    tagline: '全国市町村の都会度マップ',
    legendTitle: '都会度レベル',
    legendLabels: ['低い', '高い'],
    gradient: 'linear-gradient(to right, #064e3b, #065f46, #059669, #f59e0b, #dc2626)',
    scoreProperty: 'urbanity_v2',
    mapColors: ['#064e3b', '#065f46', '#059669', '#f59e0b', '#dc2626'],
    scoreLabel: 'URBANITY SCORE',
    sliderLabels: [
      { label: '田舎', offset: 20 },
      { label: '郊外', offset: 65 },
      { label: '都市', offset: 85 },
      { label: '大都市', offset: 98 },
    ],
  },
  lightPollution: {
    label: '光害度',
    tagline: '全国市町村の光害マップ',
    legendTitle: '光害レベル',
    legendLabels: ['星空が見える', '光害が濃い'],
    gradient: 'linear-gradient(to right, #0c0c1e, #1a1a4e, #f59e0b, #fbbf24, #fef3c7)',
    scoreProperty: 'light_pollution',
    mapColors: ['#0c0c1e', '#1a1a4e', '#f59e0b', '#fbbf24', '#fef3c7'],
    scoreLabel: 'LIGHT POLLUTION SCORE',
    sliderLabels: [
      { label: '暗い', offset: 10 },
      { label: '普通', offset: 50 },
      { label: '明るい', offset: 90 },
    ],
  },
};

/**
 * アーバニティマップのメインアプリケーションコンポーネント
 *
 * @description
 * 日本全国の市区町村の都会度（夜間光輝度）を可視化するインタラクティブマップを提供します。
 *
 * 機能:
 * - 夜間光データに基づくコロプレスマップ表示
 * - 市区町村クリックによるスコア詳細表示
 * - 市区町村検索機能
 * - スコアに応じた色分け凡例
 *
 * @returns Appコンポーネント
 */
function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<RegionInfo | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [urbanityData, setUrbanityData] = useState<UrbanityScore | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('urbanity');
  const [minScore, setMinScore] = useState(0);
  const [maxScore, setMaxScore] = useState(100);
  const [municipalities, setMunicipalities] = useState<MunicipalityItem[]>([]);
  const [searchResults, setSearchResults] = useState<MunicipalityItem[]>([]);

  // アーバニティデータ（夜間光スコア）を読み込む
  useEffect(() => {
    fetch('/data/urbanity-score.json')
      .then((res) => res.json())
      .then((data: UrbanityScore) => {
        setUrbanityData(data);
      })
      .catch(console.error);
  }, []);

  // マップを初期化する
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
        fetch('/data/japan-with-scores-v2.geojson')
          .then((res) => res.json())
          .then((geojson) => {
            if (!map.current) return;

            // ソースを追加
            map.current.addSource('municipalities', {
              type: 'geojson',
              data: geojson
            });

            // 夜間光カラースケールで塗りつぶしレイヤーを追加（暗い→明るい）
            map.current.addLayer({
              id: 'municipalities-fill',
              type: 'fill',
              source: 'municipalities',
              paint: {
                'fill-color': [
                  'interpolate',
                  ['linear'],
                  ['coalesce', ['get', MODE_CONFIG.urbanity.scoreProperty], 0],
                  0, MODE_CONFIG.urbanity.mapColors[0],
                  25, MODE_CONFIG.urbanity.mapColors[1],
                  50, MODE_CONFIG.urbanity.mapColors[2],
                  75, MODE_CONFIG.urbanity.mapColors[3],
                  100, MODE_CONFIG.urbanity.mapColors[4]
                ],
                'fill-opacity': 0.85
              }
            });

            // 境界線レイヤーを追加
            map.current.addLayer({
              id: 'municipalities-border',
              type: 'line',
              source: 'municipalities',
              paint: {
                'line-color': '#ffffff',
                'line-width': 1
              }
            });

            // ホバー時にカーソルを変更
            map.current.on('mouseenter', 'municipalities-fill', () => {
              if (map.current) map.current.getCanvas().style.cursor = 'pointer';
            });
            map.current.on('mouseleave', 'municipalities-fill', () => {
              if (map.current) map.current.getCanvas().style.cursor = '';
            });

            // クリックハンドラー
            map.current.on('click', 'municipalities-fill', (e) => {
              if (e.features && e.features[0]) {
                const props = e.features[0].properties;
                if (props) {
                  // N03フィールドから市区町村名を構築
                  // N03_003: 市区, N03_004: 区町村
                  const cityName = props.N03_003 || '';
                  const wardName = props.N03_004 || '';
                  const name = cityName + (wardName && wardName !== cityName ? wardName : '');

                  setSelectedRegion({
                    name: name || '不明',
                    prefecture: props.N03_001 || '',
                    code: props.N03_007 || '',
                    score: props.urbanity_v2 || 0,
                    lightPollution: props.light_pollution || 0
                  });
                  setSelectedCode(props.N03_007);
                }
              }
            });

            // 都会度最高の市町村を初期選択
            let maxScore = -1;
            let maxFeature: typeof geojson.features[0] | null = null;
            for (const feature of geojson.features) {
              const score = feature.properties?.urbanity_v2 || 0;
              if (score > maxScore) {
                maxScore = score;
                maxFeature = feature;
              }
            }
            if (maxFeature && maxFeature.properties) {
              const props = maxFeature.properties;
              const cityName = props.N03_003 || '';
              const wardName = props.N03_004 || '';
              const name = cityName + (wardName && wardName !== cityName ? wardName : '');
              setSelectedRegion({
                name: name || '不明',
                prefecture: props.N03_001 || '',
                code: props.N03_007 || '',
                score: props.urbanity_v2 || 0,
                lightPollution: props.light_pollution || 0
              });
              setSelectedCode(props.N03_007);
            }

            // 検索用の市区町村リストを作成
            const municipalityList: MunicipalityItem[] = [];
            const seenCodes = new Set<string>();
            for (const feature of geojson.features) {
              const props = feature.properties;
              if (props && props.N03_007 && !seenCodes.has(props.N03_007)) {
                seenCodes.add(props.N03_007);
                const cityName = props.N03_003 || '';
                const wardName = props.N03_004 || '';
                const name = cityName + (wardName && wardName !== cityName ? wardName : '');
                const prefecture = props.N03_001 || '';

                // ジオメトリから中心座標を計算
                let center: [number, number] = [139.7, 35.7]; // デフォルト（東京）
                const geometry = feature.geometry as GeoJSON.Geometry;
                if (geometry.type === 'Polygon') {
                  const coords = geometry.coordinates[0];
                  const sumLng = coords.reduce((sum, c) => sum + c[0], 0);
                  const sumLat = coords.reduce((sum, c) => sum + c[1], 0);
                  center = [sumLng / coords.length, sumLat / coords.length];
                } else if (geometry.type === 'MultiPolygon') {
                  const firstPolygon = geometry.coordinates[0][0];
                  const sumLng = firstPolygon.reduce((sum, c) => sum + c[0], 0);
                  const sumLat = firstPolygon.reduce((sum, c) => sum + c[1], 0);
                  center = [sumLng / firstPolygon.length, sumLat / firstPolygon.length];
                }

                municipalityList.push({
                  name: name || '不明',
                  fullName: prefecture + name,
                  prefecture,
                  code: props.N03_007,
                  score: props.urbanity_v2 || 0,
                  lightPollution: props.light_pollution || 0,
                  center
                });
              }
            }
            setMunicipalities(municipalityList);

            // 読み込み完了後、日本全体を表示
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

  // 選択された地域が変更されたときにハイライトを更新
  useEffect(() => {
    if (!map.current || !selectedCode) return;

    const mapInstance = map.current;

    // ハイライトレイヤーが存在しない場合は作成
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

    // フィルターを更新して選択された市区町村をハイライト
    if (mapInstance.getLayer('municipalities-highlight')) {
      mapInstance.setFilter('municipalities-highlight', ['==', ['get', 'N03_007'], selectedCode]);
    }
  }, [selectedCode]);

  // 表示モードまたはフィルターが変更されたときにマップスタイルを更新
  useEffect(() => {
    if (!map.current) return;
    const colors = MODE_CONFIG[displayMode].mapColors;
    const scoreProp = MODE_CONFIG[displayMode].scoreProperty;

    if (map.current.getLayer('municipalities-fill')) {
      map.current.setPaintProperty('municipalities-fill', 'fill-color', [
        'case',
        ['all',
          ['>=', ['coalesce', ['get', scoreProp], 0], minScore],
          ['<=', ['coalesce', ['get', scoreProp], 0], maxScore]
        ],
        // 範囲内: 既存の補間ロジック
        [
          'interpolate',
          ['linear'],
          ['coalesce', ['get', scoreProp], 0],
          0, colors[0],
          25, colors[1],
          50, colors[2],
          75, colors[3],
          100, colors[4]
        ],
        // 範囲外: グレーアウト
        '#4a4a4a'
      ]);
    }
  }, [displayMode, minScore, maxScore]);

  /**
   * 検索入力のハンドラー
   *
   * @param e - 入力変更イベント
   * @description
   * 入力された検索クエリに基づいて市区町村を検索し、
   * 結果をドロップダウンに表示します。
   */
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.length > 0 && municipalities.length > 0) {
      // 部分一致検索（最大10件）
      const results = municipalities
        .filter(m => m.fullName.includes(query) || m.name.includes(query))
        .slice(0, 10);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  /**
   * 検索結果を選択するハンドラー
   */
  const handleSelectSearchResult = (item: MunicipalityItem) => {
    setSelectedRegion({
      name: item.name,
      prefecture: item.prefecture,
      code: item.code,
      score: item.score,
      lightPollution: item.lightPollution
    });
    setSelectedCode(item.code);
    setSearchQuery('');
    setSearchResults([]);

    // 選択した市区町村にズーム
    if (map.current) {
      map.current.flyTo({
        center: item.center,
        zoom: 10,
        duration: 1500
      });
    }
  };

  /**
   * スコアに応じた色を取得する（夜間光テーマ）
   *
   * @param score - アーバニティスコア（0-100）
   * @returns スコアに対応するカラーコード
   * @description
   * スコアの範囲に応じて以下の色を返します：
   * - 75以上: とても明るい（クリームホワイト）
   * - 50-74: 明るい（イエロー）
   * - 25-49: 中間（アンバー）
   * - 0-24: 暗い（深紺）
   */
  const getScoreColor = (score: number): string => {
    const colors = MODE_CONFIG[displayMode].mapColors;
    if (score >= 75) return colors[4]; // とても明るい
    if (score >= 50) return colors[3]; // 明るい
    if (score >= 25) return colors[2]; // 中間
    return colors[1]; // 暗い
  };

  /**
   * 表示用のスコアを取得する
   * 
   * @param region - 選択された地域情報
   * @returns 表示用のスコア
   * @description
   * 現在のモードに応じて適切なスコアを返します。
   * - 都会度モード: urbanity_v2スコア
   * - 光害度モード: light_pollutionスコア
   */
  const getDisplayScore = (region: RegionInfo): number => {
    return displayMode === 'urbanity' ? region.score : region.lightPollution;
  };

  return (
    <div className="app-container">
      {/* ローディングオーバーレイ */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
        </div>
      )}

      {/* サイドバー */}
      <aside className="sidebar">
        {/* ブランド */}
        <div className="brand">
          <h1 className="brand__logo">全国都会度マップ</h1>
        </div>

        {/* 検索 */}
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="市区町村を検索..."
            value={searchQuery}
            onChange={handleSearch}
          />
          {searchResults.length > 0 && (
            <div className="search-dropdown">
              {searchResults.map((item) => (
                <button
                  key={item.code}
                  className="search-dropdown__item"
                  onClick={() => handleSelectSearchResult(item)}
                >
                  <span className="search-dropdown__name">{item.name}</span>
                  <span className="search-dropdown__prefecture">{item.prefecture}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* フィルター */}
        <div className="filter-section">
          <div className="filter-section__header">
            <span className="filter-section__title">スコア範囲フィルター</span>
            <span className="filter-section__range">{minScore} - {maxScore}</span>
          </div>
          <div className="range-slider">
            {/* グラデーショントラック（選択範囲のみ表示） */}
            <div
              className="range-slider__gradient"
              style={{
                background: MODE_CONFIG[displayMode].gradient,
                clipPath: `polygon(${minScore}% 0, ${maxScore}% 0, ${maxScore}% 100%, ${minScore}% 100%)`
              }}
            />
            {/* 非選択範囲（グレー） */}
            <div
              className="range-slider__inactive range-slider__inactive--left"
              style={{ width: `${minScore}%` }}
            />
            <div
              className="range-slider__inactive range-slider__inactive--right"
              style={{ width: `${100 - maxScore}%` }}
            />
            <input
              type="range"
              className="range-slider__input range-slider__input--min"
              min="0"
              max="100"
              value={minScore}
              onChange={(e) => {
                const value = Number(e.target.value);
                setMinScore(Math.min(value, maxScore - 1));
              }}
            />
            <input
              type="range"
              className="range-slider__input range-slider__input--max"
              min="0"
              max="100"
              value={maxScore}
              onChange={(e) => {
                const value = Number(e.target.value);
                setMaxScore(Math.max(value, minScore + 1));
              }}
            />
          </div>
          <div className="range-slider__labels">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>

        {/* 情報パネル */}
        <div className="info-panel">
          {selectedRegion ? (
            <div className="region-card">
              <h2 className="region-card__name">{selectedRegion.name}</h2>
              <p className="region-card__prefecture">{selectedRegion.prefecture}</p>

              {/* スコア表示 */}
              <div className="score-display">
                <span
                  className="score-display__value"
                  style={{ color: getScoreColor(getDisplayScore(selectedRegion)) }}
                >
                  {getDisplayScore(selectedRegion)}
                </span>
                <span className="score-display__max">/ 100</span>
              </div>
              <p className="score-display__label">{MODE_CONFIG[displayMode].scoreLabel}</p>

              {/* スコアインジケーターバー */}
              <div className="score-indicator">
                <div
                  className="score-indicator__bar"
                  style={{ background: MODE_CONFIG[displayMode].gradient }}
                />
                <div
                  className="score-indicator__thumb"
                  style={{ left: `${getDisplayScore(selectedRegion)}%` }}
                />
                <div className="score-indicator__labels">
                  {MODE_CONFIG[displayMode].sliderLabels.map((item, index) => (
                    <span
                      key={index}
                      className="score-indicator__label"
                      style={{ left: `${item.offset}%` }}
                    >
                      {item.label}
                    </span>
                  ))}
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

        {/* 光害度モード切り替え */}
        <div className="mode-toggle">
          <label className="mode-toggle__label">
            <span className="mode-toggle__text">⭐ 光害度</span>
            <div className="mode-toggle__switch">
              <input
                type="checkbox"
                checked={displayMode === 'lightPollution'}
                onChange={(e) => setDisplayMode(e.target.checked ? 'lightPollution' : 'urbanity')}
              />
              <span className="mode-toggle__slider" />
            </div>
          </label>
        </div>

      </aside>

      {/* マップ */}
      <div className="map-container" ref={mapContainer} />
    </div>
  );
}

export default App;
