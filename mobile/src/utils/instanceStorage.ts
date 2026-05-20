import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { logger } from "./logger";
import type { Instance } from "../types/instance";

const INSTANCES_KEY = "cityforge_instances";
const ACTIVE_INSTANCE_KEY = "cityforge_active_instance";
const INSTANCE_TOKEN_PREFIX = "cityforge_token_";

/**
 * Load all instances from storage
 */
export async function loadInstances(): Promise<Instance[]> {
  try {
    const data = await AsyncStorage.getItem(INSTANCES_KEY);
    if (!data) {
      return [];
    }

    const instances: Instance[] = JSON.parse(data);

    // Load tokens from secure storage for each instance
    const instancesWithTokens = await Promise.all(
      instances.map(async (instance) => {
        const token = await SecureStore.getItemAsync(
          `${INSTANCE_TOKEN_PREFIX}${instance.id}`
        );
        return { ...instance, token };
      })
    );

    return instancesWithTokens;
  } catch (error) {
    logger.error("Error loading instances:", error);
    return [];
  }
}

/**
 * Save instances to storage
 */
export async function saveInstances(instances: Instance[]): Promise<void> {
  try {
    // Save instance data (without tokens) to AsyncStorage
    const instancesWithoutTokens = instances.map((instance) => ({
      ...instance,
      token: null, // Don't store tokens in AsyncStorage
    }));

    await AsyncStorage.setItem(
      INSTANCES_KEY,
      JSON.stringify(instancesWithoutTokens)
    );

    // Save tokens to secure storage
    await Promise.all(
      instances.map(async (instance) => {
        if (instance.token) {
          await SecureStore.setItemAsync(
            `${INSTANCE_TOKEN_PREFIX}${instance.id}`,
            instance.token
          );
        } else {
          // Remove token if null
          await SecureStore.deleteItemAsync(
            `${INSTANCE_TOKEN_PREFIX}${instance.id}`
          );
        }
      })
    );
  } catch (error) {
    logger.error("Error saving instances:", error);
    throw error;
  }
}

/**
 * Get active instance ID
 */
export async function getActiveInstanceId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ACTIVE_INSTANCE_KEY);
  } catch (error) {
    logger.error("Error getting active instance:", error);
    return null;
  }
}

/**
 * Set active instance ID
 */
export async function setActiveInstanceId(
  instanceId: string | null
): Promise<void> {
  try {
    if (instanceId) {
      await AsyncStorage.setItem(ACTIVE_INSTANCE_KEY, instanceId);
    } else {
      await AsyncStorage.removeItem(ACTIVE_INSTANCE_KEY);
    }
  } catch (error) {
    logger.error("Error setting active instance:", error);
    throw error;
  }
}

/**
 * Add a new instance
 */
export async function addInstance(instance: Instance): Promise<void> {
  const instances = await loadInstances();

  // Check if instance with same ID already exists
  const existingIndex = instances.findIndex((i) => i.id === instance.id);

  if (existingIndex >= 0) {
    // Update existing instance
    instances[existingIndex] = instance;
  } else {
    // Add new instance
    instances.push(instance);
  }

  await saveInstances(instances);
}

/**
 * Remove an instance
 */
export async function removeInstance(instanceId: string): Promise<void> {
  const instances = await loadInstances();
  const filteredInstances = instances.filter((i) => i.id !== instanceId);

  await saveInstances(filteredInstances);

  // If removed instance was active, clear active instance
  const activeId = await getActiveInstanceId();
  if (activeId === instanceId) {
    await setActiveInstanceId(null);
  }
}

/**
 * Update instance token
 */
export async function updateInstanceToken(
  instanceId: string,
  token: string | null
): Promise<void> {
  const instances = await loadInstances();
  const instance = instances.find((i) => i.id === instanceId);

  if (instance) {
    instance.token = token;
    instance.lastActive = Date.now();
    await saveInstances(instances);
  }
}

/**
 * Update instance user
 */
export async function updateInstanceUser(
  instanceId: string,
  user: Instance["user"]
): Promise<void> {
  const instances = await loadInstances();
  const instance = instances.find((i) => i.id === instanceId);

  if (instance) {
    instance.user = user;
    instance.lastActive = Date.now();
    await saveInstances(instances);
  }
}

/**
 * Clear all instances (for logout all)
 */
export async function clearAllInstances(): Promise<void> {
  const instances = await loadInstances();

  // Remove all tokens from secure storage
  await Promise.all(
    instances.map((instance) =>
      SecureStore.deleteItemAsync(`${INSTANCE_TOKEN_PREFIX}${instance.id}`)
    )
  );

  await AsyncStorage.removeItem(INSTANCES_KEY);
  await AsyncStorage.removeItem(ACTIVE_INSTANCE_KEY);
}
