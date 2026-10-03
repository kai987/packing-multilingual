import { useMemo } from 'react'
import { Text, View } from 'react-native'
import {
  buildVoidFillBlocks,
  formatDimensions,
  formatDisplayItemWrapKind,
  formatLength,
  getDisplayItemWrapKind,
  type PackedLayer,
  type Recommendation,
} from '@/packing'
import { getAppText } from '@/localization'
import type { SupportedLocale } from '@/locale'
import { styles } from '@/styles'

type PlanText = ReturnType<typeof getAppText>['plan']

function percent(value: number): `${number}%` {
  return `${Math.max(0, Math.min(100, value))}%` as `${number}%`
}

function groupPlacementsByLayer(placements: Recommendation['placements']) {
  const grouped = new Map<number, Recommendation['placements']>()

  for (const placement of placements) {
    const existing = grouped.get(placement.layerIndex)

    if (existing) {
      existing.push(placement)
    } else {
      grouped.set(placement.layerIndex, [placement])
    }
  }

  for (const layerPlacements of grouped.values()) {
    layerPlacements.sort((left, right) => {
      if (left.y !== right.y) {
        return left.y - right.y
      }

      return left.x - right.x
    })
  }

  return grouped
}

function LayerBoard({
  recommendation,
  layer,
  placements,
  locale,
  labels,
}: {
  recommendation: Recommendation
  layer: PackedLayer
  placements: Recommendation['placements']
  locale: SupportedLocale
  labels: PlanText
}) {
  const itemWrapKind = getDisplayItemWrapKind(recommendation.cushion)
  const voidBlocks = buildVoidFillBlocks(recommendation).filter(
    (block) => (block.layerIndex ?? -1) === layer.index,
  )

  return (
    <View style={styles.layerCard}>
      <View style={styles.layerHeader}>
        <Text style={styles.layerTitle}>
          {labels.layerTitle(layer.index + 1)}
        </Text>
        <Text style={styles.layerRange}>
          {labels.layerRange(
            formatLength(recommendation.bottomFillHeight + layer.z, locale),
            formatLength(
              recommendation.bottomFillHeight + layer.z + layer.height,
              locale,
            ),
            formatLength(layer.height, locale),
          )}
        </Text>
      </View>

      <View
        style={[
          styles.planBoard,
          {
            aspectRatio:
              recommendation.carton.inner.length /
              recommendation.carton.inner.width,
          },
        ]}
      >
        <View
          style={[
            styles.effectiveArea,
            {
              left: percent(
                (recommendation.cushion.sidePadding /
                  recommendation.carton.inner.length) *
                  100,
              ),
              top: percent(
                (recommendation.cushion.sidePadding /
                  recommendation.carton.inner.width) *
                  100,
              ),
              width: percent(
                (recommendation.effectiveInner.length /
                  recommendation.carton.inner.length) *
                  100,
              ),
              height: percent(
                (recommendation.effectiveInner.width /
                  recommendation.carton.inner.width) *
                  100,
              ),
            },
          ]}
        />
        {voidBlocks.map((block) => (
          <View
            key={block.id}
            style={[
              styles.voidBlock,
              {
                left: percent(
                  ((recommendation.cushion.sidePadding + block.x) /
                    recommendation.carton.inner.length) *
                    100,
                ),
                top: percent(
                  ((recommendation.cushion.sidePadding + block.y) /
                    recommendation.carton.inner.width) *
                    100,
                ),
                width: percent(
                  (block.length / recommendation.carton.inner.length) * 100,
                ),
                height: percent(
                  (block.width / recommendation.carton.inner.width) * 100,
                ),
              },
            ]}
          />
        ))}
        {placements.map((placement) => {
          const widthRate =
            placement.length / recommendation.carton.inner.length
          const heightRate = placement.width / recommendation.carton.inner.width
          const hasItemWrap = placement.useItemWrap
          const insetXPercent = hasItemWrap
            ? (1 - placement.productSize.length / placement.length) * 50
            : 0
          const insetYPercent = hasItemWrap
            ? (1 - placement.productSize.width / placement.width) * 50
            : 0
          const placementDimensions = formatDimensions(
            placement.productSize,
            locale,
          )
          const canShowDetails = widthRate * heightRate >= 0.08

          return (
            <View
              key={placement.instanceId}
              style={[
                styles.planItemShell,
                hasItemWrap && styles.planItemShellWrapped,
                {
                  backgroundColor: hasItemWrap ? '#f7d8a5' : placement.color,
                  left: percent(
                    ((recommendation.cushion.sidePadding + placement.x) /
                      recommendation.carton.inner.length) *
                      100,
                  ),
                  top: percent(
                    ((recommendation.cushion.sidePadding + placement.y) /
                      recommendation.carton.inner.width) *
                      100,
                  ),
                  width: percent(widthRate * 100),
                  height: percent(heightRate * 100),
                },
              ]}
            >
              <View
                style={[
                  styles.planItem,
                  {
                    backgroundColor: placement.color,
                    left: percent(insetXPercent),
                    right: percent(insetXPercent),
                    top: percent(insetYPercent),
                    bottom: percent(insetYPercent),
                  },
                ]}
              >
                <Text numberOfLines={1} style={styles.planItemBrand}>
                  {placement.brand}
                </Text>
                {canShowDetails ? (
                  <>
                    <Text numberOfLines={1} style={styles.planItemCategory}>
                      {placement.category}
                    </Text>
                    <Text numberOfLines={1} style={styles.planItemSize}>
                      {placementDimensions}
                    </Text>
                  </>
                ) : null}
              </View>
            </View>
          )
        })}
      </View>

      <View style={styles.planLegend}>
        <Text style={styles.legendText}>{labels.boardLegend.sidePadding}</Text>
        <Text style={styles.legendText}>
          {labels.boardLegend.itemWrap(
            formatDisplayItemWrapKind(itemWrapKind, locale),
          )}
        </Text>
        <Text style={styles.legendText}>
          {labels.boardLegend.padding(
            formatLength(recommendation.cushion.sidePadding, locale),
            formatLength(recommendation.cushion.topPadding, locale),
            formatLength(recommendation.bottomFillHeight, locale),
          )}
        </Text>
      </View>
    </View>
  )
}

export function PackingPlan({
  recommendation,
  locale,
  labels,
}: {
  recommendation: Recommendation
  locale: SupportedLocale
  labels: PlanText
}) {
  const placementsByLayer = useMemo(
    () => groupPlacementsByLayer(recommendation.placements),
    [recommendation.placements],
  )

  return (
    <View style={styles.layerStack}>
      {recommendation.layers.map((layer) => (
        <LayerBoard
          key={layer.index}
          recommendation={recommendation}
          layer={layer}
          placements={placementsByLayer.get(layer.index) ?? []}
          locale={locale}
          labels={labels}
        />
      ))}
    </View>
  )
}
