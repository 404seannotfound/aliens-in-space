import { useRef, useMemo, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store/useStore'

const BIOME_COLORS: Record<string, string> = {
  ocean: '#1e3a5f',
  desert: '#d4a84b',
  forest: '#2d5a27',
  grassland: '#7cb342',
  tundra: '#b0bec5',
  wetland: '#4a7c59',
  mountain: '#757575',
  jungle: '#1b5e20'
}

function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}

function CellDots() {
  const { cells, populations, overlayMode, setSelectedCellId, selectedCellId, showCellInfo, toggleCellInfo } = useStore()
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const { camera, raycaster, pointer } = useThree()
  const [zoomLevel, setZoomLevel] = useState(5)

  // Track camera distance for LOD
  useFrame(() => {
    const dist = camera.position.length()
    setZoomLevel(dist)
  })

  const { positions, colors, scales } = useMemo(() => {
    const positions: THREE.Vector3[] = []
    const colors: THREE.Color[] = []
    const scales: number[] = []

    const populationMap = new Map(populations.map(p => [p.cell_id, p]))

    cells.forEach(cell => {
      const pos = latLonToVector3(cell.lat, cell.lon, 2.02)
      positions.push(pos)

      const pop = populationMap.get(cell.id)
      const isSelected = cell.id === selectedCellId
      let color: THREE.Color

      switch (overlayMode) {
        case 'population':
          if (pop && pop.population_size > 0) {
            const intensity = Math.min(1, pop.population_size / 10000)
            color = new THREE.Color().lerpColors(
              new THREE.Color(pop.civilization_color || '#ffffff'),
              new THREE.Color('#ff0000'),
              intensity * 0.5
            )
          } else {
            color = new THREE.Color(BIOME_COLORS[cell.biome] || '#444444')
          }
          break
        case 'tech':
          if (pop) {
            const techColor = [
              '#4a4a4a', '#8b6914', '#4a3728', '#654321', 
              '#8b7355', '#696969', '#1e90ff', '#ff6347', 
              '#9932cc', '#00ff00'
            ][pop.tech_level] || '#333333'
            color = new THREE.Color(techColor)
          } else {
            color = new THREE.Color('#222222')
          }
          break
        case 'prosperity':
          if (pop) {
            color = new THREE.Color().lerpColors(
              new THREE.Color('#8b0000'),
              new THREE.Color('#00ff00'),
              pop.prosperity / 100
            )
          } else {
            color = new THREE.Color('#333333')
          }
          break
        case 'stability':
          if (pop) {
            color = new THREE.Color().lerpColors(
              new THREE.Color('#ff0000'),
              new THREE.Color('#00bfff'),
              pop.stability / 100
            )
          } else {
            color = new THREE.Color('#333333')
          }
          break
        case 'biome':
        default:
          color = new THREE.Color(BIOME_COLORS[cell.biome] || '#444444')
      }

      // Highlight selected cell
      if (isSelected) {
        color = new THREE.Color('#ffffff')
      }

      colors.push(color)
      
      // Scale cells based on zoom level - larger when zoomed in
      const zoomScale = Math.max(0.5, Math.min(2, (6 - zoomLevel) / 2))
      const baseScale = pop && pop.population_size > 0 ? 0.04 + Math.min(0.06, pop.population_size / 50000) : 0.03
      const finalScale = baseScale * zoomScale
      scales.push(isSelected ? finalScale * 1.5 : finalScale)
    })

    return { positions, colors, scales }
  }, [cells, populations, overlayMode, selectedCellId, zoomLevel])

  useFrame(() => {
    if (!meshRef.current) return

    const dummy = new THREE.Object3D()
    positions.forEach((pos, i) => {
      dummy.position.copy(pos)
      dummy.lookAt(0, 0, 0)
      dummy.scale.setScalar(scales[i])
      dummy.updateMatrix()
      meshRef.current!.setMatrixAt(i, dummy.matrix)
      meshRef.current!.setColorAt(i, colors[i])
    })
    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true
    }
  })

  const handleClick = () => {
    raycaster.setFromCamera(pointer, camera)
    const intersects = raycaster.intersectObject(meshRef.current!, false)
    
    if (intersects.length > 0) {
      const instanceId = intersects[0].instanceId
      if (instanceId !== undefined && cells[instanceId]) {
        setSelectedCellId(cells[instanceId].id)
        // Auto-open cell info panel if not already open
        if (!showCellInfo) {
          toggleCellInfo()
        }
      }
    }
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, cells.length]}
      onClick={handleClick}
    >
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial transparent opacity={0.7} />
    </instancedMesh>
  )
}

function Planet() {
  const { cells } = useStore()
  const meshRef = useRef<THREE.Mesh>(null)
  const textureRef = useRef<THREE.CanvasTexture | null>(null)

  // Create biome texture from cell data
  const biomeTexture = useMemo(() => {
    if (cells.length === 0) return null

    // Create a canvas to paint biomes
    const canvas = document.createElement('canvas')
    const size = 512
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // Fill with dark space color
    ctx.fillStyle = '#0a0a1a'
    ctx.fillRect(0, 0, size, size)

    // Draw each cell as a colored region
    cells.forEach(cell => {
      const color = BIOME_COLORS[cell.biome] || '#444444'
      
      // Convert lat/lon to texture coordinates (equirectangular projection)
      const x = ((cell.lon + 180) / 360) * size
      const y = ((90 - cell.lat) / 180) * size
      
      // Draw a circle for each cell
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(x, y, 8, 0, Math.PI * 2)
      ctx.fill()
    })

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    return texture
  }, [cells])

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.02
    }
  })

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[2, 64, 64]} />
      <meshStandardMaterial
        map={biomeTexture}
        roughness={0.8}
        metalness={0.2}
      />
    </mesh>
  )
}

function Atmosphere() {
  return (
    <mesh>
      <sphereGeometry args={[2.15, 64, 64]} />
      <meshBasicMaterial
        color="#4fc3f7"
        transparent
        opacity={0.1}
        side={THREE.BackSide}
      />
    </mesh>
  )
}

export function Globe() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 60 }}
      style={{ background: 'transparent', pointerEvents: 'auto' }}
      eventSource={document.getElementById('root')!}
      eventPrefix="client"
    >
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#9c27b0" />
      
      <Stars
        radius={100}
        depth={50}
        count={5000}
        factor={4}
        saturation={0}
        fade
        speed={1}
      />
      
      <Planet />
      <Atmosphere />
      <CellDots />
      
      <OrbitControls
        enablePan={false}
        minDistance={3}
        maxDistance={10}
        rotateSpeed={0.5}
        zoomSpeed={0.8}
      />
    </Canvas>
  )
}
