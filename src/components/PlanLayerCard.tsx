import type { CSSProperties } from 'react'
import { type SupportedLocale } from '@/locale'
import {
  formatDimensions,
  formatDisplayItemWrapKind,
  formatLength,
  type DisplayItemWrapKind,
  type PackedLayer,
  type Recommendation,
  type VoidFillBlock,
} from '@/packing'
import type { getAppText } from '@/localization'
import { getPlacementGeometry } from '@/placementGeometry'

type PlanText = ReturnType<typeof getAppText>['plan']

type PlanLayerCardProps = {
  recommendation: Recommendation
  layer: PackedLayer
  placements: Recommendation['placements']
  voidBlocks: VoidFillBlock[]
  locale: SupportedLocale
  labels: PlanText
  itemWrapKind: DisplayItemWrapKind
}

function getCompactClass(widthRate: number, heightRate: number) {
  const footprintRate = widthRate * heightRate

  if (footprintRate >= 0.06 && widthRate >= 0.24 && heightRate >= 0.24) {
    return ''
  }

  return footprintRate < 0.03 || widthRate < 0.16 || heightRate < 0.16
    ? ' is-tiny'
    : ' is-compact'
}

export function PlanLayerCard({
  recommendation,
  layer,
  placements,
  voidBlocks,
  locale,
  labels,
  itemWrapKind,
}: PlanLayerCardProps) {
  const boardStyle: CSSProperties = {
    aspectRatio: `${recommendation.carton.inner.length} / ${recommendation.carton.inner.width}`,
  }

  const effectiveAreaStyle: CSSProperties = {
    left: `${(recommendation.cushion.sidePadding / recommendation.carton.inner.length) * 100}%`,
    top: `${(recommendation.cushion.sidePadding / recommendation.carton.inner.width) * 100}%`,
    width: `${(recommendation.effectiveInner.length / recommendation.carton.inner.length) * 100}%`,
    height: `${(recommendation.effectiveInner.width / recommendation.carton.inner.width) * 100}%`,
  }

  return (
    <article className="layer-card">
      <div className="layer-header">
        <strong>{labels.layerTitle(layer.index + 1)}</strong>
        <span>
          {labels.layerRange(
            formatLength(recommendation.bottomFillHeight + layer.z, locale),
            formatLength(
              recommendation.bottomFillHeight + layer.z + layer.height,
              locale,
            ),
            formatLength(layer.height, locale),
          )}
        </span>
      </div>
      <div className="plan-board" style={boardStyle}>
        <div
          className="plan-effective-area"
          style={effectiveAreaStyle}
          aria-hidden="true"
        />
        {voidBlocks.map((block) => (
          <div
            key={block.id}
            className="plan-void"
            style={{
              left: `${((recommendation.cushion.sidePadding + block.x) / recommendation.carton.inner.length) * 100}%`,
              top: `${((recommendation.cushion.sidePadding + block.y) / recommendation.carton.inner.width) * 100}%`,
              width: `${(block.length / recommendation.carton.inner.length) * 100}%`,
              height: `${(block.width / recommendation.carton.inner.width) * 100}%`,
            }}
          />
        ))}
        {placements.map((placement) => {
          const widthRate = placement.length / recommendation.carton.inner.length
          const heightRate = placement.width / recommendation.carton.inner.width
          const compactClass = getCompactClass(widthRate, heightRate)
          const hasItemWrap = placement.useItemWrap
          const { product, inset } = getPlacementGeometry(placement)
          const insetXPercent = (inset.length / placement.length) * 100
          const insetYPercent = (inset.width / placement.width) * 100
          const placementDimensions = formatDimensions(product, locale)

          return (
            <div
              key={placement.instanceId}
              data-testid={`placement-${placement.instanceId}`}
              data-product-size={`${product.length},${product.width},${product.height}`}
              data-package-size={`${placement.length},${placement.width},${placement.height}`}
              className={`plan-item-shell ${hasItemWrap ? `is-${itemWrapKind}` : 'is-no-wrap'}${compactClass}`}
              title={`${placement.name} / ${placementDimensions}`}
              style={{
                backgroundColor: placement.color,
                left: `${((recommendation.cushion.sidePadding + placement.x) / recommendation.carton.inner.length) * 100}%`,
                top: `${((recommendation.cushion.sidePadding + placement.y) / recommendation.carton.inner.width) * 100}%`,
                width: `${widthRate * 100}%`,
                height: `${heightRate * 100}%`,
              }}
            >
              <div
                className="plan-item"
                style={{
                  backgroundColor: placement.color,
                  left: `${insetXPercent}%`,
                  right: `${insetXPercent}%`,
                  top: `${insetYPercent}%`,
                  bottom: `${insetYPercent}%`,
                }}
              >
                <span>{placement.brand}</span>
                <strong>{placement.category}</strong>
                <small>{placementDimensions}</small>
              </div>
            </div>
          )
        })}
      </div>
      <div className="plan-legend">
        <span>{labels.boardLegend.sidePadding}</span>
        <span>
          {labels.boardLegend.itemWrap(
            formatDisplayItemWrapKind(itemWrapKind, locale),
          )}
        </span>
        <span>{labels.boardLegend.wrap}</span>
        <span>{labels.boardLegend.paperFill}</span>
        <span>{labels.boardLegend.recommendedVoidFill}</span>
        <span>
          {labels.boardLegend.padding(
            formatLength(recommendation.cushion.sidePadding, locale),
            formatLength(recommendation.cushion.topPadding, locale),
            formatLength(recommendation.bottomFillHeight, locale),
          )}
        </span>
      </div>
      <ul className="placement-list">
        {placements.map((placement) => (
          <li key={`${placement.instanceId}-list`}>
            <strong>{placement.name}</strong>
            <span>
              {labels.placementPosition(
                formatLength(placement.x, locale),
                formatLength(placement.y, locale),
                formatDimensions(
                  placement.productSize,
                  locale,
                ),
              )}
            </span>
          </li>
        ))}
      </ul>
    </article>
  )
}
