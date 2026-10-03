import {
  LAYER_SEPARATOR_HEIGHT,
  buildVoidFillBlocks,
  getDisplayItemWrapKind,
  type Dimensions,
  type Recommendation,
} from '@/packing'

export function hasSameSceneGeometry(
  left: Recommendation,
  right: Recommendation,
): boolean {
  if (left === right) return true
  const sameSize = (a: Dimensions, b: Dimensions) =>
    a.length === b.length && a.width === b.width && a.height === b.height
  if (
    !sameSize(left.carton.inner, right.carton.inner) ||
    !sameSize(left.effectiveInner, right.effectiveInner) ||
    left.cushion.id !== right.cushion.id ||
    left.cushion.sidePadding !== right.cushion.sidePadding ||
    left.cushion.topPadding !== right.cushion.topPadding ||
    left.bottomFillHeight !== right.bottomFillHeight ||
    left.topVoidFillHeight !== right.topVoidFillHeight ||
    left.placements.length !== right.placements.length ||
    left.layers.length !== right.layers.length
  )
    return false

  return (
    left.placements.every((placement, index) => {
      const other = right.placements[index]
      return (
        sameSize(placement, other) &&
        sameSize(placement.productSize, other.productSize) &&
        placement.x === other.x &&
        placement.y === other.y &&
        placement.z === other.z &&
        placement.color === other.color &&
        placement.useItemWrap === other.useItemWrap &&
        placement.layerIndex === other.layerIndex &&
        placement.rowIndex === other.rowIndex
      )
    }) &&
    left.layers.every((layer, index) => {
      const other = right.layers[index]
      return (
        layer.index === other.index &&
        layer.z === other.z &&
        layer.height === other.height
      )
    })
  )
}

export type SceneBox = {
  id: string
  args: [number, number, number]
  color: string
  edgeColor?: string
  opacity?: number
  position?: readonly [number, number, number]
  roughness?: number
}

export type SceneDimensions = {
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

export function mmToSceneUnits(value: number): number {
  return value / 10
}

export function getSceneDimensions(
  recommendation: Recommendation,
): SceneDimensions {
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

export function buildPackingScene(recommendation: Recommendation) {
  const dims = getSceneDimensions(recommendation)
  const boxes: SceneBox[] = []
  const addBox = (box: Omit<SceneBox, 'id'>) => {
    if (box.args.every((size) => size > 0))
      boxes.push({ ...box, id: `box-${boxes.length}` })
  }
  const voidFillBlocks = buildVoidFillBlocks(recommendation)
  const itemWrapKind = getDisplayItemWrapKind(recommendation.cushion)
  const sideSpan = Math.max(dims.cartonZ - dims.sidePadding * 2, 0)
  const sideHeight = Math.max(
    dims.cartonY - dims.topPadding - dims.bottomPadding,
    0,
  )
  const topGuideY = dims.cartonY - dims.topPadding
  const frameThickness = 0.14
  addBox({
    args: [dims.cartonX, dims.cartonY, dims.cartonZ],
    color: '#ffffff',
    edgeColor: '#836652',
    opacity: 0.02,
    position: [0, dims.cartonY / 2, 0],
  })

  for (const position of [
    [
      -dims.cartonX / 2 + frameThickness / 2,
      dims.cartonY / 2,
      -dims.cartonZ / 2 + frameThickness / 2,
    ],
    [
      dims.cartonX / 2 - frameThickness / 2,
      dims.cartonY / 2,
      -dims.cartonZ / 2 + frameThickness / 2,
    ],
    [
      -dims.cartonX / 2 + frameThickness / 2,
      dims.cartonY / 2,
      dims.cartonZ / 2 - frameThickness / 2,
    ],
    [
      dims.cartonX / 2 - frameThickness / 2,
      dims.cartonY / 2,
      dims.cartonZ / 2 - frameThickness / 2,
    ],
  ] as Array<[number, number, number]>) {
    addBox({
      args: [frameThickness, dims.cartonY, frameThickness],
      color: '#e4d5c4',
      position: [...position],
      roughness: 0.95,
    })
  }

  for (const [x, y, z, sx, sy, sz] of [
    [
      0,
      frameThickness / 2,
      -dims.cartonZ / 2 + frameThickness / 2,
      dims.cartonX,
      frameThickness,
      frameThickness,
    ],
    [
      0,
      frameThickness / 2,
      dims.cartonZ / 2 - frameThickness / 2,
      dims.cartonX,
      frameThickness,
      frameThickness,
    ],
    [
      -dims.cartonX / 2 + frameThickness / 2,
      frameThickness / 2,
      0,
      frameThickness,
      frameThickness,
      dims.cartonZ,
    ],
    [
      dims.cartonX / 2 - frameThickness / 2,
      frameThickness / 2,
      0,
      frameThickness,
      frameThickness,
      dims.cartonZ,
    ],
    [
      0,
      dims.cartonY - frameThickness / 2,
      -dims.cartonZ / 2 + frameThickness / 2,
      dims.cartonX,
      frameThickness,
      frameThickness,
    ],
    [
      0,
      dims.cartonY - frameThickness / 2,
      dims.cartonZ / 2 - frameThickness / 2,
      dims.cartonX,
      frameThickness,
      frameThickness,
    ],
    [
      -dims.cartonX / 2 + frameThickness / 2,
      dims.cartonY - frameThickness / 2,
      0,
      frameThickness,
      frameThickness,
      dims.cartonZ,
    ],
    [
      dims.cartonX / 2 - frameThickness / 2,
      dims.cartonY - frameThickness / 2,
      0,
      frameThickness,
      frameThickness,
      dims.cartonZ,
    ],
  ] as Array<[number, number, number, number, number, number]>) {
    addBox({
      args: [sx, sy, sz],
      color: '#eadfd3',
      position: [x, y, z],
      roughness: 0.95,
    })
  }

  addBox({
    args: [dims.effectiveX, 0.03, dims.effectiveZ],
    color: '#8f7664',
    opacity: 0.24,
    position: [0, topGuideY, 0],
  })
  addBox({
    args: [dims.cartonX, dims.bottomPadding, dims.cartonZ],
    color: '#d5b18c',
    opacity: 0.48,
    position: [0, dims.bottomPadding / 2, 0],
  })

  if (sideHeight > 0 && dims.sidePadding > 0) {
    addBox({
      args: [dims.cartonX, sideHeight, dims.sidePadding],
      color: '#d9b28a',
      opacity: 0.38,
      position: [
        0,
        dims.bottomPadding + sideHeight / 2,
        -dims.cartonZ / 2 + dims.sidePadding / 2,
      ],
    })
    addBox({
      args: [dims.cartonX, sideHeight, dims.sidePadding],
      color: '#d9b28a',
      opacity: 0.38,
      position: [
        0,
        dims.bottomPadding + sideHeight / 2,
        dims.cartonZ / 2 - dims.sidePadding / 2,
      ],
    })

    if (sideSpan > 0) {
      addBox({
        args: [dims.sidePadding, sideHeight, sideSpan],
        color: '#c99d77',
        opacity: 0.34,
        position: [
          -dims.cartonX / 2 + dims.sidePadding / 2,
          dims.bottomPadding + sideHeight / 2,
          0,
        ],
      })
      addBox({
        args: [dims.sidePadding, sideHeight, sideSpan],
        color: '#c99d77',
        opacity: 0.34,
        position: [
          dims.cartonX / 2 - dims.sidePadding / 2,
          dims.bottomPadding + sideHeight / 2,
          0,
        ],
      })
    }
  }

  for (const placement of recommendation.placements) {
    const length = mmToSceneUnits(placement.length)
    const width = mmToSceneUnits(placement.width)
    const height = mmToSceneUnits(placement.height)
    const x = mmToSceneUnits(recommendation.cushion.sidePadding + placement.x)
    const y = mmToSceneUnits(recommendation.cushion.sidePadding + placement.y)
    const z = mmToSceneUnits(recommendation.bottomFillHeight + placement.z)
    const hasItemWrap = placement.useItemWrap
    const coreHeight = mmToSceneUnits(placement.productSize.height)
    const coreLength = mmToSceneUnits(placement.productSize.length)
    const coreWidth = mmToSceneUnits(placement.productSize.width)
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

    addBox({
      args: [coreLength, coreHeight, coreWidth],
      color: placement.color,
      edgeColor: '#fff7ef',
      position,
      roughness: 0.72,
    })

    if (hasItemWrap) {
      addBox({
        args: [length, height, width],
        color: itemWrapKind === 'paper-fill' ? '#ceb08b' : '#e5c39f',
        edgeColor: itemWrapKind === 'paper-fill' ? '#9f7a52' : '#c69063',
        opacity: itemWrapKind === 'paper-fill' ? 0.16 : 0.14,
        position,
        roughness: 0.92,
      })
    }
  }

  for (const layer of recommendation.layers.slice(0, -1)) {
    const separatorHeight = mmToSceneUnits(LAYER_SEPARATOR_HEIGHT)
    const separatorLength = dims.effectiveX
    const separatorWidth = dims.effectiveZ
    const x = dims.sidePadding
    const y = dims.sidePadding
    const z = mmToSceneUnits(
      recommendation.bottomFillHeight + layer.z + layer.height,
    )

    addBox({
      args: [separatorLength, separatorHeight, separatorWidth],
      color: '#e7d1ad',
      edgeColor: '#b89061',
      opacity: 0.24,
      position: getBlockPosition({
        cartonX: dims.cartonX,
        cartonZ: dims.cartonZ,
        x,
        y,
        z,
        length: separatorLength,
        width: separatorWidth,
        height: separatorHeight,
      }),
      roughness: 0.94,
    })
  }

  for (const block of voidFillBlocks) {
    const length = mmToSceneUnits(block.length)
    const width = mmToSceneUnits(block.width)
    const height = mmToSceneUnits(block.height)
    const x = mmToSceneUnits(recommendation.cushion.sidePadding + block.x)
    const y = mmToSceneUnits(recommendation.cushion.sidePadding + block.y)
    const z = mmToSceneUnits(recommendation.bottomFillHeight + block.z)

    addBox({
      args: [length, height, width],
      color: '#dfbc98',
      opacity: 0.14,
      position: getBlockPosition({
        cartonX: dims.cartonX,
        cartonZ: dims.cartonZ,
        x,
        y,
        z,
        length,
        width,
        height,
      }),
      roughness: 0.96,
    })
  }

  return { dims, boxes }
}
