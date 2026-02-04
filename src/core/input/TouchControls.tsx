// src/ui/controls/TouchControls.tsx
import { useRef } from 'react';
import { inputState } from '../../core/input/InputManager';

export function TouchControls() {
  // Use refs instead of state to avoid re-renders on every touch move
  const knobRef = useRef<HTMLDivElement>(null);
  const joystickContainerRef = useRef<HTMLDivElement>(null);
  
  // Config
  const MAX_RADIUS = 50; 
  const DEAD_ZONE = 10;      
  const RUN_THRESHOLD = 0.8; 

  // Update knob position directly via DOM manipulation (no React re-render)
  const updateKnobPosition = (x: number, y: number) => {
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
      // Apply smooth transition only when resetting to center
      if (x === 0 && y === 0) {
        knobRef.current.style.transition = 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      } else {
        knobRef.current.style.transition = 'background 0.2s';
      }
    }
  };

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

    // Update DOM directly instead of setting state
    updateKnobPosition(deltaX, deltaY);

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
    
    // Reset visual position directly
    updateKnobPosition(0, 0);
    
    // Reset inputs
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
      <div 
        ref={knobRef}
        style={{
          width: '50px', 
          height: '50px',
          background: 'rgba(255, 255, 255, 0.8)',
          borderRadius: '50%', 
          position: 'absolute',
          top: '50%', 
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none', // Let clicks pass through to container
        }} 
      />
    </div>
  );
}