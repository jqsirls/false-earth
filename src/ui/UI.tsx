import { useEffect } from "react";
import { useGameStore } from "../core/store/gameStore";
import { useMeadowAuthStore } from "../core/store/meadowAuthStore";
import { useZenStore } from "../core/store/zenStore";
import { useShortcut } from "@core/hooks/useShortcut";
import { LoadingScreen } from "./LoadingScreen";
import { MeadowCta } from "./MeadowCta";
import { TopRightCluster } from "./TopRightCluster";
import { CharacterSwitchOverlay } from "./CharacterSwitchOverlay";
import { AuthSheet } from "./AuthSheet";
import { HueSheet } from "./HueSheet";
import { HueOAuthHandler } from "./HueOAuthHandler";
import { ControlsHint } from "./ControlsHint";
import AudioButton from "./AudioButton";
import { MeadowFooter } from "./MeadowFooter";
import { OrbCounter } from "./OrbCounter";
import { IntroFlightHint } from "./IntroFlightHint";
import { EnterVrButton } from "./EnterVrButton";
import { LegalModal } from "./LegalModal";
import { MeadowCursor } from "./MeadowCursor";
import { SessionEnd } from "./SessionEnd";
import { useMeadowOverlayEsc } from "../core/hooks/useMeadowOverlayEsc";
import { useIsMeadowOverlayOpen } from "../core/hooks/useIsMeadowOverlayOpen";
import { useVrStore } from "../core/store/vrStore";
import { TouchJoystick } from "../core/input/TouchJoystick";
import { useDoubleTapFlight } from "../core/input/useDoubleTapFlight";
import { input } from "../core/input/controls";

export function UI() {
    const isMobile = useGameStore((state) => state.isMobile);
    const isControlEnabled = useGameStore((state) => state.isControlEnabled);
    const isOverlayOpen = useIsMeadowOverlayOpen();
    const hydrateSession = useMeadowAuthStore((state) => state.hydrateSession);
    const isUiHidden = useZenStore((state) => state.isUiHidden);
    const toggleUiHidden = useZenStore((state) => state.toggleUiHidden);
    const showUi = useZenStore((state) => state.showUi);
    const isVrActive = useVrStore((state) => state.isActive);

    useDoubleTapFlight();

    useMeadowOverlayEsc();

    // Desktop [H] zen mode: hide all chrome. Same guard rule as the M key —
    // no-op before START or while any sheet/modal is open. Desktop only.
    useShortcut('h', () => {
        if (isMobile || !isControlEnabled || isOverlayOpen) return;
        toggleUiHidden();
    });

    // Esc restores the chrome (deliberately NOT movement/mouse input — people
    // will move around while hiding). Overlay Esc stacking can't collide:
    // zen can only be entered with every sheet closed.
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            if (useZenStore.getState().isUiHidden) showUi();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [showUi]);

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
            <AuthSheet />
            <HueOAuthHandler />
            <HueSheet />
            <LegalModal />
            <SessionEnd />
            <MeadowCursor />
            <CharacterSwitchOverlay />

            {/* Zen wrapper: [H] fades every piece of HUD chrome together.
                Sheets, the session ending, and the cursor live outside it.
                visibility (delayed past the fade) also kills pointer events —
                children set pointerEvents: auto, which would defeat a plain
                pointerEvents: none here. */}
            <div style={{
                opacity: isUiHidden ? 0 : 1,
                visibility: isUiHidden ? 'hidden' : undefined,
                transition: `opacity 0.5s ease, visibility 0s linear ${isUiHidden ? '0.5s' : '0s'}`,
            }}>
                {!isVrActive ? (
                  <>
                    <MeadowCta />
                    <TopRightCluster />
                    <ControlsHint />
                    <OrbCounter />
                    <MeadowFooter />
                    <IntroFlightHint />
                  </>
                ) : null}
                <EnterVrButton />

                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, width: '100%', height: '100%',
                    pointerEvents: 'none',

                    opacity: isControlEnabled ? 1 : 0,
                    // No explicit 'visible' — it would override the zen
                    // wrapper's hidden and leave the sound circle showing.
                    visibility: isControlEnabled ? undefined : 'hidden',
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
        </div>
    );
}