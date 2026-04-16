import { type SupportedLocale } from '@/locale'
import { formatWeight, type Product } from '@/packing'

type ProductCardLabels = {
  dimensions: string
  dimensionsUnit: string
  dimensionLength: string
  dimensionWidth: string
  dimensionHeight: string
  price: string
  priceUnit: string
  weight: string
  note: string
  unsetPrice: string
  itemWrapLabel: string
  itemWrapEnabled: string
  itemWrapDisabled: string
  itemWrapEnableAction: string
  itemWrapDisableAction: string
}

type ProductCardProps = {
  product: Product
  quantity: number
  useItemWrap: boolean
  locale: SupportedLocale
  labels: ProductCardLabels
  onDecrease: () => void
  onIncrease: () => void
  onQuantityChange: (value: string) => void
  onPriceChange: (value: string) => void
  onDimensionChange: (dimension: keyof Product['size'], value: string) => void
  onToggleItemWrap: () => void
}

export function ProductCard({
  product,
  quantity,
  useItemWrap,
  locale,
  labels,
  onDecrease,
  onIncrease,
  onQuantityChange,
  onPriceChange,
  onDimensionChange,
  onToggleItemWrap,
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
          <dt className="meta-label-row">
            <span>{labels.dimensions}</span>
            <span className="meta-unit">({labels.dimensionsUnit})</span>
          </dt>
          <dd className="product-input-grid">
            <label className="product-number-field">
              <span>{labels.dimensionLength}</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={3}
                aria-label={`${labels.dimensions} ${labels.dimensionLength}`}
                value={String(product.size.length)}
                onChange={(event) =>
                  onDimensionChange('length', event.currentTarget.value)
                }
              />
            </label>
            <label className="product-number-field">
              <span>{labels.dimensionWidth}</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={3}
                aria-label={`${labels.dimensions} ${labels.dimensionWidth}`}
                value={String(product.size.width)}
                onChange={(event) =>
                  onDimensionChange('width', event.currentTarget.value)
                }
              />
            </label>
            <label className="product-number-field">
              <span>{labels.dimensionHeight}</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={3}
                aria-label={`${labels.dimensions} ${labels.dimensionHeight}`}
                value={String(product.size.height)}
                onChange={(event) =>
                  onDimensionChange('height', event.currentTarget.value)
                }
              />
            </label>
          </dd>
        </div>
        <div>
          <dt className="meta-label-row">
            <span>{labels.price}</span>
            <span className="meta-unit">({labels.priceUnit})</span>
          </dt>
          <dd className="product-input-grid">
            <label className="product-number-field is-price">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                aria-label={labels.price}
                placeholder={labels.unsetPrice}
                value={product.priceYen !== undefined ? String(product.priceYen) : ''}
                onChange={(event) => onPriceChange(event.currentTarget.value)}
              />
            </label>
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
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={3}
          aria-label="Quantity"
          value={String(quantity)}
          onChange={(event) => onQuantityChange(event.currentTarget.value)}
        />
        <button type="button" onClick={onIncrease}>
          +
        </button>
      </div>
      <div className="product-wrap-control">
        <div className="product-wrap-status">
          <span>{labels.itemWrapLabel}</span>
          <strong className={useItemWrap ? 'is-enabled' : 'is-disabled'}>
            {useItemWrap ? labels.itemWrapEnabled : labels.itemWrapDisabled}
          </strong>
        </div>
        <button
          type="button"
          className={useItemWrap ? 'product-wrap-button is-active' : 'product-wrap-button'}
          onClick={onToggleItemWrap}
        >
          {useItemWrap
            ? labels.itemWrapDisableAction
            : labels.itemWrapEnableAction}
        </button>
      </div>
    </article>
  )
}
