import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import { uniform, time, instancedBufferAttribute, Fn, uv, vec3, float, length, smoothstep, mx_hsvtorgb, mx_rgbtohsv, fract, sin, PI2, vec4 } from 'three/tsl';
import { useControls } from 'leva';

interface StarsProps {
  count?: number;
  radius?: number;
}

export function Stars({
  count = 500,
  radius = 190,
}: StarsProps) {
  const {camera} = useThree();
  const groupRef = useRef<THREE.Group>(null);

  const uniforms = useMemo(() => ({
    uScale: uniform(0.25),
    uColor: uniform(new THREE.Color('#bbd0f5')),
    uHueVar: uniform(0.1),
    uRim: uniform(0.95),
    uSpeed: uniform(2),
  }), []);

  const { rim } = useControls('Stars', {
    scale: {
      value: 0.25, min: 0, max: 1, step: 0.01,
      onChange: (v) => (uniforms.uScale.value = v)
    },
    baseColor: {
      value: '#bbd0f5',
      onChange: (v) => uniforms.uColor.value.set(v)
    },
    hueVariation: {
      value: 0.1, min: 0, max: 1, step: 0.01,
      onChange: (v) => (uniforms.uHueVar.value = v)
    },
    rim: {
      value: 0.95, min: 0, max: 1, step: 0.01,
    },
    speed: {
      value: 2, min: 0, max: 10, step: 0.01,
      onChange: (v) => (uniforms.uSpeed.value = v)
    },
  }, { collapsed: true });

  const { positionAttribute, seedAttribute } = useMemo(() => {
    const pos = [];
    const seedArray = [];

    const rimMin = radius * rim;
    const rimMax = radius;
    const rimThickness = rimMax - rimMin;

    for (let i = 0; i < count; i++) {
      const seed = Math.random();
      seedArray.push(seed);

      let x, y, z, len;
      do {
        x = Math.random() * 2 - 1;
        y = Math.random() * 2 - 1;
        z = Math.random() * 2 - 1;
        len = Math.sqrt(x * x + y * y + z * z);
      } while (len > 1 || len === 0);

      const r = rimMin + Math.random() * rimThickness;
      pos.push((x / len) * r, (Math.abs(y / len)) * r, (z / len) * r);
    }

    return {
      positionAttribute: new THREE.InstancedBufferAttribute(new Float32Array(pos), 3),
      seedAttribute: new THREE.InstancedBufferAttribute(new Float32Array(seedArray), 1),
    };
  }, [count, radius, rim]);

  const material = useMemo(() => {
    const mat = new THREE.SpriteNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const seed = instancedBufferAttribute(seedAttribute);
    mat.positionNode = instancedBufferAttribute(positionAttribute);


    const sizeVar = seed.mul(0.5).add(1);
    mat.scaleNode = uniforms.uScale.mul(sizeVar);


    const baseRGB = uniforms.uColor
    const baseHSV = mx_rgbtohsv(baseRGB);
    const hueShifted = fract(baseHSV.x.add(seed.mul(float(uniforms.uHueVar))));

    // Blink
    const timePhase = time.add(seed.mul(PI2)).mul(uniforms.uSpeed);
    const brightAnim = sin(timePhase).mul(float(0.3)).add(float(0.7));

    const finalHsv = vec3(hueShifted, baseHSV.y, baseHSV.z.mul(brightAnim));
    const finalColor = mx_hsvtorgb(finalHsv);

    const shape = Fn(() => {
      const d = length(uv().sub(0.5));
      return smoothstep(float(0.5), float(0.3), d);
    })();

    mat.colorNode = vec4(finalColor, shape);

    return mat;
  }, []);

  const sprite = useMemo(() => {
    const s = new THREE.Sprite(material);
    s.count = count;
    s.frustumCulled = false;

    // Set seed attribute on the sprite's geometry
    if (s.geometry) {
      s.geometry.setAttribute('seed', seedAttribute);
    }

    return s;
  }, [material, count, seedAttribute, positionAttribute]);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.copy(camera.position);
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={sprite} />
    </group>
  );
}
