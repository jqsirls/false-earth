// src/ui/controls/TouchControls.tsx
import { useState, useRef } from 'react';
import { inputState } from '../../core/input/InputManager';
import { useGameStore } from '../../core/store/gameStore';

export function TouchControls() {
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const [isRunning, setIsRunning] = useState(false); 
  const joystickContainerRef = useRef<HTMLDivElement>(null);
  
  // Config
  const MAX_RADIUS = 50; 
  const DEAD_ZONE = 10;      
  const RUN_THRESHOLD = 0.8; 

  const handleJoystickMove = (clientX: number, clientY: number) => {
    if (!joystickContainerRef.current) return;

    const rect = joystickContainerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let deltaX = clientX - centerX;
    let deltaY = clientY - centerY;

    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    let clampedDistance = distance;
    
    if (distance > MAX_RADIUS) {
      const angle = Math.atan2(deltaY, deltaX);
      deltaX = Math.cos(angle) * MAX_RADIUS;
      deltaY = Math.sin(angle) * MAX_RADIUS;
      clampedDistance = MAX_RADIUS;
    }

    setJoystickPos({ x: deltaX, y: deltaY });

    let normX = 0;
    let normY = 0;

    if (clampedDistance > DEAD_ZONE) {
       normX = deltaX / MAX_RADIUS;
       normY = -(deltaY / MAX_RADIUS); 
    }

    inputState.joystickInput.x = normX;
    inputState.joystickInput.y = normY;

    if (clampedDistance > DEAD_ZONE) {
        inputState.moveForward = normY > 0.5;
        inputState.moveBackward = normY < -0.5;
        inputState.rotateLeft = normX < -0.5;
        inputState.rotateRight = normX > 0.5;
    } else {
        inputState.moveForward = false;
        inputState.moveBackward = false;
        inputState.rotateLeft = false;
        inputState.rotateRight = false;
    }

    const pullRatio = clampedDistance / MAX_RADIUS;
    const shouldRun = pullRatio > RUN_THRESHOLD;
    
    inputState.run = shouldRun;
    setIsRunning(shouldRun);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    handleJoystickMove(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.buttons > 0) {
      handleJoystickMove(e.clientX, e.clientY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    setJoystickPos({ x: 0, y: 0 });
    setIsRunning(false);
    
    inputState.joystickInput.x = 0;
    inputState.joystickInput.y = 0;
    inputState.moveForward = false;
    inputState.moveBackward = false;
    inputState.rotateLeft = false;
    inputState.rotateRight = false;
    inputState.run = false;
  };

  return (
    <div 
      ref={joystickContainerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: 'absolute', 
        left: '20px', 
        bottom: '20px', 
        zIndex: 100,

        width: '100px', 
        height: '100px',
        borderRadius: '50%',

        background: 'rgba(255, 255, 255, 0.1)',
        border: `2px solid rgba(255, 255, 255, 0.3)`,
        backdropFilter: 'blur(4px)',
        
        touchAction: 'none',
        pointerEvents: 'auto',
        cursor: 'pointer',
        userSelect: 'none',

        opacity: 0.5,
        transition: 'opacity 0.5s ease-in-out, border-color 0.2s',
      }}
    >
      <div style={{
        width: '50px', height: '50px',
        background: 'rgba(255, 255, 255, 0.8)',
        borderRadius: '50%', 
        position: 'absolute',
        top: '50%', left: '50%',
        transform: `translate(calc(-50% + ${joystickPos.x}px), calc(-50% + ${joystickPos.y}px))`,
        transition: joystickPos.x === 0 ? 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'background 0.2s',
      }} />
    </div>
  );
}