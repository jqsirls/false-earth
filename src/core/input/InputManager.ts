// src/core/input/InputManager.ts

export interface InputState {
    // Buttons (Digital)
    moveForward: boolean;
    moveBackward: boolean;
    rotateLeft: boolean;
    rotateRight: boolean;
    run: boolean;

    // Joystick (Analog) - New!
    // x: -1 (Left) to 1 (Right)
    // y: -1 (Back) to 1 (Forward)
    joystickInput: { x: number, y: number };
}

// Singleton state
export const inputState: InputState = {
    moveForward: false,
    moveBackward: false,
    rotateLeft: false,
    rotateRight: false,
    run: false,
    
    joystickInput: { x: 0, y: 0 }
};

export const resetInput = () => {
    inputState.moveForward = false;
    inputState.moveBackward = false;
    inputState.rotateLeft = false;
    inputState.rotateRight = false;
    inputState.run = false;
    
    inputState.joystickInput.x = 0;
    inputState.joystickInput.y = 0;
};