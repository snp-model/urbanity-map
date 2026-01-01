#!/usr/bin/env node
/**
 * 東京都GeoJSONに都会度スコアを結合するスクリプト
 */

const fs = require('fs');
const path = require('path');

// 入力ファイル
const geoJsonPath = '/tmp/tokyo_raw.json';
const scoresPath = path.join(__dirname, '../frontend/public/data/urbanity_scores.json');

// 出力ファイル
const outputPath = path.join(__dirname, '../frontend/public/data/tokyo_municipalities.geojson');

// 読み込み
const geoJson = JSON.parse(fs.readFileSync(geoJsonPath, 'utf8'));
const scores = JSON.parse(fs.readFileSync(scoresPath, 'utf8'));

// 東京23区のみフィルタ（コード 13101-13123）
const tokyo23Codes = new Set([
    '13101', '13102', '13103', '13104', '13105', '13106', '13107', '13108',
    '13109', '13110', '13111', '13112', '13113', '13114', '13115', '13116',
    '13117', '13118', '13119', '13120', '13121', '13122', '13123'
]);

// フィルタとスコア結合
const filteredFeatures = geoJson.features
    .filter(f => tokyo23Codes.has(f.properties.N03_007))
    .map(f => {
        const code = f.properties.N03_007;
        const scoreData = scores[code] || {};

        return {
            type: 'Feature',
            properties: {
                code: code,
                name: f.properties.N03_004,
                prefecture: f.properties.N03_001,
                score: scoreData.score || 0,
                cvs: scoreData.cvs || 0,
                super: scoreData.super || 0,
                restaurant: scoreData.restaurant || 0
            },
            geometry: f.geometry
        };
    });

// 出力
const output = {
    type: 'FeatureCollection',
    features: filteredFeatures
};

fs.writeFileSync(outputPath, JSON.stringify(output));
console.log(`Created: ${outputPath}`);
console.log(`Features: ${filteredFeatures.length}`);
