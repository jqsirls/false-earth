import { useProgress } from "@react-three/drei";
import { useEffect, useState } from "react";
import { useGameStore } from "../core/store/gameStore";

const EXPECTED_COMPONENTS = ['grass', 'rose', 'character'];

export function LoadingScreen() {
    const { active, progress: downloadProgress } = useProgress();
    
    const componentsReady = useGameStore((state) => state.componentsReady) as Record<string, boolean>;
    
    const isGameLoaded = useGameStore((state) => state.isGameLoaded);
    const setIsGameLoaded = useGameStore((state) => state.setIsGameLoaded);

    const readyCount = EXPECTED_COMPONENTS.filter(id => 
        !!componentsReady[id]
    ).length;

    const totalExpected = EXPECTED_COMPONENTS.length;
    const compileProgress = (readyCount / totalExpected) * 100;

    let totalProgress = 0;
    let statusText = "";

    if (active) {
        // Phase 1: Downloading (0% - 50%)
        totalProgress = downloadProgress * 0.5;
        statusText = `Downloading Assets... ${Math.round(downloadProgress)}%`;
    } else {
        // Phase 2: Compiling (50% - 100%)
        const baseProgress = 50;
        totalProgress = baseProgress + (compileProgress * 0.5);
        statusText = `Compiling Shaders... ${readyCount}/${totalExpected}`;
    }

    // 3. Handle Completion
    useEffect(() => {
        // Wait for download (active=false) AND all shaders (readyCount match)
        if (readyCount >= totalExpected && !active) {
            const t = setTimeout(() => setIsGameLoaded(true), 500);
            return () => clearTimeout(t);
        }
    }, [readyCount, active, totalExpected]);

    if (isGameLoaded) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: '#000', zIndex: 9999, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', color: 'white',
            transition: 'opacity 0.5s ease-out',
            pointerEvents: 'none'
        }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '20px', fontFamily: 'monospace' }}>
                {statusText}
            </div>
            
            <div style={{ width: '300px', height: '4px', background: '#333', borderRadius: '2px' }}>
                <div style={{
                    width: `${totalProgress}%`,
                    height: '100%',
                    background: 'white',
                    transition: 'width 0.2s ease-out',
                    boxShadow: '0 0 10px white'
                }} />
            </div>
        </div>
    );
}