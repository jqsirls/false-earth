import { useLoader, useThree } from '@react-three/fiber';
import { AudioLoader } from 'three';
import { AudioListener } from 'three/webgpu';
import * as THREE from 'three';

const _listenerPos = new THREE.Vector3();

interface PlayOptions {
    position?: THREE.Vector3;
    volume?: number;
    detuneRange?: number;
    refDistance?: number;
    maxDistance?: number;
}

export function useOneShotAudio(listener: AudioListener, filePaths: string[]) {
    const buffers = useLoader(AudioLoader, filePaths);

    const play = ({
        position,
        volume = 1,
        detuneRange = 200,
        refDistance = 5,
        maxDistance = 100
    }: PlayOptions = {}) => {
        if (!listener || buffers.length === 0) return;

        const context = listener.context;
        if (context.state === 'suspended') context.resume();

        let finalVolume = volume;

        if (position) {
            listener.getWorldPosition(_listenerPos);
            const distance = _listenerPos.distanceTo(position);

            if (distance > maxDistance) return;

            if (distance > refDistance) {
                const rollover = 1 - (distance - refDistance) / (maxDistance - refDistance);
                finalVolume = volume * Math.max(0, rollover);
            }
        }

        if (finalVolume <= 0.01) return;

        const source = context.createBufferSource();
        const gainNode = context.createGain();

        const buffer = buffers[Math.floor(Math.random() * buffers.length)];
        source.buffer = buffer;

        if (detuneRange > 0) {
            source.detune.value = (Math.random() - 0.5) * detuneRange;
        }

        gainNode.gain.value = finalVolume;

        source.connect(gainNode);
        gainNode.connect(context.destination);
        source.start(0);
    };

    return { play };
}