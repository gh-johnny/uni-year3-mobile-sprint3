import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricAvailability = 'available' | 'notEnrolled' | 'unsupported';

export class BiometricService {
  async availability(): Promise<BiometricAvailability> {
    try {
      if (!(await LocalAuthentication.hasHardwareAsync())) return 'unsupported';
      return (await LocalAuthentication.isEnrolledAsync()) ? 'available' : 'notEnrolled';
    } catch {
      return 'unsupported';
    }
  }

  async authenticate(prompt: string, cancelLabel: string): Promise<boolean> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: prompt,
        cancelLabel,
        disableDeviceFallback: false,
      });
      return result.success;
    } catch {
      return false;
    }
  }
}
