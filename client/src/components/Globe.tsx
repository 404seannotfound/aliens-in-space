import { useState, useRef, useMemo, useEffect } from 'react'
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
  const wireframeRef = useRef<THREE.Mesh>(null)
  const textureRef = useRef<THREE.CanvasTexture | null>(null)

  // Create Earth-like texture with realistic continents and biomes
  const { biomeTexture, displacementMap } = useMemo(() => {
    if (cells.length === 0) return { biomeTexture: null, displacementMap: null }

    const canvas = document.createElement('canvas')
    const size = 512  // Reduced from 1024 for faster rendering
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d', { willReadFrequently: false })
    if (!ctx) return { biomeTexture: null, displacementMap: null }

    // Create displacement canvas
    const dispCanvas = document.createElement('canvas')
    dispCanvas.width = size
    dispCanvas.height = size
    const dispCtx = dispCanvas.getContext('2d', { willReadFrequently: false })
    if (!dispCtx) return { biomeTexture: null, displacementMap: null }

    // Fill with deep ocean
    ctx.fillStyle = '#0a1929'
    ctx.fillRect(0, 0, size, size)
    dispCtx.fillStyle = '#202020'
    dispCtx.fillRect(0, 0, size, size)

    // Create a map of cell biomes for lookup
    const cellMap = new Map()
    cells.forEach(cell => {
      const x = Math.floor(((cell.lon + 180) / 360) * size)
      const y = Math.floor(((90 - cell.lat) / 180) * size)
      cellMap.set(`${x},${y}`, cell)
    })

    // Draw each pixel based on nearby cells
    const imageData = ctx.createImageData(size, size)
    const dispImageData = dispCtx.createImageData(size, size)
    
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Find nearest cell
        let nearestCell = null
        let minDist = Infinity
        
        for (let dy = -15; dy <= 15; dy++) {
          for (let dx = -15; dx <= 15; dx++) {
            const cell = cellMap.get(`${x + dx},${y + dy}`)
            if (cell) {
              const dist = Math.sqrt(dx * dx + dy * dy)
              if (dist < minDist) {
                minDist = dist
                nearestCell = cell
              }
            }
          }
        }

        const idx = (y * size + x) * 4
        
        if (nearestCell && minDist < 12) {
          // Land - use biome color
          const color = BIOME_COLORS[nearestCell.biome] || '#444444'
          const rgb = parseInt(color.slice(1), 16)
          imageData.data[idx] = (rgb >> 16) & 255
          imageData.data[idx + 1] = (rgb >> 8) & 255
          imageData.data[idx + 2] = rgb & 255
          imageData.data[idx + 3] = 255

          // Height based on biome
          let height = 100
          if (nearestCell.biome === 'mountain') height = 220
          else if (nearestCell.biome === 'grassland') height = 110
          else if (nearestCell.biome === 'forest') height = 120
          else if (nearestCell.biome === 'jungle') height = 115
          else if (nearestCell.biome === 'desert') height = 105
          else if (nearestCell.biome === 'tundra') height = 95
          else if (nearestCell.biome === 'wetland') height = 85
          else if (nearestCell.biome === 'ocean') height = 40
          
          dispImageData.data[idx] = height
          dispImageData.data[idx + 1] = height
          dispImageData.data[idx + 2] = height
          dispImageData.data[idx + 3] = 255
        } else {
          // Ocean
          imageData.data[idx] = 10
          imageData.data[idx + 1] = 25
          imageData.data[idx + 2] = 41
          imageData.data[idx + 3] = 255
          
          dispImageData.data[idx] = 32
          dispImageData.data[idx + 1] = 32
          dispImageData.data[idx + 2] = 32
          dispImageData.data[idx + 3] = 255
        }
      }
    }

    ctx.putImageData(imageData, 0, 0)
    dispCtx.putImageData(dispImageData, 0, 0)

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    
    const dispTexture = new THREE.CanvasTexture(dispCanvas)
    dispTexture.needsUpdate = true
    
    return { biomeTexture: texture, displacementMap: dispTexture }
  }, [cells])

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.02
    }
    if (wireframeRef.current) {
      wireframeRef.current.rotation.y += delta * 0.02
    }
  })

  return (
    <>
      {/* Wireframe base - always visible */}
      <mesh ref={wireframeRef}>
        <sphereGeometry args={[2, 24, 24]} />
        <meshBasicMaterial
          color="#1a1a3a"
          wireframe={!biomeTexture}
          opacity={biomeTexture ? 0 : 0.3}
          transparent
        />
      </mesh>
      
      {/* Textured planet - loads after cells are ready */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[2, 64, 64]} />
        <meshStandardMaterial
          map={biomeTexture}
          displacementMap={displacementMap}
          displacementScale={0.15}
          roughness={0.8}
          metalness={0.2}
          opacity={biomeTexture ? 1 : 0}
          transparent
        />
      </mesh>
    </>
  )
}

function Atmosphere() {
  const cloudRef = useRef<THREE.Mesh>(null)
  const [cloudColor, setCloudColor] = useState('#87ceeb')
  
  useEffect(() => {
    // Load cloud color from localStorage
    const saved = localStorage.getItem('cloudColor')
    if (saved) setCloudColor(saved)
    
    // Listen for changes
    const handleStorage = () => {
      const newColor = localStorage.getItem('cloudColor')
      if (newColor) setCloudColor(newColor)
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])
  
  useFrame((_, delta) => {
    if (cloudRef.current) {
      cloudRef.current.rotation.y += delta * 0.02
      cloudRef.current.rotation.x += delta * 0.005
    }
  })

  // Lighten and darken the base color for variety
  const baseColor = new THREE.Color(cloudColor)
  const lighterCloud = baseColor.clone().offsetHSL(0, 0, 0.1)
  const darkerCloud = baseColor.clone().offsetHSL(0, 0, -0.1)

  return (
    <>
      {/* Multiple cloud layers at different heights */}
      <mesh ref={cloudRef}>
        <sphereGeometry args={[2.25, 32, 32]} />
        <meshBasicMaterial
          color={cloudColor}
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      <mesh rotation={[0, Math.PI / 3, 0]}>
        <sphereGeometry args={[2.3, 32, 32]} />
        <meshBasicMaterial
          color={lighterCloud}
          transparent
          opacity={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      <mesh rotation={[0, Math.PI / 1.5, 0]}>
        <sphereGeometry args={[2.35, 32, 32]} />
        <meshBasicMaterial
          color={darkerCloud}
          transparent
          opacity={0.08}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  )
}

export function Globe() {
  return (
    <div className="w-full h-full pointer-events-auto">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 60 }}
        style={{ background: 'transparent' }}
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
        makeDefault={false}
      />
    </Canvas>
    </div>
  )
}
