import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import Rose, { RoseHandle } from "./Rose";

export default function TestSpawner() {
  const moverRef = useRef<THREE.Group>(null);
  
  // Use ref to control Rose component
  const roseRef = useRef<RoseHandle>(null);
  const lastSpawnPos = useRef(new THREE.Vector3(9999, 9999, 9999));

  useFrame((state) => {
    if (!moverRef.current || !roseRef.current) return;

    const time = state.clock.getElapsedTime();
    
    const radius = 3;
    moverRef.current.position.x = Math.sin(time) * radius;
    moverRef.current.position.z = Math.cos(time) * radius;
    moverRef.current.position.y = Math.sin(time * 3) * 0.5 + 0.5;

    const currentPos = moverRef.current.position;
    const dist = currentPos.distanceTo(lastSpawnPos.current);

    if (dist > 0.5) {
      // Directly command spawn, completely bypassing React Render Cycle
      roseRef.current.spawn(currentPos);
      lastSpawnPos.current.copy(currentPos);
    }
  });

  return (
    <>
      <group ref={moverRef}>
        <mesh>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color="red" emissive="red" emissiveIntensity={0.5} />
        </mesh>
      </group>

      {/* Remove trigger props, use ref instead */}
      <Rose ref={roseRef} count={2000} />
    </>
  );
}