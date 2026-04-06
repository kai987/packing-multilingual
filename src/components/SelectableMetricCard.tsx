import type { ReactNode } from 'react'
import {
  MetricsList,
  type MetricItem,
} from '@/components/common'

type SelectableMetricCardProps = {
  badge: ReactNode
  title: ReactNode
  subtitle: ReactNode
  metrics: MetricItem[]
  isActive: boolean
  onClick: () => void
}

export function SelectableMetricCard({
  badge,
  title,
  subtitle,
  metrics,
  isActive,
  onClick,
}: SelectableMetricCardProps) {
  return (
    <button
      type="button"
      className={isActive ? 'recommend-card is-active' : 'recommend-card'}
      onClick={onClick}
    >
      <div className="recommend-head">
        <span>{badge}</span>
        <strong>{title}</strong>
      </div>
      <p>{subtitle}</p>
      <MetricsList items={metrics} />
    </button>
  )
}
