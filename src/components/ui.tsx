import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { localeNames, type SupportedLocale } from '@/locale'
import { styles } from '@/styles'
import { NumericInput } from '@/components/NumericInput'
import { parseProductDimension } from '@/numericInput'

export type MetricItem = { label: string; value: string | number }

export function Section({
  eyebrow,
  title,
  children,
  actions,
  headerStacked = false,
  isCollapsed = false,
  onToggle,
  toggleLabel,
}: {
  eyebrow: string
  title: ReactNode
  children: ReactNode
  actions?: ReactNode
  headerStacked?: boolean
  isCollapsed?: boolean
  onToggle?: () => void
  toggleLabel?: string
}) {
  const canCollapse = Boolean(onToggle)
  const collapseControl = canCollapse ? (
    <Pressable
      accessibilityLabel={toggleLabel}
      accessibilityRole="button"
      accessibilityState={{ expanded: !isCollapsed }}
      hitSlop={8}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.collapseToggle,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.collapseToggleText}>{isCollapsed ? '+' : '-'}</Text>
    </Pressable>
  ) : null

  return (
    <View style={styles.section}>
      <View
        style={[
          styles.sectionHeader,
          headerStacked && styles.sectionHeaderStacked,
        ]}
      >
        {headerStacked ? (
          <>
            <View style={styles.sectionHeaderTitleRow}>
              <View
                style={[
                  styles.sectionTitleGroup,
                  styles.sectionTitleGroupStacked,
                ]}
              >
                <Text style={styles.eyebrow}>{eyebrow}</Text>
                <Text style={styles.sectionTitle}>{title}</Text>
              </View>
              {collapseControl}
            </View>
            {actions ? (
              <View
                style={[styles.sectionActions, styles.sectionActionsStacked]}
              >
                {actions}
              </View>
            ) : null}
          </>
        ) : (
          <>
            <View style={styles.sectionTitleGroup}>
              <Text style={styles.eyebrow}>{eyebrow}</Text>
              <Text style={styles.sectionTitle}>{title}</Text>
            </View>
            {actions || collapseControl ? (
              <View style={styles.sectionActions}>
                {actions}
                {collapseControl}
              </View>
            ) : null}
          </>
        )}
      </View>
      {isCollapsed ? null : children}
    </View>
  )
}

export function MetricRows({
  items,
  columns = false,
}: {
  items: MetricItem[]
  columns?: boolean
}) {
  return (
    <View style={columns ? styles.metricGrid : styles.metricList}>
      {items.map((item, index) => (
        <View
          key={`${item.label}-${index}`}
          style={columns ? styles.metricTile : styles.metricRow}
        >
          <Text style={styles.metricLabel}>{item.label}</Text>
          <Text style={styles.metricValue}>{String(item.value)}</Text>
        </View>
      ))}
    </View>
  )
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  )
}

export function AppButton({
  label,
  onPress,
  variant = 'secondary',
}: {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'ghost'
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.appButton,
        variant === 'primary' && styles.appButtonPrimary,
        variant === 'ghost' && styles.appButtonGhost,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.appButtonText,
          variant === 'primary' && styles.appButtonPrimaryText,
          variant === 'ghost' && styles.appButtonGhostText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export function LanguageSwitch({
  locale,
  onChange,
}: {
  locale: SupportedLocale
  onChange: (locale: SupportedLocale) => void
}) {
  const localeOptions = Object.keys(localeNames) as SupportedLocale[]

  return (
    <View style={styles.languageSwitch}>
      {localeOptions.map((localeOption) => {
        const isActive = localeOption === locale

        return (
          <Pressable
            key={localeOption}
            accessibilityRole="button"
            onPress={() => onChange(localeOption)}
            style={({ pressed }) => [
              styles.languageOption,
              isActive && styles.languageOptionActive,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.languageOptionText,
                isActive && styles.languageOptionActiveText,
              ]}
            >
              {localeNames[localeOption]}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function NumberField({
  label,
  value,
  maxLength,
  placeholder,
  onChangeText,
  errorMessage,
}: {
  label?: string
  value: string
  maxLength: number
  placeholder?: string
  onChangeText: (value: string) => void
  errorMessage?: string
}) {
  return (
    <View style={styles.numberField}>
      {label ? <Text style={styles.numberFieldLabel}>{label}</Text> : null}
      <NumericInput
        label={label}
        errorMessage={errorMessage}
        validate={
          errorMessage
            ? (text) => parseProductDimension(text) !== null
            : undefined
        }
        maxLength={maxLength}
        onChangeText={onChangeText}
        placeholder={placeholder}
        value={value}
      />
    </View>
  )
}
