import { lazy, Suspense, useMemo, useState } from 'react'
import { type SupportedLocale } from '@/locale'
import {
  buildVoidFillBlocks,
  formatDisplayItemWrapKind,
  getDisplayItemWrapKind,
  type Recommendation,
} from '@/packing'
import type { getAppText } from '@/localization'
import { PlanLayerCard } from '@/components/PlanLayerCard'

const PackingScene3D = lazy(() => import('@/PackingScene3D'))

type PlanText = ReturnType<typeof getAppText>['plan']

type SelectedPlanSectionProps = {
  recommendation: Recommendation
  locale: SupportedLocale
  labels: PlanText
  disabledWrapLabel: string
}

export function SelectedPlanSection({
  recommendation,
  locale,
  labels,
  disabledWrapLabel,
}: SelectedPlanSectionProps) {
  const [viewSyncToken, setViewSyncToken] = useState(0)

  const itemWrapKind = useMemo(
    () => getDisplayItemWrapKind(recommendation.cushion),
    [recommendation.cushion],
  )
  const selectedItemWrapLabel = useMemo(
    () =>
      recommendation.placements.some((placement) => placement.useItemWrap)
        ? formatDisplayItemWrapKind(itemWrapKind, locale)
        : disabledWrapLabel,
    [disabledWrapLabel, itemWrapKind, locale, recommendation.placements],
  )
  const voidFillBlocks = useMemo(
    () => buildVoidFillBlocks(recommendation),
    [recommendation],
  )
  const placementsByLayer = useMemo(() => {
    const grouped = new Map<number, Recommendation['placements']>()

    for (const placement of recommendation.placements) {
      const existing = grouped.get(placement.layerIndex)

      if (existing) {
        existing.push(placement)
        continue
      }

      grouped.set(placement.layerIndex, [placement])
    }

    for (const placements of grouped.values()) {
      placements.sort((left, right) => {
        if (left.y !== right.y) {
          return left.y - right.y
        }

        return left.x - right.x
      })
    }

    return grouped
  }, [recommendation.placements])
  const voidBlocksByLayer = useMemo(() => {
    const grouped = new Map<number, typeof voidFillBlocks>()

    for (const block of voidFillBlocks) {
      const key = block.layerIndex ?? -1
      const existing = grouped.get(key)

      if (existing) {
        existing.push(block)
        continue
      }

      grouped.set(key, [block])
    }

    return grouped
  }, [voidFillBlocks])

  return (
    <>
      <article className="three-d-panel">
        <div className="layer-header three-d-panel-head">
          <div className="layer-header-copy">
            <strong>{labels.threeDTitle}</strong>
            <span>{labels.threeDHint}</span>
          </div>
          <button
            type="button"
            className="view-match-button"
            onClick={() => setViewSyncToken((current) => current + 1)}
          >
            {labels.alignTopView}
          </button>
        </div>
        <Suspense fallback={<div className="three-d-loading">{labels.loading}</div>}>
          <PackingScene3D
            recommendation={recommendation}
            viewSyncToken={viewSyncToken}
          />
        </Suspense>

        <div className="three-d-legend">
          <span>{labels.legend.currentItemWrap(selectedItemWrapLabel)}</span>
          <span>{labels.legend.wrap}</span>
          <span>{labels.legend.paperFill}</span>
          <span>{labels.legend.recommendedVoidFill}</span>
          <span>{labels.legend.product}</span>
          <span>{labels.legend.unusedTop}</span>
          <span>{labels.legend.carton}</span>
        </div>
      </article>

      <div className="layer-stack">
        {recommendation.layers.map((layer) => (
          <PlanLayerCard
            key={layer.index}
            recommendation={recommendation}
            layer={layer}
            placements={placementsByLayer.get(layer.index) ?? []}
            voidBlocks={voidBlocksByLayer.get(layer.index) ?? []}
            locale={locale}
            labels={labels}
            itemWrapKind={itemWrapKind}
          />
        ))}
      </div>
    </>
  )
}
