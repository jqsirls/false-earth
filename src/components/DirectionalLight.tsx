import { useRef, useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import * as THREE from 'three'
import { useGameStore } from '../core/store/gameStore'
import { CINEMATIC_LIGHTING } from '../config/cinematicLighting'
import { getShadowMapSize, shouldEnableDirectionalShadows } from '../core/utils/browserCaps'

export function DirectionalLight() {
  const directionalLightRef = useRef<THREE.DirectionalLight>(null)
  const rimLightRef = useRef<THREE.DirectionalLight>(null)
  const helperRef = useRef<THREE.DirectionalLightHelper | null>(null)
  const { scene } = useThree()
  const quality = useGameStore((state) => state.quality)

  const shadowsEnabled = shouldEnableDirectionalShadows()
  const shadowMapSize = getShadowMapSize(quality)

  const { color, intensity, debug, rimIntensity } = useControls('Directional Light', {
    color: { value: CINEMATIC_LIGHTING.keyColor },
    intensity: { value: CINEMATIC_LIGHTING.keyIntensity, min: 0, max: 4, step: 0.05 },
    rimIntensity: {
      value: CINEMATIC_LIGHTING.rimIntensity,
      min: 0,
      max: 1,
      step: 0.02,
      label: 'Rim support',
    },
    debug: { value: false },
  }, { collapsed: true })

  const keyPosition = useMemo(
    () => new THREE.Vector3(...CINEMATIC_LIGHTING.keyPosition),
    [],
  )
  const rimPosition = useMemo(
    () => new THREE.Vector3(...CINEMATIC_LIGHTING.rimPosition),
    [],
  )

  useEffect(() => {
    if (!directionalLightRef.current) return

    if (debug && !helperRef.current) {
      const helper = new THREE.DirectionalLightHelper(directionalLightRef.current, 2, 'red')
      helperRef.current = helper
      scene.add(helper)
    } else if (!debug && helperRef.current) {
      scene.remove(helperRef.current)
      helperRef.current.dispose()
      helperRef.current = null
    }

    return () => {
      if (helperRef.current) {
        scene.remove(helperRef.current)
        helperRef.current.dispose()
        helperRef.current = null
      }
    }
  }, [debug, scene])

  useEffect(() => {
    const light = directionalLightRef.current
    if (!light) return

    light.color.set(color)
    light.intensity = intensity
    light.position.copy(keyPosition)

    light.castShadow = shadowsEnabled
    if (shadowsEnabled) {
      const shadow = light.shadow
      shadow.mapSize.set(shadowMapSize, shadowMapSize)
      shadow.camera.near = 1
      shadow.camera.far = 90
      shadow.camera.left = -45
      shadow.camera.right = 45
      shadow.camera.top = 45
      shadow.camera.bottom = -45
      shadow.bias = -0.00035
      shadow.normalBias = 0.025
    }

    if (helperRef.current) helperRef.current.update()
  }, [color, intensity, keyPosition, shadowsEnabled, shadowMapSize])

  useEffect(() => {
    const rim = rimLightRef.current
    if (!rim) return

    rim.color.set(CINEMATIC_LIGHTING.rimColor)
    rim.intensity = rimIntensity
    rim.position.copy(rimPosition)
  }, [rimIntensity, rimPosition])

  return (
    <>
      <hemisphereLight
        args={[
          CINEMATIC_LIGHTING.hemisphereSky,
          CINEMATIC_LIGHTING.hemisphereGround,
          CINEMATIC_LIGHTING.hemisphereIntensity,
        ]}
      />
      <directionalLight ref={directionalLightRef} castShadow={shadowsEnabled}>
        <object3D attach="target" position={[0, 0, 0]} />
      </directionalLight>
      <directionalLight ref={rimLightRef} castShadow={false}>
        <object3D attach="target" position={[0, 1.2, 0]} />
      </directionalLight>
    </>
  )
}
