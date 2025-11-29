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
  const groupRef = useRef<THREE.Group>(null)
  
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.z += delta * 0.5
    }
  })
  
  // More rings for a fuller wormhole effect
  const numRings = 12
  
  return (
    <group ref={groupRef}>
      {/* Multiple rotating rings that create tunnel effect */}
      {Array.from({ length: numRings }).map((_, i) => {
        const depth = -10 - i * 4
        const size = 2 + i * 0.3
        const hue = 0.55 + (i / numRings) * 0.15 // Cyan to blue
        const opacity = Math.max(0.3, 1 - i / numRings)
        
        return (
          <mesh
            key={i}
            position={[0, 0, depth]}
            rotation={[0, 0, (i * Math.PI) / 6]}
          >
            <torusGeometry args={[size, 0.2, 16, 100]} />
            <meshBasicMaterial
              color={new THREE.Color().setHSL(hue, 1, 0.5)}
              transparent
              opacity={opacity}
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      })}
      
      {/* Inner glow rings */}
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh
          key={`glow-${i}`}
          position={[0, 0, -15 - i * 6]}
          rotation={[0, 0, -i * 0.3]}
        >
          <torusGeometry args={[1.5 + i * 0.2, 0.05, 8, 64]} />
          <meshBasicMaterial
            color="#00ffff"
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      
      {/* Progress ring - shows loading progress */}
      <mesh position={[0, 0, -8]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5, 5.3, 64, 1, 0, (progress / 100) * Math.PI * 2]} />
        <meshBasicMaterial
          color="#00ff88"
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Center portal glow */}
      <mesh position={[0, 0, -50]}>
        <circleGeometry args={[15, 64]} />
        <meshBasicMaterial
          color="#0088ff"
          transparent
          opacity={0.1 + (progress / 100) * 0.2}
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
    // Keep wormhole until 100% complete
    if (progress >= 100 && phase === 'wormhole') {
      setPhase('planet')
    }
    
    // Complete after planet zoom animation
    if (phase === 'planet') {
      setTimeout(() => {
        setPhase('complete')
        onComplete()
      }, 2000) // 2 seconds for planet zoom
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
              Traveling through hyperspace...
            </p>
          )}
          
          {phase === 'planet' && (
            <p className="text-xl text-green-400">
              Approaching orbit...
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
