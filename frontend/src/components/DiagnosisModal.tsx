import React, { useState } from 'react';
import './DiagnosisModal.css';

interface DiagnosisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (score: number) => void;
  onSelectMunicipality?: (code: string) => void;
}

interface Question {
  id: number;
  text: string;
  leftLabel: string;
  rightLabel: string;
}

const QUESTION_POOL: Question[] = [
  { id: 1, text: "夜の明るさについて、どちらが好きですか？", leftLabel: "星空が見える暗い夜", rightLabel: "街灯や看板で明るい夜" },
  { id: 2, text: "人混みや賑わいについてどう感じますか？", leftLabel: "静かで落ち着いた所がいい", rightLabel: "活気があり賑やかな所がいい" },
  { id: 3, text: "買い物の利便性はどれくらい必要ですか？", leftLabel: "車でまとめ買いできれば十分", rightLabel: "徒歩圏内に店がないと不便" },
  { id: 4, text: "住環境に求めるものは？（予算が同じなら）", leftLabel: "郊外の広い庭付き一戸建て", rightLabel: "都心の便利なマンション" },
  { id: 5, text: "直感的に、どちらのライフスタイルに憧れますか？", leftLabel: "自然豊かなスローライフ", rightLabel: "刺激的なアーバンライフ" },
  { id: 6, text: "公共交通機関（電車・バス）の利用頻度は？", leftLabel: "ほとんど使わない", rightLabel: "毎日・頻繁に使う" },
  { id: 7, text: "街の騒音レベルについて、許容できるのは？", leftLabel: "鳥の鳴き声が聞こえる静寂", rightLabel: "深夜まで人の気配がする賑やかさ" },
  { id: 8, text: "近所付き合いの理想的な距離感は？", leftLabel: "互いに助け合う深い交流", rightLabel: "挨拶程度の適度な匿名性" },
  { id: 9, text: "窓から見える風景、どちらが癒やされますか？", leftLabel: "連なる山々や田園風景", rightLabel: "きらめく夜景やビル群" },
  { id: 10, text: "外食の選択肢はどれくらい重要ですか？", leftLabel: "たまに遠出すれば良い", rightLabel: "近所に多様な店が欲しい" },
  { id: 11, text: "治安や防犯について、何を重視しますか？", leftLabel: "鍵をかけ忘れても安心な村", rightLabel: "警備や街灯が完備された都市" },
  { id: 12, text: "映画館や美術館などの文化施設へのアクセスは？", leftLabel: "数ヶ月に一度行ければ良い", rightLabel: "思い立った時にすぐ行きたい" },
  { id: 13, text: "子育てをするなら、どんな環境を選びますか？", leftLabel: "自然の中で自由に遊べる環境", rightLabel: "教育施設や選択肢が豊富な環境" },
  { id: 14, text: "医療機関（大病院など）への距離は？", leftLabel: "車で1時間圏内なら許容", rightLabel: "近所にないと不安" },
  { id: 15, text: "地域の祭りやイベントへの関わり方は？", leftLabel: "積極的に参加・運営したい", rightLabel: "静かに見守るか、関わらない" },
  { id: 16, text: "通勤・通学時間にどれくらい耐えられますか？", leftLabel: "1時間以上でも環境重視", rightLabel: "30分以内が必須条件" },
  { id: 17, text: "最新のトレンドやファッションへの関心は？", leftLabel: "流行に左右されず過ごしたい", rightLabel: "常に新しい情報に触れたい" },
  { id: 18, text: "コンビニの密度、理想は？", leftLabel: "集落に1つあれば十分", rightLabel: "各ブロックに1つは欲しい" },
  { id: 19, text: "散歩するなら、どちらの道がいいですか？", leftLabel: "舗装されていない土の道や畦道", rightLabel: "街灯の整備された綺麗な歩道" },
  { id: 20, text: "休日の過ごし方はどちらに近いですか？", leftLabel: "家やキャンプでゆったり", rightLabel: "ショッピングやイベントへ外出" },
  { id: 21, text: "駐車場の確保しやすさは？", leftLabel: "無料で2台以上停めたい", rightLabel: "高くても利便性が勝れば良い" },
  { id: 22, text: "「街の歴史」と「新しさ」、どちらに惹かれますか？", leftLabel: "古くからの伝統が残る街", rightLabel: "常に再開発される最新の街" },
  { id: 23, text: "24時間営業の店舗は必要ですか？", leftLabel: "夜は店が閉まっていても困らない", rightLabel: "いつでも開いている店が必要" },
  { id: 24, text: "空気の綺麗さについて、こだわりは？", leftLabel: "澄んだ空気が絶対条件", rightLabel: "生活の便利さの方が優先" },
  { id: 25, text: "将来、自給自足的な生活に興味はありますか？", leftLabel: "非常に興味がある（家庭菜園等）", rightLabel: "サービスを享受する生活が良い" },
  { id: 26, text: "街の「広々とした感覚」はどれくらい大事？", leftLabel: "視界を遮るものがない方がいい", rightLabel: "建物に囲まれていても平気" },
  { id: 27, text: "徒歩5分以内に何が欲しいですか？", leftLabel: "緑豊かな公園や自然", rightLabel: "駅や大型商業施設" },
  { id: 28, text: "坂道や階段が多い街はどうですか？", leftLabel: "風景に変化があれば許容できる", rightLabel: "平坦で歩きやすい街がいい" },
  { id: 29, text: "シェアサイクルや電動キックボードの普及は？", leftLabel: "不要（自分の車や足で十分）", rightLabel: "最新の移動手段が欲しい" },
  { id: 30, text: "「有名ブランドの路面店」が近所にある必要性は？", leftLabel: "全く必要ない", rightLabel: "あるとステータスを感じる" }
];

export const DiagnosisModal: React.FC<DiagnosisModalProps> = ({ isOpen, onClose, onComplete, onSelectMunicipality }) => {
  const [step, setStep] = useState(0); // 0: Start, 1-10: Questions, 11: Image Verification, 12: Result
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [calculatedScore, setCalculatedScore] = useState<number | null>(null);
  const [tempScore, setTempScore] = useState<number>(50); // For image verification
  const [exampleMunicipality, setExampleMunicipality] = useState<{ name: string, code: string } | null>(null);

  const QUESTION_COUNT = 10;

  if (!isOpen) return null;

  const startDiagnosis = () => {
    // 30問からランダムに10問を抽出
    const shuffled = [...QUESTION_POOL].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, QUESTION_COUNT);
    setActiveQuestions(selected);
    setAnswers(new Array(QUESTION_COUNT).fill(3));
    setStep(1);
  };

  const currentQuestion = activeQuestions[step - 1];

  const handleAnswerChange = (value: number) => {
    const newAnswers = [...answers];
    newAnswers[step - 1] = value;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (step < QUESTION_COUNT) {
      setStep(step + 1);
    } else {
      calculateResult();
    }
  };

  const handleBack = () => {
    if (step === QUESTION_COUNT + 1) {
      // 画像確認画面から最後の質問に戻る場合
      setStep(QUESTION_COUNT);
    } else if (step > 1) {
      setStep(step - 1);
    }
  };

  const calculateResult = () => {
    const sum = answers.reduce((a, b) => a + b, 0);
    const avg = sum / answers.length;
    const score = Math.round(((avg - 1) / 4) * 8) * 10 + 15;

    setTempScore(score);
    setStep(step + 1); // Move to image verification
  };

  const adjustScore = (adjustment: number) => {
    let newScore = tempScore + adjustment;
    if (newScore < 15) newScore = 15;
    if (newScore > 95) newScore = 95;
    setTempScore(newScore);
  };

  const confirmScore = async () => {
    // 1. テキスト回答に基づくベーススコアを再計算 (S_text)
    const sum = answers.reduce((a, b) => a + b, 0);
    const avg = sum / answers.length;
    const textScore = Math.round(((avg - 1) / 4) * 8) * 10 + 15;

    // 2. 画像選択によるスコア (S_image)
    const imageScore = tempScore;

    // 3. アルゴリズムによる統合 (Anchor & Adjust Model)
    const K = 0.6;
    const L = 20;

    let adjustment = (imageScore - textScore) * K;
    adjustment = Math.max(-L, Math.min(L, adjustment));

    const finalScore = Math.round(textScore + adjustment);

    setCalculatedScore(finalScore);

    // 該当する市町村をランダムに取得
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}data/japan-with-scores-v2.geojson`);
      const data = await response.json();
      const candidates: { name: string, code: string }[] = [];

      const min = Math.max(0, finalScore - 5);
      const max = Math.min(100, finalScore + 5);

      data.features.forEach((feature: any) => {
        const props = feature.properties;
        const score = props.urbanity_v2;
        if (score >= min && score <= max) {
          const name = (props.N03_001 || '') + ' ' + (props.N03_003 || '') + (props.N03_004 || '');
          if (props.N03_007) {
            candidates.push({ name, code: props.N03_007 });
          }
        }
      });

      if (candidates.length > 0) {
        const randomCity = candidates[Math.floor(Math.random() * candidates.length)];
        setExampleMunicipality(randomCity);
      } else {
        setExampleMunicipality(null);
      }
    } catch (e) {
      console.error("Failed to fetch municipality data", e);
    }

    setStep(step + 1); // Move to result view
  };

  const handleApply = () => {
    if (calculatedScore !== null) {
      if (exampleMunicipality && onSelectMunicipality) {
        onSelectMunicipality(exampleMunicipality.code);
      }
      onComplete(calculatedScore);
      onClose();
      // Reset for next time after a delay
      setTimeout(() => {
        setStep(0);
        setAnswers([]);
        setActiveQuestions([]);
        setCalculatedScore(null);
        setExampleMunicipality(null);
      }, 500);
    }
  };

  const getImagePath = (score: number) => {
    let lower = Math.round((score - 15) / 10) * 10;
    if (lower < 10) lower = 10;
    if (lower > 90) lower = 90;
    const upper = lower + 10;
    return `${import.meta.env.BASE_URL}data/images/score${lower}-${upper}.png`;
  };

  // Render Start Screen
  if (step === 0) {
    return (
      <div className="diagnosis-modal-overlay" onClick={onClose}>
        <div className="diagnosis-modal" onClick={e => e.stopPropagation()}>
          <button className="diagnosis-modal__close" onClick={onClose}>×</button>
          <h2 className="diagnosis-modal__title">住みたい街診断</h2>
          <p className="diagnosis-modal__subtitle">
            10の質問と画像の選択で、<br />あなたにぴったりの「都会度」を見つけましょう。
          </p>
          <div style={{ textAlign: 'center', marginTop: '32px' }}>
            <div style={{ fontSize: '48px', marginBottom: '24px' }}>🏘️ ↔️ 🏙️</div>
            <button
              className="diagnosis-btn diagnosis-btn--primary"
              onClick={startDiagnosis}
              style={{ width: '100%' }}
            >
              診断を始める
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Result Screen
  if (step > QUESTION_COUNT + 1) {
    return (
      <div className="diagnosis-modal-overlay" onClick={onClose}>
        <div className="diagnosis-modal" onClick={e => e.stopPropagation()}>
          <button className="diagnosis-modal__close" onClick={onClose}>×</button>
          <h2 className="diagnosis-modal__title">診断結果</h2>
          <div className="diagnosis-result">
            <div className="diagnosis-result__score-label">あなたにおすすめの都会度は...</div>
            <div className="diagnosis-result__score">{calculatedScore}</div>

            <p className="diagnosis-result__desc">
              このスコアに近い自治体を地図上で探します。<br />
              （フィルター範囲: {calculatedScore ? Math.max(0, calculatedScore - 5) : 0} - {calculatedScore ? Math.min(100, calculatedScore + 5) : 100}）
            </p>
            <button
              className="diagnosis-btn diagnosis-btn--primary"
              onClick={handleApply}
              style={{ width: '100%' }}
            >
              {exampleMunicipality ? `${exampleMunicipality.name} を見る` : '地図で見る'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Image Verification Screen
  if (step === QUESTION_COUNT + 1) {
    return (
      <div className="diagnosis-modal-overlay" onClick={onClose}>
        <div className="diagnosis-modal" onClick={e => e.stopPropagation()}>
          <button className="diagnosis-modal__close" onClick={onClose}>×</button>

          <h2 className="diagnosis-modal__title">イメージの確認</h2>
          <p className="diagnosis-modal__subtitle">
            あなたの回答から推測される街並みです。<br />
            この場所に住むことを想像して、微調整してください。
          </p>

          <div className="diagnosis-image-container">
            <img
              src={getImagePath(tempScore)}
              alt="Urbanity Preview"
              className="diagnosis-image"
            />
          </div>

          <div className="diagnosis-adjustment-controls">
            <button
              className="diagnosis-adj-btn"
              onClick={() => adjustScore(-10)}
            >
              👈 もっとのどかな所がいい
            </button>
            <button
              className="diagnosis-adj-btn diagnosis-adj-btn--confirm"
              onClick={confirmScore}
            >
              これで決定 ✨
            </button>
            <button
              className="diagnosis-adj-btn"
              onClick={() => adjustScore(10)}
            >
              もっと便利な所がいい 👉
            </button>
          </div>

          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <button className="diagnosis-link-btn" onClick={handleBack}>
              質問に戻る
            </button>
          </div>

        </div>
      </div>
    );
  }

  // Render Question Screen
  return (
    <div className="diagnosis-modal-overlay" onClick={onClose}>
      <div className="diagnosis-modal" onClick={e => e.stopPropagation()}>
        <button className="diagnosis-modal__close" onClick={onClose}>×</button>

        {/* Progress */}
        <div className="diagnosis-progress">
          <div
            className="diagnosis-progress__bar"
            style={{ width: `${(step / QUESTION_COUNT) * 100}%` }}
          />
        </div>

        <h3 style={{ textAlign: 'center', color: '#999', fontSize: '0.9rem', marginBottom: '16px' }}>
          Q{step} / {QUESTION_COUNT}
        </h3>

        <div className="diagnosis-question">
          <p className="diagnosis-question__text">{currentQuestion.text}</p>

          <div className="diagnosis-slider-container">
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={answers[step - 1]}
              onChange={(e) => handleAnswerChange(Number(e.target.value))}
              className="diagnosis-slider"
            />
            <div className="diagnosis-slider-labels">
              <span className="diagnosis-slider-label-left">{currentQuestion.leftLabel}</span>
              <span className="diagnosis-slider-label-right">{currentQuestion.rightLabel}</span>
            </div>
          </div>
        </div>

        <div className="diagnosis-footer">
          {step > 1 ? (
            <button className="diagnosis-btn diagnosis-btn--secondary" onClick={handleBack}>
              戻る
            </button>
          ) : (
            <div /> // Spacer
          )}
          <button className="diagnosis-btn diagnosis-btn--primary" onClick={handleNext}>
            {step === QUESTION_COUNT ? '次へ (イメージ確認)' : '次へ'}
          </button>
        </div>
      </div>
    </div>
  );
};
