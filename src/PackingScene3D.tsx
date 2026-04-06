import { useEffect, useRef } from 'react'
import { Edges, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Vector3 } from 'three'
import {
  buildVoidFillBlocks,
  getDisplayItemWrapKind,
  getDisplayItemWrapPadding,
  type Recommendation,
} from '@/packing'

type SceneDimensions = {
  cartonX: number
  cartonY: number
  cartonZ: number
  effectiveX: number
  effectiveY: number
  effectiveZ: number
  sidePadding: number
  topPadding: number
  bottomPadding: number
}

function mmToSceneUnits(value: number): number {
  return value / 10
}

function getSceneDimensions(recommendation: Recommendation): SceneDimensions {
  return {
    cartonX: mmToSceneUnits(recommendation.carton.inner.length),
    cartonY: mmToSceneUnits(recommendation.carton.inner.height),
    cartonZ: mmToSceneUnits(recommendation.carton.inner.width),
    effectiveX: mmToSceneUnits(recommendation.effectiveInner.length),
    effectiveY: mmToSceneUnits(recommendation.effectiveInner.height),
    effectiveZ: mmToSceneUnits(recommendation.effectiveInner.width),
    sidePadding: mmToSceneUnits(recommendation.cushion.sidePadding),
    topPadding: mmToSceneUnits(recommendation.cushion.topPadding),
    bottomPadding: mmToSceneUnits(recommendation.bottomFillHeight),
  }
}

function getBlockPosition({
  cartonX,
  cartonZ,
  x,
  y,
  z,
  length,
  width,
  height,
}: {
  cartonX: number
  cartonZ: number
  x: number
  y: number
  z: number
  length: number
  width: number
  height: number
}) {
  return [
    -cartonX / 2 + x + length / 2,
    z + height / 2,
    -cartonZ / 2 + y + width / 2,
  ] as const
}

type ViewAnimationState = {
  elapsed: number
  duration: number
  fromPosition: Vector3
  toPosition: Vector3
  fromTarget: Vector3
  toTarget: Vector3
}

function easeInOutCubic(value: number) {
  if (value < 0.5) {
    return 4 * value * value * value
  }

  return 1 - Math.pow(-2 * value + 2, 3) / 2
}

function ViewSyncController({
  controlsRef,
  dims,
  syncToken,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>
  dims: SceneDimensions
  syncToken: number
}) {
  const camera = useThree((state) => state.camera)
  const animationRef = useRef<ViewAnimationState | null>(null)

  useEffect(() => {
    if (syncToken === 0) {
      return
    }

    const targetY = dims.cartonY * 0.42
    const distance = Math.max(dims.cartonX, dims.cartonY, dims.cartonZ) * 1.65
    const elevatedDistance = distance * 0.94
    const depthOffset = distance * 0.34
    const controls = controlsRef.current
    const target = controls?.target.clone() ?? new Vector3(0, targetY, 0)
    camera.up.set(0, 1, 0)

    animationRef.current = {
      elapsed: 0,
      duration: 0.68,
      fromPosition: camera.position.clone(),
      toPosition: new Vector3(0, targetY + elevatedDistance, depthOffset),
      fromTarget: target,
      toTarget: new Vector3(0, targetY, 0),
    }

    if (controls) {
      controls.enabled = false
    }
  }, [camera, controlsRef, dims.cartonX, dims.cartonY, dims.cartonZ, syncToken])

  useFrame((_, delta) => {
    const animation = animationRef.current

    if (!animation) {
      return
    }

    animation.elapsed = Math.min(animation.elapsed + delta, animation.duration)
    const progress = animation.duration > 0
      ? animation.elapsed / animation.duration
      : 1
    const easedProgress = easeInOutCubic(progress)
    const controls = controlsRef.current

    camera.position.lerpVectors(
      animation.fromPosition,
      animation.toPosition,
      easedProgress,
    )

    const target = new Vector3().lerpVectors(
      animation.fromTarget,
      animation.toTarget,
      easedProgress,
    )

    if (controls) {
      controls.target.copy(target)
      controls.update()
    } else {
      camera.lookAt(target)
    }

    if (progress >= 1) {
      if ('updateProjectionMatrix' in camera && typeof camera.updateProjectionMatrix === 'function') {
        camera.updateProjectionMatrix()
      }

      if (controls) {
        controls.enabled = true
        controls.update()
      }

      animationRef.current = null
    }
  })

  return null
}

function PackingMeshes({
  controlsRef,
  recommendation,
  viewSyncToken,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>
  recommendation: Recommendation
  viewSyncToken: number
}) {
  const dims = getSceneDimensions(recommendation)
  const voidFillBlocks = buildVoidFillBlocks(recommendation)
  const itemWrapKind = getDisplayItemWrapKind(recommendation.cushion)
  const itemWrapPadding = getDisplayItemWrapPadding(recommendation.cushion)
  const cameraDistance = Math.max(dims.cartonX, dims.cartonY, dims.cartonZ) * 1.7
  const sideSpan = Math.max(dims.cartonZ - dims.sidePadding * 2, 0)
  const sideHeight = Math.max(dims.cartonY - dims.topPadding - dims.bottomPadding, 0)
  const topGuideY = dims.cartonY - dims.topPadding
  const frameThickness = 0.14

  return (
    <>
      <ambientLight intensity={1.05} />
      <directionalLight
        position={[cameraDistance, cameraDistance * 1.3, cameraDistance]}
        intensity={1.2}
      />
      <directionalLight
        position={[-cameraDistance * 0.8, cameraDistance * 0.4, -cameraDistance * 0.6]}
        intensity={0.4}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
        <planeGeometry args={[dims.cartonX * 2.3, dims.cartonZ * 2.3]} />
        <meshStandardMaterial color="#f4ede3" />
      </mesh>

      <mesh position={[0, dims.cartonY / 2, 0]} renderOrder={3}>
        <boxGeometry args={[dims.cartonX, dims.cartonY, dims.cartonZ]} />
        <meshStandardMaterial transparent opacity={0} depthWrite={false} />
        <Edges color="#836652" />
      </mesh>

      {[
        [-dims.cartonX / 2 + frameThickness / 2, dims.cartonY / 2, -dims.cartonZ / 2 + frameThickness / 2],
        [dims.cartonX / 2 - frameThickness / 2, dims.cartonY / 2, -dims.cartonZ / 2 + frameThickness / 2],
        [-dims.cartonX / 2 + frameThickness / 2, dims.cartonY / 2, dims.cartonZ / 2 - frameThickness / 2],
        [dims.cartonX / 2 - frameThickness / 2, dims.cartonY / 2, dims.cartonZ / 2 - frameThickness / 2],
      ].map((position, index) => (
        <mesh key={`carton-post-${index}`} position={position as [number, number, number]}>
          <boxGeometry args={[frameThickness, dims.cartonY, frameThickness]} />
          <meshStandardMaterial color="#e9dccf" roughness={0.95} />
        </mesh>
      ))}

      {[
        [0, frameThickness / 2, -dims.cartonZ / 2 + frameThickness / 2, dims.cartonX, frameThickness, frameThickness],
        [0, frameThickness / 2, dims.cartonZ / 2 - frameThickness / 2, dims.cartonX, frameThickness, frameThickness],
        [-dims.cartonX / 2 + frameThickness / 2, frameThickness / 2, 0, frameThickness, frameThickness, dims.cartonZ],
        [dims.cartonX / 2 - frameThickness / 2, frameThickness / 2, 0, frameThickness, frameThickness, dims.cartonZ],
        [0, dims.cartonY - frameThickness / 2, -dims.cartonZ / 2 + frameThickness / 2, dims.cartonX, frameThickness, frameThickness],
        [0, dims.cartonY - frameThickness / 2, dims.cartonZ / 2 - frameThickness / 2, dims.cartonX, frameThickness, frameThickness],
        [-dims.cartonX / 2 + frameThickness / 2, dims.cartonY - frameThickness / 2, 0, frameThickness, frameThickness, dims.cartonZ],
        [dims.cartonX / 2 - frameThickness / 2, dims.cartonY - frameThickness / 2, 0, frameThickness, frameThickness, dims.cartonZ],
      ].map(([x, y, z, sx, sy, sz], index) => (
        <mesh key={`carton-rail-${index}`} position={[x, y, z]}>
          <boxGeometry args={[sx, sy, sz]} />
          <meshStandardMaterial color="#eadfd3" roughness={0.95} />
        </mesh>
      ))}

      <mesh position={[0, topGuideY, 0]}>
        <boxGeometry args={[dims.effectiveX, 0.02, dims.effectiveZ]} />
        <meshStandardMaterial color="#8f7664" transparent opacity={0.28} />
      </mesh>

      <mesh position={[0, dims.bottomPadding / 2, 0]}>
        <boxGeometry args={[dims.cartonX, dims.bottomPadding, dims.cartonZ]} />
        <meshStandardMaterial color="#d5b18c" transparent opacity={0.52} />
      </mesh>

      {sideHeight > 0 && dims.sidePadding > 0 ? (
        <>
          <mesh position={[0, dims.bottomPadding + sideHeight / 2, -dims.cartonZ / 2 + dims.sidePadding / 2]}>
            <boxGeometry args={[dims.cartonX, sideHeight, dims.sidePadding]} />
            <meshStandardMaterial color="#d9b28a" transparent opacity={0.42} />
          </mesh>
          <mesh position={[0, dims.bottomPadding + sideHeight / 2, dims.cartonZ / 2 - dims.sidePadding / 2]}>
            <boxGeometry args={[dims.cartonX, sideHeight, dims.sidePadding]} />
            <meshStandardMaterial color="#d9b28a" transparent opacity={0.42} />
          </mesh>
          {sideSpan > 0 ? (
            <>
              <mesh position={[-dims.cartonX / 2 + dims.sidePadding / 2, dims.bottomPadding + sideHeight / 2, 0]}>
                <boxGeometry args={[dims.sidePadding, sideHeight, sideSpan]} />
                <meshStandardMaterial color="#c99d77" transparent opacity={0.38} />
              </mesh>
              <mesh position={[dims.cartonX / 2 - dims.sidePadding / 2, dims.bottomPadding + sideHeight / 2, 0]}>
                <boxGeometry args={[dims.sidePadding, sideHeight, sideSpan]} />
                <meshStandardMaterial color="#c99d77" transparent opacity={0.38} />
              </mesh>
            </>
          ) : null}
        </>
      ) : null}

      {recommendation.placements.map((placement) => {
        const length = mmToSceneUnits(placement.length)
        const width = mmToSceneUnits(placement.width)
        const height = mmToSceneUnits(placement.height)
        const x = mmToSceneUnits(recommendation.cushion.sidePadding + placement.x)
        const y = mmToSceneUnits(recommendation.cushion.sidePadding + placement.y)
        const z = mmToSceneUnits(recommendation.bottomFillHeight + placement.z)
        const sideWrap = mmToSceneUnits(
          Math.min(
            itemWrapPadding.side,
            placement.length * 0.18,
            placement.width * 0.18,
          ),
        )
        const verticalWrap = mmToSceneUnits(
          Math.min(itemWrapPadding.vertical, placement.height * 0.18),
        )
        const shellLength = length
        const shellHeight = height
        const shellWidth = width
        const coreHeight = Math.max(height - verticalWrap * 2, height * 0.58)
        const coreLength = Math.max(length - sideWrap * 2, length * 0.58)
        const coreWidth = Math.max(width - sideWrap * 2, width * 0.58)
        const position = getBlockPosition({
          cartonX: dims.cartonX,
          cartonZ: dims.cartonZ,
          x,
          y,
          z,
          length,
          width,
          height,
        })

        return (
          <group key={placement.instanceId} position={position}>
            <mesh castShadow renderOrder={2}>
              <boxGeometry args={[coreLength, coreHeight, coreWidth]} />
              <meshStandardMaterial
                color={placement.color}
                metalness={0.05}
                roughness={0.72}
              />
              <Edges color="#fff7ef" />
            </mesh>
            <mesh renderOrder={3}>
              <boxGeometry args={[shellLength, shellHeight, shellWidth]} />
              <meshStandardMaterial
                color={itemWrapKind === 'paper-fill' ? '#ceb08b' : '#e5c39f'}
                transparent
                opacity={itemWrapKind === 'paper-fill' ? 0.16 : 0.14}
                depthWrite={false}
                roughness={0.92}
              />
              <Edges color={itemWrapKind === 'paper-fill' ? '#9f7a52' : '#c69063'} />
            </mesh>
          </group>
        )
      })}

      {voidFillBlocks.map((block) => {
        const length = mmToSceneUnits(block.length)
        const width = mmToSceneUnits(block.width)
        const height = mmToSceneUnits(block.height)
        const x = mmToSceneUnits(recommendation.cushion.sidePadding + block.x)
        const y = mmToSceneUnits(recommendation.cushion.sidePadding + block.y)
        const z = mmToSceneUnits(recommendation.bottomFillHeight + block.z)

        return (
          <mesh
            key={block.id}
            position={getBlockPosition({
              cartonX: dims.cartonX,
              cartonZ: dims.cartonZ,
              x,
              y,
              z,
              length,
              width,
              height,
            })}
            renderOrder={0}
          >
            <boxGeometry args={[length, height, width]} />
            <meshStandardMaterial
              color="#dfbc98"
              transparent
              opacity={0.14}
              depthWrite={false}
              roughness={0.96}
            />
          </mesh>
        )
      })}

      <ViewSyncController controlsRef={controlsRef} dims={dims} syncToken={viewSyncToken} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        target={[0, dims.cartonY * 0.42, 0]}
        minDistance={cameraDistance * 0.45}
        maxDistance={cameraDistance * 2.4}
        minPolarAngle={0.001}
        maxPolarAngle={Math.PI / 2.05}
      />
    </>
  )
}

export default function PackingScene3D({
  recommendation,
  viewSyncToken = 0,
}: {
  recommendation: Recommendation
  viewSyncToken?: number
}) {
  const dims = getSceneDimensions(recommendation)
  const maxSize = Math.max(dims.cartonX, dims.cartonY, dims.cartonZ)
  const cameraPosition = [maxSize * 1.55, maxSize * 1.18, maxSize * 1.65] as const
  const controlsRef = useRef<OrbitControlsImpl | null>(null)

  return (
    <div className="three-d-canvas-wrap">
      <Canvas
        camera={{ position: cameraPosition, fov: 32 }}
        dpr={[1, 1.8]}
        shadows
      >
        <PackingMeshes
          controlsRef={controlsRef}
          recommendation={recommendation}
          viewSyncToken={viewSyncToken}
        />
      </Canvas>
    </div>
  )
}
