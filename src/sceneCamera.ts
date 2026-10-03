import type { SceneDimensions } from '@/sceneModel'

export function getTopViewCameraHeight(
  dims: SceneDimensions,
  aspect: number,
  verticalFieldOfView: number,
): number {
  const halfFieldOfView = (verticalFieldOfView * Math.PI) / 360
  const visibleSpan = Math.max(dims.cartonX / aspect, dims.cartonZ)
  // Fit the top surface, which is closer to the camera than the scene center.
  return dims.cartonY + (visibleSpan / (2 * Math.tan(halfFieldOfView))) * 1.1
}
