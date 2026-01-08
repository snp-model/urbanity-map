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

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./App.css";
import { DiagnosisModal } from "./components/DiagnosisModal";
import { AdSenseBanner } from "./components/AdSenseBanner";

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
  /** 人口 */
  populationCount?: number;
  /** 高齢者割合（%） */
  elderlyRatio?: number;
  /** 人口増加率（%） */
  popGrowth?: number;
  /** 地価（円/㎡） */
  landPrice?: number;
  /** 飲食店密度（個/km²） */
  restaurantDensity?: number;
  /** 平均所得（円） */
  avgIncome?: number;
  /** 最高気温（℃） */
  maxTemp?: number;
  /** 最深積雪（cm） */
  snowfall?: number;
}

/**
 * 検索用市区町村アイテム
 */
interface MunicipalityItem {
  name: string;
  fullName: string; // 都道府県 + 市区町村名
  prefecture: string;
  code: string;
  score: number;
  lightPollution: number;
  center: [number, number]; // [lng, lat] - 地図ズーム用の中心座標
  populationCount?: number;
  elderlyRatio?: number;
  popGrowth?: number;
  landPrice?: number;
  restaurantDensity?: number;
  avgIncome?: number;
  maxTemp?: number;
  snowfall?: number;
}

/**
 * 表示モードの定義
 *
 * @description
 * 都会度と光害度の切り替えを管理する
 */
type DisplayMode =
  | "urbanity"
  | "lightPollution"
  | "population"
  | "elderlyRatio"
  | "popGrowth"
  | "landPrice"
  | "restaurantDensity"
  | "avgIncome"
  | "maxTemp"
  | "snowfall";

/**
 * モードごとの設定
 */
type DisplayModeConfig = {
  label: string;
  tagline: string;
  legendTitle: string;
  legendLabels: [string, string];
  gradient: string;
  scoreProperty: string;
  mapColors: string[];
  scoreLabel: string;
  sliderLabels: { label: string; offset: number }[];
  source?: string;
};

const MODE_CONFIG: Record<DisplayMode, DisplayModeConfig> = {
  urbanity: {
    label: "都会度",
    tagline: "インフラ、人口、商業施設などから算出した総合スコア",
    legendTitle: "都会度スコア",
    legendLabels: ["低い", "高い"],
    gradient:
      "linear-gradient(to right, #064e3b, #065f46, #059669, #f59e0b, #dc2626)",
    scoreProperty: "urbanity_v2",
    mapColors: ["#064e3b", "#065f46", "#059669", "#f59e0b", "#dc2626"],
    scoreLabel: "URBANITY SCORE",
    sliderLabels: [
      { label: "僻地", offset: 10 },
      { label: "田舎", offset: 30 },
      { label: "地方都市", offset: 55 },
      { label: "都会", offset: 80 },
      { label: "大都市", offset: 95 },
    ],
    source:
      "出典: 総務省、国土交通省、NOAA/NASA、OpenStreetMap等をもとに独自算出",
  },
  lightPollution: {
    label: "光害",
    tagline: "全国市町村の光害マップ",
    legendTitle: "光害レベル",
    legendLabels: ["星空が見える", "光害が濃い"],
    gradient:
      "linear-gradient(to right, #0c0c1e, #1a1a4e, #f59e0b, #fbbf24, #fef3c7)",
    scoreProperty: "light_pollution",
    mapColors: ["#0c0c1e", "#1a1a4e", "#f59e0b", "#fbbf24", "#fef3c7"],
    scoreLabel: "LIGHT POLLUTION SCORE",
    sliderLabels: [
      { label: "暗い", offset: 10 },
      { label: "普通", offset: 50 },
      { label: "明るい", offset: 90 },
    ],
    source: "出典: NOAA/NASA VIIRS (2023年)",
  },
  population: {
    label: "人口",
    tagline: "全国市町村の人口マップ",
    legendTitle: "人口規模",
    legendLabels: ["少ない", "多い"],
    gradient:
      "linear-gradient(to right, #f0fdf4, #86efac, #22c55e, #15803d, #14532d)",
    scoreProperty: "population_count",
    mapColors: ["#f0fdf4", "#86efac", "#22c55e", "#15803d", "#14532d"],
    scoreLabel: "POPULATION",
    sliderLabels: [
      { label: "1", offset: 0 }, // log10(1) = 0 → 0%
      { label: "10", offset: 16.7 }, // log10(10) = 1 → 16.7%
      { label: "100", offset: 33.3 }, // log10(100) = 2 → 33.3%
      { label: "1千", offset: 50 }, // log10(1000) = 3 → 50%
      { label: "1万", offset: 66.7 }, // log10(10000) = 4 → 66.7%
      { label: "10万", offset: 83.3 }, // log10(100000) = 5 → 83.3%
      { label: "100万", offset: 100 }, // log10(1000000) = 6 → 100%
    ],
    source: "出典: 総務省統計局 国勢調査 (2020年)",
  },
  elderlyRatio: {
    label: "高齢化率",
    tagline: "全国市町村の高齢化率マップ",
    legendTitle: "高齢化率",
    legendLabels: ["低い", "高い"],
    gradient:
      "linear-gradient(to right, #f3e8ff, #d8b4fe, #a855f7, #7e22ce, #3b0764)",
    scoreProperty: "elderly_ratio",
    mapColors: ["#f3e8ff", "#d8b4fe", "#a855f7", "#7e22ce", "#3b0764"],
    scoreLabel: "ELDERLY RATIO",
    sliderLabels: [
      { label: "0%", offset: 0 },
      { label: "25%", offset: 25 },
      { label: "50%", offset: 50 },
      { label: "75%", offset: 75 },
      { label: "100%", offset: 100 },
    ],
    source: "出典: 総務省統計局 国勢調査 (2020年)",
  },
  popGrowth: {
    label: "人口増加率",
    tagline: "全国市町村の人口増減マップ",
    legendTitle: "人口増減率",
    legendLabels: ["減少", "増加"],
    gradient:
      "linear-gradient(to right, #3b82f6, #93c5fd, #ffffff, #fca5a5, #ef4444)",
    scoreProperty: "pop_growth",
    mapColors: ["#3b82f6", "#93c5fd", "#ffffff", "#fca5a5", "#ef4444"],
    scoreLabel: "POPULATION GROWTH",
    sliderLabels: [
      { label: "-20%", offset: 0 },
      { label: "-10%", offset: 25 },
      { label: "0%", offset: 50 },
      { label: "+10%", offset: 75 },
      { label: "+20%", offset: 100 },
    ],
    source: "出典: 総務省統計局 国勢調査 (2015-2020年)",
  },
  landPrice: {
    label: "地価",
    tagline: "全国市町村の地価マップ",
    legendTitle: "地価",
    legendLabels: ["安い", "高い"],
    gradient:
      "linear-gradient(to right, #dcfce7, #86efac, #fbbf24, #f97316, #dc2626)",
    scoreProperty: "land_price",
    mapColors: ["#dcfce7", "#86efac", "#fbbf24", "#f97316", "#dc2626"],
    scoreLabel: "LAND PRICE",
    sliderLabels: [
      { label: "1千", offset: 0 }, // log10(1000) = 3 → (3-3)/4.5*100 = 0%
      { label: "1万", offset: 22.2 }, // log10(10000) = 4 → (4-3)/4.5*100 = 22.2%
      { label: "10万", offset: 44.4 }, // log10(100000) = 5 → (5-3)/4.5*100 = 44.4%
      { label: "100万", offset: 66.7 }, // log10(1000000) = 6 → (6-3)/4.5*100 = 66.7%
      { label: "1000万", offset: 88.9 }, // log10(10000000) = 7 → (7-3)/4.5*100 = 88.9%
    ],
    source: "出典: 国土交通省 地価公示 (2023年)",
  },
  restaurantDensity: {
    label: "飲食店密度",
    tagline: "全国市町村の飲食店密度マップ",
    legendTitle: "飲食店密度",
    legendLabels: ["低い", "高い"],
    gradient:
      "linear-gradient(to right, #eff6ff, #60a5fa, #2563eb, #1e40af, #1e3a8a)",
    scoreProperty: "poi_density",
    mapColors: ["#eff6ff", "#60a5fa", "#2563eb", "#1e40af", "#1e3a8a"],
    scoreLabel: "RESTAURANT DENSITY",
    sliderLabels: [
      { label: "0.001", offset: 0 }, // log10(0.001) = -3 → 0%
      { label: "0.01", offset: 16.7 }, // log10(0.01) = -2 → 16.7%
      { label: "0.1", offset: 33.3 }, // log10(0.1) = -1 → 33.3%
      { label: "1", offset: 50 }, // log10(1) = 0 → 50%
      { label: "10", offset: 66.7 }, // log10(10) = 1 → 66.7%
      { label: "100", offset: 83.3 }, // log10(100) = 2 → 83.3%
      { label: "1000", offset: 100 }, // log10(1000) = 3 → 100%
    ],
    source: "出典: OpenStreetMap / 国土数値情報",
  },
  avgIncome: {
    label: "平均所得",
    tagline: "全国市町村の平均所得マップ",
    legendTitle: "平均所得",
    legendLabels: ["低い", "高い"],
    gradient:
      "linear-gradient(to right, #dcfce7, #86efac, #fbbf24, #f97316, #dc2626)",
    scoreProperty: "avg_income",
    mapColors: ["#dcfce7", "#86efac", "#fbbf24", "#f97316", "#dc2626"],
    scoreLabel: "AVERAGE INCOME",
    sliderLabels: [
      { label: "100万", offset: 0 }, // log10(1000000) = 6 → 0%
      { label: "200万", offset: 30.1 }, // log10(2000000) = 6.301 → 30.1%
      { label: "300万", offset: 47.7 }, // log10(3000000) = 6.477 → 47.7%
      { label: "500万", offset: 69.9 }, // log10(5000000) = 6.699 → 69.9%
      { label: "1000万", offset: 100 }, // log10(10000000) = 7 → 100%
    ],
    source: "出典: 総務省 市町村税課税状況等の調 (2023年)",
  },
  maxTemp: {
    label: "最高気温",
    tagline: "全国市町村の月最高気温",
    legendTitle: "最高気温",
    legendLabels: ["低い", "高い"],
    gradient:
      "linear-gradient(to right, #3b82f6, #60a5fa, #fbbf24, #f97316, #dc2626)",
    scoreProperty: "max_temp",
    mapColors: ["#3b82f6", "#60a5fa", "#fbbf24", "#f97316", "#dc2626"],
    scoreLabel: "MAX TEMPERATURE",
    sliderLabels: [
      { label: "25℃", offset: 0 },
      { label: "31℃", offset: 35 },
      { label: "36℃", offset: 65 },
      { label: "42℃", offset: 100 },
    ],
    source: "出典: 気象庁 過去の気象データ (2025年)",
  },
  snowfall: {
    label: "最深積雪",
    tagline: "全国市町村の最深積雪マップ",
    legendTitle: "最深積雪",
    legendLabels: ["少ない", "多い"],
    gradient:
      "linear-gradient(to right, #f0f9ff, #bae6fd, #7dd3fc, #38bdf8, #0284c7)",
    scoreProperty: "max_snow",
    mapColors: ["#f0f9ff", "#bae6fd", "#7dd3fc", "#38bdf8", "#0284c7"],
    scoreLabel: "MAX SNOW DEPTH",
    sliderLabels: [
      { label: "0cm", offset: 0 },
      { label: "100cm", offset: 25 },
      { label: "200cm", offset: 50 },
      { label: "350cm", offset: 75 },
      { label: "510cm", offset: 100 },
    ],
    source: "出典: 気象庁 過去の気象データ (2025年)",
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
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("urbanity");
  const [minScore, setMinScore] = useState(0);
  const [maxScore, setMaxScore] = useState(100);
  const [municipalities, setMunicipalities] = useState<MunicipalityItem[]>([]);
  const [searchResults, setSearchResults] = useState<MunicipalityItem[]>([]);
  const [isDiagnosisOpen, setIsDiagnosisOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileSearchJump, setIsMobileSearchJump] = useState(false);

  // 人口フィルター用（対数スケール: 0=1人, 1=10人, 2=100人, 3=1000人, 4=10000人, 5=100000人, 6=1000000人）
  // 地図上の最大人口は世田谷区の94万人なので、上限は100万人に設定
  const [minPopLog, setMinPopLog] = useState(0); // 1人（実質的な最小値）
  const [maxPopLog, setMaxPopLog] = useState(6); // 1,000,000人

  // 人口増加率フィルター用（-50% ～ +50%）
  // UI上は±50%までだが、内部ロジックでそれ以上/以下も包含する
  const [minGrowth, setMinGrowth] = useState(-50);
  const [maxGrowth, setMaxGrowth] = useState(50);

  // 地価フィルター用（対数スケール: 3=1000円/㎡, 4=10000円/㎡, 5=100000円/㎡, 6=1000000円/㎡, 7=10000000円/㎡, 7.5=31622776円/㎡）
  const [minPriceLog, setMinPriceLog] = useState(3); // 1,000円/㎡
  const [maxPriceLog, setMaxPriceLog] = useState(7.5); // 31,622,776円/㎡（実データの最大値をカバー）

  // 飲食店密度フィルター用（対数スケール: -3=0.001個/km², -2=0.01, -1=0.1, 0=1, 1=10, 2=100, 3=1000）
  const [minRestaurantLog, setMinRestaurantLog] = useState(-3); // 0.001個/km²
  const [maxRestaurantLog, setMaxRestaurantLog] = useState(3); // 1,000個/km²

  // 平均所得フィルター用（対数スケール: 6=100万円, 7=1000万円）
  const [minIncomeLog, setMinIncomeLog] = useState(6); // 100万円
  const [maxIncomeLog, setMaxIncomeLog] = useState(7); // 1000万円

  // 最高気温フィルター用（15℃ ～ 42℃）
  const [minTempFilter, setMinTempFilter] = useState(25);
  const [maxTempFilter, setMaxTempFilter] = useState(42);

  // 最深積雪フィルター用（0cm ～ 510cm）
  const [minSnowFilter, setMinSnowFilter] = useState(0);
  const [maxSnowFilter, setMaxSnowFilter] = useState(510);

  // ディスプレイモードが変更されたら、各フィルターを初期値にリセットする
  useEffect(() => {
    setMinScore(0);
    setMaxScore(100);

    setMinPopLog(0);
    setMaxPopLog(6);

    setMinGrowth(-50);
    setMaxGrowth(50);

    setMinPriceLog(3);
    setMaxPriceLog(7.5);

    setMinRestaurantLog(-3);
    setMaxRestaurantLog(3);

    setMinIncomeLog(6);
    setMaxIncomeLog(7);

    setMinTempFilter(25);
    setMaxTempFilter(42);

    setMinSnowFilter(0);
    setMaxSnowFilter(510);
  }, [displayMode]);

  // マップを初期化する
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        attributionControl: false,
        // 回転機能を無効化
        dragRotate: false,
        touchPitch: false,
        style: {
          version: 8,
          sources: {
            "gsi-pale": {
              type: "raster",
              tiles: [
                "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png",
              ],
              tileSize: 256,
              attribution:
                '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> | 出典: <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>, <a href="https://nlftp.mlit.go.jp/ksj/" target="_blank">国土数値情報(行政区域・地価)</a>, <a href="https://www.e-stat.go.jp/" target="_blank">総務省統計局(e-Stat)</a>, <a href="https://www.jma.go.jp/" target="_blank">気象庁</a>, NASA/NOAA VIIRS',
              maxzoom: 18,
            },
          },
          layers: [
            {
              id: "gsi-pale-layer",
              type: "raster",
              source: "gsi-pale",
              minzoom: 0,
              maxzoom: 18,
            },
          ],
        },
        center: [137.0, 38.0],
        zoom: 4,
        maxBounds: [
          [122, 20],
          [154, 50],
        ], // 少し広めに制限
      });

      map.current.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-right"
      );

      map.current.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "bottom-right"
      );

      // タッチ操作での回転も無効化
      map.current.touchZoomRotate.disableRotation();

      map.current.on("error", (e) => {
        console.error("Map error:", e);
      });

      map.current.once("load", () => {
        if (!map.current) return;

        // Load both municipalities and prefectures data in parallel
        Promise.all([
          fetch(
            `${import.meta.env.BASE_URL}data/japan-with-scores-v2.geojson`
          ).then((res) => res.json()),
          fetch(`${import.meta.env.BASE_URL}data/prefectures.geojson`).then(
            (res) => res.json()
          ),
        ])
          .then(([geojson, prefGeojson]) => {
            if (!map.current) return;

            // --- Municipalities (City/Ward level) ---
            map.current.addSource("municipalities", {
              type: "geojson",
              data: geojson,
            });

            // Fill layer (Base color)
            map.current.addLayer({
              id: "municipalities-fill",
              type: "fill",
              source: "municipalities",
              paint: {
                "fill-color": [
                  "interpolate",
                  ["linear"],
                  ["coalesce", ["get", MODE_CONFIG.urbanity.scoreProperty], 0],
                  0,
                  MODE_CONFIG.urbanity.mapColors[0],
                  25,
                  MODE_CONFIG.urbanity.mapColors[1],
                  50,
                  MODE_CONFIG.urbanity.mapColors[2],
                  75,
                  MODE_CONFIG.urbanity.mapColors[3],
                  100,
                  MODE_CONFIG.urbanity.mapColors[4],
                ],
                "fill-opacity": 0.85,
              },
            });

            // Municipality Border layer (Thin white line)
            map.current.addLayer({
              id: "municipalities-border",
              type: "line",
              source: "municipalities",
              paint: {
                "line-color": "#ffffff",
                "line-width": 0.5,
                "line-opacity": 0.5,
              },
            });

            // --- Prefectures (Province level) ---
            map.current.addSource("prefectures", {
              type: "geojson",
              data: prefGeojson,
            });

            // Prefecture Border layer (Thicker dark line)
            map.current.addLayer({
              id: "prefectures-border",
              type: "line",
              source: "prefectures",
              paint: {
                "line-color": "#444444",
                "line-width": 1.5,
                "line-opacity": 0.8,
              },
            });

            // --- Events ---
            // ホバー時にカーソルを変更
            map.current.on("mouseenter", "municipalities-fill", () => {
              if (map.current) map.current.getCanvas().style.cursor = "pointer";
            });
            map.current.on("mouseleave", "municipalities-fill", () => {
              if (map.current) map.current.getCanvas().style.cursor = "";
            });

            // クリックハンドラー
            map.current.on("click", "municipalities-fill", (e) => {
              if (e.features && e.features[0]) {
                const props = e.features[0].properties;
                if (props) {
                  // N03フィールドから市区町村名を構築
                  // N03_003: 市区, N03_004: 区町村
                  const cityName = props.N03_003 || "";
                  const wardName = props.N03_004 || "";
                  const name =
                    cityName +
                    (wardName && wardName !== cityName ? wardName : "");

                  setSelectedRegion({
                    name: name || "不明",
                    prefecture: props.N03_001 || "",
                    code: props.N03_007 || "",
                    score: props.urbanity_v2 || 0,
                    lightPollution: props.light_pollution || 0,
                    populationCount:
                      props.population_count !== undefined &&
                      props.population_count !== null
                        ? Math.round(props.population_count)
                        : undefined,
                    elderlyRatio:
                      props.elderly_ratio !== undefined &&
                      props.elderly_ratio !== null
                        ? props.elderly_ratio
                        : undefined,
                    popGrowth:
                      props.pop_growth !== undefined &&
                      props.pop_growth !== null
                        ? props.pop_growth
                        : undefined,
                    landPrice:
                      props.land_price !== undefined &&
                      props.land_price !== null
                        ? Math.round(props.land_price)
                        : undefined,
                    restaurantDensity:
                      props.poi_density !== undefined &&
                      props.poi_density !== null
                        ? props.poi_density
                        : undefined,
                    avgIncome:
                      props.avg_income !== undefined &&
                      props.avg_income !== null
                        ? Math.round(props.avg_income)
                        : undefined,
                    maxTemp:
                      props.max_temp !== undefined && props.max_temp !== null
                        ? props.max_temp
                        : undefined,
                    snowfall:
                      props.max_snow !== undefined && props.max_snow !== null
                        ? props.max_snow
                        : undefined,
                  });
                  setSelectedCode(props.N03_007);
                }
              }
            });

            // 都会度最高の市町村を初期選択
            let maxScore = -1;
            let maxFeature: (typeof geojson.features)[0] | null = null;
            for (const feature of geojson.features) {
              const score = feature.properties?.urbanity_v2 || 0;
              if (score > maxScore) {
                maxScore = score;
                maxFeature = feature;
              }
            }
            if (maxFeature && maxFeature.properties) {
              const props = maxFeature.properties;
              const cityName = props.N03_003 || "";
              const wardName = props.N03_004 || "";
              const name =
                cityName + (wardName && wardName !== cityName ? wardName : "");
              setSelectedRegion({
                name: name || "不明",
                prefecture: props.N03_001 || "",
                code: props.N03_007 || "",
                score: props.urbanity_v2 || 0,
                lightPollution: props.light_pollution || 0,
                populationCount:
                  props.population_count !== undefined &&
                  props.population_count !== null
                    ? Math.round(props.population_count)
                    : undefined,
                elderlyRatio:
                  props.elderly_ratio !== undefined &&
                  props.elderly_ratio !== null
                    ? props.elderly_ratio
                    : undefined,
                popGrowth:
                  props.pop_growth !== undefined && props.pop_growth !== null
                    ? props.pop_growth
                    : undefined,
                landPrice:
                  props.land_price !== undefined && props.land_price !== null
                    ? Math.round(props.land_price)
                    : undefined,
                restaurantDensity:
                  props.poi_density !== undefined && props.poi_density !== null
                    ? props.poi_density
                    : undefined,
                avgIncome:
                  props.avg_income !== undefined && props.avg_income !== null
                    ? Math.round(props.avg_income)
                    : undefined,
                maxTemp:
                  props.max_temp !== undefined && props.max_temp !== null
                    ? props.max_temp
                    : undefined,
                snowfall:
                  props.max_snow !== undefined && props.max_snow !== null
                    ? props.max_snow
                    : undefined,
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
                const cityName = props.N03_003 || "";
                const wardName = props.N03_004 || "";
                const name =
                  cityName +
                  (wardName && wardName !== cityName ? wardName : "");
                const prefecture = props.N03_001 || "";

                // ジオメトリから中心座標を計算
                let center: [number, number] = [139.7, 35.7]; // デフォルト（東京）
                const geometry = feature.geometry as GeoJSON.Geometry;
                if (geometry.type === "Polygon") {
                  const coords = geometry.coordinates[0];
                  const sumLng = coords.reduce((sum, c) => sum + c[0], 0);
                  const sumLat = coords.reduce((sum, c) => sum + c[1], 0);
                  center = [sumLng / coords.length, sumLat / coords.length];
                } else if (geometry.type === "MultiPolygon") {
                  const firstPolygon = geometry.coordinates[0][0];
                  const sumLng = firstPolygon.reduce((sum, c) => sum + c[0], 0);
                  const sumLat = firstPolygon.reduce((sum, c) => sum + c[1], 0);
                  center = [
                    sumLng / firstPolygon.length,
                    sumLat / firstPolygon.length,
                  ];
                }

                municipalityList.push({
                  name: name || "不明",
                  fullName: prefecture + name,
                  prefecture,
                  code: props.N03_007,
                  score: props.urbanity_v2 || 0,
                  lightPollution: props.light_pollution || 0,
                  center,
                  populationCount:
                    props.population_count !== undefined &&
                    props.population_count !== null
                      ? Math.round(props.population_count)
                      : undefined,
                  elderlyRatio:
                    props.elderly_ratio !== undefined &&
                    props.elderly_ratio !== null
                      ? props.elderly_ratio
                      : undefined,
                  popGrowth:
                    props.pop_growth !== undefined && props.pop_growth !== null
                      ? props.pop_growth
                      : undefined,
                  landPrice:
                    props.land_price !== undefined && props.land_price !== null
                      ? Math.round(props.land_price)
                      : undefined,
                  restaurantDensity:
                    props.poi_density !== undefined &&
                    props.poi_density !== null
                      ? props.poi_density
                      : undefined,
                  avgIncome:
                    props.avg_income !== undefined && props.avg_income !== null
                      ? Math.round(props.avg_income)
                      : undefined,
                  maxTemp:
                    props.max_temp !== undefined && props.max_temp !== null
                      ? props.max_temp
                      : undefined,
                  snowfall:
                    props.max_snow !== undefined && props.max_snow !== null
                      ? props.max_snow
                      : undefined,
                });
              }
            }
            setMunicipalities(municipalityList);

            // 読み込み完了後、日本全体を表示 (fitBoundsを使用)
            map.current.fitBounds(
              [
                [128, 30],
                [146, 45],
              ],
              {
                padding: { top: 50, bottom: 50, left: 350, right: 50 }, // サイドバー分を考慮したpadding
                duration: 2000,
              }
            );
            setIsLoading(false);
          })
          .catch((err) => {
            console.error("Failed to load map data:", err);
            setIsLoading(false);
          });

        setIsLoading(false);
      });
    } catch (error) {
      console.error("Map initialization error:", error);
      setTimeout(() => setIsLoading(false), 0);
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
    if (!mapInstance.getLayer("municipalities-highlight")) {
      if (mapInstance.getSource("municipalities")) {
        mapInstance.addLayer({
          id: "municipalities-highlight",
          type: "line",
          source: "municipalities",
          paint: {
            "line-color": "#ffffff",
            "line-width": 5,
          },
          filter: ["==", ["get", "N03_007"], ""],
        });
      }
    }

    // フィルターを更新して選択された市区町村をハイライト
    if (mapInstance.getLayer("municipalities-highlight")) {
      mapInstance.setFilter("municipalities-highlight", [
        "==",
        ["get", "N03_007"],
        selectedCode,
      ]);
    }
  }, [selectedCode]);

  /**
   * モバイル用: サイドバーの高さに合わせて検索ボタン位置とマップパディングを動的に調整
   * DOMのレンダリングタイミングを考慮してMutationObserverとResizeObserverを組み合わせる
   */
  useEffect(() => {
    // モバイル判定
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return;

    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;

    const adjustLayout = () => {
      const sidebar = document.querySelector(".sidebar") as HTMLElement;
      const searchBtn = document.querySelector(
        ".mobile-search-trigger-btn"
      ) as HTMLElement;

      if (sidebar) {
        const sidebarHeight = sidebar.offsetHeight;

        // 検索ボタンの位置調整
        if (searchBtn) {
          searchBtn.style.bottom = `${sidebarHeight + 10}px`;
        }

        // マップパディングの調整
        if (map.current) {
          map.current.setPadding({
            bottom: sidebarHeight,
            top: 0,
            left: 0,
            right: 0,
          });

          // モバイル検索からのジャンプフラグが立っている場合、ここでジャンプ実行
          // setPaddingの直後に実行することで、パディング適用後の座標で中心を計算させる
          if (isMobileSearchJump && selectedCode) {
            const target = municipalities.find((m) => m.code === selectedCode);
            if (target) {
              // パディング変更と競合しないように少し遅延させる
              setTimeout(() => {
                if (map.current) {
                  map.current.flyTo({
                    center: target.center,
                    zoom: 9,
                    duration: 1500,
                  });
                }
              }, 50);
            }
            setIsMobileSearchJump(false);
          }
        }
      } else {
        // サイドバーがない場合（リセット）
        if (map.current) {
          map.current.setPadding({ bottom: 0, top: 0, left: 0, right: 0 });
        }
      }
    };

    // ResizeObserverの設定関数
    const setupResizeObserver = () => {
      const sidebar = document.querySelector(".sidebar");
      if (sidebar && !resizeObserver && window.ResizeObserver) {
        resizeObserver = new ResizeObserver(adjustLayout);
        resizeObserver.observe(sidebar);
      }
    };

    // 初期実行
    adjustLayout();
    setupResizeObserver();

    // DOMの変更を監視してサイドバーの出現を検知
    if (window.MutationObserver) {
      mutationObserver = new MutationObserver(() => {
        adjustLayout();
        setupResizeObserver();
      });
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    // リサイズイベント
    window.addEventListener("resize", () => {
      if (window.innerWidth <= 768) {
        adjustLayout();
      } else {
        // PC表示になったらリセット
        if (map.current) {
          map.current.setPadding({ bottom: 0, top: 0, left: 0, right: 0 });
        }
      }
    });

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      if (mutationObserver) mutationObserver.disconnect();
      window.removeEventListener("resize", adjustLayout);
    };
  }, [selectedRegion, isMobileSearchJump, municipalities, selectedCode]); // 依存配列を更新

  // 表示モードまたはフィルターが変更されたときにマップスタイルを更新（デバウンス処理付き）
  useEffect(() => {
    // デバウンス用タイマー
    const timerId = setTimeout(() => {
      if (!map.current) return;
      const colors = MODE_CONFIG[displayMode].mapColors;
      const scoreProp = MODE_CONFIG[displayMode].scoreProperty;

      if (map.current.getLayer("municipalities-fill")) {
        // 人口モードの場合は対数スケールで色分け + フィルタリング
        if (displayMode === "population") {
          const minPop = Math.pow(10, minPopLog);
          const maxPop = Math.pow(10, maxPopLog);

          map.current.setPaintProperty("municipalities-fill", "fill-color", [
            "case",
            [
              "all",
              [">=", ["coalesce", ["get", scoreProp], 0], minPop],
              ["<=", ["coalesce", ["get", scoreProp], 0], maxPop],
            ],
            [
              "interpolate",
              ["linear"],
              ["log10", ["max", ["coalesce", ["get", scoreProp], 1], 1]],
              0,
              colors[0], // 1人
              3,
              colors[1], // 1,000人
              4,
              colors[2], // 10,000人
              5,
              colors[3], // 100,000人
              6,
              colors[4], // 1,000,000人
            ],
            "#4a4a4a",
          ]);
        } else if (displayMode === "popGrowth") {
          // 人口増加率モード（ダイバージングスケール: 色は-20%～+20%でクリップ）
          // フィルターで除外された値のみグレー表示、それ以外は全て色を表示
          map.current.setPaintProperty("municipalities-fill", "fill-color", [
            "case",
            // フィルター範囲外かつデータが存在する場合のみグレー
            // ただし、minGrowth <= -50 の場合は下限なし、maxGrowth >= 50 の場合は上限なしとして扱う
            [
              "any",
              minGrowth > -50
                ? ["<", ["coalesce", ["get", scoreProp], 0], minGrowth]
                : false,
              maxGrowth < 50
                ? [">", ["coalesce", ["get", scoreProp], 0], maxGrowth]
                : false,
            ],
            "#4a4a4a",
            // それ以外は色を表示（値は-20～+20にクリップ）
            [
              "interpolate",
              ["linear"],
              ["max", -20, ["min", 20, ["coalesce", ["get", scoreProp], 0]]],
              -20,
              colors[0], // 青（減少）
              -10,
              colors[1], // 薄い青
              0,
              colors[2], // 白（変化なし）
              10,
              colors[3], // 薄い赤
              20,
              colors[4], // 赤（増加）
            ],
          ]);
        } else if (displayMode === "landPrice") {
          // 地価モードの場合は対数スケールで色分け + フィルタリング
          const minPrice = Math.pow(10, minPriceLog);
          const maxPrice = Math.pow(10, maxPriceLog);

          map.current.setPaintProperty("municipalities-fill", "fill-color", [
            "case",
            [
              "all",
              [">=", ["coalesce", ["get", scoreProp], 0], minPrice],
              ["<=", ["coalesce", ["get", scoreProp], 0], maxPrice],
            ],
            [
              "interpolate",
              ["linear"],
              ["log10", ["max", ["coalesce", ["get", scoreProp], 1000], 1000]],
              3,
              colors[0], // 1,000円/㎡
              4,
              colors[1], // 10,000円/㎡
              5,
              colors[2], // 100,000円/㎡
              6,
              colors[3], // 1,000,000円/㎡
              7.5,
              colors[4], // 31,622,776円/㎡
            ],
            "#4a4a4a",
          ]);
        } else if (displayMode === "restaurantDensity") {
          // 飲食店密度モードの場合は対数スケールで色分け + フィルタリング
          const minDensity = Math.pow(10, minRestaurantLog);
          const maxDensity = Math.pow(10, maxRestaurantLog);

          map.current.setPaintProperty("municipalities-fill", "fill-color", [
            "case",
            [
              "all",
              [">=", ["coalesce", ["get", scoreProp], 0], minDensity],
              ["<=", ["coalesce", ["get", scoreProp], 0], maxDensity],
            ],
            [
              "interpolate",
              ["linear"],
              [
                "log10",
                ["max", ["coalesce", ["get", scoreProp], 0.001], 0.001],
              ],
              -3,
              colors[0], // 0.001個/km²
              -2,
              colors[1], // 0.01個/km²
              -1,
              colors[2], // 0.1個/km²
              0,
              colors[2], // 1個/km²
              1,
              colors[3], // 10個/km²
              2,
              colors[3], // 100個/km²
              3,
              colors[4], // 1000個/km²
            ],
            "#4a4a4a",
          ]);
        } else if (displayMode === "avgIncome") {
          // 平均所得モードの場合は対数スケールで色分け
          const minIncome = Math.pow(10, minIncomeLog);
          const maxIncome = Math.pow(10, maxIncomeLog);
          const isDefaultFilter = minIncomeLog === 6 && maxIncomeLog === 7;

          map.current.setPaintProperty("municipalities-fill", "fill-color", [
            "case",
            // データなし（100万円未満）の場合のみグレー
            ["<", ["coalesce", ["get", scoreProp], 0], 1000000],
            "#4a4a4a",
            // フィルターが初期設定でない場合、範囲外をグレーアウト
            !isDefaultFilter
              ? [
                  "case",
                  [
                    "any",
                    ["<", ["get", scoreProp], minIncome],
                    [">", ["get", scoreProp], maxIncome],
                  ],
                  "#4a4a4a",
                  // 範囲内は色を表示（値をクリップ）
                  [
                    "interpolate",
                    ["linear"],
                    [
                      "log10",
                      [
                        "max",
                        minIncome,
                        ["min", maxIncome, ["get", scoreProp]],
                      ],
                    ],
                    6,
                    colors[0], // 100万円
                    6.301,
                    colors[1], // 200万円
                    6.477,
                    colors[2], // 300万円
                    6.699,
                    colors[3], // 500万円
                    7,
                    colors[4], // 1000万円
                  ],
                ]
              : [
                  // 初期設定の場合は全てのデータを色表示（値をクリップ）
                  "interpolate",
                  ["linear"],
                  ["log10", ["max", 1000000, ["get", scoreProp]]],
                  6,
                  colors[0],
                  6.301,
                  colors[1],
                  6.477,
                  colors[2],
                  6.699,
                  colors[3],
                  7,
                  colors[4],
                ],
          ]);
        } else if (displayMode === "maxTemp") {
          // 最高気温モード（15℃〜42℃）
          // データなし（null/undefined）の場合はグレー、フィルター範囲外もグレー
          map.current.setPaintProperty("municipalities-fill", "fill-color", [
            "case",
            // データなし（nullまたは0以下）の場合はグレー
            ["!", ["has", scoreProp]],
            "#4a4a4a",
            ["==", ["get", scoreProp], null],
            "#4a4a4a",
            // フィルター範囲チェック
            [
              "all",
              [">=", ["get", scoreProp], minTempFilter],
              ["<=", ["get", scoreProp], maxTempFilter],
            ],
            [
              "interpolate",
              ["linear"],
              ["get", scoreProp],
              25,
              colors[0], // 青（低温）
              29,
              colors[1],
              33,
              colors[2],
              38,
              colors[3],
              42,
              colors[4], // 赤（高温）
            ],
            "#4a4a4a",
          ]);
        } else if (displayMode === "snowfall") {
          // 最深積雪モード（0cm〜400cm）
          // データなし（null/undefined）の場合はグレー、フィルター範囲外もグレー
          map.current.setPaintProperty("municipalities-fill", "fill-color", [
            "case",
            // データなし（nullまたはプロパティなし）の場合はグレー
            ["!", ["has", scoreProp]],
            "#4a4a4a",
            ["==", ["get", scoreProp], null],
            "#4a4a4a",
            // フィルター範囲チェック
            [
              "all",
              [">=", ["get", scoreProp], minSnowFilter],
              ["<=", ["get", scoreProp], maxSnowFilter],
            ],
            [
              "interpolate",
              ["linear"],
              ["get", scoreProp],
              0,
              colors[0], // 水色（少）
              100,
              colors[1],
              200,
              colors[2],
              350,
              colors[3],
              510,
              colors[4], // 濃い青（多）
            ],
            "#4a4a4a",
          ]);
        } else {
          // 都会度・光害度・高齢化率モード（0-100スケール）
          map.current.setPaintProperty("municipalities-fill", "fill-color", [
            "case",
            [
              "all",
              [">=", ["coalesce", ["get", scoreProp], 0], minScore],
              ["<=", ["coalesce", ["get", scoreProp], 0], maxScore],
            ],
            [
              "interpolate",
              ["linear"],
              ["coalesce", ["get", scoreProp], 0],
              0,
              colors[0],
              25,
              colors[1],
              50,
              colors[2],
              75,
              colors[3],
              100,
              colors[4],
            ],
            "#4a4a4a",
          ]);
        }
      }
    }, 150); // 150msのデバウンス（操作感とパフォーマンスのバランス）

    return () => clearTimeout(timerId);
  }, [
    displayMode,
    minScore,
    maxScore,
    minPopLog,
    maxPopLog,
    minGrowth,
    maxGrowth,
    minPriceLog,
    maxPriceLog,
    minRestaurantLog,
    maxRestaurantLog,
    minIncomeLog,
    maxIncomeLog,
    minTempFilter,
    maxTempFilter,
    minSnowFilter,
    maxSnowFilter,
  ]);

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
        .filter((m) => m.fullName.includes(query) || m.name.includes(query))
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
      lightPollution: item.lightPollution,
      populationCount: item.populationCount,
      elderlyRatio: item.elderlyRatio,
      popGrowth: item.popGrowth,
      landPrice: item.landPrice,
      restaurantDensity: item.restaurantDensity,
      avgIncome: item.avgIncome,
      maxTemp: item.maxTemp,
      snowfall: item.snowfall,
    });
    setSelectedCode(item.code);
    setSearchQuery("");
    setSearchResults([]);

    // 選択した市区町村にズーム
    if (map.current) {
      map.current.flyTo({
        center: item.center,
        zoom: 10,
        duration: 1500,
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
    let color: string;
    if (score >= 75) color = colors[4]; // とても明るい
    else if (score >= 50) color = colors[3]; // 明るい
    else if (score >= 25) color = colors[2]; // 中間
    else color = colors[1]; // 暗い

    // 白色の場合は視認性のため濃いグレーに変更
    if (color === "#ffffff") return "#333333";
    return color;
  };

  /**
   * 表示用のRaw値を取得する
   */
  const getDisplayValue = (region: RegionInfo): number => {
    switch (displayMode) {
      case "urbanity":
        return region.score;
      case "lightPollution":
        return region.lightPollution;
      case "population":
        return region.populationCount !== undefined &&
          region.populationCount !== null
          ? region.populationCount
          : 0;
      case "elderlyRatio":
        return region.elderlyRatio !== undefined && region.elderlyRatio !== null
          ? region.elderlyRatio
          : 0;
      case "popGrowth":
        return region.popGrowth !== undefined && region.popGrowth !== null
          ? region.popGrowth
          : 0;
      case "landPrice":
        return region.landPrice !== undefined && region.landPrice !== null
          ? region.landPrice
          : 0;
      case "restaurantDensity":
        return region.restaurantDensity !== undefined &&
          region.restaurantDensity !== null
          ? region.restaurantDensity
          : 0;
      case "avgIncome":
        return region.avgIncome !== undefined && region.avgIncome !== null
          ? region.avgIncome
          : 0;
      case "maxTemp":
        return region.maxTemp !== undefined && region.maxTemp !== null
          ? region.maxTemp
          : 0;
      case "snowfall":
        return region.snowfall !== undefined && region.snowfall !== null
          ? region.snowfall
          : 0;
    }
  };

  /**
   * ゲージ・色用の正規化スコア(0-100)を取得する
   */
  const getNormalizedScore = (region: RegionInfo): number => {
    switch (displayMode) {
      case "urbanity":
        return region.score;
      case "lightPollution":
        return region.lightPollution;
      case "population": {
        // 人口を対数スケールで0-100に正規化（0=1人 ～ 6=100万人）
        const pop = region.populationCount || 0;
        if (pop <= 1) return 0;
        const logPop = Math.log10(pop);
        // map: log10(0)=1人 -> 0%, log10(6)=100万人 -> 100%
        return Math.min(Math.max(logPop * 16.67, 0), 100);
      }
      case "elderlyRatio": {
        // 高齢者割合はそのまま0-100%として扱う
        const ratio = region.elderlyRatio || 0;
        return Math.min(Math.max(ratio, 0), 100);
      }
      case "popGrowth": {
        // 人口増加率を-20%～+20%の範囲で0-100に正規化（ダイバージングスケール）
        const growth = region.popGrowth || 0;
        // -20% -> 0, 0% -> 50, +20% -> 100
        return Math.min(Math.max(((growth + 20) / 40) * 100, 0), 100);
      }
      case "landPrice": {
        // 地価を対数スケールで0-100に正規化（3=1000円/㎡ ～ 7.5=31622776円/㎡）
        const price = region.landPrice || 0;
        if (price <= 1000) return 0;
        const logPrice = Math.log10(price);
        // map: log10(3)=1000円/㎡ -> 0%, log10(7.5)=31622776円/㎡ -> 100%
        return Math.min(Math.max(((logPrice - 3) / 4.5) * 100, 0), 100);
      }
      case "restaurantDensity": {
        // 飲食店密度を対数スケールで0-100に正規化（-3=0.001個/km² ～ 3=1000個/km²）
        const density = region.restaurantDensity || 0;
        if (density <= 0.001) return 0;
        const logDensity = Math.log10(density);
        // map: log10(-3)=0.001個/km² -> 0%, log10(3)=1000個/km² -> 100%
        return Math.min(Math.max(((logDensity + 3) / 6) * 100, 0), 100);
      }
      case "avgIncome": {
        // 平均所得を対数スケールで0-100に正規化（6=100万円 ～ 7=1000万円）
        const income = region.avgIncome || 0;
        if (income <= 1000000) return 0;
        const logIncome = Math.log10(income);
        // map: log10(6)=100万円 -> 0%, log10(7)=1000万円 -> 100%
        return Math.min(Math.max(((logIncome - 6) / 1) * 100, 0), 100);
      }
      case "maxTemp": {
        // 最高気温を25℃〜42℃の範囲で0-100に正規化
        const temp = region.maxTemp || 0;
        return Math.min(Math.max(((temp - 25) / 17) * 100, 0), 100);
      }
      case "snowfall": {
        // 最深積雪を0cm〜400cmの範囲で0-100に正規化
        const snow = region.snowfall || 0;
        return Math.min(Math.max((snow / 510) * 100, 0), 100);
      }
    }
  };

  const handleDiagnosisComplete = (score: number) => {
    setDisplayMode("urbanity");
    // Set filter range to score ± 5
    setMinScore(Math.max(0, score - 5));
    setMaxScore(Math.min(100, score + 5));
  };

  const handleSelectMunicipalityCode = (code: string) => {
    const target = municipalities.find((m) => m.code === code);
    if (target) {
      handleSelectSearchResult(target);
    }
  };

  return (
    <div className="app-container">
      {/* 診断モーダル */}
      <DiagnosisModal
        isOpen={isDiagnosisOpen}
        onClose={() => setIsDiagnosisOpen(false)}
        onComplete={handleDiagnosisComplete}
        onSelectMunicipality={handleSelectMunicipalityCode}
        municipalities={municipalities}
        displayMode={displayMode}
      />

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

        {/* 検索ボックス */}
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
              {searchResults.map((result) => (
                <button
                  key={result.code}
                  className="search-dropdown__item"
                  onClick={() => handleSelectSearchResult(result)}
                >
                  <div className="search-dropdown__info">
                    <div className="search-dropdown__name">{result.name}</div>
                    <div className="search-dropdown__prefecture">
                      {result.prefecture}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 情報パネル */}
        <div className="info-panel">
          {selectedRegion ? (
            <div className="region-card">
              {/* 1行目: 地名(左) + スコア(右) */}
              <div className="region-card__header">
                <div className="region-card__info">
                  <h2 className="region-card__name">{selectedRegion.name}</h2>
                  <p className="region-card__prefecture">
                    {selectedRegion.prefecture}
                  </p>
                </div>
                {/* スコア表示 */}
                <div className="score-display">
                  <span
                    className={`score-display__value ${
                      [
                        "population",
                        "landPrice",
                        "avgIncome",
                        "restaurantDensity",
                      ].includes(displayMode)
                        ? "score-display__value--small"
                        : ""
                    }`}
                    style={{
                      color: getScoreColor(getNormalizedScore(selectedRegion)),
                    }}
                  >
                    {displayMode === "population"
                      ? selectedRegion.populationCount !== undefined &&
                        selectedRegion.populationCount !== null &&
                        selectedRegion.populationCount > 0
                        ? getDisplayValue(selectedRegion).toLocaleString()
                        : "データなし"
                      : displayMode === "elderlyRatio"
                      ? selectedRegion.elderlyRatio !== undefined &&
                        selectedRegion.elderlyRatio !== null
                        ? getDisplayValue(selectedRegion).toFixed(1)
                        : "データなし"
                      : displayMode === "popGrowth"
                      ? selectedRegion.popGrowth !== undefined &&
                        selectedRegion.popGrowth !== null
                        ? (selectedRegion.popGrowth >= 0 ? "+" : "") +
                          getDisplayValue(selectedRegion).toFixed(1)
                        : "データなし"
                      : displayMode === "landPrice"
                      ? selectedRegion.landPrice !== undefined &&
                        selectedRegion.landPrice !== null &&
                        selectedRegion.landPrice > 0
                        ? getDisplayValue(selectedRegion).toLocaleString()
                        : "データなし"
                      : displayMode === "restaurantDensity"
                      ? selectedRegion.restaurantDensity !== undefined &&
                        selectedRegion.restaurantDensity !== null
                        ? getDisplayValue(selectedRegion).toFixed(3)
                        : "データなし"
                      : displayMode === "avgIncome"
                      ? selectedRegion.avgIncome !== undefined &&
                        selectedRegion.avgIncome !== null &&
                        selectedRegion.avgIncome > 0
                        ? getDisplayValue(selectedRegion).toLocaleString()
                        : "データなし"
                      : displayMode === "maxTemp"
                      ? selectedRegion.maxTemp !== undefined &&
                        selectedRegion.maxTemp !== null
                        ? getDisplayValue(selectedRegion).toFixed(1)
                        : "データなし"
                      : displayMode === "snowfall"
                      ? selectedRegion.snowfall !== undefined &&
                        selectedRegion.snowfall !== null
                        ? getDisplayValue(selectedRegion).toFixed(1)
                        : "データなし"
                      : getDisplayValue(selectedRegion).toFixed(1)}
                    {displayMode === "population" &&
                      selectedRegion.populationCount !== undefined &&
                      selectedRegion.populationCount !== null &&
                      selectedRegion.populationCount > 0 && (
                        <span style={{ fontSize: "0.5em", marginLeft: "2px" }}>
                          人
                        </span>
                      )}
                    {displayMode === "elderlyRatio" &&
                      selectedRegion.elderlyRatio !== undefined &&
                      selectedRegion.elderlyRatio !== null && (
                        <span style={{ fontSize: "0.5em", marginLeft: "2px" }}>
                          %
                        </span>
                      )}
                    {displayMode === "popGrowth" &&
                      selectedRegion.popGrowth !== undefined &&
                      selectedRegion.popGrowth !== null && (
                        <span style={{ fontSize: "0.5em", marginLeft: "2px" }}>
                          %
                        </span>
                      )}
                    {displayMode === "landPrice" &&
                      selectedRegion.landPrice !== undefined &&
                      selectedRegion.landPrice !== null &&
                      selectedRegion.landPrice > 0 && (
                        <span style={{ fontSize: "0.5em", marginLeft: "2px" }}>
                          円/㎡
                        </span>
                      )}
                    {displayMode === "restaurantDensity" &&
                      selectedRegion.restaurantDensity !== undefined &&
                      selectedRegion.restaurantDensity !== null && (
                        <span style={{ fontSize: "0.5em", marginLeft: "2px" }}>
                          個/k㎡
                        </span>
                      )}
                    {displayMode === "avgIncome" &&
                      selectedRegion.avgIncome !== undefined &&
                      selectedRegion.avgIncome !== null &&
                      selectedRegion.avgIncome > 0 && (
                        <span style={{ fontSize: "0.4em", marginLeft: "2px" }}>
                          円
                        </span>
                      )}
                    {displayMode === "maxTemp" &&
                      selectedRegion.maxTemp !== undefined &&
                      selectedRegion.maxTemp !== null && (
                        <span style={{ fontSize: "0.5em", marginLeft: "2px" }}>
                          ℃
                        </span>
                      )}
                    {displayMode === "snowfall" &&
                      selectedRegion.snowfall !== undefined &&
                      selectedRegion.snowfall !== null && (
                        <span style={{ fontSize: "0.5em", marginLeft: "2px" }}>
                          cm
                        </span>
                      )}
                  </span>
                  {(displayMode === "urbanity" ||
                    displayMode === "lightPollution") && (
                    <span className="score-display__max">/ 100</span>
                  )}
                </div>
              </div>
              {/* スコアインジケーターバー */}
              <div className="score-indicator">
                <div
                  className="score-indicator__bar"
                  style={{ background: MODE_CONFIG[displayMode].gradient }}
                />
                <div
                  className="score-indicator__thumb"
                  style={{ left: `${getNormalizedScore(selectedRegion)}%` }}
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

              {/* データ出典 */}
              {MODE_CONFIG[displayMode].source && (
                <div className="region-card__source">
                  {MODE_CONFIG[displayMode].source}
                </div>
              )}

              {/* 統計値一覧 */}
              <div className="stats-list">
                <div
                  className={`stats-list__item ${
                    displayMode === "urbanity" ? "stats-list__item--active" : ""
                  }`}
                  onClick={() => setDisplayMode("urbanity")}
                >
                  <span className="stats-list__label">都会度</span>
                  <span className="stats-list__value">
                    {selectedRegion.score.toFixed(1)}
                  </span>
                </div>
                <div
                  className={`stats-list__item ${
                    displayMode === "population"
                      ? "stats-list__item--active"
                      : ""
                  }`}
                  onClick={() => setDisplayMode("population")}
                >
                  <span className="stats-list__label">人口</span>
                  <span className="stats-list__value">
                    {selectedRegion.populationCount !== undefined &&
                    selectedRegion.populationCount !== null
                      ? selectedRegion.populationCount.toLocaleString() + " 人"
                      : "データなし"}
                  </span>
                </div>
                <div
                  className={`stats-list__item ${
                    displayMode === "elderlyRatio"
                      ? "stats-list__item--active"
                      : ""
                  }`}
                  onClick={() => setDisplayMode("elderlyRatio")}
                >
                  <span className="stats-list__label">高齢化率</span>
                  <span className="stats-list__value">
                    {selectedRegion.elderlyRatio !== undefined &&
                    selectedRegion.elderlyRatio !== null
                      ? selectedRegion.elderlyRatio.toFixed(1) + "%"
                      : "データなし"}
                  </span>
                </div>
                <div
                  className={`stats-list__item ${
                    displayMode === "popGrowth"
                      ? "stats-list__item--active"
                      : ""
                  }`}
                  onClick={() => setDisplayMode("popGrowth")}
                >
                  <span className="stats-list__label">人口増加率</span>
                  <span className="stats-list__value">
                    {selectedRegion.popGrowth !== undefined &&
                    selectedRegion.popGrowth !== null
                      ? (selectedRegion.popGrowth >= 0 ? "+" : "") +
                        selectedRegion.popGrowth.toFixed(1) +
                        "%"
                      : "データなし"}
                  </span>
                </div>
                <div
                  className={`stats-list__item ${
                    displayMode === "landPrice"
                      ? "stats-list__item--active"
                      : ""
                  }`}
                  onClick={() => setDisplayMode("landPrice")}
                >
                  <span className="stats-list__label">地価</span>
                  <span className="stats-list__value">
                    {selectedRegion.landPrice !== undefined &&
                    selectedRegion.landPrice !== null &&
                    selectedRegion.landPrice > 0
                      ? selectedRegion.landPrice.toLocaleString() + " 円/㎡"
                      : "データなし"}
                  </span>
                </div>
                <div
                  className={`stats-list__item ${
                    displayMode === "restaurantDensity"
                      ? "stats-list__item--active"
                      : ""
                  }`}
                  onClick={() => setDisplayMode("restaurantDensity")}
                >
                  <span className="stats-list__label">飲食店密度</span>
                  <span className="stats-list__value">
                    {selectedRegion.restaurantDensity !== undefined &&
                    selectedRegion.restaurantDensity !== null
                      ? selectedRegion.restaurantDensity.toFixed(3) + " 個/km²"
                      : "データなし"}
                  </span>
                </div>
                <div
                  className={`stats-list__item ${
                    displayMode === "avgIncome"
                      ? "stats-list__item--active"
                      : ""
                  }`}
                  onClick={() => setDisplayMode("avgIncome")}
                >
                  <span className="stats-list__label">平均所得</span>
                  <span className="stats-list__value">
                    {selectedRegion.avgIncome !== undefined &&
                    selectedRegion.avgIncome !== null &&
                    selectedRegion.avgIncome > 0
                      ? selectedRegion.avgIncome.toLocaleString() + " 円"
                      : "データなし"}
                  </span>
                </div>
                <div
                  className={`stats-list__item ${
                    displayMode === "maxTemp" ? "stats-list__item--active" : ""
                  }`}
                  onClick={() => setDisplayMode("maxTemp")}
                >
                  <span className="stats-list__label">最高気温</span>
                  <span className="stats-list__value">
                    {selectedRegion.maxTemp !== undefined &&
                    selectedRegion.maxTemp !== null
                      ? selectedRegion.maxTemp.toFixed(1) + "℃"
                      : "データなし"}
                  </span>
                </div>
                <div
                  className={`stats-list__item ${
                    displayMode === "snowfall" ? "stats-list__item--active" : ""
                  }`}
                  onClick={() => setDisplayMode("snowfall")}
                >
                  <span className="stats-list__label">最深積雪</span>
                  <span className="stats-list__value">
                    {selectedRegion.snowfall !== undefined &&
                    selectedRegion.snowfall !== null
                      ? selectedRegion.snowfall + " cm"
                      : "データなし"}
                  </span>
                </div>
                <div
                  className={`stats-list__item ${
                    displayMode === "lightPollution"
                      ? "stats-list__item--active"
                      : ""
                  }`}
                  onClick={() => setDisplayMode("lightPollution")}
                >
                  <span className="stats-list__label">光害</span>
                  <span className="stats-list__value">
                    {selectedRegion.lightPollution.toFixed(1)}
                  </span>
                  {displayMode === "lightPollution" &&
                    MODE_CONFIG["lightPollution"].source && (
                      <div className="stats-list__source">
                        {MODE_CONFIG["lightPollution"].source}
                      </div>
                    )}
                </div>
              </div>
            </div>
          ) : (
            <div className="info-panel__empty">
              <div className="info-panel__empty-icon">🗾</div>
              <p>
                地図上の市区町村をクリック
                <br />
                または検索してください
              </p>
            </div>
          )}
        </div>

        {/* プライバシーポリシー・免責事項 */}
        <div className="disclaimer">
          <details className="disclaimer__details">
            <summary className="disclaimer__summary">
              プライバシーポリシー・免責事項
            </summary>
            <div className="disclaimer__content">
              <h4 className="disclaimer__title">1. 情報の取り扱いについて</h4>
              <p className="disclaimer__text">
                当サイトの「住みたい街診断」で入力された回答データは、お客様のブラウザ内でのみ計算に使用され、サーバーへの送信や保存は一切行われません。個人を特定できる情報は収集しておりません。
              </p>

              <h4 className="disclaimer__title">2. アクセス解析について</h4>
              <p className="disclaimer__text">
                本サイトでは、利用状況の把握のためにGoogle
                Analytics等のツールを使用し、匿名のトラフィックデータを収集する場合があります。
              </p>

              <h4 className="disclaimer__title">3. 免責事項</h4>
              <p className="disclaimer__text">
                本サービスが提供する都会度スコアや診断結果は、公開統計データに基づく独自のアルゴリズムによる推計値です。データの完全性、正確性、実際の居住感について一切保証いたしません。
              </p>
              <p className="disclaimer__text">
                本データの利用により生じたいかなる損害（直接・間接を問わず）についても、当方は一切の責任を負いません。
              </p>
            </div>
          </details>
        </div>
      </aside>

      {/* マップ */}
      <div className="map-container" ref={mapContainer}>
        {/* フローティングフィルターパネル */}
        <div className="floating-filter-panel">
          <div className="floating-filter-panel__header">
            <span className="floating-filter-panel__title">絞り込み</span>
            <span className="floating-filter-panel__range">
              {displayMode === "population"
                ? `${Math.pow(10, minPopLog).toLocaleString()}人 - ${Math.pow(
                    10,
                    maxPopLog
                  ).toLocaleString()}人`
                : displayMode === "elderlyRatio"
                ? `${minScore}% - ${maxScore}%`
                : displayMode === "popGrowth"
                ? `${minGrowth >= 0 ? "+" : ""}${minGrowth}% - ${
                    maxGrowth >= 0 ? "+" : ""
                  }${maxGrowth}%`
                : displayMode === "landPrice"
                ? `${Math.pow(
                    10,
                    minPriceLog
                  ).toLocaleString()}円/㎡ - ${Math.pow(
                    10,
                    maxPriceLog
                  ).toLocaleString()}円/㎡`
                : displayMode === "restaurantDensity"
                ? `${Math.pow(10, minRestaurantLog).toFixed(
                    3
                  )}個/km² - ${Math.pow(
                    10,
                    maxRestaurantLog
                  ).toLocaleString()}個/km²`
                : displayMode === "avgIncome"
                ? `${Math.pow(
                    10,
                    minIncomeLog
                  ).toLocaleString()}円 - ${Math.pow(
                    10,
                    maxIncomeLog
                  ).toLocaleString()}円`
                : displayMode === "maxTemp"
                ? `${minTempFilter}℃ - ${maxTempFilter}℃`
                : displayMode === "snowfall"
                ? `${minSnowFilter}cm - ${maxSnowFilter}cm`
                : `${minScore} - ${maxScore}`}
            </span>
          </div>
          <div className="range-slider">
            {/* グラデーショントラック（選択範囲のみ表示） */}
            <div
              className="range-slider__gradient"
              style={{
                background: MODE_CONFIG[displayMode].gradient,
                clipPath:
                  displayMode === "population"
                    ? `polygon(${minPopLog * 16.67}% 0, ${
                        maxPopLog * 16.67
                      }% 0, ${maxPopLog * 16.67}% 100%, ${
                        minPopLog * 16.67
                      }% 100%)`
                    : displayMode === "popGrowth"
                    ? `polygon(${minGrowth + 50}% 0, ${maxGrowth + 50}% 0, ${
                        maxGrowth + 50
                      }% 100%, ${minGrowth + 50}% 100%)`
                    : displayMode === "landPrice"
                    ? `polygon(${((minPriceLog - 3) / 4.5) * 100}% 0, ${
                        ((maxPriceLog - 3) / 4.5) * 100
                      }% 0, ${((maxPriceLog - 3) / 4.5) * 100}% 100%, ${
                        ((minPriceLog - 3) / 4.5) * 100
                      }% 100%)`
                    : displayMode === "restaurantDensity"
                    ? `polygon(${((minRestaurantLog + 3) / 6) * 100}% 0, ${
                        ((maxRestaurantLog + 3) / 6) * 100
                      }% 0, ${((maxRestaurantLog + 3) / 6) * 100}% 100%, ${
                        ((minRestaurantLog + 3) / 6) * 100
                      }% 100%)`
                    : displayMode === "avgIncome"
                    ? `polygon(${(minIncomeLog - 6) * 100}% 0, ${
                        (maxIncomeLog - 6) * 100
                      }% 0, ${(maxIncomeLog - 6) * 100}% 100%, ${
                        (minIncomeLog - 6) * 100
                      }% 100%)`
                    : displayMode === "maxTemp"
                    ? `polygon(${((minTempFilter - 25) / 17) * 100}% 0, ${
                        ((maxTempFilter - 25) / 17) * 100
                      }% 0, ${((maxTempFilter - 25) / 17) * 100}% 100%, ${
                        ((minTempFilter - 25) / 17) * 100
                      }% 100%)`
                    : displayMode === "snowfall"
                    ? `polygon(${(minSnowFilter / 510) * 100}% 0, ${
                        (maxSnowFilter / 510) * 100
                      }% 0, ${(maxSnowFilter / 510) * 100}% 100%, ${
                        (minSnowFilter / 510) * 100
                      }% 100%)`
                    : `polygon(${minScore}% 0, ${maxScore}% 0, ${maxScore}% 100%, ${minScore}% 100%)`,
              }}
            />
            {/* 非選択範囲（グレー） */}
            <div
              className="range-slider__inactive range-slider__inactive--left"
              style={{
                width:
                  displayMode === "population"
                    ? `${minPopLog * 16.67}%`
                    : displayMode === "popGrowth"
                    ? `${minGrowth + 50}%`
                    : displayMode === "landPrice"
                    ? `${((minPriceLog - 3) / 4.5) * 100}%`
                    : displayMode === "restaurantDensity"
                    ? `${((minRestaurantLog + 3) / 6) * 100}%`
                    : displayMode === "avgIncome"
                    ? `${(minIncomeLog - 6) * 100}%`
                    : displayMode === "maxTemp"
                    ? `${((minTempFilter - 25) / 17) * 100}%`
                    : displayMode === "snowfall"
                    ? `${(minSnowFilter / 510) * 100}%`
                    : `${minScore}%`,
              }}
            />
            <div
              className="range-slider__inactive range-slider__inactive--right"
              style={{
                width:
                  displayMode === "population"
                    ? `${(6 - maxPopLog) * 16.67}%`
                    : displayMode === "popGrowth"
                    ? `${50 - maxGrowth}%`
                    : displayMode === "landPrice"
                    ? `${((7.5 - maxPriceLog) / 4.5) * 100}%`
                    : displayMode === "restaurantDensity"
                    ? `${((3 - maxRestaurantLog) / 6) * 100}%`
                    : displayMode === "avgIncome"
                    ? `${(7 - maxIncomeLog) * 100}%`
                    : displayMode === "maxTemp"
                    ? `${((42 - maxTempFilter) / 17) * 100}%`
                    : displayMode === "snowfall"
                    ? `${((510 - maxSnowFilter) / 510) * 100}%`
                    : `${100 - maxScore}%`,
              }}
            />
            {displayMode === "population" ? (
              // 人口モード用のスライダー（対数スケール: 0-6 = 1人-1,000,000人）
              <>
                <input
                  type="range"
                  className="range-slider__input range-slider__input--min"
                  min="0"
                  max="6"
                  step="0.1"
                  value={minPopLog}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setMinPopLog(Math.min(value, maxPopLog - 0.1));
                  }}
                />
                <input
                  type="range"
                  className="range-slider__input range-slider__input--max"
                  min="0"
                  max="6"
                  step="0.1"
                  value={maxPopLog}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setMaxPopLog(Math.max(value, minPopLog + 0.1));
                  }}
                />
              </>
            ) : displayMode === "popGrowth" ? (
              // 人口増加率モード用のスライダー（-50% ～ +50%）
              <>
                <input
                  type="range"
                  className="range-slider__input range-slider__input--min"
                  min="-50"
                  max="50"
                  step="1"
                  value={minGrowth}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setMinGrowth(Math.min(value, maxGrowth - 1));
                  }}
                />
                <input
                  type="range"
                  className="range-slider__input range-slider__input--max"
                  min="-50"
                  max="50"
                  step="1"
                  value={maxGrowth}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setMaxGrowth(Math.max(value, minGrowth + 1));
                  }}
                />
              </>
            ) : displayMode === "landPrice" ? (
              // 地価モード用のスライダー（対数スケール: 3-7.5 = 1000円/㎡-31622776円/㎡）
              <>
                <input
                  type="range"
                  className="range-slider__input range-slider__input--min"
                  min="3"
                  max="7.5"
                  step="0.1"
                  value={minPriceLog}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setMinPriceLog(Math.min(value, maxPriceLog - 0.1));
                  }}
                />
                <input
                  type="range"
                  className="range-slider__input range-slider__input--max"
                  min="3"
                  max="7.5"
                  step="0.1"
                  value={maxPriceLog}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setMaxPriceLog(Math.max(value, minPriceLog + 0.1));
                  }}
                />
              </>
            ) : displayMode === "restaurantDensity" ? (
              // 飲食店密度モード用のスライダー（対数スケール: -3 to 3）
              <>
                <input
                  type="range"
                  className="range-slider__input range-slider__input--min"
                  min="-3"
                  max="3"
                  step="0.1"
                  value={minRestaurantLog}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setMinRestaurantLog(
                      Math.min(value, maxRestaurantLog - 0.1)
                    );
                  }}
                />
                <input
                  type="range"
                  className="range-slider__input range-slider__input--max"
                  min="-3"
                  max="3"
                  step="0.1"
                  value={maxRestaurantLog}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setMaxRestaurantLog(
                      Math.max(value, minRestaurantLog + 0.1)
                    );
                  }}
                />
              </>
            ) : displayMode === "avgIncome" ? (
              // 平均所得モード用のスライダー（対数スケール: 6-7 = 100万円-1000万円）
              <>
                <input
                  type="range"
                  className="range-slider__input range-slider__input--min"
                  min="6"
                  max="7"
                  step="0.01"
                  value={minIncomeLog}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setMinIncomeLog(Math.min(value, maxIncomeLog - 0.01));
                  }}
                />
                <input
                  type="range"
                  className="range-slider__input range-slider__input--max"
                  min="6"
                  max="7"
                  step="0.01"
                  value={maxIncomeLog}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setMaxIncomeLog(Math.max(value, minIncomeLog + 0.01));
                  }}
                />
              </>
            ) : displayMode === "maxTemp" ? (
              // 最高気温モード用のスライダー（25℃〜42℃）
              <>
                <input
                  type="range"
                  className="range-slider__input range-slider__input--min"
                  min="25"
                  max="42"
                  step="1"
                  value={minTempFilter}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setMinTempFilter(Math.min(value, maxTempFilter - 1));
                  }}
                />
                <input
                  type="range"
                  className="range-slider__input range-slider__input--max"
                  min="25"
                  max="42"
                  step="1"
                  value={maxTempFilter}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setMaxTempFilter(Math.max(value, minTempFilter + 1));
                  }}
                />
              </>
            ) : displayMode === "snowfall" ? (
              // 最深積雪モード用のスライダー（0cm〜510cm）
              <>
                <input
                  type="range"
                  className="range-slider__input range-slider__input--min"
                  min="0"
                  max="510"
                  step="10"
                  value={minSnowFilter}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setMinSnowFilter(Math.min(value, maxSnowFilter - 10));
                  }}
                />
                <input
                  type="range"
                  className="range-slider__input range-slider__input--max"
                  min="0"
                  max="510"
                  step="10"
                  value={maxSnowFilter}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setMaxSnowFilter(Math.max(value, minSnowFilter + 10));
                  }}
                />
              </>
            ) : (
              // スコアモード用のスライダー（0-100）
              <>
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
              </>
            )}
          </div>
          <div className="range-slider__labels">
            {displayMode === "population" ? (
              <>
                <span>1</span>
                <span>10</span>
                <span>100</span>
                <span>1千</span>
                <span>1万</span>
                <span>10万</span>
                <span>100万</span>
              </>
            ) : displayMode === "elderlyRatio" ? (
              <>
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </>
            ) : displayMode === "popGrowth" ? (
              <>
                <span>-50%</span>
                <span>-25%</span>
                <span>0%</span>
                <span>+25%</span>
                <span>+50%</span>
              </>
            ) : displayMode === "landPrice" ? (
              <>
                <span>1千</span>
                <span>1万</span>
                <span>10万</span>
                <span>100万</span>
                <span>1000万</span>
              </>
            ) : displayMode === "restaurantDensity" ? (
              <>
                <span>0.001</span>
                <span>0.01</span>
                <span>0.1</span>
                <span>1</span>
                <span>10</span>
                <span>100</span>
                <span>1000</span>
              </>
            ) : displayMode === "avgIncome" ? (
              <>
                <span>100万</span>
                <span>200万</span>
                <span>300万</span>
                <span>500万</span>
                <span>1000万</span>
              </>
            ) : displayMode === "maxTemp" ? (
              <>
                <span>25℃</span>
                <span>31℃</span>
                <span>36℃</span>
                <span>42℃</span>
              </>
            ) : displayMode === "snowfall" ? (
              <>
                <span>0cm</span>
                <span>100cm</span>
                <span>200cm</span>
                <span>350cm</span>
                <span>510cm</span>
              </>
            ) : (
              <>
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </>
            )}
          </div>
        </div>

        {/* モバイル用検索ボタン（フラットデザイン） */}
        <button
          className="mobile-search-trigger-btn"
          onClick={() => setIsSearchOpen(!isSearchOpen)}
          aria-label="検索"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </button>

        {/* モバイル用検索モーダル */}
        {isSearchOpen && (
          <div
            className="mobile-search-modal"
            onClick={() => setIsSearchOpen(false)}
          >
            <div
              className="mobile-search-content"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="text"
                className="search-input"
                placeholder="市区町村を検索..."
                value={searchQuery}
                autoFocus
                onChange={(e) => {
                  const query = e.target.value;
                  setSearchQuery(query);
                  if (query) {
                    const results = municipalities.filter((m) =>
                      m.fullName.toLowerCase().includes(query.toLowerCase())
                    );
                    setSearchResults(results.slice(0, 10));
                  } else {
                    setSearchResults([]);
                  }
                }}
              />
              {searchResults.length > 0 && (
                <div className="search-dropdown">
                  {searchResults.map((result) => (
                    <button
                      key={result.code}
                      className="search-dropdown__item"
                      onClick={() => {
                        if (map.current) {
                          // Note: モバイルではuseEffect内のisMobileSearchJumpフラグでflyToを実行する
                          // ここで直接実行するとsetPaddingによるレイアウト変更と競合して止まるため
                        }
                        setSelectedRegion({
                          name: result.name,
                          prefecture: result.prefecture,
                          code: result.code,
                          score: result.score,
                          lightPollution: result.lightPollution,
                          populationCount: result.populationCount,
                          elderlyRatio: result.elderlyRatio,
                          popGrowth: result.popGrowth,
                          landPrice: result.landPrice,
                          restaurantDensity: result.restaurantDensity,
                          avgIncome: result.avgIncome,
                          maxTemp: result.maxTemp,
                          snowfall: result.snowfall,
                        });
                        setSelectedCode(result.code);
                        setIsMobileSearchJump(true); // モバイルジャンプフラグをセット
                        setSearchQuery("");
                        setSearchResults([]);
                        setIsSearchOpen(false);
                      }}
                    >
                      <div>
                        <div className="search-dropdown__name">
                          {result.name}
                        </div>
                        <div className="search-dropdown__prefecture">
                          {result.prefecture}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 住みたい街診断ボタン */}
        <button
          className="diagnosis-trigger-btn"
          onClick={() => setIsDiagnosisOpen(true)}
        >
          <span className="diagnosis-trigger-icon">✨</span>
          住みたい街診断
        </button>

        {/* データ出典 - MapLibreのアトリビューションに追加したため削除 */}
      </div>

      {/* 広告バナー（下部固定） */}
      <div className="ad-banner-container">
        <div className="ad-banner-wrapper">
          <AdSenseBanner />
        </div>
      </div>
    </div>
  );
}

export default App;
