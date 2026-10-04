import type { PackedPlacement } from '@/packing'

export function getPlacementGeometry(
  placement: Pick<
    PackedPlacement,
    'length' | 'width' | 'height' | 'productSize'
  >,
) {
  return {
    product: placement.productSize,
    inset: {
      length: (placement.length - placement.productSize.length) / 2,
      width: (placement.width - placement.productSize.width) / 2,
      height: (placement.height - placement.productSize.height) / 2,
    },
  }
}
