import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import './App.css'
import {
  DetailMetricGrid,
  EmptyState,
  MetricsList,
  SectionHeading,
  type MetricItem,
} from './components/common'
import { ProductCard } from './components/ProductCard'
import { SelectedPlanSection } from './components/SelectedPlanSection'
import { SelectableMetricCard } from './components/SelectableMetricCard'
import { SplitBoxCard } from './components/SplitBoxCard'
import {
  FloatingRepoLink,
  LanguageSwitcher,
} from './components/TopControls'
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
  type SupportedLocale,
} from './locale'
import {
  formatDimensions,
  formatDisplayItemWrapKind,
  formatLength,
  formatPackingStrategy,
  formatPercent,
  formatVolumeLiters,
  formatWeight,
  getDisplayItemWrapKind,
  recommendPacking,
  recommendSplitPacking,
  type PackingStrategy,
} from './packing'
const repositoryUrl = 'https://github.com/kai987/packing-multilingual'
const repositoryAriaLabels: Record<SupportedLocale, string> = {
  ja: 'GitHub リポジトリを開く',
  zh: '打开 GitHub 仓库',
  en: 'Open the GitHub repository',
}

function getSelectedItem<T extends { key: string }>(
  items: T[],
  selectedKey: string | null,
) {
  return items.find((item) => item.key === selectedKey) ?? items[0] ?? null
}

function formatCartonSummary(
  boxes: Array<{
    recommendation: {
      carton: {
        code: string
        label: string
      }
    }
  }>,
) {
  return boxes
    .map((box) => `${box.recommendation.carton.code} ${box.recommendation.carton.label}`)
    .join(' + ')
}

function App() {
  const [locale, setLocale] = useState<SupportedLocale>('ja')
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false)
  const [orderLines, setOrderLines] = useState(defaultOrderLines)
  const [packingStrategy, setPackingStrategy] = useState<PackingStrategy>('compact')
  const [selectedRecommendationKey, setSelectedRecommendationKey] = useState<
    string | null
  >(null)
  const [selectedSplitKey, setSelectedSplitKey] = useState<string | null>(null)
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
    () => getSelectedItem(recommendations, selectedRecommendationKey),
    [recommendations, selectedRecommendationKey],
  )
  const selectedSplitRecommendation = useMemo(
    () => getSelectedItem(splitRecommendations, selectedSplitKey),
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
  const selectedItemWrapLabel = selectedRecommendation
    ? formatDisplayItemWrapKind(
        getDisplayItemWrapKind(selectedRecommendation.cushion),
        locale,
      )
    : ''
  const productCardLabels = {
    dimensions: text.order.dimensions,
    price: text.order.price,
    weight: text.order.weight,
    note: text.order.note,
    unsetPrice: text.order.unsetPrice,
  }
  const selectedPlanMetricItems: MetricItem[] = selectedRecommendation
    ? [
        {
          label: text.selectedPlan.metrics.innerDimensions,
          value: formatDimensions(selectedRecommendation.carton.inner, locale),
        },
        {
          label: text.selectedPlan.metrics.effectiveInner,
          value: formatDimensions(selectedRecommendation.effectiveInner, locale),
        },
        {
          label: text.selectedPlan.metrics.totalWeight,
          value: formatWeight(selectedRecommendation.totalWeight, locale),
        },
        {
          label: text.selectedPlan.metrics.emptyVolume,
          value: formatVolumeLiters(selectedRecommendation.emptyVolume, locale),
        },
        {
          label: text.selectedPlan.metrics.recommendedVoidFill,
          value: formatVolumeLiters(
            selectedRecommendation.recommendedVoidFillVolume,
            locale,
          ),
        },
        {
          label: text.selectedPlan.metrics.bottomFillHeight,
          value: formatLength(selectedRecommendation.bottomFillHeight, locale),
        },
        {
          label: text.selectedPlan.metrics.itemWrapKind,
          value: selectedItemWrapLabel,
        },
        {
          label: text.selectedPlan.metrics.topEmptyHeight,
          value: formatLength(selectedRecommendation.topEmptyHeight, locale),
        },
        {
          label: text.selectedPlan.metrics.topVoidFillHeight,
          value: formatLength(selectedRecommendation.topVoidFillHeight, locale),
        },
        {
          label: text.selectedPlan.metrics.unusedTopHeight,
          value: formatLength(selectedRecommendation.unusedTopHeight, locale),
        },
        {
          label: text.selectedPlan.metrics.unusedVolume,
          value: formatVolumeLiters(selectedRecommendation.unusedVolume, locale),
        },
      ]
    : []
  const singleComparisonMetrics: MetricItem[] = bestSingleRecommendation
    ? [
        {
          label: text.comparison.metrics.fillRate,
          value: formatPercent(bestSingleRecommendation.effectiveFillRate, locale),
        },
        {
          label: text.comparison.metrics.emptyVolume,
          value: formatVolumeLiters(bestSingleRecommendation.emptyVolume, locale),
        },
        {
          label: text.comparison.metrics.extraVoidFill,
          value: formatVolumeLiters(
            bestSingleRecommendation.recommendedVoidFillVolume,
            locale,
          ),
        },
        {
          label: text.comparison.metrics.unusedVolume,
          value: formatVolumeLiters(bestSingleRecommendation.unusedVolume, locale),
        },
      ]
    : []
  const splitComparisonMetrics: MetricItem[] = bestSplitRecommendation
    ? [
        {
          label: text.comparison.metrics.totalFillRate,
          value: formatPercent(bestSplitRecommendation.effectiveFillRate, locale),
        },
        {
          label: text.comparison.metrics.totalEmptyVolume,
          value: formatVolumeLiters(bestSplitRecommendation.totalEmptyVolume, locale),
        },
        {
          label: text.comparison.metrics.extraVoidFill,
          value: formatVolumeLiters(
            bestSplitRecommendation.totalRecommendedVoidFillVolume,
            locale,
          ),
        },
        {
          label: text.comparison.metrics.unusedVolume,
          value: formatVolumeLiters(bestSplitRecommendation.totalUnusedVolume, locale),
        },
      ]
    : []
  const splitBoxLabels = {
    boxTitle: text.split.boxTitle,
    fillRate: text.split.fillRate,
    weight: text.split.weight,
    bottomFillHeight: text.split.bottomFillHeight,
    topEmptyHeight: text.split.topEmptyHeight,
    topVoidFillHeight: text.split.topVoidFillHeight,
    unusedTopHeight: text.split.unusedTopHeight,
    unusedVolume: text.split.unusedVolume,
    boxThreeDTitle: text.split.boxThreeDTitle,
    threeDHint: text.plan.threeDHint,
    loading: text.plan.loading,
    itemQuantity: text.split.itemQuantity,
  }

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
  const changePackingStrategy = (strategy: PackingStrategy) => {
    setPackingStrategy(strategy)
    setSelectedRecommendationKey(null)
    setSelectedSplitKey(null)
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
      <FloatingRepoLink
        href={repositoryUrl}
        ariaLabel={repositoryAriaLabels[locale]}
      />
      <LanguageSwitcher
        locale={locale}
        isOpen={isLanguageMenuOpen}
        menuRef={languageMenuRef}
        label={text.languageMenuLabel}
        ariaLabel={text.languageMenuAria}
        onTogglePointerDown={toggleLanguageMenuOnPointerDown}
        onToggleKeyDown={handleLanguageMenuKeyDown}
        onOptionPointerDown={selectLanguageOnPointerDown}
        onOptionKeyDown={handleLanguageOptionKeyDown}
      />

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
            <SectionHeading
              eyebrow={text.order.eyebrow}
              title={text.order.title}
              actions={
                <div className="inline-actions">
                  <button type="button" onClick={resetSample}>
                    {text.order.sampleButton}
                  </button>
                  <button type="button" onClick={clearOrder}>
                    {text.order.clearButton}
                  </button>
                </div>
              }
            />

            <div className="product-grid">
              {products.map((product) => {
                const quantity = quantities.get(product.id) ?? 0

                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    quantity={quantity}
                    locale={locale}
                    labels={productCardLabels}
                    onDecrease={() => updateQuantity(product.id, -1)}
                    onIncrease={() => updateQuantity(product.id, 1)}
                  />
                )
              })}
            </div>
          </section>

        </section>

        <section className="right-column">
          <section className="section-card">
            <SectionHeading
              eyebrow={text.recommendations.eyebrow}
              title={text.recommendations.title}
            />

            <div className="strategy-switch" aria-label={text.strategy.ariaLabel}>
              <button
                type="button"
                className={
                  packingStrategy === 'compact'
                    ? 'strategy-chip is-active'
                    : 'strategy-chip'
                }
                onClick={() => changePackingStrategy('compact')}
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
                onClick={() => changePackingStrategy('stable')}
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
              <EmptyState
                title={text.recommendations.emptyNoItemsTitle}
                body={text.recommendations.emptyNoItemsBody}
              />
            ) : recommendations.length === 0 ? (
              <EmptyState
                title={text.recommendations.emptyNoFitTitle}
                body={text.recommendations.emptyNoFitBody}
              />
            ) : (
              <div className="recommendation-grid">
                {recommendations.map((recommendation, index) => (
                  <SelectableMetricCard
                    key={recommendation.key}
                    badge={text.recommendations.candidateLabel(index + 1)}
                    title={recommendation.carton.code}
                    subtitle={`${recommendation.carton.label} / ${recommendation.carton.service}`}
                    metrics={[
                      {
                        label: text.recommendations.metrics.cushion,
                        value: recommendation.cushion.name,
                      },
                      {
                        label: text.recommendations.metrics.score,
                        value: recommendation.score,
                      },
                      {
                        label: text.recommendations.metrics.fillRate,
                        value: formatPercent(recommendation.effectiveFillRate, locale),
                      },
                      {
                        label: text.recommendations.metrics.stability,
                        value: `${recommendation.stabilityScore} / 100`,
                      },
                    ]}
                    isActive={selectedRecommendation?.key === recommendation.key}
                    onClick={() => setSelectedRecommendationKey(recommendation.key)}
                  />
                ))}
              </div>
            )}
          </section>

          {selectedRecommendation ? (
            <>
              <section className="section-card">
                <SectionHeading
                  eyebrow={text.selectedPlan.eyebrow}
                  title={
                    <>
                      {selectedRecommendation.carton.code} /{' '}
                      {selectedRecommendation.cushion.name}
                    </>
                  }
                  details={
                    <>
                      <p className="service-line">
                        {text.selectedPlan.serviceLabel}:{' '}
                        {selectedRecommendation.carton.service}
                      </p>
                      <p className="service-line">
                        {text.selectedPlan.strategyLabel}:{' '}
                        {formatPackingStrategy(selectedRecommendation.strategy, locale)}
                      </p>
                    </>
                  }
                />

                <DetailMetricGrid items={selectedPlanMetricItems} />

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
          <SectionHeading
            eyebrow={text.comparison.eyebrow}
            title={text.comparison.title}
          />

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
                  <MetricsList items={singleComparisonMetrics} />
                </article>

                <article className="comparison-card is-highlight">
                  <span className="comparison-tag">
                    {text.comparison.splitBest(bestSplitRecommendation.boxCount)}
                  </span>
                  <strong>{formatCartonSummary(bestSplitRecommendation.boxes)}</strong>
                  <p>{text.comparison.splitShipment(bestSplitRecommendation.boxes.length)}</p>
                  <MetricsList items={splitComparisonMetrics} />
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
            <EmptyState
              title={text.comparison.emptyTitle}
              body={text.comparison.emptyBody}
            />
          )}
        </section>

        {selectedRecommendation ? (
          <SelectedPlanSection
            recommendation={selectedRecommendation}
            locale={locale}
            labels={text.plan}
          />
        ) : null}

        <section className="section-card">
          <SectionHeading
            eyebrow={text.split.eyebrow}
            title={text.split.title}
          />

          {splitRecommendations.length === 0 ? (
            <EmptyState title={text.split.emptyTitle} body={text.split.emptyBody} />
          ) : (
            <>
              <div className="split-recommendation-grid">
                {splitRecommendations.map((recommendation, index) => (
                  <SelectableMetricCard
                    key={recommendation.key}
                    badge={text.split.optionLabel(recommendation.boxCount, index + 1)}
                    title={formatPercent(recommendation.effectiveFillRate, locale)}
                    subtitle={formatCartonSummary(recommendation.boxes)}
                    metrics={[
                      {
                        label: text.split.metrics.totalEmptyVolume,
                        value: formatVolumeLiters(
                          recommendation.totalEmptyVolume,
                          locale,
                        ),
                      },
                      {
                        label: text.split.metrics.extraVoidFill,
                        value: formatVolumeLiters(
                          recommendation.totalRecommendedVoidFillVolume,
                          locale,
                        ),
                      },
                      {
                        label: text.split.metrics.unusedVolume,
                        value: formatVolumeLiters(
                          recommendation.totalUnusedVolume,
                          locale,
                        ),
                      },
                      {
                        label: text.split.metrics.stability,
                        value: `${recommendation.stabilityScore} / 100`,
                      },
                    ]}
                    isActive={selectedSplitRecommendation?.key === recommendation.key}
                    onClick={() => setSelectedSplitKey(recommendation.key)}
                  />
                ))}
              </div>

              {selectedSplitRecommendation ? (
                <>
                  <div className="split-box-grid">
                    {selectedSplitRecommendation.boxes.map((box) => (
                      <SplitBoxCard
                        key={box.boxIndex}
                        box={box}
                        locale={locale}
                        labels={splitBoxLabels}
                      />
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
          <SectionHeading
            eyebrow={text.catalog.eyebrow}
            title={text.catalog.title}
          />

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
          <SectionHeading
            eyebrow={text.nextData.eyebrow}
            title={text.nextData.title}
          />
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
