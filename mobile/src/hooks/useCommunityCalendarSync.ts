import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useInstance } from "../contexts/InstanceContext";
import { networkManager } from "../utils/networkManager";
import {
  getCommunityCalendarSyncEnabled,
  syncCommunityCalendar,
} from "../utils/communityCalendarSync";
import { apiClient } from "../api/client";
import { logger } from "../utils/logger";

const SYNC_INTERVAL_MS = 15 * 60 * 1000;

export function useCommunityCalendarSync(): void {
  const { activeInstance, isLoading: instancesLoading } = useInstance();
  const syncInFlight = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (instancesLoading || !activeInstance?.id) {
      return;
    }

    apiClient.setBaseUrl(activeInstance.apiUrl);

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const runSync = async (reason: string) => {
      if (syncInFlight.current || networkManager.isOffline()) {
        return;
      }

      const enabled = await getCommunityCalendarSyncEnabled(activeInstance.id);
      if (!enabled) {
        return;
      }

      syncInFlight.current = true;
      try {
        await syncCommunityCalendar(activeInstance.id, { refresh: true });
        logger.debug(`Community calendar sync complete (${reason})`);
      } catch (error) {
        logger.error("Community calendar sync failed:", error);
      } finally {
        syncInFlight.current = false;
      }
    };

    const onAppStateChange = (nextState: AppStateStatus) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (
        (previousState === "background" || previousState === "inactive") &&
        nextState === "active"
      ) {
        void runSync("foreground");
      }
    };

    const subscription = AppState.addEventListener("change", onAppStateChange);
    void runSync("startup");
    intervalId = setInterval(() => {
      void runSync("interval");
    }, SYNC_INTERVAL_MS);

    return () => {
      subscription.remove();
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [activeInstance?.apiUrl, activeInstance?.id, instancesLoading]);
}
