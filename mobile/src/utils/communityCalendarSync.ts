import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Calendar from "expo-calendar";
import type { CommunityCalendarEvent } from "../types/api";
import { logger } from "./logger";
import {
  loadCommunityCalendar,
  refreshCommunityCalendar,
} from "./calendarEventCache";

export interface CommunityCalendarSyncResult {
  total: number;
  created: number;
  updated: number;
  deleted: number;
  skipped: boolean;
}

interface SyncState {
  enabled: boolean;
  fingerprint: string | null;
  calendarId: string | null;
  eventIdsByEventId: Record<string, string>;
}

const STORAGE_PREFIX = "@CityForge:community-calendar-sync:";

function syncKey(instanceId: string): string {
  return `${STORAGE_PREFIX}${instanceId}`;
}

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function buildFingerprint(events: CommunityCalendarEvent[]): string {
  const payload = events
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((event) =>
      [
        event.id,
        event.updated_date,
        event.title,
        event.description || "",
        event.location || "",
        event.start_at,
        event.end_at || "",
        event.url || "",
        event.all_day ? "1" : "0",
      ].join("|")
    )
    .join("||");

  let hash = 0x811c9dc5;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash.toString(16);
}

function buildEvent(
  event: CommunityCalendarEvent
): Partial<Calendar.ExpoCalendarEvent> {
  const startDate = new Date(event.start_at);
  const endDate = new Date(event.end_at || event.start_at);
  return {
    title: event.title,
    notes: event.description || "",
    location: event.location || undefined,
    startDate,
    endDate,
    url: event.url ? normalizeUrl(event.url) : undefined,
    allDay: event.all_day,
  };
}

async function loadState(instanceId: string): Promise<SyncState> {
  const raw = await AsyncStorage.getItem(syncKey(instanceId));
  if (!raw) {
    return {
      enabled: false,
      fingerprint: null,
      calendarId: null,
      eventIdsByEventId: {},
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SyncState>;
    return {
      enabled: parsed.enabled ?? false,
      fingerprint: parsed.fingerprint ?? null,
      calendarId: parsed.calendarId ?? null,
      eventIdsByEventId: parsed.eventIdsByEventId ?? {},
    };
  } catch {
    return {
      enabled: false,
      fingerprint: null,
      calendarId: null,
      eventIdsByEventId: {},
    };
  }
}

async function saveState(instanceId: string, state: SyncState): Promise<void> {
  await AsyncStorage.setItem(syncKey(instanceId), JSON.stringify(state));
}

async function checkCalendarPermission(prompt: boolean): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }

  const current = await Calendar.getCalendarPermissions();
  if (current.granted) {
    return true;
  }

  if (!prompt) {
    return false;
  }

  const request = await Calendar.requestCalendarPermissions();
  return request.granted;
}

function getCalendarSource(): Calendar.Source {
  if (Platform.OS === "ios") {
    return Calendar.getDefaultCalendarSync().source;
  }

  return {
    isLocalAccount: true,
    name: "CityForge",
    type: Calendar.SourceType.LOCAL,
  };
}

async function ensureCalendar(instanceId: string, calendarId: string | null): Promise<string> {
  const desiredTitle = `CityForge Community Calendar ${instanceId.slice(0, 8)}`;
  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  const existing =
    (calendarId ? calendars.find((calendar) => calendar.id === calendarId) : undefined) ??
    calendars.find((calendar) => calendar.title === desiredTitle);
  if (existing) {
    return existing.id;
  }

  const source = getCalendarSource();
  const calendar = await Calendar.createCalendar(
    Platform.OS === "ios"
      ? {
          title: desiredTitle,
          name: desiredTitle,
          color: "#3b82f6",
          entityType: Calendar.EntityTypes.EVENT,
          sourceId: source.id,
          source,
          ownerAccount: "personal",
          accessLevel: Calendar.CalendarAccessLevel.OWNER,
        }
      : {
          title: desiredTitle,
          name: desiredTitle,
          color: "#3b82f6",
          entityType: Calendar.EntityTypes.EVENT,
          source,
          ownerAccount: "personal",
          accessLevel: Calendar.CalendarAccessLevel.OWNER,
          isSynced: true,
          isVisible: true,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }
  );
  return calendar.id;
}

export async function getCommunityCalendarSyncEnabled(
  instanceId: string
): Promise<boolean> {
  return (await loadState(instanceId)).enabled;
}

export async function exportCommunityCalendar(
  instanceId: string
): Promise<CommunityCalendarSyncResult> {
  const granted = await checkCalendarPermission(true);
  if (!granted) {
    throw new Error("Calendar permission is required to sync events.");
  }

  return syncCommunityCalendar(instanceId, { force: true, refresh: true, enable: true });
}

export async function syncCommunityCalendar(
  instanceId: string,
  options: { force?: boolean; refresh?: boolean; enable?: boolean } = {}
): Promise<CommunityCalendarSyncResult> {
  const state = await loadState(instanceId);
  const enabled = options.enable ?? state.enabled;
  if (!enabled && !options.force) {
    return { total: 0, created: 0, updated: 0, deleted: 0, skipped: true };
  }

  const granted = await checkCalendarPermission(false);
  if (!granted) {
    return { total: 0, created: 0, updated: 0, deleted: 0, skipped: true };
  }

  const events = options.refresh
    ? await refreshCommunityCalendar(instanceId)
    : await loadCommunityCalendar(instanceId);
  const fingerprint = buildFingerprint(events);

  if (!options.force && state.fingerprint === fingerprint) {
    return {
      total: events.length,
      created: 0,
      updated: 0,
      deleted: 0,
      skipped: true,
    };
  }

  const calendarId = await ensureCalendar(instanceId, state.calendarId);
  const calendar = await Calendar.ExpoCalendar.get(calendarId);
  const currentEventIds = new Set<string>();
  let created = 0;
  let updated = 0;
  let deleted = 0;
  const eventIdsByEventId = { ...state.eventIdsByEventId };

  for (const event of events) {
    const eventId = String(event.id);
    currentEventIds.add(eventId);
    const calendarEventId = eventIdsByEventId[eventId];
    const details = buildEvent(event);

    if (calendarEventId) {
      try {
        const existing = new Calendar.ExpoCalendarEvent(calendarEventId);
        await existing.update(details);
        updated += 1;
        continue;
      } catch (error) {
        logger.warn(`Updating calendar event failed for event ${event.id}:`, error);
        delete eventIdsByEventId[eventId];
      }
    }

    try {
      const newEvent = await calendar.createEvent(details);
      eventIdsByEventId[eventId] = newEvent.id;
      created += 1;
    } catch (error) {
      logger.error(`Creating calendar event failed for event ${event.id}:`, error);
      throw error;
    }
  }

  for (const [eventId, calendarEventId] of Object.entries(state.eventIdsByEventId)) {
    if (currentEventIds.has(eventId)) {
      continue;
    }

    try {
      const staleEvent = new Calendar.ExpoCalendarEvent(calendarEventId);
      await staleEvent.delete();
      deleted += 1;
      delete eventIdsByEventId[eventId];
    } catch (error) {
      logger.warn(`Deleting stale calendar event failed for event ${eventId}:`, error);
    }
  }

  await saveState(instanceId, {
    enabled: true,
    fingerprint,
    calendarId,
    eventIdsByEventId,
  });

  logger.info(
    `Synced ${events.length} community events (${created} created, ${updated} updated, ${deleted} deleted)`
  );

  return {
    total: events.length,
    created,
    updated,
    deleted,
    skipped: false,
  };
}
