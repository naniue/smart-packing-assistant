import { Edges, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import {
  CanvasTexture,
  LinearFilter,
  SRGBColorSpace,
} from 'three'
import type { PackedBox, Placement } from '../types'

function SurfaceLabels({
  name,
  size,
}: {
  name: string
  size: [number, number, number]
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 128
    const context = canvas.getContext('2d')
    if (context) {
      context.fillStyle = 'rgba(255, 255, 255, 0.88)'
      context.fillRect(4, 4, 504, 120)
      context.strokeStyle = 'rgba(19, 47, 38, 0.3)'
      context.lineWidth = 4
      context.strokeRect(4, 4, 504, 120)
      context.fillStyle = '#142b24'
      context.font =
        '700 54px "Microsoft YaHei", "PingFang SC", sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      const shownName = name.length > 10 ? `${name.slice(0, 9)}…` : name
      context.fillText(shownName, 256, 66, 470)
    }
    const canvasTexture = new CanvasTexture(canvas)
    canvasTexture.colorSpace = SRGBColorSpace
    canvasTexture.minFilter = LinearFilter
    canvasTexture.generateMipmaps = false
    return canvasTexture
  }, [name])

  useEffect(() => () => texture.dispose(), [texture])

  const labelWidth = Math.max(0.18, size[0] * 0.82)
  const topHeight = Math.min(size[2] * 0.42, labelWidth / 3.7)
  const frontHeight = Math.min(size[1] * 0.3, labelWidth / 3.7)

  return (
    <>
      <mesh
        position={[0, size[1] / 2 + 0.004, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[labelWidth, Math.max(0.07, topHeight)]} />
        <meshBasicMaterial
          map={texture}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0, size[2] / 2 + 0.004]}>
        <planeGeometry args={[labelWidth, Math.max(0.07, frontHeight)]} />
        <meshBasicMaterial
          map={texture}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </>
  )
}

function PackedItem({
  placement,
  scale,
  selected,
  onSelect,
}: {
  placement: Placement
  scale: number
  selected: boolean
  onSelect: () => void
}) {
  const { dimensions, position } = placement
  const size: [number, number, number] = [
    dimensions.length * scale,
    dimensions.height * scale,
    dimensions.width * scale,
  ]
  const center: [number, number, number] = [
    (position.x + dimensions.length / 2) * scale,
    (position.y + dimensions.height / 2) * scale,
    (position.z + dimensions.width / 2) * scale,
  ]

  return (
    <group position={center}>
      <mesh
        onClick={(event) => {
          event.stopPropagation()
          onSelect()
        }}
        onPointerOver={(event) => {
          event.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = ''
        }}
      >
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={placement.color}
          emissive={selected ? '#ffffff' : '#000000'}
          emissiveIntensity={selected ? 0.22 : 0}
          roughness={0.7}
        />
        <Edges color={selected ? '#102f25' : '#ffffff'} threshold={15} />
      </mesh>
      <SurfaceLabels name={placement.productName} size={size} />
    </group>
  )
}

function Scene({
  packedBox,
  selectedItemId,
  onSelectItem,
}: {
  packedBox: PackedBox
  selectedItemId: string | null
  onSelectItem: (instanceId: string) => void
}) {
  const { length, width, height } = packedBox.boxType
  const scale = 5 / Math.max(length, width, height)
  const size: [number, number, number] = [
    length * scale,
    height * scale,
    width * scale,
  ]
  const center: [number, number, number] = [
    (length * scale) / 2,
    (height * scale) / 2,
    (width * scale) / 2,
  ]

  return (
    <>
      <ambientLight intensity={1.7} />
      <directionalLight position={[8, 12, 10]} intensity={2.2} />
      <directionalLight position={[-5, 4, -3]} intensity={0.8} />
      <group position={[-center[0], -center[1], -center[2]]}>
        {packedBox.placements.map((placement) => (
          <PackedItem
            key={placement.instanceId}
            placement={placement}
            scale={scale}
            selected={placement.instanceId === selectedItemId}
            onSelect={() => onSelectItem(placement.instanceId)}
          />
        ))}
        <mesh position={center}>
          <boxGeometry args={size} />
          <meshBasicMaterial color="#58a6ff" transparent opacity={0.04} />
          <Edges color="#3178c6" />
        </mesh>
      </group>
      <gridHelper
        args={[8, 16, '#c7d2db', '#e6ebef']}
        position={[0, -center[1] - 0.02, 0]}
      />
      <OrbitControls
        makeDefault
        enableDamping
        minDistance={5}
        maxDistance={18}
        target={[0, 0, 0]}
      />
    </>
  )
}

export function PackingScene({
  packedBox,
  selectedItemId,
  onSelectItem,
}: {
  packedBox: PackedBox
  selectedItemId: string | null
  onSelectItem: (instanceId: string) => void
}) {
  const [viewKey, setViewKey] = useState(0)

  return (
    <div className="scene-shell">
      <button
        className="scene-reset"
        type="button"
        onClick={() => setViewKey((key) => key + 1)}
      >
        重置视角
      </button>
      <Canvas
        key={viewKey}
        camera={{ position: [7.5, 6.5, 8.5], fov: 42 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
      >
        <Scene
          packedBox={packedBox}
          selectedItemId={selectedItemId}
          onSelectItem={onSelectItem}
        />
      </Canvas>
      <span className="scene-tip">点击商品调整朝向 · 拖动空白处旋转视角</span>
    </div>
  )
}
