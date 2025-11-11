import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import type { Instance } from "../types/instance";
import {
  loadInstances,
  saveInstances,
  getActiveInstanceId,
  setActiveInstanceId,
  addInstance as addInstanceToStorage,
  removeInstance as removeInstanceFromStorage,
  updateInstanceToken,
  updateInstanceUser,
} from "../utils/instanceStorage";

interface InstanceContextType {
  instances: Instance[];
  activeInstance: Instance | null;
  isLoading: boolean;
  addInstance: (
    instance: Omit<Instance, "createdAt" | "lastActive">
  ) => Promise<void>;
  removeInstance: (instanceId: string) => Promise<void>;
  switchInstance: (instanceId: string) => Promise<void>;
  updateToken: (instanceId: string, token: string | null) => Promise<void>;
  updateUser: (instanceId: string, user: Instance["user"]) => Promise<void>;
  refreshInstances: () => Promise<void>;
}

const InstanceContext = createContext<InstanceContextType | undefined>(
  undefined
);

export function useInstance() {
  const context = useContext(InstanceContext);
  if (!context) {
    throw new Error("useInstance must be used within an InstanceProvider");
  }
  return context;
}

interface InstanceProviderProps {
  children: ReactNode;
}

export function InstanceProvider({ children }: InstanceProviderProps) {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [activeInstanceId, setActiveInstanceIdState] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);

  const activeInstance =
    instances.find((i) => i.id === activeInstanceId) || null;

  // Load instances on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      setIsLoading(true);
      const [loadedInstances, activeId] = await Promise.all([
        loadInstances(),
        getActiveInstanceId(),
      ]);

      setInstances(loadedInstances);
      setActiveInstanceIdState(activeId);

      // If no active instance but instances exist, set first as active
      if (!activeId && loadedInstances.length > 0) {
        await switchInstance(loadedInstances[0].id);
      }
    } catch (error) {
      console.error("Error loading instance data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshInstances() {
    try {
      const loadedInstances = await loadInstances();
      setInstances(loadedInstances);
    } catch (error) {
      console.error("Error refreshing instances:", error);
    }
  }

  async function addInstance(
    instance: Omit<Instance, "createdAt" | "lastActive">
  ) {
    const now = Date.now();
    const newInstance: Instance = {
      ...instance,
      createdAt: now,
      lastActive: now,
    };

    await addInstanceToStorage(newInstance);
    await refreshInstances();

    // If this is the first instance, make it active
    if (instances.length === 0) {
      await switchInstance(newInstance.id);
    }
  }

  async function removeInstance(instanceId: string) {
    await removeInstanceFromStorage(instanceId);
    await refreshInstances();

    // If removed instance was active, switch to another or clear
    if (activeInstanceId === instanceId) {
      const remaining = instances.filter((i) => i.id !== instanceId);
      if (remaining.length > 0) {
        await switchInstance(remaining[0].id);
      } else {
        setActiveInstanceIdState(null);
      }
    }
  }

  async function switchInstance(instanceId: string) {
    await setActiveInstanceId(instanceId);
    setActiveInstanceIdState(instanceId);

    // Update lastActive timestamp
    const instance = instances.find((i) => i.id === instanceId);
    if (instance) {
      instance.lastActive = Date.now();
      await saveInstances(instances);
    }
  }

  async function updateToken(instanceId: string, token: string | null) {
    await updateInstanceToken(instanceId, token);
    await refreshInstances();
  }

  async function updateUser(instanceId: string, user: Instance["user"]) {
    await updateInstanceUser(instanceId, user);
    await refreshInstances();
  }

  const value: InstanceContextType = {
    instances,
    activeInstance,
    isLoading,
    addInstance,
    removeInstance,
    switchInstance,
    updateToken,
    updateUser,
    refreshInstances,
  };

  return (
    <InstanceContext.Provider value={value}>
      {children}
    </InstanceContext.Provider>
  );
}
