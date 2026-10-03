import { memo } from 'react'
import { Pressable, Text, View } from 'react-native'
import { formatWeight, type Product } from '@/packing'
import type { SupportedLocale } from '@/locale'
import { styles } from '@/styles'
import { AppButton, NumberField } from '@/components/ui'
import { NumericInput } from '@/components/NumericInput'
import {
  PRODUCT_QUANTITY_MAX_DIGITS,
  PRODUCT_DIMENSION_MAX_DIGITS,
  PRODUCT_PRICE_MAX_DIGITS,
} from '@/numericInput'

export const ProductEditor = memo(function ProductEditor({
  compact,
  product,
  size,
  priceYen,
  dimensionErrorMessage,
  quantity,
  useItemWrap,
  locale,
  labels,
  onQuantityStep,
  onQuantityChange,
  onPriceChange,
  onDimensionChange,
  onToggleItemWrap,
}: {
  compact: boolean
  product: Product
  size: Product['size']
  priceYen: number | undefined
  dimensionErrorMessage: string
  quantity: number
  useItemWrap: boolean
  locale: SupportedLocale
  labels: {
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
  onQuantityStep: (productId: string, delta: number) => void
  onQuantityChange: (productId: string, value: string) => void
  onPriceChange: (productId: string, value: string) => void
  onDimensionChange: (
    productId: string,
    dimension: keyof Product['size'],
    value: string,
  ) => void
  onToggleItemWrap: (productId: string) => void
}) {
  return (
    <View testID={`product-${product.id}`} style={styles.productCard}>
      <View
        style={[styles.productHeader, compact && styles.productHeaderCompact]}
      >
        <View style={[styles.brandChip, { backgroundColor: product.color }]}>
          <Text style={styles.brandChipText}>{product.brand}</Text>
        </View>
        <Text style={styles.productName}>{product.name}</Text>
      </View>
      <Text style={styles.productCategory}>{product.category}</Text>

      <Text style={styles.fieldGroupLabel}>
        {labels.dimensions} ({labels.dimensionsUnit})
      </Text>
      <View
        style={[styles.dimensionGrid, compact && styles.dimensionGridCompact]}
      >
        <NumberField
          label={labels.dimensionLength}
          maxLength={PRODUCT_DIMENSION_MAX_DIGITS}
          value={String(size.length)}
          errorMessage={dimensionErrorMessage}
          onChangeText={(value) =>
            onDimensionChange(product.id, 'length', value)
          }
        />
        <NumberField
          label={labels.dimensionWidth}
          maxLength={PRODUCT_DIMENSION_MAX_DIGITS}
          value={String(size.width)}
          errorMessage={dimensionErrorMessage}
          onChangeText={(value) =>
            onDimensionChange(product.id, 'width', value)
          }
        />
        <NumberField
          label={labels.dimensionHeight}
          maxLength={PRODUCT_DIMENSION_MAX_DIGITS}
          value={String(size.height)}
          errorMessage={dimensionErrorMessage}
          onChangeText={(value) =>
            onDimensionChange(product.id, 'height', value)
          }
        />
      </View>

      <Text style={styles.fieldGroupLabel}>
        {labels.price} ({labels.priceUnit})
      </Text>
      <NumberField
        maxLength={PRODUCT_PRICE_MAX_DIGITS}
        placeholder={labels.unsetPrice}
        value={priceYen !== undefined ? String(priceYen) : ''}
        onChangeText={(value) => onPriceChange(product.id, value)}
      />

      <View style={styles.productMetaGrid}>
        <View style={styles.productMetaBlock}>
          <Text style={styles.metricLabel}>{labels.weight}</Text>
          <Text style={styles.metricValue}>
            {formatWeight(product.weight, locale)}
          </Text>
        </View>
        <View style={styles.productMetaBlock}>
          <Text style={styles.metricLabel}>{labels.note}</Text>
          <Text style={styles.metaText}>{product.note}</Text>
        </View>
      </View>

      <View style={styles.stepper}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onQuantityStep(product.id, -1)}
          style={({ pressed }) => [
            styles.stepperButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.stepperButtonText}>-</Text>
        </Pressable>
        <NumericInput
          maxLength={PRODUCT_QUANTITY_MAX_DIGITS}
          onChangeText={(value) => onQuantityChange(product.id, value)}
          style={styles.quantityInput}
          value={String(quantity)}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => onQuantityStep(product.id, 1)}
          style={({ pressed }) => [
            styles.stepperButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.stepperButtonText}>+</Text>
        </Pressable>
      </View>

      <View style={[styles.wrapControl, compact && styles.wrapControlCompact]}>
        <View>
          <Text style={styles.metricLabel}>{labels.itemWrapLabel}</Text>
          <Text style={useItemWrap ? styles.wrapEnabled : styles.wrapDisabled}>
            {useItemWrap ? labels.itemWrapEnabled : labels.itemWrapDisabled}
          </Text>
        </View>
        <AppButton
          label={
            useItemWrap
              ? labels.itemWrapDisableAction
              : labels.itemWrapEnableAction
          }
          onPress={() => onToggleItemWrap(product.id)}
          variant={useItemWrap ? 'primary' : 'secondary'}
        />
      </View>
    </View>
  )
})
