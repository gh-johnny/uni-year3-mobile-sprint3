import { useEffect } from 'react';
import { Modal, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInUp, SlideOutUp, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Toast, useToasts } from '../../state/toast-store';
import { IconName } from '../icons/glyphs';
import { Tone } from '../theme/theme';
import { useTheme } from '../theme/use-theme';
import { Button } from './button';
import { Icon } from './icon';
import { Text } from './text';

const TOAST_ICONS: Record<Tone, IconName> = {
  neutral: 'info',
  primary: 'info',
  accent: 'sparkle',
  success: 'check',
  warning: 'alert',
  danger: 'alert',
};

export const TOAST_DURATION_MS = 3200;

function ToastCard({ toast }: { toast: Toast }) {
  const theme = useTheme();
  const dismiss = useToasts((state) => state.dismiss);
  const tone = theme.tone(toast.tone);

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast.id, dismiss]);

  return (
    <Animated.View entering={SlideInUp.springify().damping(18)} exiting={SlideOutUp.duration(200)}>
      <Pressable
        accessibilityRole="alert"
        accessibilityLabel={toast.title}
        onPress={() => dismiss(toast.id)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 14,
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.surfaceRaised,
          borderWidth: 1,
          borderColor: theme.colors.border,
          shadowColor: theme.colors.shadow,
          shadowOpacity: 1,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 10 },
          elevation: 6,
        }}
      >
        <View style={{ width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: tone.soft }}>
          <Icon name={TOAST_ICONS[toast.tone]} size={18} color={tone.onSoft} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="callout">{toast.title}</Text>
          {toast.message ? (
            <Text variant="caption" color="textMuted">
              {toast.message}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Renders queued toasts on top of every screen. */
export function ToastHost() {
  const toasts = useToasts((state) => state.toasts);
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, gap: 8 }}>
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </View>
  );
}

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Native modal with design-system content — the replacement for `Alert.alert` confirms. */
export function ConfirmDialog({ visible, title, message, confirmLabel, cancelLabel, destructive, onConfirm, onCancel }: ConfirmDialogProps) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={{ flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'center', padding: 24 }}>
        <Pressable accessibilityLabel={cancelLabel} style={{ position: 'absolute', inset: 0 }} onPress={onCancel} />
        <Animated.View
          entering={ZoomIn.springify().damping(16)}
          accessibilityViewIsModal
          style={{ gap: 12, padding: 22, borderRadius: theme.radius.xl, backgroundColor: theme.colors.surfaceRaised }}
        >
          <Text variant="title2">{title}</Text>
          {message ? (
            <Text variant="body" color="textMuted">
              {message}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <Button label={cancelLabel} variant="outline" onPress={onCancel} style={{ flex: 1 }} />
            <Button label={confirmLabel} variant={destructive ? 'danger' : 'primary'} haptic="commit" onPress={onConfirm} style={{ flex: 1 }} />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
