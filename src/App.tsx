import { Suspense, lazy, useCallback, useMemo, useState } from 'react'
import {
  Linking,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import {
  cartons as packingCartons,
  cushions as packingCushions,
  defaultOrderLines,
  products as packingProducts,
} from '@/data'
import {
  getAppText,
  getLocalizedCatalog,
  getLocalizedCatalogMaps,
  localizeRecommendation,
  localizeSplitRecommendation,
} from '@/localization'
import { formatCurrencyYen, type SupportedLocale } from '@/locale'
import {
  formatDimensions,
  formatDisplayItemWrapKind,
  formatLength,
  formatPackingStrategy,
  formatPercent,
  formatVolumeLiters,
  formatWeight,
  getDisplayItemWrapKind,
  type PackingStrategy,
  type Product,
  type Recommendation,
  type SplitPackingRecommendation,
} from '@/packing'
import { usePackingPlans } from '@/hooks/usePackingPlans'
import { styles } from '@/styles'
import {
  Section,
  MetricRows,
  EmptyState,
  AppButton,
  LanguageSwitch,
  type MetricItem,
} from '@/components/ui'
import { ProductEditor } from '@/components/ProductEditor'
import { PackingPlan } from '@/components/PackingPlan'
import {
  SelectableCard,
  SplitBoxSummary,
} from '@/components/RecommendationCards'
import {
  PRODUCT_QUANTITY_MAX_DIGITS,
  PRODUCT_DIMENSION_MAX_DIGITS,
  PRODUCT_PRICE_MAX_DIGITS,
  sanitizeDigitsInput,
  parseProductDimension,
} from '@/numericInput'

const repositoryUrl = 'https://github.com/kai987/packing-multilingual'
const PackingScene3D = lazy(() => import('@/PackingScene3D'))
const sectionNumberPrefixPattern = /^\d+\.\s*/
const collapseActionLabels: Record<
  SupportedLocale,
  { collapse: string; expand: string }
> = {
  ja: {
    collapse: 'セクションを折りたたむ',
    expand: 'セクションを開く',
  },
  zh: {
    collapse: '折叠模块',
    expand: '展开模块',
  },
  en: {
    collapse: 'Collapse section',
    expand: 'Expand section',
  },
}

type PlanSelection = {
  kind: 'single' | 'split'
  key: string
}

type ActivePlan =
  | { kind: 'single'; recommendation: Recommendation }
  | { kind: 'split'; recommendation: SplitPackingRecommendation }
  | null

type NumberedSectionKey =
  | 'order'
  | 'recommendations'
  | 'selectedPlan'
  | 'plan'
  | 'comparison'
  | 'split'
  | 'catalog'
  | 'nextData'

function cloneProducts(products: Product[]) {
  return products.map((product) => ({
    ...product,
    size: { ...product.size },
  }))
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
    .map(
      (box) =>
        `${box.recommendation.carton.code} ${box.recommendation.carton.label}`,
    )
    .join(' + ')
}

function formatNumberedSectionEyebrow(index: number, eyebrow: string) {
  return `${index}. ${eyebrow.replace(sectionNumberPrefixPattern, '')}`
}

function getNumberedSectionEyebrows(
  text: ReturnType<typeof getAppText>,
  hasSelectedRecommendation: boolean,
) {
  const baseEyebrows: Record<NumberedSectionKey, string> = {
    order: text.order.eyebrow,
    recommendations: text.recommendations.eyebrow,
    selectedPlan: text.selectedPlan.eyebrow,
    plan: text.plan.eyebrow,
    comparison: text.comparison.eyebrow,
    split: text.split.eyebrow,
    catalog: text.catalog.eyebrow,
    nextData: text.nextData.eyebrow,
  }
  const visibleKeys: NumberedSectionKey[] = ['order', 'recommendations']

  if (hasSelectedRecommendation) {
    visibleKeys.push('selectedPlan')
  }

  visibleKeys.push('plan', 'comparison', 'split', 'catalog', 'nextData')

  const numberedEyebrows = { ...baseEyebrows }

  visibleKeys.forEach((key, index) => {
    numberedEyebrows[key] = formatNumberedSectionEyebrow(
      index + 1,
      baseEyebrows[key],
    )
  })

  return numberedEyebrows
}

export default function App() {
  const [locale, setLocale] = useState<SupportedLocale>('ja')
  const [editableProducts, setEditableProducts] = useState(() =>
    cloneProducts(packingProducts),
  )
  const [productPrices, setProductPrices] = useState<
    Record<string, number | undefined>
  >(() =>
    Object.fromEntries(
      packingProducts.map((product) => [product.id, product.priceYen]),
    ),
  )
  const [orderLines, setOrderLines] = useState(defaultOrderLines)
  const [packingStrategy, setPackingStrategy] =
    useState<PackingStrategy>('compact')
  const [planSelection, setPlanSelection] = useState<PlanSelection | null>(null)
  const [viewSyncToken, setViewSyncToken] = useState(0)
  const [isSceneGestureActive, setIsSceneGestureActive] = useState(false)
  const [isOrderCollapsed, setIsOrderCollapsed] = useState(false)
  const [isRecommendationsCollapsed, setIsRecommendationsCollapsed] =
    useState(false)
  const [isSelectedSummaryCollapsed, setIsSelectedSummaryCollapsed] =
    useState(false)
  const [isPlanCollapsed, setIsPlanCollapsed] = useState(false)
  const [isComparisonCollapsed, setIsComparisonCollapsed] = useState(false)
  const [isSplitCollapsed, setIsSplitCollapsed] = useState(false)
  const [isCatalogCollapsed, setIsCatalogCollapsed] = useState(false)
  const [isNextDataCollapsed, setIsNextDataCollapsed] = useState(false)
  const { width } = useWindowDimensions()
  const isWide = width >= 900
  const isCompact = width < 640
  const text = getAppText(locale)
  const collapseLabels = collapseActionLabels[locale]
  const baseLocalizedCatalog = useMemo(
    () => getLocalizedCatalog(locale),
    [locale],
  )
  const editableProductsById = useMemo(
    () => new Map(editableProducts.map((product) => [product.id, product])),
    [editableProducts],
  )
  const { products, cartons, cushions } = baseLocalizedCatalog
  const localizedCatalogMaps = useMemo(
    () => getLocalizedCatalogMaps(baseLocalizedCatalog),
    [baseLocalizedCatalog],
  )
  const quantities = useMemo(
    () =>
      new Map(
        orderLines.map((line) => [line.productId, line.quantity] as const),
      ),
    [orderLines],
  )
  const itemWrapUsage = useMemo(
    () =>
      new Map(
        orderLines.map((line) => [line.productId, line.useItemWrap] as const),
      ),
    [orderLines],
  )
  const packingRequest = useMemo(
    () => ({
      products: editableProducts,
      cartons: packingCartons,
      cushions: packingCushions,
      orderLines,
      strategy: packingStrategy,
    }),
    [orderLines, packingStrategy, editableProducts],
  )
  const {
    options: packingPlanOptions,
    isCalculating,
    error: calculationError,
    retry,
    backend: calculationBackend,
    usedFallback: calculationUsedFallback,
  } = usePackingPlans(packingRequest)
  const baseRecommendations = packingPlanOptions.single
  const baseSplitRecommendations = packingPlanOptions.split
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
        localizeSplitRecommendation(
          recommendation,
          locale,
          localizedCatalogMaps,
        ),
      ),
    [baseSplitRecommendations, locale, localizedCatalogMaps],
  )
  const activePlan = useMemo<ActivePlan>(() => {
    if (planSelection?.kind === 'split') {
      const recommendation = getSelectedItem(
        splitRecommendations,
        planSelection.key,
      )

      if (recommendation) {
        return { kind: 'split', recommendation }
      }
    } else {
      const recommendation = getSelectedItem(
        recommendations,
        planSelection?.key ?? null,
      )

      if (recommendation) {
        return { kind: 'single', recommendation }
      }
    }

    const fallbackSingle = recommendations[0]

    if (fallbackSingle) {
      return { kind: 'single', recommendation: fallbackSingle }
    }

    const fallbackSplit = splitRecommendations[0]

    return fallbackSplit
      ? { kind: 'split', recommendation: fallbackSplit }
      : null
  }, [planSelection, recommendations, splitRecommendations])
  const selectedRecommendation =
    activePlan?.kind === 'single' ? activePlan.recommendation : null
  const selectedSplitRecommendation =
    activePlan?.kind === 'split' ? activePlan.recommendation : null
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
      editableProducts.reduce((sum, product) => {
        return sum + product.weight * (quantities.get(product.id) ?? 0)
      }, 0),
    [editableProducts, quantities],
  )
  const selectedHasItemWrap = selectedRecommendation
    ? selectedRecommendation.placements.some(
        (placement) => placement.useItemWrap,
      )
    : false
  const getRecommendationItemWrapLabel = (recommendation: Recommendation) =>
    recommendation.placements.some((placement) => placement.useItemWrap)
      ? formatDisplayItemWrapKind(
          getDisplayItemWrapKind(recommendation.cushion),
          locale,
        )
      : text.order.itemWrapDisabled
  const selectedItemWrapLabel = selectedRecommendation
    ? selectedHasItemWrap
      ? getRecommendationItemWrapLabel(selectedRecommendation)
      : text.order.itemWrapDisabled
    : ''
  const visualizedPlanBoxes = selectedRecommendation
    ? [
        {
          key: selectedRecommendation.key,
          title: text.plan.threeDTitle,
          subtitle: `${selectedRecommendation.carton.code} / ${selectedRecommendation.cushion.name}`,
          recommendation: selectedRecommendation,
        },
      ]
    : selectedSplitRecommendation
      ? selectedSplitRecommendation.boxes.map((box) => ({
          key: `${selectedSplitRecommendation.key}-${box.boxIndex}`,
          title: text.split.boxThreeDTitle(box.boxIndex),
          subtitle: `${box.recommendation.carton.code} / ${box.recommendation.cushion.name}`,
          recommendation: box.recommendation,
        }))
      : []
  const sectionEyebrows = getNumberedSectionEyebrows(
    text,
    Boolean(selectedRecommendation),
  )
  const productCardLabels = text.order
  const selectedPlanMetricItems: MetricItem[] = selectedRecommendation
    ? [
        {
          label: text.selectedPlan.metrics.innerDimensions,
          value: formatDimensions(selectedRecommendation.carton.inner, locale),
        },
        {
          label: text.selectedPlan.metrics.effectiveInner,
          value: formatDimensions(
            selectedRecommendation.effectiveInner,
            locale,
          ),
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
          value: formatVolumeLiters(
            selectedRecommendation.unusedVolume,
            locale,
          ),
        },
      ]
    : []
  const singleComparisonMetrics: MetricItem[] = bestSingleRecommendation
    ? [
        {
          label: text.comparison.metrics.fillRate,
          value: formatPercent(
            bestSingleRecommendation.effectiveFillRate,
            locale,
          ),
        },
        {
          label: text.comparison.metrics.emptyVolume,
          value: formatVolumeLiters(
            bestSingleRecommendation.emptyVolume,
            locale,
          ),
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
          value: formatVolumeLiters(
            bestSingleRecommendation.unusedVolume,
            locale,
          ),
        },
      ]
    : []
  const splitComparisonMetrics: MetricItem[] = bestSplitRecommendation
    ? [
        {
          label: text.comparison.metrics.totalFillRate,
          value: formatPercent(
            bestSplitRecommendation.effectiveFillRate,
            locale,
          ),
        },
        {
          label: text.comparison.metrics.totalEmptyVolume,
          value: formatVolumeLiters(
            bestSplitRecommendation.totalEmptyVolume,
            locale,
          ),
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
          value: formatVolumeLiters(
            bestSplitRecommendation.totalUnusedVolume,
            locale,
          ),
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
    itemQuantity: text.split.itemQuantity,
  }

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setOrderLines((current) =>
      current.map((line) =>
        line.productId === productId
          ? {
              ...line,
              quantity: Math.min(999, Math.max(0, line.quantity + delta)),
            }
          : line,
      ),
    )
  }, [])
  const updateQuantityValue = useCallback(
    (productId: string, rawValue: string) => {
      const nextDigits = sanitizeDigitsInput(
        rawValue,
        PRODUCT_QUANTITY_MAX_DIGITS,
      )

      setOrderLines((current) =>
        current.map((line) =>
          line.productId === productId
            ? {
                ...line,
                quantity:
                  nextDigits.length > 0 ? Number.parseInt(nextDigits, 10) : 0,
              }
            : line,
        ),
      )
    },
    [],
  )
  const updateProductDimension = useCallback(
    (productId: string, dimension: keyof Product['size'], rawValue: string) => {
      const nextDigits = sanitizeDigitsInput(
        rawValue,
        PRODUCT_DIMENSION_MAX_DIGITS,
      )

      if (nextDigits.length === 0) {
        return
      }

      const nextValue = parseProductDimension(nextDigits)

      if (nextValue === null) {
        return
      }

      setEditableProducts((current) =>
        current.map((product) =>
          product.id === productId
            ? {
                ...product,
                size: {
                  ...product.size,
                  [dimension]: nextValue,
                },
              }
            : product,
        ),
      )
    },
    [],
  )
  const updateProductPrice = useCallback(
    (productId: string, rawValue: string) => {
      const nextDigits = sanitizeDigitsInput(rawValue, PRODUCT_PRICE_MAX_DIGITS)

      setProductPrices((current) => ({
        ...current,
        [productId]:
          nextDigits.length > 0 ? Number.parseInt(nextDigits, 10) : undefined,
      }))
    },
    [],
  )
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
  const toggleItemWrap = useCallback((productId: string) => {
    setOrderLines((current) =>
      current.map((line) =>
        line.productId === productId
          ? { ...line, useItemWrap: !line.useItemWrap }
          : line,
      ),
    )
  }, [])
  const changePackingStrategy = (strategy: PackingStrategy) => {
    setPackingStrategy(strategy)
    setPlanSelection(null)
  }
  const openRepository = () => {
    void Linking.openURL(repositoryUrl)
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#f4f5f0" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!isSceneGestureActive}
      >
        <View style={styles.page}>
          <View style={styles.topBar}>
            <LanguageSwitch locale={locale} onChange={setLocale} />
            <AppButton
              label="GitHub"
              onPress={openRepository}
              variant="ghost"
            />
          </View>

          <View style={[styles.hero, isWide && styles.heroWide]}>
            <View style={styles.heroPanel}>
              <Text style={styles.heroTitle}>{text.hero.tagline}</Text>
              <Text style={styles.eyebrow}>{text.hero.eyebrow}</Text>
              <Text style={styles.lead}>{text.hero.lead}</Text>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.metricLabel}>
                    {text.hero.stats.totalUnits}
                  </Text>
                  <Text style={styles.heroStatValue}>{totalUnits}</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={styles.metricLabel}>
                    {text.hero.stats.activeSkus}
                  </Text>
                  <Text style={styles.heroStatValue}>{activeSkuCount}</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={styles.metricLabel}>
                    {text.hero.stats.totalWeight}
                  </Text>
                  <Text style={styles.heroStatValue}>
                    {formatWeight(totalWeight, locale)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.summaryPanel}>
              <Text style={styles.eyebrow}>{text.summary.title}</Text>
              {text.summary.items.map((item) => (
                <Text key={item} style={styles.bulletText}>
                  - {item}
                </Text>
              ))}
            </View>
          </View>

          <View style={[styles.workspace, isWide && styles.workspaceWide]}>
            <View
              style={[
                styles.workspaceColumn,
                isWide && styles.workspaceColumnWide,
              ]}
            >
              <Section
                eyebrow={sectionEyebrows.order}
                title={text.order.title}
                headerStacked={isCompact}
                isCollapsed={isOrderCollapsed}
                toggleLabel={
                  isOrderCollapsed
                    ? collapseLabels.expand
                    : collapseLabels.collapse
                }
                onToggle={() => setIsOrderCollapsed((current) => !current)}
                actions={
                  <>
                    <AppButton
                      label={text.order.sampleButton}
                      onPress={resetSample}
                    />
                    <AppButton
                      label={text.order.clearButton}
                      onPress={clearOrder}
                    />
                  </>
                }
              >
                <View style={styles.productGrid}>
                  {products.map((product) => {
                    const quantity = quantities.get(product.id) ?? 0
                    const useItemWrap = itemWrapUsage.get(product.id) ?? false

                    return (
                      <ProductEditor
                        compact={isCompact}
                        key={product.id}
                        product={product}
                        size={
                          editableProductsById.get(product.id)?.size ??
                          product.size
                        }
                        priceYen={productPrices[product.id]}
                        dimensionErrorMessage={
                          text.recommendations.invalidDimension
                        }
                        quantity={quantity}
                        useItemWrap={useItemWrap}
                        locale={locale}
                        labels={productCardLabels}
                        onQuantityStep={updateQuantity}
                        onQuantityChange={updateQuantityValue}
                        onPriceChange={updateProductPrice}
                        onDimensionChange={updateProductDimension}
                        onToggleItemWrap={toggleItemWrap}
                      />
                    )
                  })}
                </View>
              </Section>
            </View>

            <View
              style={[
                styles.workspaceColumn,
                isWide && styles.workspaceColumnWide,
              ]}
            >
              <Section
                eyebrow={sectionEyebrows.recommendations}
                title={text.recommendations.title}
                isCollapsed={isRecommendationsCollapsed}
                toggleLabel={
                  isRecommendationsCollapsed
                    ? collapseLabels.expand
                    : collapseLabels.collapse
                }
                onToggle={() =>
                  setIsRecommendationsCollapsed((current) => !current)
                }
              >
                <View style={styles.strategySwitch}>
                  <AppButton
                    label={text.strategy.compact}
                    onPress={() => changePackingStrategy('compact')}
                    variant={
                      packingStrategy === 'compact' ? 'primary' : 'secondary'
                    }
                  />
                  <AppButton
                    label={text.strategy.stable}
                    onPress={() => changePackingStrategy('stable')}
                    variant={
                      packingStrategy === 'stable' ? 'primary' : 'secondary'
                    }
                  />
                </View>
                <Text style={styles.strategyNote}>
                  {packingStrategy === 'compact'
                    ? text.strategy.compactNote
                    : text.strategy.stableNote}
                </Text>

                {calculationBackend ? (
                  <Text testID="packing-engine-status" style={styles.metaText}>
                    {text.recommendations.engine}:{' '}
                    {calculationBackend === 'rust-wasm'
                      ? 'Rust / WASM'
                      : 'TypeScript'}
                    {calculationUsedFallback
                      ? ` (${text.recommendations.wasmFallback})`
                      : ''}
                  </Text>
                ) : null}

                {isCalculating ? (
                  <Text
                    accessibilityLiveRegion="polite"
                    style={styles.metaText}
                  >
                    {text.recommendations.calculating}
                  </Text>
                ) : null}
                {calculationError ? (
                  <View>
                    <Text accessibilityRole="alert" style={styles.metaText}>
                      {text.recommendations.calculationFailed}
                    </Text>
                    <AppButton
                      label={text.recommendations.retry}
                      onPress={retry}
                    />
                  </View>
                ) : null}

                {isCalculating &&
                recommendations.length === 0 ? null : totalUnits === 0 ? (
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
                  <View style={styles.cardStack}>
                    {recommendations.map((recommendation, index) => (
                      <SelectableCard
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
                            value: formatPercent(
                              recommendation.effectiveFillRate,
                              locale,
                            ),
                          },
                          {
                            label: text.recommendations.metrics.stability,
                            value: `${recommendation.stabilityScore} / 100`,
                          },
                        ]}
                        isActive={
                          selectedRecommendation?.key === recommendation.key
                        }
                        onPress={() =>
                          setPlanSelection({
                            kind: 'single',
                            key: recommendation.key,
                          })
                        }
                      />
                    ))}
                  </View>
                )}
              </Section>

              {selectedRecommendation ? (
                <Section
                  eyebrow={sectionEyebrows.selectedPlan}
                  title={`${selectedRecommendation.carton.code} / ${selectedRecommendation.cushion.name}`}
                  isCollapsed={isSelectedSummaryCollapsed}
                  toggleLabel={
                    isSelectedSummaryCollapsed
                      ? collapseLabels.expand
                      : collapseLabels.collapse
                  }
                  onToggle={() =>
                    setIsSelectedSummaryCollapsed((current) => !current)
                  }
                >
                  <Text style={styles.serviceText}>
                    {text.selectedPlan.serviceLabel}:{' '}
                    {selectedRecommendation.carton.service}
                  </Text>
                  <Text style={styles.serviceText}>
                    {text.selectedPlan.strategyLabel}:{' '}
                    {formatPackingStrategy(
                      selectedRecommendation.strategy,
                      locale,
                    )}
                  </Text>
                  <MetricRows items={selectedPlanMetricItems} columns />
                  <View style={styles.reasonList}>
                    {selectedRecommendation.reasons.map((reason) => (
                      <Text key={reason} style={styles.bulletText}>
                        - {reason}
                      </Text>
                    ))}
                  </View>
                </Section>
              ) : null}
            </View>
          </View>

          <Section
            eyebrow={sectionEyebrows.plan}
            title={text.plan.title}
            isCollapsed={isPlanCollapsed}
            toggleLabel={
              isPlanCollapsed ? collapseLabels.expand : collapseLabels.collapse
            }
            onToggle={() => setIsPlanCollapsed((current) => !current)}
            actions={
              visualizedPlanBoxes.length > 0 ? (
                <AppButton
                  label={text.plan.alignTopView}
                  onPress={() => setViewSyncToken((current) => current + 1)}
                />
              ) : undefined
            }
          >
            {visualizedPlanBoxes.length > 0 ? (
              <>
                {visualizedPlanBoxes.map((box) => (
                  <View key={box.key} style={styles.visualizedBox}>
                    <View style={styles.scenePanel}>
                      <View style={styles.layerHeader}>
                        <Text style={styles.layerTitle}>{box.title}</Text>
                        <Text style={styles.layerRange}>{box.subtitle}</Text>
                        <Text style={styles.layerRange}>
                          {text.plan.threeDHint}
                        </Text>
                      </View>
                      <Suspense
                        fallback={
                          <View style={styles.sceneLoading}>
                            <Text style={styles.metaText}>
                              {text.plan.loading}
                            </Text>
                          </View>
                        }
                      >
                        <PackingScene3D
                          onGestureActiveChange={setIsSceneGestureActive}
                          recommendation={box.recommendation}
                          viewSyncToken={viewSyncToken}
                        />
                      </Suspense>
                      <View style={styles.threeDLegend}>
                        {[
                          text.plan.legend.currentItemWrap(
                            getRecommendationItemWrapLabel(box.recommendation),
                          ),
                          text.plan.legend.wrap,
                          text.plan.legend.paperFill,
                          text.plan.legend.recommendedVoidFill,
                          text.plan.legend.product,
                          text.plan.legend.unusedTop,
                          text.plan.legend.carton,
                        ].map((item) => (
                          <Text key={item} style={styles.legendText}>
                            {item}
                          </Text>
                        ))}
                      </View>
                    </View>
                    <PackingPlan
                      recommendation={box.recommendation}
                      locale={locale}
                      labels={text.plan}
                    />
                  </View>
                ))}
              </>
            ) : isCalculating ? (
              <Text accessibilityLiveRegion="polite" style={styles.metaText}>
                {text.recommendations.calculating}
              </Text>
            ) : (
              <EmptyState
                title={
                  totalUnits === 0
                    ? text.recommendations.emptyNoItemsTitle
                    : text.recommendations.emptyNoFitTitle
                }
                body={
                  totalUnits === 0
                    ? text.recommendations.emptyNoItemsBody
                    : text.recommendations.emptyNoFitBody
                }
              />
            )}
          </Section>

          <Section
            eyebrow={sectionEyebrows.comparison}
            title={text.comparison.title}
            isCollapsed={isComparisonCollapsed}
            toggleLabel={
              isComparisonCollapsed
                ? collapseLabels.expand
                : collapseLabels.collapse
            }
            onToggle={() => setIsComparisonCollapsed((current) => !current)}
          >
            {bestSingleRecommendation && bestSplitRecommendation ? (
              <>
                <View
                  style={[
                    styles.comparisonGrid,
                    isWide && styles.comparisonGridWide,
                  ]}
                >
                  <View style={styles.comparisonCard}>
                    <Text style={styles.cardBadge}>
                      {text.comparison.singleBest}
                    </Text>
                    <Text style={styles.comparisonTitle}>
                      {bestSingleRecommendation.carton.code} /{' '}
                      {bestSingleRecommendation.carton.label}
                    </Text>
                    <Text style={styles.metaText}>
                      {bestSingleRecommendation.cushion.name}
                    </Text>
                    <MetricRows items={singleComparisonMetrics} />
                  </View>

                  <View
                    style={[
                      styles.comparisonCard,
                      styles.comparisonCardHighlight,
                    ]}
                  >
                    <Text style={styles.cardBadge}>
                      {text.comparison.splitBest(
                        bestSplitRecommendation.boxCount,
                      )}
                    </Text>
                    <Text style={styles.comparisonTitle}>
                      {formatCartonSummary(bestSplitRecommendation.boxes)}
                    </Text>
                    <Text style={styles.metaText}>
                      {text.comparison.splitShipment(
                        bestSplitRecommendation.boxes.length,
                      )}
                    </Text>
                    <MetricRows items={splitComparisonMetrics} />
                  </View>
                </View>
                <Text style={styles.strategyNote}>
                  {text.comparison.note(
                    bestSplitRecommendation.boxCount,
                    formatPercent(
                      bestSplitRecommendation.effectiveFillRate,
                      locale,
                    ),
                    formatPercent(
                      bestSplitRecommendation.effectiveFillRate -
                        bestSingleRecommendation.effectiveFillRate,
                      locale,
                    ),
                  )}
                </Text>
              </>
            ) : (
              <EmptyState
                title={text.comparison.emptyTitle}
                body={text.comparison.emptyBody}
              />
            )}
          </Section>

          <Section
            eyebrow={sectionEyebrows.split}
            title={text.split.title}
            isCollapsed={isSplitCollapsed}
            toggleLabel={
              isSplitCollapsed ? collapseLabels.expand : collapseLabels.collapse
            }
            onToggle={() => setIsSplitCollapsed((current) => !current)}
          >
            {splitRecommendations.length === 0 ? (
              <EmptyState
                title={text.split.emptyTitle}
                body={text.split.emptyBody}
              />
            ) : (
              <>
                <View style={styles.cardStack}>
                  {splitRecommendations.map((recommendation, index) => (
                    <SelectableCard
                      key={recommendation.key}
                      badge={text.split.optionLabel(
                        recommendation.boxCount,
                        index + 1,
                      )}
                      title={formatPercent(
                        recommendation.effectiveFillRate,
                        locale,
                      )}
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
                      isActive={
                        selectedSplitRecommendation?.key === recommendation.key
                      }
                      onPress={() =>
                        setPlanSelection({
                          kind: 'split',
                          key: recommendation.key,
                        })
                      }
                    />
                  ))}
                </View>

                {selectedSplitRecommendation ? (
                  <>
                    <View
                      style={[
                        styles.splitBoxGrid,
                        isWide && styles.splitBoxGridWide,
                      ]}
                    >
                      {selectedSplitRecommendation.boxes.map((box) => (
                        <SplitBoxSummary
                          key={box.boxIndex}
                          box={box}
                          locale={locale}
                          labels={splitBoxLabels}
                        />
                      ))}
                    </View>
                    <View style={styles.reasonList}>
                      {selectedSplitRecommendation.reasons.map((reason) => (
                        <Text key={reason} style={styles.bulletText}>
                          - {reason}
                        </Text>
                      ))}
                    </View>
                  </>
                ) : null}
              </>
            )}
          </Section>

          <Section
            eyebrow={sectionEyebrows.catalog}
            title={text.catalog.title}
            isCollapsed={isCatalogCollapsed}
            toggleLabel={
              isCatalogCollapsed
                ? collapseLabels.expand
                : collapseLabels.collapse
            }
            onToggle={() => setIsCatalogCollapsed((current) => !current)}
          >
            <View
              style={[styles.catalogGrid, isWide && styles.catalogGridWide]}
            >
              <View style={styles.catalogPanel}>
                <Text style={styles.catalogTitle}>
                  {text.catalog.cartonTitle}
                </Text>
                {cartons.map((carton) => (
                  <View key={carton.id} style={styles.catalogItem}>
                    <Text style={styles.catalogItemTitle}>
                      {carton.code} / {carton.label}
                    </Text>
                    <Text style={styles.metaText}>
                      {text.catalog.service}: {carton.service}
                    </Text>
                    {carton.outer ? (
                      <Text style={styles.metaText}>
                        {text.catalog.outerDimensions}:{' '}
                        {formatDimensions(carton.outer, locale)}
                      </Text>
                    ) : null}
                    <Text style={styles.metaText}>
                      {text.catalog.innerDimensions}:{' '}
                      {formatDimensions(carton.inner, locale)}
                    </Text>
                    <Text style={styles.metaText}>
                      {text.catalog.volumetricWeight}:{' '}
                      {carton.volumetricWeightGrams === null
                        ? text.catalog.unknownWeightLimit
                        : formatWeight(carton.volumetricWeightGrams, locale)}
                    </Text>
                    <Text style={styles.metaText}>
                      {text.catalog.maxLoadWeight}:{' '}
                      {carton.maxLoadWeightGrams === null
                        ? text.catalog.unknownWeightLimit
                        : formatWeight(carton.maxLoadWeightGrams, locale)}
                    </Text>
                    {carton.priceYen ? (
                      <Text style={styles.metaText}>
                        {text.catalog.materialPrice}:{' '}
                        {formatCurrencyYen(carton.priceYen, locale)}
                      </Text>
                    ) : null}
                    <Text style={styles.catalogNote}>{carton.note}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.catalogPanel}>
                <Text style={styles.catalogTitle}>
                  {text.catalog.cushionTitle}
                </Text>
                {cushions.map((cushion) => (
                  <View key={cushion.id} style={styles.catalogItem}>
                    <Text style={styles.catalogItemTitle}>{cushion.name}</Text>
                    <Text style={styles.metaText}>
                      {text.catalog.cushionRule(
                        formatLength(cushion.sidePadding, locale),
                        formatLength(cushion.topPadding, locale),
                        formatLength(cushion.bottomPadding, locale),
                      )}
                    </Text>
                    <Text style={styles.metaText}>
                      {text.catalog.stabilityBonus}: +{cushion.stabilityBonus}
                    </Text>
                    <Text style={styles.catalogNote}>{cushion.note}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Section>

          <Section
            eyebrow={sectionEyebrows.nextData}
            title={text.nextData.title}
            isCollapsed={isNextDataCollapsed}
            toggleLabel={
              isNextDataCollapsed
                ? collapseLabels.expand
                : collapseLabels.collapse
            }
            onToggle={() => setIsNextDataCollapsed((current) => !current)}
          >
            {text.nextData.items.map((item) => (
              <Text key={item} style={styles.bulletText}>
                - {item}
              </Text>
            ))}
          </Section>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
