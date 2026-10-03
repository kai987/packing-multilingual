import { memo, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type { Recommendation } from '@/packing'
import { getTopViewCameraHeight } from '@/sceneCamera'
import {
  buildPackingScene,
  hasSameSceneGeometry,
  type SceneDimensions,
} from '@/sceneModel'

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function addBox({
  args,
  color,
  edgeColor,
  group,
  opacity = 1,
  position = new THREE.Vector3(),
  roughness = 0.8,
}: {
  args: [number, number, number]
  color: string
  edgeColor?: string
  group: THREE.Group
  opacity?: number
  position?: THREE.Vector3
  roughness?: number
}) {
  const geometry = new THREE.BoxGeometry(...args)
  const material = new THREE.MeshStandardMaterial({
    color,
    depthWrite: opacity >= 0.28,
    opacity,
    roughness,
    transparent: opacity < 1,
  })
  const mesh = new THREE.Mesh(geometry, material)

  mesh.position.copy(position)
  group.add(mesh)

  if (edgeColor) {
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({
        color: edgeColor,
        transparent: true,
        opacity: 0.62,
      }),
    )

    edges.position.copy(position)
    group.add(edges)
  }
}

function buildPackingGroup(recommendation: Recommendation) {
  const { dims, boxes } = buildPackingScene(recommendation)
  const group = new THREE.Group()
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(dims.cartonX * 2.25, dims.cartonZ * 2.25),
    new THREE.MeshStandardMaterial({ color: '#ebe6dc', roughness: 1 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.04
  group.add(floor)
  for (const box of boxes) {
    addBox({
      ...box,
      group,
      position: new THREE.Vector3(...(box.position ?? [0, 0, 0])),
    })
  }
  return { dims, group }
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((item) => {
    if (item instanceof THREE.Mesh || item instanceof THREE.LineSegments) {
      item.geometry.dispose()

      if (Array.isArray(item.material)) {
        for (const material of item.material) {
          material.dispose()
        }
      } else {
        item.material.dispose()
      }
    }
  })
}

type SceneRuntime = {
  replaceGroup: (dims: SceneDimensions, group: THREE.Group) => void
  showTopView: () => void
}

function PackingScene3D({
  onGestureActiveChange,
  recommendation,
  viewSyncToken = 0,
}: {
  onGestureActiveChange?: (active: boolean) => void
  recommendation: Recommendation
  viewSyncToken?: number
}) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const runtimeRef = useRef<SceneRuntime | null>(null)
  const gestureCallbackRef = useRef(onGestureActiveChange)
  const [webGlUnavailable, setWebGlUnavailable] = useState(false)

  useEffect(() => {
    gestureCallbackRef.current = onGestureActiveChange
  }, [onGestureActiveChange])

  useEffect(() => {
    const mount = mountRef.current

    if (!mount || webGlUnavailable) {
      return
    }

    const canvas = document.createElement('canvas')
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 1000)
    let renderer: THREE.WebGLRenderer

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        canvas,
        failIfMajorPerformanceCaveat: false,
        powerPreference: 'high-performance',
      })
    } catch {
      window.setTimeout(() => setWebGlUnavailable(true), 0)
      return
    }
    const target = new THREE.Vector3()
    let activeGroup: THREE.Group | null = null
    let activeDims: SceneDimensions | null = null
    let maxSize = 1
    let viewMode: 'orbit' | 'top' = 'orbit'
    let yaw = -0.12
    let pitch = 0
    let zoom = 1
    let startX = 0
    let startY = 0
    let startYaw = yaw
    let startPitch = pitch
    let isDragging = false
    let frameId: number | null = null

    scene.background = new THREE.Color('#f7f8f4')
    scene.add(new THREE.AmbientLight('#ffffff', 1.15))

    const mainLight = new THREE.DirectionalLight('#ffffff', 1.25)
    scene.add(mainLight)

    const fillLight = new THREE.DirectionalLight('#ffffff', 0.42)
    scene.add(fillLight)
    mount.appendChild(canvas)

    const updateCamera = () => {
      if (!activeDims) {
        return
      }

      if (viewMode === 'top') {
        const height = getTopViewCameraHeight(
          activeDims,
          camera.aspect,
          camera.fov,
        )
        camera.position.set(0, height * zoom, 0.001)
        camera.up.set(0, 0, -1)
      } else {
        const distanceScale = Math.max(1, 1 / camera.aspect)
        camera.position.set(
          maxSize * 1.55 * zoom * distanceScale,
          maxSize * 1.18 * zoom * distanceScale,
          maxSize * 1.65 * zoom * distanceScale,
        )
        camera.up.set(0, 1, 0)
      }

      camera.lookAt(target)
      camera.updateProjectionMatrix()
    }
    const renderScene = () => {
      if (frameId !== null) {
        return
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null
        activeGroup?.rotation.set(pitch, yaw, 0)
        renderer.render(scene, camera)
      })
    }
    const resize = () => {
      const width = mount.clientWidth
      const height = mount.clientHeight

      if (width === 0 || height === 0) {
        return
      }

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      updateCamera()
      renderScene()
    }
    const replaceGroup = (dims: SceneDimensions, group: THREE.Group) => {
      if (activeGroup) {
        scene.remove(activeGroup)
        disposeObject(activeGroup)
      }

      activeDims = dims
      activeGroup = group
      maxSize = Math.max(dims.cartonX, dims.cartonY, dims.cartonZ)
      target.set(0, dims.cartonY * 0.42, 0)
      mainLight.position.set(maxSize * 1.8, maxSize * 1.7, maxSize * 1.4)
      fillLight.position.set(-maxSize * 1.2, maxSize * 0.8, -maxSize)
      group.rotation.set(pitch, yaw, 0)
      scene.add(group)
      updateCamera()
      renderScene()
    }
    const showTopView = () => {
      viewMode = 'top'
      pitch = 0
      yaw = 0
      zoom = 1
      updateCamera()
      renderScene()
    }
    const handlePointerDown = (event: PointerEvent) => {
      event.preventDefault()
      isDragging = true
      startX = event.clientX
      startY = event.clientY
      startYaw = yaw
      startPitch = pitch
      gestureCallbackRef.current?.(true)
      mount.setPointerCapture(event.pointerId)
      renderScene()
    }
    const handlePointerMove = (event: PointerEvent) => {
      if (!isDragging) {
        return
      }

      event.preventDefault()
      viewMode = 'orbit'
      yaw = startYaw + (event.clientX - startX) * 0.008
      pitch = clamp(startPitch + (event.clientY - startY) * 0.006, -0.56, 0.46)
      updateCamera()
      renderScene()
    }
    const handlePointerUp = (event: PointerEvent) => {
      isDragging = false
      gestureCallbackRef.current?.(false)

      if (mount.hasPointerCapture(event.pointerId)) {
        mount.releasePointerCapture(event.pointerId)
      }
    }
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      zoom = clamp(zoom + event.deltaY * 0.0018, 0.68, 1.85)
      updateCamera()
      renderScene()
    }
    const observer = new ResizeObserver(resize)

    runtimeRef.current = { replaceGroup, showTopView }

    mount.addEventListener('pointerdown', handlePointerDown)
    mount.addEventListener('pointermove', handlePointerMove)
    mount.addEventListener('pointerup', handlePointerUp)
    mount.addEventListener('pointercancel', handlePointerUp)
    mount.addEventListener('wheel', handleWheel, { passive: false })
    observer.observe(mount)
    resize()

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }

      observer.disconnect()
      mount.removeEventListener('pointerdown', handlePointerDown)
      mount.removeEventListener('pointermove', handlePointerMove)
      mount.removeEventListener('pointerup', handlePointerUp)
      mount.removeEventListener('pointercancel', handlePointerUp)
      mount.removeEventListener('wheel', handleWheel)
      gestureCallbackRef.current?.(false)

      if (runtimeRef.current?.replaceGroup === replaceGroup) {
        runtimeRef.current = null
      }

      if (canvas.parentNode === mount) {
        mount.removeChild(canvas)
      }

      if (activeGroup) {
        scene.remove(activeGroup)
        disposeObject(activeGroup)
      }

      renderer.dispose()
    }
  }, [webGlUnavailable])

  useEffect(() => {
    const runtime = runtimeRef.current

    if (!runtime || webGlUnavailable) {
      return
    }

    const { dims, group } = buildPackingGroup(recommendation)
    runtime.replaceGroup(dims, group)
  }, [recommendation, webGlUnavailable])

  useEffect(() => {
    if (viewSyncToken === 0) {
      return
    }

    runtimeRef.current?.showTopView()
  }, [viewSyncToken])

  return (
    <div
      ref={mountRef}
      style={{
        alignItems: 'center',
        backgroundColor: '#eef2ee',
        border: '1px solid #cbd8d0',
        borderRadius: 8,
        boxSizing: 'border-box',
        display: 'flex',
        height: 340,
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
        touchAction: 'none',
        width: '100%',
      }}
    >
      {webGlUnavailable ? (
        <div
          style={{
            color: '#59645e',
            fontSize: 13,
            lineHeight: '19px',
            maxWidth: 320,
            padding: 18,
            textAlign: 'center',
          }}
        >
          <strong
            style={{
              color: '#17221d',
              display: 'block',
              fontSize: 16,
              marginBottom: 6,
            }}
          >
            3D preview needs WebGL
          </strong>
          Enable hardware acceleration or open this app in Chrome, Safari, or
          Expo Go.
        </div>
      ) : null}
    </div>
  )
}

export default memo(
  PackingScene3D,
  (previous, next) =>
    previous.onGestureActiveChange === next.onGestureActiveChange &&
    previous.viewSyncToken === next.viewSyncToken &&
    hasSameSceneGeometry(previous.recommendation, next.recommendation),
)
