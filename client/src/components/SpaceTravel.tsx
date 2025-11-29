import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface SpaceTravelProps {
  worldName: string
  progress: number
  onComplete: () => void
}

function Starfield() {
  const starsRef = useRef<THREE.Points>(null)
  
  const stars = useRef(() => {
    const positions = new Float32Array(2000 * 3)
    for (let i = 0; i < 2000; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 200
      positions[i * 3 + 1] = (Math.random() - 0.5) * 200
      positions[i * 3 + 2] = (Math.random() - 0.5) * 200
    }
    return positions
  }).current()
  
  useFrame((_, delta) => {
    if (starsRef.current) {
      starsRef.current.rotation.z += delta * 0.05
      // Move stars toward camera
      const positions = starsRef.current.geometry.attributes.position.array as Float32Array
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 2] += delta * 20
        if (positions[i + 2] > 100) {
          positions[i + 2] = -100
        }
      }
      starsRef.current.geometry.attributes.position.needsUpdate = true
    }
  })
  
  return (
    <points ref={starsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={stars.length / 3}
          array={stars}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.5}
        color="#ffffff"
        transparent
        opacity={0.8}
        sizeAttenuation
      />
    </points>
  )
}

function Wormhole({ progress }: { progress: number }) {
  const wormholeRef = useRef<THREE.Mesh>(null)
  
  useFrame((_, delta) => {
    if (wormholeRef.current) {
      wormholeRef.current.rotation.z += delta * 2
    }
  })
  
  // Calculate how many rings should be visible based on progress
  const visibleRings = Math.ceil((progress / 100) * 5)
  
  return (
    <group>
      {/* Multiple rotating rings that appear as loading progresses */}
      {[0, 1, 2, 3, 4].map((i) => {
        const ringProgress = Math.max(0, Math.min(1, (progress - i * 20) / 20))
        const isVisible = i < visibleRings
        
        return (
          <mesh
            key={i}
            ref={i === 0 ? wormholeRef : undefined}
            position={[0, 0, -20 - i * 5]}
            rotation={[0, 0, i * 0.5]}
            scale={isVisible ? ringProgress : 0}
          >
            <torusGeometry args={[3 + i * 0.5, 0.15, 16, 100]} />
            <meshBasicMaterial
              color={new THREE.Color().setHSL(0.5 + ringProgress * 0.2, 1, 0.5)}
              transparent
              opacity={0.6 * ringProgress}
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      })}
      
      {/* Center glow that intensifies with progress */}
      <mesh position={[0, 0, -30]}>
        <torusGeometry args={[8, 0.1, 8, 64]} />
        <meshBasicMaterial
          color="#00ffff"
          transparent
          opacity={0.2 + progress / 100 * 0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Progress ring */}
      <mesh position={[0, 0, -15]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[6, 6.2, 64, 1, 0, (progress / 100) * Math.PI * 2]} />
        <meshBasicMaterial
          color="#00ff00"
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

function PlanetZoom({ show }: { show: boolean }) {
  const planetRef = useRef<THREE.Mesh>(null)
  const [scale, setScale] = useState(0.1)
  
  useFrame((state, delta) => {
    if (show && planetRef.current) {
      // Zoom in effect
      setScale(prev => Math.min(prev + delta * 0.5, 2))
      planetRef.current.position.z = -50 + scale * 48
    }
  })
  
  if (!show) return null
  
  return (
    <mesh ref={planetRef} position={[0, 0, -50]} scale={scale}>
      <sphereGeometry args={[2, 32, 32]} />
      <meshStandardMaterial
        color="#4a90e2"
        emissive="#1a3a5f"
        emissiveIntensity={0.3}
      />
      {/* Atmosphere glow */}
      <mesh scale={1.1}>
        <sphereGeometry args={[2, 32, 32]} />
        <meshBasicMaterial
          color="#87ceeb"
          transparent
          opacity={0.2}
          side={THREE.BackSide}
        />
      </mesh>
    </mesh>
  )
}

export function SpaceTravel({ worldName, progress, onComplete }: SpaceTravelProps) {
  const [phase, setPhase] = useState<'wormhole' | 'planet' | 'complete'>('wormhole')
  
  useEffect(() => {
    // Transition to planet view when progress reaches 90%
    if (progress >= 90 && phase === 'wormhole') {
      setPhase('planet')
    }
    
    // Complete when progress reaches 100%
    if (progress >= 100 && phase === 'planet') {
      setTimeout(() => {
        setPhase('complete')
        onComplete()
      }, 1000)
    }
  }, [progress, phase, onComplete])
  
  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* 3D Canvas */}
      <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        
        <Starfield />
        {phase === 'wormhole' && <Wormhole progress={progress} />}
        {phase === 'planet' && <PlanetZoom show={true} />}
      </Canvas>
      
      {/* Overlay Text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-center space-y-4">
          <h1 className="text-6xl font-bold text-white animate-pulse">
            {worldName}
          </h1>
          
          {phase === 'wormhole' && (
            <p className="text-xl text-cyan-400">
              Entering wormhole... {progress}%
            </p>
          )}
          
          {phase === 'planet' && (
            <p className="text-xl text-green-400">
              Approaching orbit... {progress}%
            </p>
          )}
        </div>
        
        {/* Progress percentage display */}
        <div className="absolute bottom-20">
          <div className="text-4xl font-bold text-cyan-400">
            {progress}%
          </div>
        </div>
      </div>
    </div>
  )
}
