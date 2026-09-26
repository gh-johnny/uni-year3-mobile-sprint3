import { forwardRef, useState } from 'react';
import { Control, Controller, FieldPath, FieldValues } from 'react-hook-form';
import { TextInput, TextInputProps, View } from 'react-native';

import { IconName } from '../icons/glyphs';
import { useTheme } from '../theme/use-theme';
import { Icon } from './icon';
import { Text } from './text';

export type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  icon?: IconName;
  mono?: boolean;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, icon, mono, style, onFocus, onBlur, ...props },
  ref,
) {
  const theme = useTheme();
  const { colors } = theme;
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={{ gap: 6 }}>
      <Text variant="overline" color="textMuted">
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          minHeight: 52,
          paddingHorizontal: 14,
          borderRadius: theme.radius.md,
          borderWidth: 1.5,
          borderColor,
          backgroundColor: colors.surface,
        }}
      >
        {icon ? <Icon name={icon} size={20} color={focused ? colors.primary : colors.textMuted} /> : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.textSubtle}
          selectionColor={colors.primary}
          {...props}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            mono ? theme.typography.mono : theme.typography.body,
            { flex: 1, color: colors.text, paddingVertical: 12 },
            mono && { fontSize: 16, letterSpacing: 1.2 },
            style,
          ]}
        />
      </View>
      {error ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="textMuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

type FormTextFieldProps<T extends FieldValues> = Omit<TextFieldProps, 'value' | 'onChangeText' | 'error'> & {
  control: Control<T>;
  name: FieldPath<T>;
  transform?: (text: string) => string;
};

/** react-hook-form binding: validation messages come from the Zod schema. */
export function FormTextField<T extends FieldValues>({ control, name, transform, ...props }: FormTextFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          {...props}
          value={field.value === undefined || field.value === null ? '' : String(field.value)}
          onChangeText={(text) => field.onChange(transform ? transform(text) : text)}
          onBlur={field.onBlur}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}
