import type { ReactNode } from 'react'

export type MetricItem = {
  label: string
  value: ReactNode
}

type SectionHeadingProps = {
  eyebrow: string
  title: ReactNode
  details?: ReactNode
  actions?: ReactNode
}

export function SectionHeading({
  eyebrow,
  title,
  details,
  actions,
}: SectionHeadingProps) {
  return (
    <div className="section-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {details}
      </div>
      {actions}
    </div>
  )
}

type EmptyStateProps = {
  title: string
  body: ReactNode
}

export function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  )
}

type MetricsListProps = {
  items: MetricItem[]
  className?: string
}

export function MetricsList({
  items,
  className = 'recommend-metrics',
}: MetricsListProps) {
  return (
    <dl className={className}>
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

type DetailMetricGridProps = {
  items: MetricItem[]
}

export function DetailMetricGrid({ items }: DetailMetricGridProps) {
  return (
    <div className="detail-grid">
      {items.map((item, index) => (
        <article key={`${item.label}-${index}`}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </article>
      ))}
    </div>
  )
}
