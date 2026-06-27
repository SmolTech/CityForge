import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Contacts from "expo-contacts";
import type { CreateContactRecord } from "expo-contacts";
import type { Card } from "../types/api";
import { logger } from "./logger";
import {
  loadBusinessDirectory,
  refreshBusinessDirectory,
} from "./businessDirectoryCache";

export interface BusinessContactSyncResult {
  total: number;
  created: number;
  updated: number;
  skipped: boolean;
}

interface SyncState {
  enabled: boolean;
  fingerprint: string | null;
  contactIdsByBusinessId: Record<string, string>;
}

const STORAGE_PREFIX = "@CityForge:business-contact-sync:";

function syncKey(instanceId: string): string {
  return `${STORAGE_PREFIX}${instanceId}`;
}

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function buildFingerprint(cards: Card[]): string {
  const fields = cards
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((card) =>
      [
        card.id,
        card.updated_date,
        card.name,
        card.description || "",
        card.phone || "",
        card.email || "",
        card.website || "",
        card.address || "",
        card.address_override_url || "",
        card.tags.map((tag) => tag.name).sort().join(","),
      ].join("|")
    )
    .join("||");

  let hash = 0x811c9dc5;
  for (let index = 0; index < fields.length; index += 1) {
    hash ^= fields.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash.toString(16);
}

function buildContact(card: Card): CreateContactRecord {
  const urlAddresses: { label: string; url: string }[] = [];
  const record: CreateContactRecord = {
    company: card.name,
  };

  if (card.website) {
    urlAddresses.push({ label: "website", url: normalizeUrl(card.website) });
  }

  if (card.address_override_url) {
    urlAddresses.push({ label: "map", url: normalizeUrl(card.address_override_url) });
  }

  if (card.phone) {
    record.phones = [{ label: "work", number: card.phone }];
  }
  if (card.email) {
    record.emails = [{ label: "work", address: card.email }];
  }
  if (card.address) {
    record.addresses = [{ label: "work", street: card.address }];
  }
  if (urlAddresses.length > 0) {
    record.urlAddresses = urlAddresses;
  }

  return record;
}

async function loadState(instanceId: string): Promise<SyncState> {
  const raw = await AsyncStorage.getItem(syncKey(instanceId));
  if (!raw) {
    return {
      enabled: false,
      fingerprint: null,
      contactIdsByBusinessId: {},
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SyncState>;
    return {
      enabled: parsed.enabled ?? false,
      fingerprint: parsed.fingerprint ?? null,
      contactIdsByBusinessId: parsed.contactIdsByBusinessId ?? {},
    };
  } catch {
    return {
      enabled: false,
      fingerprint: null,
      contactIdsByBusinessId: {},
    };
  }
}

async function saveState(instanceId: string, state: SyncState): Promise<void> {
  await AsyncStorage.setItem(syncKey(instanceId), JSON.stringify(state));
}

async function checkContactsPermission(prompt: boolean): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }

  const available = await Contacts.isAvailableAsync();
  if (!available) {
    return false;
  }

  const current = await Contacts.getPermissionsAsync();
  if (current.granted) {
    return true;
  }

  if (!prompt) {
    return false;
  }

  const request = await Contacts.requestPermissionsAsync();
  return request.granted;
}

export async function getBusinessContactSyncEnabled(
  instanceId: string
): Promise<boolean> {
  return (await loadState(instanceId)).enabled;
}

export async function setBusinessContactSyncEnabled(
  instanceId: string,
  enabled: boolean
): Promise<void> {
  const state = await loadState(instanceId);
  await saveState(instanceId, { ...state, enabled });
}

export async function exportBusinessesToContacts(
  instanceId: string
): Promise<BusinessContactSyncResult> {
  const granted = await checkContactsPermission(true);
  if (!granted) {
    throw new Error("Contacts permission is required to export businesses.");
  }

  await setBusinessContactSyncEnabled(instanceId, true);
  return syncBusinessesToContacts(instanceId, { force: true, refresh: true });
}

export async function syncBusinessesToContacts(
  instanceId: string,
  options: { force?: boolean; refresh?: boolean } = {}
): Promise<BusinessContactSyncResult> {
  const state = await loadState(instanceId);
  if (!state.enabled && !options.force) {
    return { total: 0, created: 0, updated: 0, skipped: true };
  }

  const granted = await checkContactsPermission(false);
  if (!granted) {
    return { total: 0, created: 0, updated: 0, skipped: true };
  }

  const businesses = options.refresh
    ? await refreshBusinessDirectory(instanceId)
    : await loadBusinessDirectory(instanceId);
  const fingerprint = buildFingerprint(businesses);

  if (!options.force && state.fingerprint === fingerprint) {
    return {
      total: businesses.length,
      created: 0,
      updated: 0,
      skipped: true,
    };
  }

  let created = 0;
  let updated = 0;
  const contactIdsByBusinessId = { ...state.contactIdsByBusinessId };

  for (const card of businesses) {
    const contact = buildContact(card);
    const businessId = String(card.id);
    const knownContactId = contactIdsByBusinessId[businessId];

    if (knownContactId) {
      try {
        const existing = new Contacts.Contact(knownContactId);
        await existing.update(contact);
        updated += 1;
        continue;
      } catch (error) {
        logger.warn(`Updating contact failed for business ${card.id}:`, error);
      }
    }

    try {
      const newContact = await Contacts.Contact.create(contact);
      contactIdsByBusinessId[businessId] = newContact.id;
      created += 1;
    } catch (error) {
      logger.error(`Creating contact failed for business ${card.id}:`, error);
      throw error;
    }
  }

  await saveState(instanceId, {
    enabled: true,
    fingerprint,
    contactIdsByBusinessId,
  });

  logger.info(
    `Synced ${businesses.length} business contacts (${created} created, ${updated} updated)`
  );

  return {
    total: businesses.length,
    created,
    updated,
    skipped: false,
  };
}
