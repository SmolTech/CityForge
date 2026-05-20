import { cacheManager } from "./cacheManager";
import { apiClient } from "../api/client";
import type { CommunityCalendarEvent } from "../types/api";

const CACHE_TTL = 6 * 60 * 60 * 1000;
const CACHE_PREFIX = "community-calendar:";

function cacheKey(instanceId: string): string {
  return `${CACHE_PREFIX}${instanceId}`;
}

export async function cacheCommunityCalendar(
  instanceId: string,
  events: CommunityCalendarEvent[]
): Promise<void> {
  await cacheManager.set(cacheKey(instanceId), events, CACHE_TTL);
}

export async function getCachedCommunityCalendar(
  instanceId: string
): Promise<CommunityCalendarEvent[] | null> {
  return cacheManager.get<CommunityCalendarEvent[]>(cacheKey(instanceId));
}

export async function loadCommunityCalendar(
  instanceId: string
): Promise<CommunityCalendarEvent[]> {
  const cached = await getCachedCommunityCalendar(instanceId);
  if (cached) {
    return cached;
  }

  const events = await apiClient.getCalendarEvents();
  await cacheCommunityCalendar(instanceId, events);
  return events;
}

export async function refreshCommunityCalendar(
  instanceId: string
): Promise<CommunityCalendarEvent[]> {
  const events = await apiClient.getCalendarEvents();
  await cacheCommunityCalendar(instanceId, events);
  return events;
}
