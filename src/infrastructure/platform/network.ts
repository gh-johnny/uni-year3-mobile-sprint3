import * as Network from 'expo-network';

/** Feeds connectivity changes into the sync engine (offline → pause, back online → drain). */
export class NetworkMonitor {
  async isOnline(): Promise<boolean> {
    try {
      const state = await Network.getNetworkStateAsync();
      return NetworkMonitor.reachable(state);
    } catch {
      return true;
    }
  }

  subscribe(listener: (online: boolean) => void): () => void {
    const subscription = Network.addNetworkStateListener((state) => listener(NetworkMonitor.reachable(state)));
    return () => subscription.remove();
  }

  private static reachable(state: Network.NetworkState): boolean {
    return state.isConnected !== false && state.isInternetReachable !== false;
  }
}
