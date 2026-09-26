import { zodResolver } from '@hookform/resolvers/zod';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Vin } from '@/domain/vehicle/vin';
import { VEHICLE_MODEL_KEYS, VehicleModelKey, VehicleModels } from '@/domain/vehicle/vehicle-model';

import { Badge, Button, Card, Chip, FormTextField, Icon, IconButton, Screen, SegmentedControl, Text, useTheme } from '../../design-system';
import { useFeedback } from '../../hooks/use-feedback';
import { useI18n } from '../../hooks/use-i18n';
import type { TranslationKey } from '../../i18n';
import { useHaptics, useServices } from '../../providers/services';
import { useCurrentUser } from '../../state/session-store';
import { extractVin, isVinShaped, purchaseYears, ScanValues, scanSchema } from './scan-form';

type Mode = 'camera' | 'manual';

function DecodeCard({ vin }: { vin: Vin }) {
  const { t } = useI18n();
  const country = vin.assemblyCountry();
  const year = vin.modelYear(new Date().getFullYear());
  return (
    <Animated.View entering={FadeIn.duration(240)}>
      <Card variant="filled" testID="vin-decode">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Badge label={vin.isFord() ? t('scan.decode.ford') : t('scan.decode.notFord')} tone={vin.isFord() ? 'success' : 'danger'} icon={vin.isFord() ? 'check' : 'alert'} />
          {country ? <Badge label={t('scan.decode.country', { country: t(`countries.${country}` as TranslationKey) })} tone="primary" icon="globe" /> : null}
          {year ? <Badge label={t('scan.decode.year', { year })} tone="neutral" icon="calendar" /> : null}
          <Badge
            label={vin.hasValidCheckDigit() ? t('scan.decode.checkDigit') : t('scan.decode.noCheckDigit')}
            tone={vin.hasValidCheckDigit() ? 'success' : 'warning'}
            icon={vin.hasValidCheckDigit() ? 'shield' : 'info'}
          />
        </View>
      </Card>
    </Animated.View>
  );
}

function Scanner({ onVin }: { onVin: (vin: string) => void }) {
  const theme = useTheme();
  const { t } = useI18n();
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);

  if (!permission?.granted) {
    return (
      <Card testID="camera-permission">
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 12 }}>
          <Icon name="camera" size={36} color={theme.colors.primary} />
          <Text variant="title3">{t('scan.permissionTitle')}</Text>
          <Text variant="body" color="textMuted" align="center">
            {t('scan.permissionBody')}
          </Text>
          <Button label={t('scan.allow')} icon="camera" onPress={() => void requestPermission()} testID="allow-camera" />
        </View>
      </Card>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ height: 300, borderRadius: theme.radius.xl, overflow: 'hidden', backgroundColor: theme.colors.brand }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['code39', 'code128', 'datamatrix', 'qr', 'pdf417'] }}
          onBarcodeScanned={({ data }) => {
            const vin = extractVin(data);
            if (handled.current || !isVinShaped(vin)) return;
            handled.current = true;
            onVin(vin);
          }}
        />
        <View pointerEvents="none" style={{ ...absoluteFill, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: '82%', height: 84, borderRadius: 16, borderWidth: 3, borderColor: theme.colors.accent }} />
        </View>
      </View>
      <Text variant="callout" color="textMuted" align="center">
        {t('scan.aim')}
      </Text>
    </View>
  );
}

const absoluteFill = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;

/** Adds a vehicle: camera reads the VIN barcode, or it is typed; the VIN is decoded live (ISO 3779). */
export function ScanScreen() {
  const i18n = useI18n();
  const { t } = i18n;
  const user = useCurrentUser();
  const { container } = useServices();
  const haptics = useHaptics();
  const feedback = useFeedback();
  const [mode, setMode] = useState<Mode>('camera');
  const currentYear = container.clock.now().getFullYear();
  const schema = scanSchema(t, currentYear);

  const { control, handleSubmit, setValue, formState } = useForm<ScanValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { vin: '', modelKey: 'ranger', mileage: '', purchaseYear: currentYear - 1, nickname: '' },
  });
  const vinValue = useWatch({ control, name: 'vin' });
  const decoded = isVinShaped(vinValue) ? Vin.create(vinValue) : null;

  const onScanned = (vin: string) => {
    haptics.success();
    setValue('vin', vin, { shouldValidate: true });
    setMode('manual');
  };

  const submit = handleSubmit(async (values) => {
    const result = await container.useCases.registerVehicle.execute(user, {
      vin: values.vin,
      modelKey: values.modelKey,
      mileageKm: Number(values.mileage),
      purchasedAt: new Date(values.purchaseYear, 0, 1),
      nickname: values.nickname || null,
    });
    if (result.isFail()) return feedback.error(result.error);
    feedback.success(t('scan.added', { name: result.value.displayName }));
    router.back();
  });

  return (
    <Screen testID="scan-screen">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconButton icon="close" label={t('common.close')} onPress={() => router.back()} testID="close-scan" />
        <Text variant="title1" accessibilityRole="header" style={{ flex: 1 }}>
          {t('scan.title')}
        </Text>
      </View>

      <SegmentedControl<Mode>
        testID="scan-mode"
        value={mode}
        onChange={setMode}
        segments={[
          { value: 'camera', label: t('scan.useCamera') },
          { value: 'manual', label: t('scan.manual') },
        ]}
      />

      {mode === 'camera' ? <Scanner onVin={onScanned} /> : null}

      <Animated.View entering={FadeInDown.duration(300)} style={{ gap: 16 }}>
        <FormTextField
          control={control}
          name="vin"
          label={t('scan.vin')}
          placeholder={t('scan.vinPlaceholder')}
          icon="keyboard"
          mono
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={17}
          transform={Vin.normalize}
          testID="vin-input"
        />
        {decoded?.isOk() ? <DecodeCard vin={decoded.value} /> : null}

        <View style={{ gap: 8 }}>
          <Text variant="overline" color="textMuted">
            {t('scan.model')}
          </Text>
          <Controller
            control={control}
            name="modelKey"
            render={({ field }) => (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 20 }} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
                {VEHICLE_MODEL_KEYS.map((key: VehicleModelKey) => (
                  <Chip key={key} label={VehicleModels.get(key).name} selected={field.value === key} onPress={() => field.onChange(key)} testID={`model-${key}`} />
                ))}
              </ScrollView>
            )}
          />
        </View>

        <FormTextField control={control} name="mileage" label={t('scan.mileage')} icon="gauge" keyboardType="number-pad" maxLength={7} transform={(text) => text.replace(/\D/g, '')} testID="mileage-input" />

        <View style={{ gap: 8 }}>
          <Text variant="overline" color="textMuted">
            {t('scan.purchased')}
          </Text>
          <Controller
            control={control}
            name="purchaseYear"
            render={({ field, fieldState }) => (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 20 }} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
                  {purchaseYears(currentYear).map((year) => (
                    <Chip key={year} label={String(year)} selected={field.value === year} onPress={() => field.onChange(year)} testID={`year-${year}`} />
                  ))}
                </ScrollView>
                {fieldState.error ? (
                  <Text variant="caption" color="danger">
                    {fieldState.error.message}
                  </Text>
                ) : null}
              </>
            )}
          />
        </View>

        <FormTextField control={control} name="nickname" label={t('scan.nickname')} icon="car" maxLength={24} testID="nickname-input" />

        <Button label={t('scan.register')} icon="plus" size="lg" fullWidth loading={formState.isSubmitting} disabled={!formState.isValid} onPress={submit} testID="register-vehicle" />
      </Animated.View>
    </Screen>
  );
}
