import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface SpaceTravelProps {
  worldName: string
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

function Wormhole() {
  const wormholeRef = useRef<THREE.Mesh>(null)
  
  useFrame((_, delta) => {
    if (wormholeRef.current) {
      wormholeRef.current.rotation.z += delta * 2
    }
  })
  
  return (
    <group>
      {/* Multiple rotating rings */}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh
          key={i}
          ref={i === 0 ? wormholeRef : undefined}
          position={[0, 0, -20 - i * 5]}
          rotation={[0, 0, i * 0.5]}
        >
          <torusGeometry args={[3 + i * 0.5, 0.1, 16, 100]} />
          <meshBasicMaterial
            color={new THREE.Color().setHSL(0.6 + i * 0.05, 1, 0.5)}
            transparent
            opacity={0.6 - i * 0.1}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      
      {/* Swirling particles */}
      <mesh position={[0, 0, -30]}>
        <torusGeometry args={[8, 0.05, 8, 64]} />
        <meshBasicMaterial
          color="#00ffff"
          transparent
          opacity={0.3}
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

export function SpaceTravel({ worldName, onComplete }: SpaceTravelProps) {
  const [phase, setPhase] = useState<'wormhole' | 'planet' | 'complete'>('wormhole')
  
  useEffect(() => {
    // Transition to planet view after 3 seconds
    const timer1 = setTimeout(() => {
      setPhase('planet')
    }, 3000)
    
    // Complete after 5 seconds total
    const timer2 = setTimeout(() => {
      setPhase('complete')
      onComplete()
    }, 5000)
    
    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [onComplete])
  
  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* 3D Canvas */}
      <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        
        <Starfield />
        {phase === 'wormhole' && <Wormhole />}
        {phase === 'planet' && <PlanetZoom show={true} />}
      </Canvas>
      
      {/* Overlay Text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-center space-y-4">
          <h1 className="text-6xl font-bold text-white animate-pulse">
            {worldName}
          </h1>
          
          {phase === 'wormhole' && (
            <p className="text-xl text-cyan-400 animate-pulse">
              Entering wormhole...
            </p>
          )}
          
          {phase === 'planet' && (
            <p className="text-xl text-green-400 animate-pulse">
              Approaching orbit...
            </p>
          )}
        </div>
        
        {/* Progress dots */}
        <div className="absolute bottom-20 flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all duration-500 ${
                (phase === 'wormhole' && i === 0) ||
                (phase === 'planet' && i === 1) ||
                (phase === 'complete' && i === 2)
                  ? 'bg-cyan-400 scale-150'
                  : 'bg-gray-600'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
