import { cacheManager } from "./cacheManager";
import { apiClient } from "../api/client";
import type { Card } from "../types/api";

const CACHE_TTL = 24 * 60 * 60 * 1000;
const CACHE_PREFIX = "business-directory:";

function cacheKey(instanceId: string): string {
  return `${CACHE_PREFIX}${instanceId}`;
}

export async function cacheBusinessDirectory(
  instanceId: string,
  cards: Card[]
): Promise<void> {
  await cacheManager.set(cacheKey(instanceId), cards, CACHE_TTL);
}

export async function getCachedBusinessDirectory(
  instanceId: string
): Promise<Card[] | null> {
  return cacheManager.get<Card[]>(cacheKey(instanceId));
}

export async function loadBusinessDirectory(
  instanceId: string
): Promise<Card[]> {
  const cached = await getCachedBusinessDirectory(instanceId);
  if (cached) {
    return cached;
  }

  const response = await apiClient.getCards({ page: 1, per_page: 5000 });
  await cacheBusinessDirectory(instanceId, response.items);
  return response.items;
}

export async function refreshBusinessDirectory(
  instanceId: string
): Promise<Card[]> {
  const response = await apiClient.getCards({ page: 1, per_page: 5000 });
  await cacheBusinessDirectory(instanceId, response.items);
  return response.items;
}
