import { useProgress } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../core/store/gameStore";
import gsap from "gsap";

const EXPECTED_COMPONENTS = ['grass', 'rose', 'character'];

const Key = ({ children }: { children: React.ReactNode }) => (
    <span style={{
        border: '1px solid #555',
        borderRadius: '4px',
        padding: '2px 6px',
        margin: '0 4px',
        fontFamily: 'monospace',
        fontSize: '0.8rem',
        background: 'rgba(255,255,255,0.05)',
        color: '#ccc'
    }}>
        {children}
    </span>
);


export function LoadingScreen() {
    const { active, progress: downloadProgress } = useProgress();
    const componentsReady = useGameStore((state) => state.componentsReady) as Record<string, boolean>;

    const containerRef = useRef<HTMLDivElement>(null);
    const setIsGameStarted = useGameStore((state) => state.setIsGameStarted);

    const [isReadyToStart, setIsReadyToStart] = useState(false);
    const [isVisible, setIsVisible] = useState(true);

    const readyCount = EXPECTED_COMPONENTS.filter(id => !!componentsReady[id]).length;
    const totalExpected = EXPECTED_COMPONENTS.length;
    const compileProgress = (readyCount / totalExpected) * 100.0;

    let totalProgress = 0;

    if (active) {
        totalProgress = downloadProgress * 0.5;
    } else {
        const baseProgress = 50;
        totalProgress = baseProgress + (compileProgress * 50);
    }

    const displayProgress = Math.min(Math.round(totalProgress), 99);

    useEffect(() => {
        if (readyCount >= totalExpected && !active) {
            const t = setTimeout(() => setIsReadyToStart(true), 200);
            return () => clearTimeout(t);
        }
    }, [readyCount, active, totalExpected]);

    const handleStart = () => {
        if (!isReadyToStart) return;
        setIsGameStarted(true);

        gsap.to(containerRef.current, {
            opacity: 0,
            duration: 1,
            ease: "power2.inOut",
            onComplete: () => {
                setIsVisible(false);
            }
        });
    };

    if (!isVisible) return null;


    return (
        <div
            ref={containerRef}
            style={{
                position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                background: '#000', zIndex: 9999,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', color: 'white',
                fontFamily: 'Cousine',
                pointerEvents: 'auto',
                fontSize: '0.9rem',
                opacity: 0.99, // prevent culling 3D scene 
            }}>

            <div className='entry' style={{
                opacity: 1,
                textAlign: 'center',
                maxWidth: '600px',
                padding: '20px',
                animation: 'fadeIn 2s ease'
            }}>
                <div className='title' style={{
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    letterSpacing: '0.5rem',
                    marginBottom: '2rem',
                }}>
                    FALSE EARTH
                </div>

                <div className='intro' style={{
                    lineHeight: '1.5',
                    color: '#ccc',
                    marginBottom: '3rem',
                    textAlign: 'left'
                }}>
                    <p>After a long period of drifting, solid ground appears on a planet that closely resembles Earth.</p>
                    <p>As movement continues across an endless field, the horizon remains fixed, and flowers appear where light from the sky reaches the ground.</p>

                    <p>Travel through the open terrain, influence the falling light through your movement, and witness a quiet phenomenon unfolding across the surface.</p>
                </div>

                <div className='play'>
                    <button
                        onClick={handleStart}
                        disabled={!isReadyToStart}
                        style={{
                            color: 'white',
                            backgroundColor: 'transparent',
                            border: 'none',
                            letterSpacing: '3px',
                            cursor: isReadyToStart ? 'pointer' : 'wait',
                            transition: 'all 0.5s ease',
                        }}
                        onMouseEnter={(e) => {
                            if (isReadyToStart) {
                                e.currentTarget.style.transform = 'scale(1.02)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (isReadyToStart) {
                                e.currentTarget.style.transform = 'scale(1)';
                            }
                        }}
                    >
                        {isReadyToStart ? (
                            "START"
                        ) : (
                            <span>
                                {active ? "ESTABLISHING UPLINK" : "CALIBRATING SENSORS"}... {displayProgress}%
                            </span>
                        )}
                    </button>

                    <div style={{ width: '250px', height: '1px', background: '#222', margin: '10px auto', opacity: isReadyToStart ? 0 : 1 }}>
                        <div style={{ width: `${displayProgress}%`, height: '100%', background: '#666', transition: 'width 0.2s' }} />
                    </div>

                </div>
                <div style={{
                    marginTop: '80px',
                    color: '#ccc',
                    fontSize: '0.75rem',
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '20px',
                    opacity: 0.8,
                    animation: 'fadeIn 3s ease'
                }}>
                    <div>
                        <Key>W</Key><Key>A</Key><Key>S</Key><Key>D</Key> <span>MOVE</span>
                    </div>
                    <div>
                        <Key>SHIFT</Key> <span>BOOST</span>
                    </div>
                    <div>
                        <Key>C</Key> <span>CAMERA</span>
                    </div>
                </div>
            </div>

        </div>
    );
}