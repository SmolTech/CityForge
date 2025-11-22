import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { logger } from "./logger";

interface NetworkState {
  isConnected: boolean;
  type: string | null;
  isInternetReachable: boolean | null;
}

class NetworkManager {
  private listeners: ((state: NetworkState) => void)[] = [];
  private currentState: NetworkState = {
    isConnected: false,
    type: null,
    isInternetReachable: null,
  };

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      // Get initial network state
      const state = await NetInfo.fetch();
      this.updateState(state);

      // Listen for network changes
      NetInfo.addEventListener(this.handleNetworkChange);
    } catch (error) {
      logger.error("Error initializing network manager:", error);
    }
  }

  private handleNetworkChange = (state: NetInfoState) => {
    this.updateState(state);
  };

  private updateState(state: NetInfoState) {
    const newState: NetworkState = {
      isConnected: state.isConnected ?? false,
      type: state.type,
      isInternetReachable: state.isInternetReachable,
    };

    const wasConnected = this.currentState.isConnected;
    const isNowConnected = newState.isConnected;

    this.currentState = newState;

    // Log network changes
    if (wasConnected !== isNowConnected) {
      logger.info(
        `Network state changed: ${isNowConnected ? "Connected" : "Disconnected"}`
      );
    }

    // Notify listeners
    this.listeners.forEach((listener) => {
      try {
        listener(newState);
      } catch (error) {
        logger.error("Error in network listener:", error);
      }
    });
  }

  /**
   * Get current network state
   */
  getState(): NetworkState {
    return { ...this.currentState };
  }

  /**
   * Check if device is online
   */
  isOnline(): boolean {
    return (
      this.currentState.isConnected &&
      this.currentState.isInternetReachable !== false
    );
  }

  /**
   * Check if device is offline
   */
  isOffline(): boolean {
    return !this.isOnline();
  }

  /**
   * Add a listener for network state changes
   */
  addListener(listener: (state: NetworkState) => void): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Remove all listeners
   */
  removeAllListeners() {
    this.listeners = [];
  }

  /**
   * Get human-readable connection type
   */
  getConnectionType(): string {
    if (!this.currentState.isConnected) {
      return "No Connection";
    }

    switch (this.currentState.type) {
      case "wifi":
        return "Wi-Fi";
      case "cellular":
        return "Cellular";
      case "bluetooth":
        return "Bluetooth";
      case "ethernet":
        return "Ethernet";
      case "wimax":
        return "WiMAX";
      default:
        return "Unknown";
    }
  }

  /**
   * Wait for network to become available (with timeout)
   */
  async waitForConnection(timeout: number = 10000): Promise<boolean> {
    if (this.isOnline()) {
      return true;
    }

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        unsubscribe();
        resolve(false);
      }, timeout);

      const unsubscribe = this.addListener((state) => {
        if (state.isConnected && state.isInternetReachable !== false) {
          clearTimeout(timeoutId);
          unsubscribe();
          resolve(true);
        }
      });
    });
  }
}

export const networkManager = new NetworkManager();
