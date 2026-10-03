import { describe, expect, it } from 'vitest'
import { getTopViewCameraHeight } from '@/sceneCamera'
import type { SceneDimensions } from '@/sceneModel'

const dims: SceneDimensions = {
  cartonX: 35,
  cartonY: 35,
  cartonZ: 35,
  effectiveX: 34,
  effectiveY: 33,
  effectiveZ: 34,
  sidePadding: 0.5,
  topPadding: 0.8,
  bottomPadding: 1.2,
}

describe('top-view camera framing', () => {
  it.each([1280 / 340, 289 / 340])(
    'fits the entire carton top at aspect ratio %s',
    (aspect) => {
      const height = getTopViewCameraHeight(dims, aspect, 32)
      const visibleHeight =
        (height - dims.cartonY) * 2 * Math.tan((32 * Math.PI) / 360)
      expect(visibleHeight).toBeGreaterThan(dims.cartonZ)
      expect(visibleHeight * aspect).toBeGreaterThan(dims.cartonX)
    },
  )
})
