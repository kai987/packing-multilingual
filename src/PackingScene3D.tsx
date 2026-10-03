import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from 'react'
import { PanResponder, Platform, StyleSheet, Text, View } from 'react-native'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Recommendation } from '@/packing'
import {
  buildPackingScene,
  getSceneDimensions,
  hasSameSceneGeometry,
  type SceneDimensions,
} from '@/sceneModel'

type CameraMode = 'orbit' | 'top'

type ViewState = {
  mode: CameraMode
  pitch: number
  yaw: number
  zoom: number
}

type GestureState = {
  pinchDistance: number
  pitch: number
  yaw: number
  zoom: number
}

type InvalidateScene = () => void

const defaultViewState: ViewState = {
  mode: 'orbit',
  pitch: 0,
  yaw: -0.12,
  zoom: 1,
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function BoxBlock({
  args,
  color,
  edgeColor,
  opacity = 1,
  position,
  transparent = false,
  roughness = 0.8,
}: {
  args: [number, number, number]
  color: string
  edgeColor?: string
  opacity?: number
  position?: readonly [number, number, number]
  transparent?: boolean
  roughness?: number
}) {
  const [sizeX, sizeY, sizeZ] = args
  const edgeLines = useMemo(() => {
    if (!edgeColor) {
      return null
    }

    const boxGeometry = new THREE.BoxGeometry(sizeX, sizeY, sizeZ)
    const edgeGeometry = new THREE.EdgesGeometry(boxGeometry)
    boxGeometry.dispose()

    return new THREE.LineSegments(
      edgeGeometry,
      new THREE.LineBasicMaterial({
        color: edgeColor,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
      }),
    )
  }, [edgeColor, sizeX, sizeY, sizeZ])

  useEffect(() => {
    return () => {
      if (!edgeLines) {
        return
      }

      edgeLines.geometry.dispose()

      if (Array.isArray(edgeLines.material)) {
        edgeLines.material.forEach((material) => material.dispose())
      } else {
        edgeLines.material.dispose()
      }
    }
  }, [edgeLines])

  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={args} />
        <meshStandardMaterial
          color={color}
          opacity={opacity}
          transparent={transparent || opacity < 1}
          roughness={roughness}
          depthWrite={opacity >= 0.28}
        />
      </mesh>
      {edgeLines ? <primitive object={edgeLines} /> : null}
    </group>
  )
}

function applyCameraView(
  camera: THREE.Camera,
  dims: SceneDimensions,
  viewState: ViewState,
) {
  const maxSize = Math.max(dims.cartonX, dims.cartonY, dims.cartonZ)
  const target = new THREE.Vector3(0, dims.cartonY * 0.42, 0)

  if (viewState.mode === 'top') {
    camera.position.set(0, maxSize * 2.2 * viewState.zoom, 0.001)
    camera.up.set(0, 0, -1)
  } else {
    camera.position.set(
      maxSize * 1.55 * viewState.zoom,
      maxSize * 1.18 * viewState.zoom,
      maxSize * 1.65 * viewState.zoom,
    )
    camera.up.set(0, 1, 0)
  }

  camera.lookAt(target)

  const projectionCamera = camera as {
    updateProjectionMatrix?: () => void
  }

  if (projectionCamera.updateProjectionMatrix) {
    projectionCamera.updateProjectionMatrix()
  }
}

function SceneController({
  dims,
  groupRef,
  invalidateRef,
  viewStateRef,
}: {
  dims: SceneDimensions
  groupRef: RefObject<THREE.Group | null>
  invalidateRef: MutableRefObject<InvalidateScene | null>
  viewStateRef: MutableRefObject<ViewState>
}) {
  const camera = useThree((state) => state.camera)
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => {
    invalidateRef.current = invalidate
    invalidate()

    return () => {
      if (invalidateRef.current === invalidate) {
        invalidateRef.current = null
      }
    }
  }, [invalidate, invalidateRef])

  useFrame(() => {
    const viewState = viewStateRef.current

    groupRef.current?.rotation.set(viewState.pitch, viewState.yaw, 0)
    applyCameraView(camera, dims, viewState)
  })

  return null
}

const PackingMeshes = memo(function PackingMeshes({
  dims,
  groupRef,
  recommendation,
}: {
  dims: SceneDimensions
  groupRef: RefObject<THREE.Group | null>
  recommendation: Recommendation
}) {
  const { boxes } = useMemo(
    () => buildPackingScene(recommendation),
    [recommendation],
  )
  const maxSize = Math.max(dims.cartonX, dims.cartonY, dims.cartonZ)

  return (
    <>
      <color attach="background" args={['#f7f8f4']} />
      <ambientLight intensity={1.15} />
      <directionalLight
        position={[maxSize * 1.8, maxSize * 1.7, maxSize * 1.4]}
        intensity={1.25}
      />
      <directionalLight
        position={[-maxSize * 1.2, maxSize * 0.8, -maxSize]}
        intensity={0.42}
      />
      <group
        ref={groupRef}
        rotation={[defaultViewState.pitch, defaultViewState.yaw, 0]}
      >
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
          <planeGeometry args={[dims.cartonX * 2.25, dims.cartonZ * 2.25]} />
          <meshStandardMaterial color="#ebe6dc" roughness={1} />
        </mesh>
        {boxes.map((box) => (
          <BoxBlock key={box.id} {...box} />
        ))}
      </group>
    </>
  )
})

function PackingScene3D({
  onGestureActiveChange,
  recommendation,
  viewSyncToken = 0,
}: {
  onGestureActiveChange?: (active: boolean) => void
  recommendation: Recommendation
  viewSyncToken?: number
}) {
  const dims = useMemo(
    () => getSceneDimensions(recommendation),
    [recommendation],
  )
  const [webGlAvailable, setWebGlAvailable] = useState(true)
  const maxSize = Math.max(dims.cartonX, dims.cartonY, dims.cartonZ)
  const groupRef = useRef<THREE.Group>(null)
  const invalidateSceneRef = useRef<InvalidateScene | null>(null)
  const viewStateRef = useRef<ViewState>({ ...defaultViewState })
  const gestureRef = useRef<GestureState>({
    pinchDistance: 0,
    pitch: defaultViewState.pitch,
    yaw: defaultViewState.yaw,
    zoom: defaultViewState.zoom,
  })
  const invalidateScene = useCallback(() => {
    invalidateSceneRef.current?.()
  }, [])

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return
    }

    const canvas = document.createElement('canvas')
    const context =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')

    setWebGlAvailable(Boolean(context))
  }, [])

  useEffect(() => {
    if (viewSyncToken === 0) {
      return
    }

    viewStateRef.current = {
      mode: 'top',
      pitch: 0,
      yaw: 0,
      zoom: 1,
    }
    invalidateScene()
  }, [invalidateScene, viewSyncToken])

  useEffect(() => {
    return () => onGestureActiveChange?.(false)
  }, [onGestureActiveChange])

  // PanResponder callbacks read this mutable gesture baseline after render.
  /* eslint-disable react-hooks/refs */
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onStartShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (event) => {
          const touches = event.nativeEvent.touches
          const viewState = viewStateRef.current

          onGestureActiveChange?.(true)
          gestureRef.current = {
            pinchDistance:
              touches.length >= 2
                ? Math.hypot(
                    touches[0].pageX - touches[1].pageX,
                    touches[0].pageY - touches[1].pageY,
                  )
                : 0,
            pitch: viewState.pitch,
            yaw: viewState.yaw,
            zoom: viewState.zoom,
          }
        },
        onPanResponderMove: (event, gestureState) => {
          const touches = event.nativeEvent.touches
          const viewState = viewStateRef.current

          if (touches.length >= 2) {
            const distance = Math.hypot(
              touches[0].pageX - touches[1].pageX,
              touches[0].pageY - touches[1].pageY,
            )
            const initialDistance = gestureRef.current.pinchDistance || distance
            const nextZoom =
              gestureRef.current.zoom * (initialDistance / distance)

            viewState.zoom = clamp(nextZoom, 0.68, 1.85)
            invalidateScene()
            return
          }

          viewState.mode = 'orbit'
          viewState.yaw = gestureRef.current.yaw + gestureState.dx * 0.008
          viewState.pitch = clamp(
            gestureRef.current.pitch + gestureState.dy * 0.006,
            -0.56,
            0.46,
          )
          invalidateScene()
        },
        onPanResponderRelease: () => {
          onGestureActiveChange?.(false)
        },
        onPanResponderTerminate: () => {
          onGestureActiveChange?.(false)
        },
      }),
    [invalidateScene, onGestureActiveChange],
  )
  /* eslint-enable react-hooks/refs */

  return webGlAvailable ? (
    <View style={styles.wrap} {...panResponder.panHandlers}>
      <Canvas
        camera={{
          fov: 32,
          near: 0.1,
          far: 1000,
          position: [maxSize * 1.55, maxSize * 1.18, maxSize * 1.65] as [
            number,
            number,
            number,
          ],
        }}
        dpr={[1, 1.5]}
        frameloop="demand"
        gl={{
          antialias: true,
          failIfMajorPerformanceCaveat: false,
          powerPreference: 'high-performance',
        }}
      >
        <SceneController
          dims={dims}
          groupRef={groupRef}
          invalidateRef={invalidateSceneRef}
          viewStateRef={viewStateRef}
        />
        <PackingMeshes
          dims={dims}
          groupRef={groupRef}
          recommendation={recommendation}
        />
      </Canvas>
    </View>
  ) : (
    <View style={[styles.wrap, styles.fallback]}>
      <Text style={styles.fallbackTitle}>3D preview needs WebGL</Text>
      <Text style={styles.fallbackText}>
        Enable hardware acceleration or open this app in Chrome, Safari, or Expo
        Go.
      </Text>
    </View>
  )
}

export default memo(
  PackingScene3D,
  (previous, next) =>
    previous.onGestureActiveChange === next.onGestureActiveChange &&
    previous.viewSyncToken === next.viewSyncToken &&
    hasSameSceneGeometry(previous.recommendation, next.recommendation),
)

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#eef2ee',
    borderColor: '#cbd8d0',
    borderRadius: 8,
    borderWidth: 1,
    height: 340,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  fallbackTitle: {
    color: '#17221d',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  fallbackText: {
    color: '#59645e',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
})
