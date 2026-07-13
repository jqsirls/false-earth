import * as THREE from 'three'
import { useMemo, useEffect, memo } from 'react'
import { useThree } from '@react-three/fiber'
import { texture, equirectUV, uniform, mx_rotate3d, vec3, positionWorld, float, smoothstep } from 'three/tsl'
import { useKTX2Texture } from '@core'
import { CameraMode, useGameStore } from '../../core/store/gameStore'
import { uTime } from '../../core/shaders/uniforms';

export const Background = memo(function Background({ intensity, axis, speed }: { intensity: number, axis: [number, number, number], speed: number }) {
  const { scene } = useThree()

  const uniforms = useMemo(() => ({
    uIntensity: uniform(0.1),
    uSpeed: uniform(0.05),
    uAxis: uniform(vec3(0, 1, 0)),
  }), [])

  const cameraMode = useGameStore((state) => state.cameraMode);
  const map = useKTX2Texture({ map: '/textures/starmap_2020_4k.ktx2' }).map
  map.mapping = THREE.EquirectangularReflectionMapping
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = THREE.RepeatWrapping
  map.wrapT = THREE.RepeatWrapping

  useEffect(() => {
    uniforms.uIntensity.value = cameraMode === CameraMode.FPV ? 1 : intensity
    uniforms.uAxis.value.set(axis[0], axis[1], axis[2]).normalize()
    uniforms.uSpeed.value = speed
  }, [cameraMode, intensity, axis, speed])

  useEffect(() => {
    if (map) {
      const dir = positionWorld.normalize()
      const angle = uTime.mul(uniforms.uSpeed)
      const rotatedDir = mx_rotate3d(dir, angle, uniforms.uAxis)
      const finalUVs = equirectUV(rotatedDir)

      const bgNode = texture(map, finalUVs).mul(uniforms.uIntensity)
      const skyLift = smoothstep(float(-0.15), float(0.65), rotatedDir.y)
      const haze = vec3(0.02, 0.035, 0.07).mul(skyLift.mul(float(0.12)))
      scene.backgroundNode = bgNode.add(haze)
    }
    return () => {
      scene.backgroundNode = null
    }
  }, [scene, map, uniforms])


  return null
})

