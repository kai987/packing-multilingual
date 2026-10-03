import { describe, expect, it } from 'vitest'
import { cartons, cushions, defaultOrderLines, products } from '@/data'
import { recommendPacking } from '@/packing'
import {
  buildPackingScene,
  hasSameSceneGeometry,
  mmToSceneUnits,
} from '@/sceneModel'
import {
  getLocalizedCatalog,
  getLocalizedCatalogMaps,
  localizeRecommendation,
} from '@/localization'

describe('shared 3D geometry', () => {
  it('ignores translated labels but detects physical layout changes', () => {
    const plan = recommendPacking({
      products,
      cartons,
      cushions,
      orderLines: defaultOrderLines,
    })[0]
    const localized = localizeRecommendation(
      plan,
      'en',
      getLocalizedCatalogMaps(getLocalizedCatalog('en')),
    )
    expect(hasSameSceneGeometry(plan, localized)).toBe(true)
    expect(buildPackingScene(plan)).toEqual(buildPackingScene(localized))
    expect(
      hasSameSceneGeometry(plan, {
        ...plan,
        placements: plan.placements.map((p, index) =>
          index === 0 ? { ...p, x: p.x + 1 } : p,
        ),
      }),
    ).toBe(false)
  })
  it('renders the original item dimensions inside the calculated wrapping envelope', () => {
    const plan = recommendPacking({
      products,
      cartons,
      cushions,
      orderLines: defaultOrderLines.map((line) => ({
        ...line,
        useItemWrap: true,
      })),
    })[0]
    const { boxes } = buildPackingScene(plan)
    const productBoxes = boxes.filter((box) => box.roughness === 0.72)
    const wrappingBoxes = boxes.filter((box) => box.roughness === 0.92)
    expect(productBoxes).toHaveLength(plan.placements.length)
    expect(wrappingBoxes).toHaveLength(plan.placements.length)
    for (const [index, placement] of plan.placements.entries()) {
      expect(productBoxes[index].args).toEqual(
        [
          placement.productSize.length,
          placement.productSize.height,
          placement.productSize.width,
        ].map(mmToSceneUnits),
      )
      expect(wrappingBoxes[index].args).toEqual(
        [placement.length, placement.height, placement.width].map(
          mmToSceneUnits,
        ),
      )
      expect(productBoxes[index].position).toEqual(
        wrappingBoxes[index].position,
      )
    }
  })
  it('does not create wrapping meshes when individual wrapping is disabled', () => {
    const plan = recommendPacking({
      products,
      cartons,
      cushions,
      orderLines: defaultOrderLines,
    })[0]
    expect(
      buildPackingScene(plan).boxes.some((box) => box.roughness === 0.92),
    ).toBe(false)
  })
})
