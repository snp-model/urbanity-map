import React, { useState } from 'react';
import './DiagnosisModal.css';

interface DiagnosisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (score: number) => void;
  onSelectMunicipality?: (code: string) => void;
  municipalities?: any[];
  displayMode?: string;
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

type PreferenceDirection = 'urban' | 'rural';
type FollowUpDirection = PreferenceDirection | 'balanced';

const INITIAL_QUESTION_COUNT = 4;
const FOLLOW_UP_QUESTION_COUNT = 6;
const QUESTION_COUNT = INITIAL_QUESTION_COUNT + FOLLOW_UP_QUESTION_COUNT;
const INITIAL_QUESTION_POOL = QUESTION_POOL.filter(
  question => ![11, 15, 17, 22, 28, 30].includes(question.id)
);

const FOLLOW_UP_QUESTION_POOLS: Record<PreferenceDirection, Question[]> = {
  urban: [
    { id: 31, text: "都会の中では、どんな場所に住みたいですか？", leftLabel: "都心から少し離れた静かな住宅街", rightLabel: "駅前や繁華街に近い中心部" },
    { id: 32, text: "駅や路線の利便性はどれくらい求めますか？", leftLabel: "近くに1路線あれば十分", rightLabel: "複数路線の駅が徒歩圏内に欲しい" },
    { id: 33, text: "住まい選びで、広さと立地のどちらを優先しますか？", leftLabel: "駅から離れても広さを確保したい", rightLabel: "コンパクトでも駅に近い方がいい" },
    { id: 34, text: "家の周辺にどれくらいの建物や店が欲しいですか？", leftLabel: "緑や空が見えるゆとりが欲しい", rightLabel: "ビルや店が連なる街並みが好き" },
    { id: 35, text: "夜の街の雰囲気はどちらが理想ですか？", leftLabel: "夜は人通りが落ち着く場所", rightLabel: "夜遅くまで店や人通りがある場所" },
    { id: 36, text: "近所に欲しい店や施設はどのくらいですか？", leftLabel: "スーパーなど日常の店があれば十分", rightLabel: "専門店や飲食店、文化施設も揃ってほしい" },
    { id: 37, text: "休日に街の中でどんな過ごし方をしたいですか？", leftLabel: "公園や落ち着いた場所で過ごしたい", rightLabel: "イベントや買い物を気軽に楽しみたい" },
    { id: 38, text: "車を使わずに暮らせることはどれくらい重要ですか？", leftLabel: "必要なときに車も使いたい", rightLabel: "徒歩・自転車・電車だけで暮らしたい" },
    { id: 39, text: "便利さのためなら、どの程度の人通りを許容できますか？", leftLabel: "便利でも静かな環境がいい", rightLabel: "人通りが多くても便利さを優先したい" },
    { id: 40, text: "街の変化について、どちらに魅力を感じますか？", leftLabel: "落ち着いた街並みが続く場所", rightLabel: "新しい店や施設が増えていく場所" }
  ],
  rural: [
    { id: 41, text: "住まいの近くに、どれくらい自然があってほしいですか？", leftLabel: "家の周りに山や田畑が広がる環境", rightLabel: "町の近くに自然公園があれば十分" },
    { id: 42, text: "日用品の買い物は、どのようにしたいですか？", leftLabel: "車でまとめ買いできればよい", rightLabel: "徒歩や自転車で日々買い物したい" },
    { id: 43, text: "車がなくても暮らせることは必要ですか？", leftLabel: "自家用車が生活に欠かせなくてもよい", rightLabel: "バスや電車で移動できる環境がほしい" },
    { id: 44, text: "医療機関へのアクセスはどれくらい重視しますか？", leftLabel: "専門的な病院が遠くても自然を優先", rightLabel: "診療所や病院が近くにあると安心" },
    { id: 45, text: "近所の家との距離感はどれくらいが理想ですか？", leftLabel: "隣家と距離のある広い敷地", rightLabel: "近所に家が集まった住宅地" },
    { id: 46, text: "中心市街地までの移動時間はどれくらい許容できますか？", leftLabel: "車で1時間以上かかってもよい", rightLabel: "車や電車で30分以内がいい" },
    { id: 47, text: "宅配やネット注文の便利さはどれくらい必要ですか？", leftLabel: "配送に日数がかかっても気にならない", rightLabel: "当日配送や受け取り場所が充実してほしい" },
    { id: 48, text: "夜の明るさや人通りについて、どちらが安心ですか？", leftLabel: "街灯が少なく星空が見える夜", rightLabel: "街灯や店、人通りがある夜" },
    { id: 49, text: "地域の人との付き合い方はどちらが理想ですか？", leftLabel: "行事や助け合いに積極的に関わりたい", rightLabel: "必要な交流をしつつ程よい距離を保ちたい" },
    { id: 50, text: "通勤・通学先への近さと自然環境なら、どちらを優先しますか？", leftLabel: "時間がかかっても自然環境を選ぶ", rightLabel: "職場や学校へ短時間で通える方がいい" }
  ]
};

const selectFollowUpQuestions = (direction: FollowUpDirection): Question[] => {
  const shuffle = (questions: Question[]) => [...questions].sort(() => 0.5 - Math.random());

  if (direction === 'balanced') {
    const urbanQuestions = shuffle(FOLLOW_UP_QUESTION_POOLS.urban).slice(0, FOLLOW_UP_QUESTION_COUNT / 2);
    const ruralQuestions = shuffle(FOLLOW_UP_QUESTION_POOLS.rural).slice(0, FOLLOW_UP_QUESTION_COUNT / 2);
    return shuffle([...urbanQuestions, ...ruralQuestions]);
  }

  return shuffle(FOLLOW_UP_QUESTION_POOLS[direction]).slice(0, FOLLOW_UP_QUESTION_COUNT);
};

export const DiagnosisModal: React.FC<DiagnosisModalProps> = ({ isOpen, onClose, onComplete, onSelectMunicipality }) => {
  const [step, setStep] = useState(0); // 0: Start, 1-10: Questions, 11: Result
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [calculatedScore, setCalculatedScore] = useState<number | null>(null);
  const [exampleMunicipality, setExampleMunicipality] = useState<{ name: string, code: string } | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [followUpDirection, setFollowUpDirection] = useState<FollowUpDirection | null>(null);

  if (!isOpen) return null;

  const startDiagnosis = () => {
    // 共通設問を4問出し、回答傾向に応じて深掘り設問を追加する
    const selected = [...INITIAL_QUESTION_POOL]
      .sort(() => 0.5 - Math.random())
      .slice(0, INITIAL_QUESTION_COUNT);
    setActiveQuestions(selected);
    setAnswers(new Array(INITIAL_QUESTION_COUNT).fill(3));
    setCalculatedScore(null);
    setExampleMunicipality(null);
    setFollowUpDirection(null);
    setStep(1);
  };

  const currentQuestion = activeQuestions[step - 1];

  const handleAnswerChange = (value: number) => {
    const newAnswers = [...answers];
    newAnswers[step - 1] = value;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (isCalculating) return;

    if (step === INITIAL_QUESTION_COUNT) {
      const initialAverage = answers
        .slice(0, INITIAL_QUESTION_COUNT)
        .reduce((sum, answer) => sum + answer, 0) / INITIAL_QUESTION_COUNT;
      const direction: FollowUpDirection = initialAverage > 3.25
        ? 'urban'
        : initialAverage < 2.75
          ? 'rural'
          : 'balanced';

      if (followUpDirection !== direction) {
        const followUpQuestions = selectFollowUpQuestions(direction);
        setActiveQuestions([...activeQuestions.slice(0, INITIAL_QUESTION_COUNT), ...followUpQuestions]);
        setAnswers([
          ...answers.slice(0, INITIAL_QUESTION_COUNT),
          ...new Array(FOLLOW_UP_QUESTION_COUNT).fill(3)
        ]);
        setFollowUpDirection(direction);
      }

      setStep(INITIAL_QUESTION_COUNT + 1);
    } else if (step < QUESTION_COUNT) {
      setStep(step + 1);
    } else {
      void calculateResult();
    }
  };

  const handleBack = () => {
    if (step > 1 && step <= QUESTION_COUNT) {
      setStep(step - 1);
    }
  };

  const calculateResult = async () => {
    setIsCalculating(true);

    const sum = answers.reduce((a, b) => a + b, 0);
    const avg = sum / answers.length;
    const finalScore = Math.round(((avg - 1) / 4) * 8) * 10 + 15;

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

    setIsCalculating(false);
    setStep(QUESTION_COUNT + 1);
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
        setFollowUpDirection(null);
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
            10の質問に答えて、<br />あなたにぴったりの「都会度」を見つけましょう。
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
  if (step > QUESTION_COUNT) {
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
          <button className="diagnosis-btn diagnosis-btn--primary" onClick={handleNext} disabled={isCalculating}>
            {isCalculating
              ? '診断中...'
              : step === QUESTION_COUNT
                ? '診断結果を見る'
                : '次へ'}
          </button>
        </div>
      </div>
    </div>
  );
};
