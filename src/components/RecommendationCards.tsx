import { Pressable, Text, View } from 'react-native'
import {
  formatPercent,
  formatWeight,
  formatLength,
  formatVolumeLiters,
  type SplitPackingBox,
} from '@/packing'
import type { SupportedLocale } from '@/locale'
import { MetricRows, type MetricItem } from '@/components/ui'
import { styles } from '@/styles'

export function SelectableCard({
  badge,
  title,
  subtitle,
  metrics,
  isActive,
  onPress,
}: {
  badge: string
  title: string
  subtitle: string
  metrics: MetricItem[]
  isActive: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.selectableCard,
        isActive && styles.selectableCardActive,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.selectableHead}>
        <Text style={styles.cardBadge}>{badge}</Text>
        <Text style={styles.selectableTitle}>{title}</Text>
      </View>
      <Text style={styles.selectableSubtitle}>{subtitle}</Text>
      <MetricRows items={metrics} />
    </Pressable>
  )
}

export function SplitBoxSummary({
  box,
  locale,
  labels,
}: {
  box: SplitPackingBox
  locale: SupportedLocale
  labels: {
    boxTitle: (boxIndex: number) => string
    fillRate: string
    weight: string
    bottomFillHeight: string
    topEmptyHeight: string
    topVoidFillHeight: string
    unusedTopHeight: string
    unusedVolume: string
    itemQuantity: (quantity: number) => string
  }
}) {
  const metrics: MetricItem[] = [
    {
      label: labels.fillRate,
      value: formatPercent(box.recommendation.effectiveFillRate, locale),
    },
    {
      label: labels.weight,
      value: formatWeight(box.recommendation.totalWeight, locale),
    },
    {
      label: labels.bottomFillHeight,
      value: formatLength(box.recommendation.bottomFillHeight, locale),
    },
    {
      label: labels.topEmptyHeight,
      value: formatLength(box.recommendation.topEmptyHeight, locale),
    },
    {
      label: labels.topVoidFillHeight,
      value: formatLength(box.recommendation.topVoidFillHeight, locale),
    },
    {
      label: labels.unusedTopHeight,
      value: formatLength(box.recommendation.unusedTopHeight, locale),
    },
    {
      label: labels.unusedVolume,
      value: formatVolumeLiters(box.recommendation.unusedVolume, locale),
    },
  ]

  return (
    <View style={styles.splitBoxCard}>
      <View style={styles.splitBoxHeader}>
        <Text style={styles.splitBoxTitle}>
          {labels.boxTitle(box.boxIndex)}
        </Text>
        <Text style={styles.serviceText}>
          {box.recommendation.carton.service}
        </Text>
      </View>
      <Text style={styles.splitBoxName}>
        {box.recommendation.carton.code} / {box.recommendation.carton.label}
      </Text>
      <Text style={styles.metaText}>{box.recommendation.cushion.name}</Text>
      <MetricRows items={metrics} />
      <View style={styles.splitItemList}>
        {box.items.map((item) => (
          <View
            key={`${box.boxIndex}-${item.productId}`}
            style={styles.splitItem}
          >
            <View
              style={[styles.miniColorDot, { backgroundColor: item.color }]}
            />
            <Text numberOfLines={1} style={styles.splitItemName}>
              {item.brand} / {item.name}
            </Text>
            <Text style={styles.splitItemQty}>
              {labels.itemQuantity(item.quantity)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}
