import { useProgress } from "@react-three/drei";
import { useEffect, useRef, useState, useMemo } from "react";
import { useGameStore } from "../core/store/gameStore";
import { MEADOW_LOGO_ALT, MEADOW_LOGO_PATH, MEADOW_PLAYLIST_TRACKS, resolveMeadowAsset } from "../config/meadow";
import { resumeMeadowAudioContext } from "../config/meadowAudio";
import { prefersReducedMotion } from "../core/utils/reducedMotion";
import { formatGpuError, getGpuErrorHeadline, getGpuErrorHint } from "../core/utils/gpuError";
import gsap from "gsap";

const SPLASH_WEBP = resolveMeadowAsset('/storytailor-splash.webp');
const SPLASH_JPG = resolveMeadowAsset('/storytailor-splash.jpg');

const logoStyles = `
.meadow-splash-logo {
  width: min(400px, 85vw);
  height: auto;
  margin: 0 auto 1.25rem;
  display: block;
}
@media (max-width: 768px) {
  .meadow-splash-logo {
    width: min(300px, 80vw);
  }
}
`;

export function LoadingScreen() {
    const { active, progress: downloadProgress } = useProgress();
    const activeTargets = useGameStore((state) => state.activeTargets);
    const readyStatus = useGameStore((state) => state.readyStatus);
    const setIsGameStarted = useGameStore((state) => state.setIsGameStarted);
    const setIsSoundOn = useGameStore((state) => state.setIsSoundOn);
    const audioListener = useGameStore((state) => state.audioListener);
    const gpuError = useGameStore((state) => state.gpuError);
    const gpuErrorInfo = useMemo(() => formatGpuError(gpuError), [gpuError]);

    const [isReadyToStart, setIsReadyToStart] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);
    const animationRef = useRef<gsap.core.Tween | null>(null);

    const total = activeTargets.length;
    const loaded = activeTargets.filter((id) => readyStatus[id]).length;
    const compileProgress = total === 0 ? 0 : (loaded / total) * 100;

    const displayProgress = useMemo(() => {
        if (active) return Math.round(downloadProgress * 0.5);
        return Math.min(Math.round(50 + compileProgress * 0.5), 99);
    }, [active, downloadProgress, compileProgress]);

    const reduceMotion = prefersReducedMotion();

    useEffect(() => {
        if (gpuError) {
            setIsReadyToStart(false);
            setIsVisible(true);
            if (animationRef.current) animationRef.current.kill();
            if (containerRef.current) containerRef.current.style.opacity = '1';
            return;
        }

        if (!active && loaded === total && total > 0) {
            const t = setTimeout(() => setIsReadyToStart(true), 200);
            return () => clearTimeout(t);
        }

        setIsReadyToStart(false);
    }, [active, loaded, total, gpuError]);

    const handleStart = () => {
        if (!isReadyToStart || gpuError) return;

        if (import.meta.env.DEV) {
            console.info('[meadow] BGM tracks:', MEADOW_PLAYLIST_TRACKS.map((t) => t.url));
        }

        // User gesture — unlock AudioContext before BGM mounts after camera intro.
        resumeMeadowAudioContext(audioListener);
        setIsSoundOn(true);
        setIsGameStarted(true);

        if (containerRef.current) {
            animationRef.current = gsap.to(containerRef.current, {
                opacity: 0,
                duration: 0.9,
                ease: "power2.inOut",
                onComplete: () => setIsVisible(false),
            });
        } else {
            setIsVisible(false);
        }
    };

    useEffect(() => {
        return () => {
            if (animationRef.current) animationRef.current.kill();
        };
    }, []);

    if (!isVisible) return null;

    return (
        <div
            ref={containerRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100dvh',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontFamily: 'Inter, system-ui, sans-serif',
                pointerEvents: 'auto',
                opacity: 0.99,
                padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)',
                overflow: 'hidden',
            }}
        >
            <style>{logoStyles}</style>
            <div
                aria-hidden
                style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `image-set(url(${SPLASH_WEBP}) type('image/webp'), url(${SPLASH_JPG}) type('image/jpeg'))`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                }}
            />
            <header style={{
                position: 'relative',
                textAlign: 'center',
                maxWidth: '440px',
                padding: '24px',
                textShadow: '0 1px 12px rgba(0,0,0,0.65), 0 2px 24px rgba(0,0,0,0.45)',
            }}>
                <h1 style={{ margin: 0 }}>
                    <img
                        src={MEADOW_LOGO_PATH}
                        alt={MEADOW_LOGO_ALT}
                        className="meadow-splash-logo"
                    />
                </h1>

                {gpuErrorInfo ? (
                    <div style={{ color: '#ff6b6b', fontSize: '0.85rem', lineHeight: 1.5 }}>
                        <p style={{ margin: 0, fontWeight: 600 }}>{getGpuErrorHeadline(gpuErrorInfo)}</p>
                        <p style={{ margin: '0.5rem 0 0', opacity: 0.85 }}>{gpuErrorInfo.detail}</p>
                        {getGpuErrorHint(gpuErrorInfo) && (
                            <p style={{ margin: '0.75rem 0 0', opacity: 0.7, fontSize: '0.8rem' }}>
                                {getGpuErrorHint(gpuErrorInfo)}
                            </p>
                        )}
                    </div>
                ) : (
                    <>
                        <p style={{
                            margin: '0 0 1.5rem',
                            fontSize: '0.85rem',
                            lineHeight: 1.5,
                            letterSpacing: '0.02em',
                            color: 'rgba(255,255,255,0.78)',
                        }}>
                            {isReadyToStart
                                ? 'Press start when you\'re ready.'
                                : 'Getting things ready…'}
                        </p>

                        <button
                            type="button"
                            onClick={handleStart}
                            disabled={!isReadyToStart}
                            style={{
                                color: 'white',
                                background: 'transparent',
                                border: 'none',
                                letterSpacing: '0.2rem',
                                fontSize: '0.8rem',
                                cursor: isReadyToStart ? 'pointer' : 'wait',
                                opacity: isReadyToStart ? 1 : 0.75,
                                animation: isReadyToStart && !reduceMotion ? 'breathe 2s infinite ease-in-out' : 'none',
                            }}
                        >
                            {isReadyToStart ? '[ START ]' : (
                                <span>
                                    {active ? 'LOADING' : 'ENTERING'}… {displayProgress}%
                                </span>
                            )}
                        </button>

                        <div style={{
                            width: '200px',
                            height: '1px',
                            background: 'rgba(255,255,255,0.15)',
                            margin: '14px auto 0',
                            opacity: isReadyToStart ? 0 : 1,
                            transition: 'opacity 0.5s',
                        }}>
                            <div style={{
                                width: `${displayProgress}%`,
                                height: '100%',
                                background: 'rgba(255,255,255,0.45)',
                                transition: 'width 0.2s',
                            }} />
                        </div>
                    </>
                )}
            </header>
        </div>
    );
}
