// components/AsyncCompile.tsx
import { useRef, useEffect, useState, ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import { useGameStore } from '../../core/store/gameStore'
import * as THREE from 'three/webgpu'

interface AsyncCompileProps {
  children: ReactNode
  id: string
}

export function AsyncCompile({ children, id }: AsyncCompileProps) {
  const { gl, camera } = useThree()
  const setComponentReady = useGameStore((state) => state.setComponentReady)
  const groupRef = useRef<THREE.Group>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (groupRef.current) {
      gl.compileAsync(groupRef.current, camera).then(() => {
        // console.log(`[⚡ Compiled] ${id}`)
        setIsReady(true)
        setComponentReady(id as 'rose' | 'grass' | 'character')
      })
    }
  }, [gl, camera, id, setComponentReady])

  return (
    <group ref={groupRef} visible={isReady}>
      {children}
    </group>
  )
}