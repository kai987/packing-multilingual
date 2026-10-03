import { useState } from 'react'
import {
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native'
import { sanitizeDigitsInput } from '@/numericInput'
import { styles } from '@/styles'

export function NumericInput({
  value,
  maxLength,
  onChangeText,
  validate,
  errorMessage,
  label,
  placeholder,
  style,
}: {
  value: string
  maxLength: number
  onChangeText: (value: string) => void
  validate?: (value: string) => boolean
  errorMessage?: string
  label?: string
  placeholder?: string
  style?: StyleProp<TextStyle>
}) {
  const [draft, setDraft] = useState(value)
  const [isEditing, setIsEditing] = useState(false)
  const isInvalid = isEditing && Boolean(validate && !validate(draft))

  return (
    <View style={styles.numericInputContainer}>
      <TextInput
        accessibilityLabel={label}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor="#7b817a"
        style={[style ?? styles.numberInput, isInvalid && styles.invalidInput]}
        value={isEditing ? draft : value}
        onFocus={() => {
          setDraft(value)
          setIsEditing(true)
        }}
        onChangeText={(text) => {
          const digits = sanitizeDigitsInput(text, maxLength)
          setDraft(digits)
          if (!validate || validate(digits)) onChangeText(digits)
        }}
        onBlur={() => setIsEditing(false)}
      />
      {isInvalid && errorMessage ? (
        <Text accessibilityRole="alert" style={styles.inputError}>
          {errorMessage}
        </Text>
      ) : null}
    </View>
  )
}
