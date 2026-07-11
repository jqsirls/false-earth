import { useEffect } from "react";
import { useGameStore } from "../core/store/gameStore";
import { useMeadowAuthStore } from "../core/store/meadowAuthStore";
import { LoadingScreen } from "./LoadingScreen";
import { MeadowCta } from "./MeadowCta";
import { LampButton } from "./LampButton";
import { AuthSheet } from "./AuthSheet";
import { HueSheet } from "./HueSheet";
import { HueOAuthHandler } from "./HueOAuthHandler";
import { ControlsHint } from "./ControlsHint";
import AudioButton from "./AudioButton";
import { MeadowFooter } from "./MeadowFooter";
import { OrbCounter } from "./OrbCounter";
import { LegalModal } from "./LegalModal";
import { useMeadowOverlayEsc } from "../core/hooks/useMeadowOverlayEsc";
import { useIsMeadowOverlayOpen } from "../core/hooks/useIsMeadowOverlayOpen";
import { TouchJoystick } from "../core/input/TouchJoystick";
import { useDoubleTapFlight } from "../core/input/useDoubleTapFlight";
import { input } from "../core/input/controls";

export function UI() {
    const isMobile = useGameStore((state) => state.isMobile);
    const isControlEnabled = useGameStore((state) => state.isControlEnabled);
    const isOverlayOpen = useIsMeadowOverlayOpen();
    const hydrateSession = useMeadowAuthStore((state) => state.hydrateSession);

    useDoubleTapFlight();

    useMeadowOverlayEsc();

    useEffect(() => {
        void hydrateSession();
    }, [hydrateSession]);

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none', // Critical: lets clicks pass through to the 3D canvas
            zIndex: 10 // Ensure UI is above Canvas
        }}>
            <LoadingScreen />
            <MeadowCta />
            <LampButton />
            <AuthSheet />
            <HueOAuthHandler />
            <HueSheet />
            <ControlsHint />
            <OrbCounter />
            <MeadowFooter />
            <LegalModal />

            <div style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%',
                pointerEvents: 'none',

                opacity: isControlEnabled ? 1 : 0,
                visibility: isControlEnabled ? 'visible' : 'hidden',
                transition: `opacity 0.5s ease, visibility 0s linear ${isControlEnabled ? '0s' : '0.5s'}`
            }}>
                <AudioButton />

                {isMobile && !isOverlayOpen &&
                    <TouchJoystick
                        input={input}
                        actions={{
                            forward: 'MoveForward',
                            backward: 'MoveBackward',
                            left: 'RotateLeft',
                            right: 'RotateRight',
                            run: 'Run'
                        }} />}
            </div>
        </div>
    );
}