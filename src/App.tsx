import type { CSSProperties } from 'react'
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import './App.css'
import {
  cartons as packingCartons,
  cushions as packingCushions,
  defaultOrderLines,
  products as packingProducts,
} from './data'
import {
  getAppText,
  getLocalizedCatalog,
  getLocalizedCatalogMaps,
  localizeRecommendation,
  localizeSplitRecommendation,
} from './localization'
import {
  formatCurrencyYen,
  getDocumentLang,
  localeNames,
  supportedLocales,
  type SupportedLocale,
} from './locale'
import {
  buildVoidFillBlocks,
  formatDisplayItemWrapKind,
  formatDimensions,
  formatLength,
  formatPackingStrategy,
  formatPercent,
  formatVolumeLiters,
  formatWeight,
  getDisplayItemWrapKind,
  getDisplayItemWrapPadding,
  recommendPacking,
  recommendSplitPacking,
  type PackingStrategy,
} from './packing'

const PackingScene3D = lazy(() => import('./PackingScene3D'))

function App() {
  const [locale, setLocale] = useState<SupportedLocale>('ja')
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false)
  const [orderLines, setOrderLines] = useState(defaultOrderLines)
  const [packingStrategy, setPackingStrategy] = useState<PackingStrategy>('compact')
  const [selectedRecommendationKey, setSelectedRecommendationKey] = useState<
    string | null
  >(null)
  const [selectedSplitKey, setSelectedSplitKey] = useState<string | null>(null)
  const [threeDViewRequest, setThreeDViewRequest] = useState({
    key: '',
    nonce: 0,
  })
  const languageMenuRef = useRef<HTMLDivElement | null>(null)
  const text = getAppText(locale)
  const localizedCatalog = useMemo(
    () => getLocalizedCatalog(locale),
    [locale],
  )
  const { products, cartons, cushions } = localizedCatalog
  const localizedCatalogMaps = useMemo(
    () => getLocalizedCatalogMaps(localizedCatalog),
    [localizedCatalog],
  )

  useEffect(() => {
    document.documentElement.lang = getDocumentLang(locale)
    document.title = text.documentTitle
  }, [locale, text.documentTitle])

  useEffect(() => {
    if (!isLanguageMenuOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) {
        setIsLanguageMenuOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsLanguageMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isLanguageMenuOpen])

  const quantities = useMemo(
    () => new Map(orderLines.map((line) => [line.productId, line.quantity] as const)),
    [orderLines],
  )

  const baseRecommendations = useMemo(
    () =>
      recommendPacking({
        products: packingProducts,
        cartons: packingCartons,
        cushions: packingCushions,
        orderLines,
        strategy: packingStrategy,
      }).slice(0, 3),
    [orderLines, packingStrategy],
  )
  const baseSplitRecommendations = useMemo(
    () =>
      recommendSplitPacking({
        products: packingProducts,
        cartons: packingCartons,
        cushions: packingCushions,
        orderLines,
        strategy: packingStrategy,
      }).slice(0, 3),
    [orderLines, packingStrategy],
  )
  const recommendations = useMemo(
    () =>
      baseRecommendations.map((recommendation) =>
        localizeRecommendation(recommendation, locale, localizedCatalogMaps),
      ),
    [baseRecommendations, locale, localizedCatalogMaps],
  )
  const splitRecommendations = useMemo(
    () =>
      baseSplitRecommendations.map((recommendation) =>
        localizeSplitRecommendation(recommendation, locale, localizedCatalogMaps),
      ),
    [baseSplitRecommendations, locale, localizedCatalogMaps],
  )

  const selectedRecommendation = useMemo(
    () =>
      recommendations.find(
        (recommendation) => recommendation.key === selectedRecommendationKey,
      ) ??
      recommendations[0] ??
      null,
    [recommendations, selectedRecommendationKey],
  )
  const selectedSplitRecommendation = useMemo(
    () =>
      splitRecommendations.find(
        (recommendation) => recommendation.key === selectedSplitKey,
      ) ??
      splitRecommendations[0] ??
      null,
    [selectedSplitKey, splitRecommendations],
  )
  const bestSingleRecommendation = recommendations[0] ?? null
  const bestSplitRecommendation = splitRecommendations[0] ?? null

  const totalUnits = useMemo(
    () => orderLines.reduce((sum, line) => sum + line.quantity, 0),
    [orderLines],
  )
  const activeSkuCount = useMemo(
    () => orderLines.filter((line) => line.quantity > 0).length,
    [orderLines],
  )
  const totalWeight = useMemo(
    () =>
      packingProducts.reduce((sum, product) => {
        return sum + product.weight * (quantities.get(product.id) ?? 0)
      }, 0),
    [quantities],
  )
  const voidFillBlocks = useMemo(
    () => (selectedRecommendation ? buildVoidFillBlocks(selectedRecommendation) : []),
    [selectedRecommendation],
  )
  const selectedItemWrapKind = selectedRecommendation
    ? getDisplayItemWrapKind(selectedRecommendation.cushion)
    : null
  const selectedItemWrapLabel =
    selectedItemWrapKind !== null
      ? formatDisplayItemWrapKind(selectedItemWrapKind, locale)
      : ''

  const updateQuantity = (productId: string, delta: number) => {
    setOrderLines((current) =>
      current.map((line) =>
        line.productId === productId
          ? { ...line, quantity: Math.max(0, line.quantity + delta) }
          : line,
      ),
    )
  }

  const resetSample = () => {
    setOrderLines(defaultOrderLines)
  }

  const clearOrder = () => {
    setOrderLines((current) =>
      current.map((line) => ({
        ...line,
        quantity: 0,
      })),
    )
  }

  const updateLocaleImmediately = (localeOption: SupportedLocale) => {
    if (localeOption === locale) {
      setIsLanguageMenuOpen(false)
      return
    }

    setLocale(localeOption)
    setIsLanguageMenuOpen(false)
  }

  const toggleLanguageMenuOnPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    event.preventDefault()
    setIsLanguageMenuOpen((current) => !current)
  }

  const selectLanguageOnPointerDown = (localeOption: SupportedLocale) => (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    event.preventDefault()
    updateLocaleImmediately(localeOption)
  }

  const handleLanguageMenuKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    setIsLanguageMenuOpen((current) => !current)
  }

  const handleLanguageOptionKeyDown = (localeOption: SupportedLocale) => (
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    updateLocaleImmediately(localeOption)
  }

  return (
    <main className="page-shell">
      <div
        className={isLanguageMenuOpen ? 'language-switch-wrap is-open' : 'language-switch-wrap'}
        ref={languageMenuRef}
      >
        <button
          type="button"
          className={isLanguageMenuOpen ? 'language-switch is-open' : 'language-switch'}
          onPointerDown={toggleLanguageMenuOnPointerDown}
          onKeyDown={handleLanguageMenuKeyDown}
          aria-label={text.languageMenuAria}
          aria-haspopup="menu"
          aria-expanded={isLanguageMenuOpen}
        >
          <span className="language-switch-copy">
            <strong>{localeNames[locale]}</strong>
            <small>{text.languageMenuLabel}</small>
          </span>
          <span className="language-switch-caret" aria-hidden="true">
            ▾
          </span>
        </button>

        <div
          className={isLanguageMenuOpen ? 'language-switch-menu is-open' : 'language-switch-menu'}
          role="menu"
          aria-label={text.languageMenuLabel}
          aria-hidden={!isLanguageMenuOpen}
        >
          {supportedLocales.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === locale}
              tabIndex={isLanguageMenuOpen ? 0 : -1}
              className={
                option === locale
                  ? 'language-switch-option is-active'
                  : 'language-switch-option'
              }
              onPointerDown={selectLanguageOnPointerDown(option)}
              onKeyDown={handleLanguageOptionKeyDown(option)}
            >
              <span>{localeNames[option]}</span>
            </button>
          ))}
        </div>
      </div>

      <section className="hero">
        <div className="hero-copy section-card">
          <h1 className="hero-tagline">{text.hero.tagline}</h1>
          <p className="eyebrow">{text.hero.eyebrow}</p>
          <p className="lead">{text.hero.lead}</p>
          <div className="hero-stats">
            <article>
              <span>{text.hero.stats.totalUnits}</span>
              <strong>{totalUnits}</strong>
            </article>
            <article>
              <span>{text.hero.stats.activeSkus}</span>
              <strong>{activeSkuCount}</strong>
            </article>
            <article>
              <span>{text.hero.stats.totalWeight}</span>
              <strong>{formatWeight(totalWeight, locale)}</strong>
            </article>
          </div>
        </div>

        <aside className="section-card summary-card">
          <p className="eyebrow">{text.summary.title}</p>
          <ul className="bullet-list summary-list">
            {text.summary.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </aside>
      </section>

      <section className="workspace">
        <section className="left-column">
          <section className="section-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">{text.order.eyebrow}</p>
                <h2>{text.order.title}</h2>
              </div>
              <div className="inline-actions">
                <button type="button" onClick={resetSample}>
                  {text.order.sampleButton}
                </button>
                <button type="button" onClick={clearOrder}>
                  {text.order.clearButton}
                </button>
              </div>
            </div>

            <div className="product-grid">
              {products.map((product) => {
                const quantity = quantities.get(product.id) ?? 0

                return (
                  <article className="product-card" key={product.id}>
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
                        <dt>{text.order.dimensions}</dt>
                        <dd>{formatDimensions(product.size, locale)}</dd>
                      </div>
                      <div>
                        <dt>{text.order.price}</dt>
                        <dd>
                          {product.priceYen
                            ? formatCurrencyYen(product.priceYen, locale)
                            : text.order.unsetPrice}
                        </dd>
                      </div>
                      <div>
                        <dt>{text.order.weight}</dt>
                        <dd>{formatWeight(product.weight, locale)}</dd>
                      </div>
                      <div>
                        <dt>{text.order.note}</dt>
                        <dd>{product.note}</dd>
                      </div>
                    </dl>
                    <div className="stepper">
                      <button
                        type="button"
                        onClick={() => updateQuantity(product.id, -1)}
                      >
                        -
                      </button>
                      <strong>{quantity}</strong>
                      <button
                        type="button"
                        onClick={() => updateQuantity(product.id, 1)}
                      >
                        +
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

        </section>

        <section className="right-column">
          <section className="section-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">{text.recommendations.eyebrow}</p>
                <h2>{text.recommendations.title}</h2>
              </div>
            </div>

            <div className="strategy-switch" aria-label={text.strategy.ariaLabel}>
              <button
                type="button"
                className={
                  packingStrategy === 'compact'
                    ? 'strategy-chip is-active'
                    : 'strategy-chip'
                }
                onClick={() => {
                  setPackingStrategy('compact')
                  setSelectedRecommendationKey(null)
                  setSelectedSplitKey(null)
                }}
              >
                {text.strategy.compact}
              </button>
              <button
                type="button"
                className={
                  packingStrategy === 'stable'
                    ? 'strategy-chip is-active'
                    : 'strategy-chip'
                }
                onClick={() => {
                  setPackingStrategy('stable')
                  setSelectedRecommendationKey(null)
                  setSelectedSplitKey(null)
                }}
              >
                {text.strategy.stable}
              </button>
            </div>
            <p className="strategy-note">
              {packingStrategy === 'compact'
                ? text.strategy.compactNote
                : text.strategy.stableNote}
            </p>

            {totalUnits === 0 ? (
              <div className="empty-state">
                <strong>{text.recommendations.emptyNoItemsTitle}</strong>
                <p>{text.recommendations.emptyNoItemsBody}</p>
              </div>
            ) : recommendations.length === 0 ? (
              <div className="empty-state">
                <strong>{text.recommendations.emptyNoFitTitle}</strong>
                <p>{text.recommendations.emptyNoFitBody}</p>
              </div>
            ) : (
              <div className="recommendation-grid">
                {recommendations.map((recommendation, index) => (
                  <button
                    key={recommendation.key}
                    type="button"
                    className={
                      selectedRecommendation?.key === recommendation.key
                        ? 'recommend-card is-active'
                        : 'recommend-card'
                    }
                    onClick={() => setSelectedRecommendationKey(recommendation.key)}
                  >
                    <div className="recommend-head">
                      <span>{text.recommendations.candidateLabel(index + 1)}</span>
                      <strong>{recommendation.carton.code}</strong>
                    </div>
                    <p>
                      {recommendation.carton.label} / {recommendation.carton.service}
                    </p>
                    <dl className="recommend-metrics">
                      <div>
                        <dt>{text.recommendations.metrics.cushion}</dt>
                        <dd>{recommendation.cushion.name}</dd>
                      </div>
                      <div>
                        <dt>{text.recommendations.metrics.score}</dt>
                        <dd>{recommendation.score}</dd>
                      </div>
                      <div>
                        <dt>{text.recommendations.metrics.fillRate}</dt>
                        <dd>{formatPercent(recommendation.effectiveFillRate, locale)}</dd>
                      </div>
                      <div>
                        <dt>{text.recommendations.metrics.stability}</dt>
                        <dd>{recommendation.stabilityScore} / 100</dd>
                      </div>
                    </dl>
                  </button>
                ))}
              </div>
            )}
          </section>

          {selectedRecommendation ? (
            <>
              <section className="section-card">
                <div className="section-header">
                  <div>
                    <p className="eyebrow">{text.selectedPlan.eyebrow}</p>
                    <h2>
                      {selectedRecommendation.carton.code} /{' '}
                      {selectedRecommendation.cushion.name}
                    </h2>
                    <p className="service-line">
                      {text.selectedPlan.serviceLabel}: {selectedRecommendation.carton.service}
                    </p>
                    <p className="service-line">
                      {text.selectedPlan.strategyLabel}:{' '}
                      {formatPackingStrategy(selectedRecommendation.strategy, locale)}
                    </p>
                  </div>
                </div>

                <div className="detail-grid">
                  <article>
                    <span>{text.selectedPlan.metrics.innerDimensions}</span>
                    <strong>
                      {formatDimensions(selectedRecommendation.carton.inner, locale)}
                    </strong>
                  </article>
                  <article>
                    <span>{text.selectedPlan.metrics.effectiveInner}</span>
                    <strong>
                      {formatDimensions(selectedRecommendation.effectiveInner, locale)}
                    </strong>
                  </article>
                  <article>
                    <span>{text.selectedPlan.metrics.totalWeight}</span>
                    <strong>{formatWeight(selectedRecommendation.totalWeight, locale)}</strong>
                  </article>
                  <article>
                    <span>{text.selectedPlan.metrics.emptyVolume}</span>
                    <strong>
                      {formatVolumeLiters(selectedRecommendation.emptyVolume, locale)}
                    </strong>
                  </article>
                  <article>
                    <span>{text.selectedPlan.metrics.recommendedVoidFill}</span>
                    <strong>
                      {formatVolumeLiters(
                        selectedRecommendation.recommendedVoidFillVolume,
                        locale,
                      )}
                    </strong>
                  </article>
                  <article>
                    <span>{text.selectedPlan.metrics.bottomFillHeight}</span>
                    <strong>{formatLength(selectedRecommendation.bottomFillHeight, locale)}</strong>
                  </article>
                  <article>
                    <span>{text.selectedPlan.metrics.itemWrapKind}</span>
                    <strong>
                      {formatDisplayItemWrapKind(
                        getDisplayItemWrapKind(selectedRecommendation.cushion),
                        locale,
                      )}
                    </strong>
                  </article>
                  <article>
                    <span>{text.selectedPlan.metrics.topEmptyHeight}</span>
                    <strong>{formatLength(selectedRecommendation.topEmptyHeight, locale)}</strong>
                  </article>
                  <article>
                    <span>{text.selectedPlan.metrics.topVoidFillHeight}</span>
                    <strong>
                      {formatLength(selectedRecommendation.topVoidFillHeight, locale)}
                    </strong>
                  </article>
                  <article>
                    <span>{text.selectedPlan.metrics.unusedTopHeight}</span>
                    <strong>{formatLength(selectedRecommendation.unusedTopHeight, locale)}</strong>
                  </article>
                  <article>
                    <span>{text.selectedPlan.metrics.unusedVolume}</span>
                    <strong>
                      {formatVolumeLiters(selectedRecommendation.unusedVolume, locale)}
                    </strong>
                  </article>
                </div>

                <ul className="bullet-list">
                  {selectedRecommendation.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </section>

            </>
          ) : null}

        </section>
      </section>

      <section className="analysis-panels">
        <section className="section-card compare-section-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">{text.comparison.eyebrow}</p>
              <h2>{text.comparison.title}</h2>
            </div>
          </div>

          {bestSingleRecommendation && bestSplitRecommendation ? (
            <>
              <div className="comparison-grid">
                <article className="comparison-card">
                  <span className="comparison-tag">{text.comparison.singleBest}</span>
                  <strong>
                    {bestSingleRecommendation.carton.code} /{' '}
                    {bestSingleRecommendation.carton.label}
                  </strong>
                  <p>{bestSingleRecommendation.cushion.name}</p>
                  <dl className="recommend-metrics">
                    <div>
                      <dt>{text.comparison.metrics.fillRate}</dt>
                      <dd>
                        {formatPercent(bestSingleRecommendation.effectiveFillRate, locale)}
                      </dd>
                    </div>
                    <div>
                      <dt>{text.comparison.metrics.emptyVolume}</dt>
                      <dd>{formatVolumeLiters(bestSingleRecommendation.emptyVolume, locale)}</dd>
                    </div>
                    <div>
                      <dt>{text.comparison.metrics.extraVoidFill}</dt>
                      <dd>
                        {formatVolumeLiters(
                          bestSingleRecommendation.recommendedVoidFillVolume,
                          locale,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>{text.comparison.metrics.unusedVolume}</dt>
                      <dd>{formatVolumeLiters(bestSingleRecommendation.unusedVolume, locale)}</dd>
                    </div>
                  </dl>
                </article>

                <article className="comparison-card is-highlight">
                  <span className="comparison-tag">
                    {text.comparison.splitBest(bestSplitRecommendation.boxCount)}
                  </span>
                  <strong>
                    {bestSplitRecommendation.boxes
                      .map(
                        (box) =>
                          `${box.recommendation.carton.code} ${box.recommendation.carton.label}`,
                      )
                      .join(' + ')}
                  </strong>
                  <p>{text.comparison.splitShipment(bestSplitRecommendation.boxes.length)}</p>
                  <dl className="recommend-metrics">
                    <div>
                      <dt>{text.comparison.metrics.totalFillRate}</dt>
                      <dd>{formatPercent(bestSplitRecommendation.effectiveFillRate, locale)}</dd>
                    </div>
                    <div>
                      <dt>{text.comparison.metrics.totalEmptyVolume}</dt>
                      <dd>
                        {formatVolumeLiters(bestSplitRecommendation.totalEmptyVolume, locale)}
                      </dd>
                    </div>
                    <div>
                      <dt>{text.comparison.metrics.extraVoidFill}</dt>
                      <dd>
                        {formatVolumeLiters(
                          bestSplitRecommendation.totalRecommendedVoidFillVolume,
                          locale,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>{text.comparison.metrics.unusedVolume}</dt>
                      <dd>
                        {formatVolumeLiters(bestSplitRecommendation.totalUnusedVolume, locale)}
                      </dd>
                    </div>
                  </dl>
                </article>
              </div>
              <p className="strategy-note compare-note">
                {text.comparison.note(
                  bestSplitRecommendation.boxCount,
                  formatPercent(bestSplitRecommendation.effectiveFillRate, locale),
                  formatPercent(
                    bestSplitRecommendation.effectiveFillRate -
                      bestSingleRecommendation.effectiveFillRate,
                    locale,
                  ),
                )}
              </p>
            </>
          ) : (
            <div className="empty-state">
              <strong>{text.comparison.emptyTitle}</strong>
              <p>{text.comparison.emptyBody}</p>
            </div>
          )}
        </section>

        {selectedRecommendation ? (
          <section className="section-card plan-section-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">{text.plan.eyebrow}</p>
                <h2>{text.plan.title}</h2>
              </div>
            </div>

            <article className="three-d-panel">
              <div className="layer-header three-d-panel-head">
                <div className="layer-header-copy">
                  <strong>{text.plan.threeDTitle}</strong>
                  <span>{text.plan.threeDHint}</span>
                </div>
                <button
                  type="button"
                  className="view-match-button"
                  onClick={() =>
                    setThreeDViewRequest((current) => ({
                      key: selectedRecommendation.key,
                      nonce: current.nonce + 1,
                    }))
                  }
                >
                  {text.plan.alignTopView}
                </button>
              </div>
              <Suspense
                fallback={
                  <div className="three-d-loading">{text.plan.loading}</div>
                }
              >
                <PackingScene3D
                  recommendation={selectedRecommendation}
                  viewSyncToken={
                    threeDViewRequest.key === selectedRecommendation.key
                      ? threeDViewRequest.nonce
                      : 0
                  }
                />
              </Suspense>

              <div className="three-d-legend">
                <span>{text.plan.legend.currentItemWrap(selectedItemWrapLabel)}</span>
                <span>{text.plan.legend.wrap}</span>
                <span>{text.plan.legend.paperFill}</span>
                <span>{text.plan.legend.recommendedVoidFill}</span>
                <span>{text.plan.legend.product}</span>
                <span>{text.plan.legend.unusedTop}</span>
                <span>{text.plan.legend.carton}</span>
              </div>
            </article>

            <div className="layer-stack">
              {selectedRecommendation.layers.map((layer) => {
                const placements = selectedRecommendation.placements
                  .filter((placement) => placement.layerIndex === layer.index)
                  .sort((left, right) => {
                    if (left.y !== right.y) {
                      return left.y - right.y
                    }

                    return left.x - right.x
                  })
                const layerVoidBlocks = voidFillBlocks.filter(
                  (block) => block.layerIndex === layer.index,
                )
                const itemWrapPadding = getDisplayItemWrapPadding(
                  selectedRecommendation.cushion,
                )
                const itemWrapKind = getDisplayItemWrapKind(
                  selectedRecommendation.cushion,
                )

                const boardStyle: CSSProperties = {
                  aspectRatio: `${selectedRecommendation.carton.inner.length} / ${selectedRecommendation.carton.inner.width}`,
                }

                const effectiveAreaStyle: CSSProperties = {
                  left: `${(selectedRecommendation.cushion.sidePadding / selectedRecommendation.carton.inner.length) * 100}%`,
                  top: `${(selectedRecommendation.cushion.sidePadding / selectedRecommendation.carton.inner.width) * 100}%`,
                  width: `${(selectedRecommendation.effectiveInner.length / selectedRecommendation.carton.inner.length) * 100}%`,
                  height: `${(selectedRecommendation.effectiveInner.width / selectedRecommendation.carton.inner.width) * 100}%`,
                }

                return (
                  <article className="layer-card" key={layer.index}>
                    <div className="layer-header">
                      <strong>{text.plan.layerTitle(layer.index + 1)}</strong>
                      <span>
                        {text.plan.layerRange(
                          formatLength(
                            selectedRecommendation.bottomFillHeight + layer.z,
                            locale,
                          ),
                          formatLength(
                            selectedRecommendation.bottomFillHeight +
                              layer.z +
                              layer.height,
                            locale,
                          ),
                          formatLength(layer.height, locale),
                        )}{' '}
                      </span>
                    </div>
                    <div className="plan-board" style={boardStyle}>
                      <div
                        className="plan-effective-area"
                        style={effectiveAreaStyle}
                        aria-hidden="true"
                      />
                      {layerVoidBlocks.map((block) => (
                        <div
                          key={block.id}
                          className="plan-void"
                          style={{
                            left: `${((selectedRecommendation.cushion.sidePadding + block.x) / selectedRecommendation.carton.inner.length) * 100}%`,
                            top: `${((selectedRecommendation.cushion.sidePadding + block.y) / selectedRecommendation.carton.inner.width) * 100}%`,
                            width: `${(block.length / selectedRecommendation.carton.inner.length) * 100}%`,
                            height: `${(block.width / selectedRecommendation.carton.inner.width) * 100}%`,
                          }}
                        />
                      ))}
                      {placements.map((placement) => {
                        const widthRate =
                          placement.length / selectedRecommendation.carton.inner.length
                        const heightRate =
                          placement.width / selectedRecommendation.carton.inner.width
                        const footprintRate = widthRate * heightRate
                        const compactClass =
                          footprintRate < 0.06 || widthRate < 0.24 || heightRate < 0.24
                            ? footprintRate < 0.03 ||
                              widthRate < 0.16 ||
                              heightRate < 0.16
                              ? ' is-tiny'
                              : ' is-compact'
                            : ''
                        const insetXPercent = Math.min(
                          (itemWrapPadding.side / placement.length) * 100,
                          18,
                        )
                        const insetYPercent = Math.min(
                          (itemWrapPadding.side / placement.width) * 100,
                          18,
                        )

                        return (
                          <div
                            key={placement.instanceId}
                            className={`plan-item-shell is-${itemWrapKind}${compactClass}`}
                            title={`${placement.name} / ${formatDimensions({
                              length: placement.length,
                              width: placement.width,
                              height: placement.height,
                            }, locale)}`}
                            style={{
                              backgroundColor: placement.color,
                              left: `${((selectedRecommendation.cushion.sidePadding + placement.x) / selectedRecommendation.carton.inner.length) * 100}%`,
                              top: `${((selectedRecommendation.cushion.sidePadding + placement.y) / selectedRecommendation.carton.inner.width) * 100}%`,
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
                              <small>
                                {formatDimensions({
                                  length: placement.length,
                                  width: placement.width,
                                  height: placement.height,
                                }, locale)}
                              </small>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="plan-legend">
                      <span>{text.plan.boardLegend.sidePadding}</span>
                      <span>
                        {text.plan.boardLegend.itemWrap(
                          formatDisplayItemWrapKind(itemWrapKind, locale),
                        )}
                      </span>
                      <span>{text.plan.boardLegend.wrap}</span>
                      <span>{text.plan.boardLegend.paperFill}</span>
                      <span>{text.plan.boardLegend.recommendedVoidFill}</span>
                      <span>
                        {text.plan.boardLegend.padding(
                          formatLength(selectedRecommendation.cushion.sidePadding, locale),
                          formatLength(selectedRecommendation.cushion.topPadding, locale),
                          formatLength(selectedRecommendation.bottomFillHeight, locale),
                        )}
                      </span>
                    </div>
                    <ul className="placement-list">
                      {placements.map((placement) => (
                        <li key={`${placement.instanceId}-list`}>
                          <strong>{placement.name}</strong>
                          <span>
                            {text.plan.placementPosition(
                              formatLength(placement.x, locale),
                              formatLength(placement.y, locale),
                              formatDimensions(
                                {
                                  length: placement.length,
                                  width: placement.width,
                                  height: placement.height,
                                },
                                locale,
                              ),
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </article>
                )
              })}
            </div>
          </section>
        ) : null}

        <section className="section-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">{text.split.eyebrow}</p>
              <h2>{text.split.title}</h2>
            </div>
          </div>

          {splitRecommendations.length === 0 ? (
            <div className="empty-state">
              <strong>{text.split.emptyTitle}</strong>
              <p>{text.split.emptyBody}</p>
            </div>
          ) : (
            <>
              <div className="split-recommendation-grid">
                {splitRecommendations.map((recommendation, index) => (
                  <button
                    key={recommendation.key}
                    type="button"
                    className={
                      selectedSplitRecommendation?.key === recommendation.key
                        ? 'recommend-card is-active'
                        : 'recommend-card'
                    }
                    onClick={() => setSelectedSplitKey(recommendation.key)}
                  >
                    <div className="recommend-head">
                      <span>
                        {text.split.optionLabel(recommendation.boxCount, index + 1)}
                      </span>
                      <strong>{formatPercent(recommendation.effectiveFillRate, locale)}</strong>
                    </div>
                    <p>
                      {recommendation.boxes
                        .map(
                          (box) =>
                            `${box.recommendation.carton.code} ${box.recommendation.carton.label}`,
                        )
                        .join(' + ')}
                    </p>
                    <dl className="recommend-metrics">
                      <div>
                        <dt>{text.split.metrics.totalEmptyVolume}</dt>
                        <dd>{formatVolumeLiters(recommendation.totalEmptyVolume, locale)}</dd>
                      </div>
                      <div>
                        <dt>{text.split.metrics.extraVoidFill}</dt>
                        <dd>
                          {formatVolumeLiters(
                            recommendation.totalRecommendedVoidFillVolume,
                            locale,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>{text.split.metrics.unusedVolume}</dt>
                        <dd>{formatVolumeLiters(recommendation.totalUnusedVolume, locale)}</dd>
                      </div>
                      <div>
                        <dt>{text.split.metrics.stability}</dt>
                        <dd>{recommendation.stabilityScore} / 100</dd>
                      </div>
                    </dl>
                  </button>
                ))}
              </div>

              {selectedSplitRecommendation ? (
                <>
                  <div className="split-box-grid">
                    {selectedSplitRecommendation.boxes.map((box) => (
                      <article className="split-box-card" key={box.boxIndex}>
                        <div className="split-box-header">
                          <strong>{text.split.boxTitle(box.boxIndex)}</strong>
                          <span>{box.recommendation.carton.service}</span>
                        </div>
                        <h3>
                          {box.recommendation.carton.code} /{' '}
                          {box.recommendation.carton.label}
                        </h3>
                        <p className="service-line">{box.recommendation.cushion.name}</p>
                        <dl className="recommend-metrics">
                          <div>
                            <dt>{text.split.fillRate}</dt>
                            <dd>{formatPercent(box.recommendation.effectiveFillRate, locale)}</dd>
                          </div>
                          <div>
                            <dt>{text.split.weight}</dt>
                            <dd>{formatWeight(box.recommendation.totalWeight, locale)}</dd>
                          </div>
                          <div>
                            <dt>{text.split.bottomFillHeight}</dt>
                            <dd>{formatLength(box.recommendation.bottomFillHeight, locale)}</dd>
                          </div>
                          <div>
                            <dt>{text.split.topEmptyHeight}</dt>
                            <dd>{formatLength(box.recommendation.topEmptyHeight, locale)}</dd>
                          </div>
                          <div>
                            <dt>{text.split.topVoidFillHeight}</dt>
                            <dd>{formatLength(box.recommendation.topVoidFillHeight, locale)}</dd>
                          </div>
                          <div>
                            <dt>{text.split.unusedTopHeight}</dt>
                            <dd>{formatLength(box.recommendation.unusedTopHeight, locale)}</dd>
                          </div>
                          <div>
                            <dt>{text.split.unusedVolume}</dt>
                            <dd>{formatVolumeLiters(box.recommendation.unusedVolume, locale)}</dd>
                          </div>
                        </dl>
                        <article className="split-box-visual">
                          <div className="layer-header">
                            <strong>{text.split.boxThreeDTitle(box.boxIndex)}</strong>
                            <span>{text.plan.threeDHint}</span>
                          </div>
                          <Suspense
                            fallback={
                              <div className="split-box-loading">{text.plan.loading}</div>
                            }
                          >
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
                              <span>{text.split.itemQuantity(item.quantity)}</span>
                            </li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                  <ul className="bullet-list">
                    {selectedSplitRecommendation.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          )}
        </section>

        <section className="section-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">{text.catalog.eyebrow}</p>
              <h2>{text.catalog.title}</h2>
            </div>
          </div>

          <div className="catalog-grid">
            <div className="catalog-panel">
              <h3>{text.catalog.cartonTitle}</h3>
              <ul className="catalog-list">
                {cartons.map((carton) => (
                  <li key={carton.id}>
                    <strong>
                      {carton.code} / {carton.label}
                    </strong>
                    <span>{text.catalog.service}: {carton.service}</span>
                    {carton.outer ? (
                      <span>
                        {text.catalog.outerDimensions}: {formatDimensions(carton.outer, locale)}
                      </span>
                    ) : null}
                    <span>
                      {text.catalog.innerDimensions}:{' '}
                      {formatDimensions(carton.inner, locale)}
                    </span>
                    <span>
                      {text.catalog.maxWeight}:{' '}
                      {carton.maxWeight === null
                        ? text.catalog.noWeightLimit
                        : formatWeight(carton.maxWeight, locale)}
                    </span>
                    {carton.priceYen ? (
                      <span>
                        {text.catalog.materialPrice}: {formatCurrencyYen(carton.priceYen, locale)}
                      </span>
                    ) : null}
                    <p>{carton.note}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="catalog-panel">
              <h3>{text.catalog.cushionTitle}</h3>
              <ul className="catalog-list">
                {cushions.map((cushion) => (
                  <li key={cushion.id}>
                    <strong>{cushion.name}</strong>
                    <span>
                      {text.catalog.cushionRule(
                        formatLength(cushion.sidePadding, locale),
                        formatLength(cushion.topPadding, locale),
                        formatLength(cushion.bottomPadding, locale),
                      )}
                    </span>
                    <span>{text.catalog.stabilityBonus}: +{cushion.stabilityBonus}</span>
                    <p>{cushion.note}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </section>

      <section className="post-workspace">
        <section className="section-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">{text.nextData.eyebrow}</p>
              <h2>{text.nextData.title}</h2>
            </div>
          </div>
          <ul className="bullet-list">
            {text.nextData.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </section>
    </main>
  )
}

export default App
