import { formatCurrencyYen, type SupportedLocale } from '@/locale'
import {
  formatDimensions,
  formatWeight,
  type Product,
} from '@/packing'

type ProductCardLabels = {
  dimensions: string
  price: string
  weight: string
  note: string
  unsetPrice: string
}

type ProductCardProps = {
  product: Product
  quantity: number
  locale: SupportedLocale
  labels: ProductCardLabels
  onDecrease: () => void
  onIncrease: () => void
}

export function ProductCard({
  product,
  quantity,
  locale,
  labels,
  onDecrease,
  onIncrease,
}: ProductCardProps) {
  return (
    <article className="product-card">
      <div className="product-top">
        <span
          className="brand-chip"
          style={{ backgroundColor: product.color }}
        >
          {product.brand}
        </span>
        <strong>{product.name}</strong>
      </div>
      <p className="product-category">{product.category}</p>
      <dl className="meta-list">
        <div>
          <dt>{labels.dimensions}</dt>
          <dd>{formatDimensions(product.size, locale)}</dd>
        </div>
        <div>
          <dt>{labels.price}</dt>
          <dd>
            {product.priceYen !== undefined
              ? formatCurrencyYen(product.priceYen, locale)
              : labels.unsetPrice}
          </dd>
        </div>
        <div>
          <dt>{labels.weight}</dt>
          <dd>{formatWeight(product.weight, locale)}</dd>
        </div>
        <div>
          <dt>{labels.note}</dt>
          <dd>{product.note}</dd>
        </div>
      </dl>
      <div className="stepper">
        <button type="button" onClick={onDecrease}>
          -
        </button>
        <strong>{quantity}</strong>
        <button type="button" onClick={onIncrease}>
          +
        </button>
      </div>
    </article>
  )
}
