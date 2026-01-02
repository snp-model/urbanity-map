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
  /** アーバニティスコア（0-100） */
  score: number;
}

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
        fetch('/data/japan-with-scores.geojson')
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
                    score: props.score || 0
                  });
                  setSelectedCode(props.N03_007);
                }
              }
            });

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

  /**
   * 検索入力のハンドラー
   *
   * @param e - 入力変更イベント
   * @description
   * 入力された検索クエリに基づいて市区町村を検索し、
   * 見つかった場合は選択状態を更新します。
   */
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
    if (score >= 75) return '#fef3c7'; // とても明るい
    if (score >= 50) return '#fbbf24'; // 明るい
    if (score >= 25) return '#f59e0b'; // 中間
    return '#1a1a4e'; // 暗い
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
          <h1 className="brand__logo">URBANITY MAP</h1>
          <p className="brand__tagline">全国市町村の都会度マップ</p>
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

        {/* 凡例 */}
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

      {/* マップ */}
      <div className="map-container" ref={mapContainer} />
    </div>
  );
}

export default App;
