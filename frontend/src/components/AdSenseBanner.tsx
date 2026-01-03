import { useEffect, useRef } from 'react';

interface AdSenseBannerProps {
    /**
     * Google AdSenseの広告ユニットID (data-ad-slot)
     * 未指定の場合はプレースホルダーを表示
     */
    slot?: string;
    /**
     * 広告フォーマット (auto, rectangle, horizontal, vertical)
     * デフォルト: 'auto'
     */
    format?: string;
    /**
     * レスポンシブ対応かどうか
     * デフォルト: true
     */
    responsive?: boolean;
    className?: string;
    style?: React.CSSProperties;
}

declare global {
    interface Window {
        adsbygoogle: any[];
    }
}

/**
 * Google AdSenseバナーを表示するコンポーネント
 */
export const AdSenseBanner = ({
    slot,
    format = 'auto',
    responsive = true,
    className = '',
    style = {}
}: AdSenseBannerProps) => {
    const adRef = useRef<HTMLModElement>(null);

    useEffect(() => {
        // スロットIDが指定されている場合のみ広告をリクエスト
        if (slot && adRef.current) {
            try {
                // 同じ広告枠への重複プッシュを防ぐための簡易チェック
                // (厳密なチェックは難しいが、ReactのStrictモード開発環境での二重実行エラーを抑制するため)
                const currentAd = adRef.current;
                if (currentAd && !currentAd.getAttribute('data-adsbygoogle-status')) {
                    (window.adsbygoogle = window.adsbygoogle || []).push({});
                }
            } catch (e) {
                console.error('AdSense request failed:', e);
            }
        }
    }, [slot]);

    // 開発環境またはスロット未指定時はプレースホルダーを表示
    if (!slot) {
        return (
            <div
                className={`adsense-placeholder ${className}`}
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: '#f0f0f0',
                    border: '1px dashed #ccc',
                    color: '#888',
                    fontSize: '0.8rem',
                    padding: '10px',
                    minHeight: '100px', // バナーらしい高さ
                    width: '100%',
                    ...style
                }}
            >
                <div>
                    <p style={{ margin: 0, fontWeight: 'bold' }}>広告スペース</p>
                    <p style={{ margin: 0, fontSize: '0.7rem' }}>ここにAdSense広告が表示されます</p>
                </div>
            </div>
        );
    }

    return (
        <div className={className} style={{ width: '100%', overflow: 'hidden', ...style }}>
            <ins
                ref={adRef}
                className="adsbygoogle"
                style={{ display: 'block' }}
                data-ad-client="ca-pub-3564571386265497"
                data-ad-slot={slot}
                data-ad-format={format}
                data-full-width-responsive={responsive ? "true" : "false"}
            />
        </div>
    );
};
