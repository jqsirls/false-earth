import { memo, useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import { useTexture } from '@react-three/drei'
import { texture, equirectUV, uniform } from 'three/tsl'
import * as THREE from 'three'

export const Background = memo(function Background() {
  const { scene } = useThree()

  const intensity = useMemo(() => uniform(0.1), [])

  useControls('Background', {
    backgroundIntensity: { value: 0.1, min: 0, max: 1, step: 0.01, onChange: (value) => intensity.value = value },
  }, { collapsed: true })

  const map = useTexture('/textures/starmap_2020_4k.png', (tex) => {
    tex.mapping = THREE.EquirectangularReflectionMapping
    tex.colorSpace = THREE.SRGBColorSpace
  })

  useEffect(() => {
    if (map) {
      const bgNode = texture(map, equirectUV()).mul(intensity)
      scene.backgroundNode = bgNode
    }
    return () => {
      scene.backgroundNode = null
    }
  }, [scene, map, intensity])

  return null
})

