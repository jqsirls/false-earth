import { memo, useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import { texture, equirectUV, uniform, vec2 } from 'three/tsl'
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
  map.wrapS = THREE.RepeatWrapping
  map.wrapT = THREE.RepeatWrapping

  useEffect(() => {
    if (map) {
      const uvs = equirectUV()
      const rotatedUVs = uvs.add(vec2(0.2, 0))
      
      const bgNode = texture(map, rotatedUVs).mul(intensity)
      scene.backgroundNode = bgNode
    }
    return () => {
      scene.backgroundNode = null
    }
  }, [scene, map, intensity])

  return null
})

