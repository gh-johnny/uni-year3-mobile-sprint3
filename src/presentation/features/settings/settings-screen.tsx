import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import type { BiometricAvailability } from '@/infrastructure/platform/biometrics';

import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  Divider,
  ListItem,
  Screen,
  ScreenHeader,
  SectionHeader,
  SegmentedControl,
  Switch,
  Text,
} from '../../design-system';
import { useFeedback } from '../../hooks/use-feedback';
import { useI18n } from '../../hooks/use-i18n';
import type { LocalePreference } from '../../i18n';
import { useServices } from '../../providers/services';
import { ThemePreference, usePreferences } from '../../state/preferences-store';
import { useCurrentUser, useSession } from '../../state/session-store';

const initialsOf = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('');

/** Profile & settings, shared by both personas (owner: "account", advisor: "profile"). */
export function SettingsScreen() {
  const { t } = useI18n();
  const user = useCurrentUser();
  const { container, biometrics } = useServices();
  const feedback = useFeedback();
  const { theme, locale, haptics, biometricLock, setTheme, setLocale, setHaptics, setBiometricLock } = usePreferences();
  const [availability, setAvailability] = useState<BiometricAvailability | null>(null);
  const [dealerName, setDealerName] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  useEffect(() => {
    let active = true;
    void biometrics.availability().then((value) => active && setAvailability(value));
    if (user.dealerId) void container.useCases.repositories.dealers.findById(user.dealerId).then((dealer) => active && setDealerName(dealer?.name ?? null));
    return () => {
      active = false;
    };
  }, [biometrics, container, user.dealerId]);

  const toggleBiometric = async (enabled: boolean) => {
    if (enabled && !(await biometrics.authenticate(t('auth.biometricPrompt'), t('common.cancel')))) return;
    setBiometricLock(enabled);
  };

  const reset = async () => {
    setConfirmingReset(false);
    await container.resetDemoData();
    feedback.success(t('settings.resetDone'));
  };

  const signOut = async () => {
    await container.useCases.signOut.execute();
    useSession.getState().signedOut();
  };

  const role = user.role.key === 'advisor' ? t('settings.role.advisor', { dealer: dealerName ?? '' }) : t('settings.role.owner');

  return (
    <Screen withTabBar testID="settings-screen">
      <ScreenHeader eyebrow={role} title={t('settings.title')} />

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar initials={initialsOf(user.name)} size={56} />
          <View style={{ flex: 1 }}>
            <Text variant="title3" numberOfLines={1} testID="profile-name">
              {user.name}
            </Text>
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {user.email.value}
            </Text>
          </View>
        </View>
      </Card>

      <View style={{ gap: 12 }}>
        <SectionHeader title={t('settings.appearance')} />
        <Card>
          <View style={{ gap: 16 }}>
            <SegmentedControl<ThemePreference>
              testID="theme-control"
              value={theme}
              onChange={setTheme}
              segments={[
                { value: 'system', label: t('settings.theme.system') },
                { value: 'light', label: t('settings.theme.light') },
                { value: 'dark', label: t('settings.theme.dark') },
              ]}
            />
            <Divider />
            <View style={{ gap: 8 }}>
              <Text variant="callout">{t('settings.language')}</Text>
              <SegmentedControl<LocalePreference>
                testID="language-control"
                value={locale}
                onChange={setLocale}
                segments={[
                  { value: 'system', label: t('settings.languages.system') },
                  { value: 'en', label: t('settings.languages.en') },
                  { value: 'pt-BR', label: t('settings.languages.pt-BR') },
                ]}
              />
            </View>
          </View>
        </Card>
      </View>

      <Card>
        <ListItem
          title={t('settings.haptics')}
          subtitle={t('settings.hapticsHint')}
          icon="bolt"
          trailing={<Switch value={haptics} onValueChange={setHaptics} label={t('settings.haptics')} testID="haptics-switch" />}
        />
        <ListItem
          title={t('settings.biometricLock')}
          subtitle={availability === 'available' || availability === null ? t('settings.biometricHint') : t('settings.biometricUnavailable')}
          icon="fingerprint"
          trailing={
            <Switch
              value={biometricLock}
              onValueChange={toggleBiometric}
              label={t('settings.biometricLock')}
              disabled={availability !== 'available'}
              testID="biometric-switch"
            />
          }
        />
      </Card>

      <Card>
        <ListItem title={t('settings.sync')} icon="sync" chevron onPress={() => router.push('/sync')} testID="open-sync" />
        <ListItem title={t('settings.designSystem')} subtitle={t('settings.designSystemHint')} icon="palette" chevron onPress={() => router.push('/design-system')} testID="open-design-system" />
        <ListItem title={t('settings.reset')} icon="trendDown" iconTone="warning" onPress={() => setConfirmingReset(true)} testID="reset-demo" />
      </Card>

      <Button label={t('settings.signOut')} icon="logout" variant="outline" fullWidth onPress={signOut} testID="sign-out" />

      <View style={{ gap: 4 }}>
        <Text variant="caption" color="textSubtle" align="center">
          {t('settings.about', { version: Constants.expoConfig?.version ?? '1.0.0' })}
        </Text>
        <Text variant="caption" color="textSubtle" align="center">
          {t('settings.privacy')}
        </Text>
      </View>

      <ConfirmDialog
        visible={confirmingReset}
        title={t('settings.resetTitle')}
        message={t('settings.resetBody')}
        confirmLabel={t('settings.reset')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={reset}
        onCancel={() => setConfirmingReset(false)}
      />
    </Screen>
  );
}
