import { lazy, Suspense } from 'react'
import { type SupportedLocale } from '@/locale'
import {
  formatLength,
  formatPercent,
  formatVolumeLiters,
  formatWeight,
  type SplitPackingBox,
} from '@/packing'
import {
  MetricsList,
  type MetricItem,
} from '@/components/common'

const PackingScene3D = lazy(() => import('@/PackingScene3D'))

type SplitBoxCardLabels = {
  boxTitle: (boxIndex: number) => string
  fillRate: string
  weight: string
  bottomFillHeight: string
  topEmptyHeight: string
  topVoidFillHeight: string
  unusedTopHeight: string
  unusedVolume: string
  boxThreeDTitle: (boxIndex: number) => string
  threeDHint: string
  loading: string
  itemQuantity: (quantity: number) => string
}

type SplitBoxCardProps = {
  box: SplitPackingBox
  locale: SupportedLocale
  labels: SplitBoxCardLabels
}

export function SplitBoxCard({
  box,
  locale,
  labels,
}: SplitBoxCardProps) {
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
    <article className="split-box-card">
      <div className="split-box-header">
        <strong>{labels.boxTitle(box.boxIndex)}</strong>
        <span>{box.recommendation.carton.service}</span>
      </div>
      <h3>
        {box.recommendation.carton.code} / {box.recommendation.carton.label}
      </h3>
      <p className="service-line">{box.recommendation.cushion.name}</p>
      <MetricsList items={metrics} />
      <article className="split-box-visual">
        <div className="layer-header">
          <strong>{labels.boxThreeDTitle(box.boxIndex)}</strong>
          <span>{labels.threeDHint}</span>
        </div>
        <Suspense fallback={<div className="split-box-loading">{labels.loading}</div>}>
          <PackingScene3D recommendation={box.recommendation} />
        </Suspense>
      </article>
      <ul className="split-item-list">
        {box.items.map((item) => (
          <li key={`${box.boxIndex}-${item.productId}`}>
            <span
              className="brand-chip"
              style={{ backgroundColor: item.color }}
            >
              {item.brand}
            </span>
            <strong>{item.name}</strong>
            <span>{labels.itemQuantity(item.quantity)}</span>
          </li>
        ))}
      </ul>
    </article>
  )
}
