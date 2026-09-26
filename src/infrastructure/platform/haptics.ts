import * as Haptics from 'expo-haptics';

/**
 * Semantic haptic vocabulary. Screens say *what happened* (`success`, `select`)
 * and never pick raw vibration styles, so the feel stays consistent app-wide.
 */
export class HapticsService {
  private enabled = true;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Light tick for taps on buttons and cards. */
  tap(): void {
    this.fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  }

  /** Crisp selection click for pickers, chips, tabs and segmented controls. */
  select(): void {
    this.fire(() => Haptics.selectionAsync());
  }

  /** Heavier thud for committing an important action. */
  commit(): void {
    this.fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  }

  success(): void {
    this.fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  }

  warning(): void {
    this.fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  }

  error(): void {
    this.fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  }

  /** Signature "lub-dub" used on health rings and risk scores. */
  heartbeat(): void {
    this.fire(async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await new Promise((resolve) => setTimeout(resolve, 110));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    });
  }

  private fire(effect: () => Promise<void>): void {
    if (!this.enabled) return;
    effect().catch(() => undefined);
  }
}
