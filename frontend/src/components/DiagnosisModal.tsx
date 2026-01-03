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
  weight: number; // 将来的な拡張用
}

const QUESTIONS: Question[] = [
  {
    id: 1,
    text: "夜の明るさについて、どちらが好きですか？",
    leftLabel: "星空が見える真っ暗な夜",
    rightLabel: "深夜でも街灯や店の明かりがある",
    weight: 1
  },
  {
    id: 2,
    text: "人混みや賑わいについてどう感じますか？",
    leftLabel: "静かで近所付き合いも少ない方がいい",
    rightLabel: "人が多く活気ある場所が好き",
    weight: 1
  },
  {
    id: 3,
    text: "買い物の利便性はどれくらい必要ですか？",
    leftLabel: "週末に車でまとめ買いできれば十分",
    rightLabel: "徒歩5分以内にコンビニがないと無理",
    weight: 1
  },
  {
    id: 4,
    text: "住環境に求めるものは？（予算が同じなら）",
    leftLabel: "都心から離れた広い庭付き一戸建て",
    rightLabel: "狭くても地価の高い都心部",
    weight: 1
  },
  {
    id: 5,
    text: "直感的に、どちらのライフスタイルに憧れますか？",
    leftLabel: "自然に囲まれたスローライフ",
    rightLabel: "刺激的な大都会のアーバンライフ",
    weight: 1
  }
];

export const DiagnosisModal: React.FC<DiagnosisModalProps> = ({ isOpen, onClose, onComplete, onSelectMunicipality }) => {
  const [step, setStep] = useState(0); // 0: Start, 1-5: Questions, 6: Image Verification, 7: Result
  const [answers, setAnswers] = useState<number[]>([3, 3, 3, 3, 3]); // Default neutral (3)
  const [calculatedScore, setCalculatedScore] = useState<number | null>(null);
  const [tempScore, setTempScore] = useState<number>(50); // For image verification
  const [exampleMunicipality, setExampleMunicipality] = useState<{name: string, code: string} | null>(null);

  if (!isOpen) return null;

  const currentQuestion = QUESTIONS[step - 1];

  const handleAnswerChange = (value: number) => {
    const newAnswers = [...answers];
    newAnswers[step - 1] = value;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (step < QUESTIONS.length) {
      setStep(step + 1);
    } else {
      calculateResult();
    }
  };

  const handleBack = () => {
    if (step === 6) {
        // 画像確認画面から最後の質問に戻る場合
        setStep(QUESTIONS.length);
    } else if (step > 1) {
      setStep(step - 1);
    }
  };

  const calculateResult = () => {
    // 1-5の平均から、15, 25, 35... 95 のスコアを生成する
    // (avg-1)/4 は 0.0 ~ 1.0
    // これを 0 ~ 8 の整数に変換して 10倍し、15を加える
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
    setCalculatedScore(tempScore);
    
    // 該当する市町村をランダムに取得
    try {
        const response = await fetch('/data/japan-with-scores-v2.geojson');
        const data = await response.json();
        const candidates: {name: string, code: string}[] = [];
        
        const min = Math.max(0, tempScore - 5);
        const max = Math.min(100, tempScore + 5);

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
        setAnswers([3, 3, 3, 3, 3]);
        setCalculatedScore(null);
        setExampleMunicipality(null);
      }, 500);
    }
  };

  const getImagePath = (score: number) => {
    // 要求仕様: スコア35ならば score20-30.png を表示する
    // lower = score - 15
    let lower = Math.round((score - 15) / 10) * 10;
    if (lower < 10) lower = 10;
    if (lower > 90) lower = 90;
    
    const upper = lower + 10;
    return `/data/images/score${lower}-${upper}.png`;
  };

  // Render Start Screen
  if (step === 0) {
    return (
      <div className="diagnosis-modal-overlay" onClick={onClose}>
        <div className="diagnosis-modal" onClick={e => e.stopPropagation()}>
          <button className="diagnosis-modal__close" onClick={onClose}>×</button>
          <h2 className="diagnosis-modal__title">住みたい街診断</h2>
          <p className="diagnosis-modal__subtitle">
            5つの質問と画像の選択で、<br />あなたにぴったりの「都会度」を見つけましょう。
          </p>
          <div style={{ textAlign: 'center', marginTop: '32px' }}>
            <div style={{ fontSize: '48px', marginBottom: '24px' }}>🏘️ ↔️ 🏙️</div>
            <button 
              className="diagnosis-btn diagnosis-btn--primary"
              onClick={() => setStep(1)}
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
  if (step > QUESTIONS.length + 1) {
    return (
      <div className="diagnosis-modal-overlay" onClick={onClose}>
        <div className="diagnosis-modal" onClick={e => e.stopPropagation()}>
          <button className="diagnosis-modal__close" onClick={onClose}>×</button>
          <h2 className="diagnosis-modal__title">診断結果</h2>
          <div className="diagnosis-result">
            <div className="diagnosis-result__score-label">あなたにおすすめの都会度は...</div>
            <div className="diagnosis-result__score">{calculatedScore}</div>
            
            {/* 画像プレビュー削除、市町村ボタンに変更 */}

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
  if (step === QUESTIONS.length + 1) {
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
            style={{ width: `${(step / QUESTIONS.length) * 100}%` }}
          />
        </div>

        <h3 style={{ textAlign: 'center', color: '#999', fontSize: '0.9rem', marginBottom: '16px' }}>
          Q{step} / {QUESTIONS.length}
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
            {step === QUESTIONS.length ? '診断する' : '次へ'}
          </button>
        </div>
      </div>
    </div>
  );
};
