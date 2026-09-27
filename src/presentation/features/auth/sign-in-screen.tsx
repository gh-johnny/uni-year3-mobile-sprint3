import { zodResolver } from '@hookform/resolvers/zod';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RoleKey } from '@/domain/auth/role';

import { Avatar, Button, Circuit, CornerCut, FormTextField, Icon, IconName, PressableScale, Text, useTheme, Wordmark } from '../../design-system';
import { useFeedback } from '../../hooks/use-feedback';
import { useI18n } from '../../hooks/use-i18n';
import { useServices } from '../../providers/services';
import { useSession } from '../../state/session-store';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, signInSchema, SignInValues } from './sign-in-form';

function PersonaCard({ role, icon, title, hint, selected, onPress }: { role: RoleKey; icon: IconName; title: string; hint: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  const { colors } = theme;
  return (
    <PressableScale
      testID={`persona-${role}`}
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityState={{ selected }}
      haptic="select"
      onPress={onPress}
      style={{
        flex: 1,
        gap: 10,
        padding: 14,
        borderRadius: theme.radius.sm,
        borderTopRightRadius: 24,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primarySoft : colors.surface,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Icon name={icon} size={24} color={selected ? colors.onPrimarySoft : colors.textMuted} />
        <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: selected ? colors.primary : colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
          {selected ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} /> : null}
        </View>
      </View>
      <View style={{ gap: 2 }}>
        <Text variant="title3">{title}</Text>
        <Text variant="caption" color="textMuted" numberOfLines={2}>
          {hint}
        </Text>
      </View>
    </PressableScale>
  );
}

function UnlockPanel() {
  const { t } = useI18n();
  const { biometrics } = useServices();
  const { user, unlock, signedOut } = useSession();
  const feedback = useFeedback();

  const attempt = async () => {
    const ok = await biometrics.authenticate(t('auth.biometricPrompt'), t('common.cancel'));
    if (ok) unlock();
  };

  useEffect(() => {
    void attempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View entering={FadeInUp.springify().damping(18)} style={{ gap: 18, alignItems: 'center', paddingVertical: 12 }}>
      <Avatar initials={user?.name.split(' ').map((part) => part[0]).join('') ?? '?'} size={72} />
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Text variant="title2">{t('auth.unlockTitle', { name: user?.firstName ?? '' })}</Text>
        <Text variant="body" color="textMuted">
          {t('auth.unlockHint')}
        </Text>
      </View>
      <Button label={t('auth.unlock')} icon="fingerprint" size="lg" fullWidth onPress={attempt} testID="unlock" />
      <Button
        label={t('auth.usePassword')}
        variant="ghost"
        onPress={() => {
          signedOut();
          feedback.info(t('auth.usePassword'));
        }}
      />
    </Animated.View>
  );
}

function SignInForm() {
  const i18n = useI18n();
  const { t } = i18n;
  const { container } = useServices();
  const signedIn = useSession((state) => state.signedIn);
  const feedback = useFeedback();
  const [role, setRole] = useState<RoleKey>('owner');
  const schema = useMemo(() => signInSchema(t), [t]);
  const { control, handleSubmit, reset, formState } = useForm<SignInValues>({
    resolver: zodResolver(schema),
    defaultValues: DEMO_ACCOUNTS.owner,
    mode: 'onSubmit',
  });

  const choose = (next: RoleKey) => {
    setRole(next);
    reset(DEMO_ACCOUNTS[next]);
  };

  const submit = handleSubmit(async (values) => {
    const result = await container.useCases.signIn.execute(values);
    if (result.isFail()) return feedback.error(result.error);
    signedIn(result.value);
  });

  return (
    <View style={{ gap: 18 }}>
      <Text variant="callout" color="textMuted">
        {t('auth.persona')}
      </Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <PersonaCard role="owner" icon="car" title={t('auth.owner')} hint={t('auth.ownerHint')} selected={role === 'owner'} onPress={() => choose('owner')} />
        <PersonaCard role="advisor" icon="radar" title={t('auth.advisor')} hint={t('auth.advisorHint')} selected={role === 'advisor'} onPress={() => choose('advisor')} />
      </View>
      <FormTextField control={control} name="email" label={t('auth.email')} icon="mail" autoCapitalize="none" keyboardType="email-address" autoComplete="email" testID="email" />
      <FormTextField control={control} name="password" label={t('auth.password')} icon="lock" secureTextEntry autoComplete="password" testID="password" />
      <Button label={t('auth.signIn')} size="lg" trailingIcon="arrowUpRight" haptic="commit" loading={formState.isSubmitting} onPress={submit} fullWidth testID="sign-in" />
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="info" size={14} color={useTheme().colors.textMuted} />
        <Text variant="caption" color="textMuted" style={{ flexShrink: 1 }}>
          {t('auth.demoHint', { password: DEMO_PASSWORD })}
        </Text>
      </View>
    </View>
  );
}

export function SignInScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const locked = useSession((state) => state.locked);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: theme.colors.brand }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 24, paddingBottom: 24, gap: 20, overflow: 'hidden' }}>
          <Animated.View entering={FadeInDown.duration(500)}>
            <Wordmark size={24} inverse />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(120).duration(500)} style={{ gap: 12 }}>
            <Text variant="overline" style={{ color: theme.colors.onBrand, opacity: 0.65 }}>
              {t('auth.eyebrow')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text variant="hero" style={{ color: theme.colors.signal, fontSize: 36, lineHeight: 39, letterSpacing: -1.6, flex: 1 }}>
                {t('auth.headline')}
              </Text>
              <Circuit size={156} style={{ marginRight: -30 }} />
            </View>
            <Text variant="caption" style={{ color: theme.colors.onBrand, opacity: 0.75 }}>
              {t('common.tagline')}
            </Text>
          </Animated.View>
        </View>
        <Animated.View
          entering={FadeInUp.delay(200).springify().damping(20)}
          style={{
            flex: 1,
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: insets.bottom + 28,
            backgroundColor: theme.colors.background,
          }}
        >
          <CornerCut color={theme.colors.brand} size={30} />
          {locked ? <UnlockPanel /> : <SignInForm />}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
