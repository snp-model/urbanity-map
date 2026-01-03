import React, { useState } from 'react';
import './DiagnosisModal.css';

interface DiagnosisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (score: number) => void;
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

export const DiagnosisModal: React.FC<DiagnosisModalProps> = ({ isOpen, onClose, onComplete }) => {
  const [step, setStep] = useState(0); // 0: Start, 1-5: Questions, 6: Result
  const [answers, setAnswers] = useState<number[]>([3, 3, 3, 3, 3]); // Default neutral (3)
  const [calculatedScore, setCalculatedScore] = useState<number | null>(null);

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
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const calculateResult = () => {
    // Simple logic: Average of answers * 20 to map 1-5 to 0-100 range
    // 1 -> 20, 3 -> 60, 5 -> 100
    const sum = answers.reduce((a, b) => a + b, 0);
    const avg = sum / answers.length;
    // Map 1..5 to 0..100
    // (val - 1) / 4 * 100
    const score = Math.round(((avg - 1) / 4) * 100);
    
    setCalculatedScore(score);
    setStep(step + 1); // Move to result view
  };

  const handleApply = () => {
    if (calculatedScore !== null) {
      onComplete(calculatedScore);
      onClose();
      // Reset for next time after a delay
      setTimeout(() => {
        setStep(0);
        setAnswers([3, 3, 3, 3, 3]);
        setCalculatedScore(null);
      }, 500);
    }
  };

  // Render Start Screen
  if (step === 0) {
    return (
      <div className="diagnosis-modal-overlay" onClick={onClose}>
        <div className="diagnosis-modal" onClick={e => e.stopPropagation()}>
          <button className="diagnosis-modal__close" onClick={onClose}>×</button>
          <h2 className="diagnosis-modal__title">住みたい街診断</h2>
          <p className="diagnosis-modal__subtitle">
            5つの質問に答えて、<br />あなたにぴったりの「都会度」を見つけましょう。
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
  if (step > QUESTIONS.length) {
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
              （フィルター範囲: {calculatedScore ? calculatedScore - 5 : 0} - {calculatedScore ? calculatedScore + 5 : 100}）
            </p>
            <button 
              className="diagnosis-btn diagnosis-btn--primary"
              onClick={handleApply}
              style={{ width: '100%' }}
            >
              地図で見る
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
