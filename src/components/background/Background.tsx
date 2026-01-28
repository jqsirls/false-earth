import { memo, useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import { texture, equirectUV, uniform } from 'three/tsl'
import * as THREE from 'three'
import { useKTX2Texture } from '../../core/utils/useKTX2Texture'

export const Background = memo(function Background() {
  const { scene } = useThree()
  const intensity = useMemo(() => uniform(0.1), [])

  useControls('Background', {
    backgroundIntensity: { value: 0.1, min: 0, max: 1, step: 0.01, onChange: (value) => intensity.value = value },
  }, { collapsed: true })

  const map = useKTX2Texture({ map: '/textures/starmap_2020_4k.ktx2' }).map
  map.mapping = THREE.EquirectangularReflectionMapping
  map.colorSpace = THREE.SRGBColorSpace

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

