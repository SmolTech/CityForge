import { logger } from "../logger";
import { prisma } from "../db/client";
import crypto from "crypto";
import {
  WebhookEvent,
  WebhookEndpoint,
  WebhookDelivery,
  WebhookEventType,
} from "./types";

interface WebhookConfig {
  endpoints: WebhookEndpoint[];
  enabledGlobally: boolean;
  fallbackToEmail: boolean;
}

class WebhookService {
  private config: WebhookConfig;
  private deliveryQueue: Map<string, WebhookDelivery> = new Map();

  constructor() {
    this.config = this.loadConfig();
    this.startDeliveryWorker();
  }

  private loadConfig(): WebhookConfig {
    const envConfig = process.env["WEBHOOK_CONFIG"];
    if (envConfig) {
      try {
        return JSON.parse(envConfig);
      } catch (error) {
        logger.error("Failed to parse WEBHOOK_CONFIG environment variable", {
          error,
        });
      }
    }

    // Default configuration
    return {
      endpoints: [],
      enabledGlobally: process.env["WEBHOOKS_ENABLED"] === "true",
      fallbackToEmail: process.env["WEBHOOK_FALLBACK_TO_EMAIL"] !== "false",
    };
  }

  /**
   * Send webhook event to configured endpoints
   */
  async sendWebhookEvent(event: WebhookEvent): Promise<void> {
    if (!this.config.enabledGlobally) {
      logger.debug("Webhooks disabled globally, skipping event", {
        eventType: event.type,
      });
      return;
    }

    // Store event in database first
    try {
      await prisma.webhookEvent.create({
        data: {
          id: event.id,
          type: event.type,
          data: JSON.stringify(event.data),
          timestamp: new Date(event.timestamp),
          environment: event.environment,
          sourceInfo: JSON.stringify(event.source),
        },
      });
    } catch (error) {
      logger.error("Failed to store webhook event in database", {
        eventId: event.id,
        error,
      });
    }

    // Get relevant endpoints from database
    const relevantEndpoints = await prisma.webhookEndpoint.findMany({
      where: {
        enabled: true,
        events: {
          contains: event.type,
        },
      },
    });

    if (relevantEndpoints.length === 0) {
      logger.debug("No endpoints configured for event type", {
        eventType: event.type,
      });
      return;
    }

    // Queue delivery for each endpoint
    for (const endpoint of relevantEndpoints) {
      // Convert database model to service type
      const result: WebhookEndpoint = {
        id: endpoint.id,
        name: endpoint.name,
        url: endpoint.url,
        enabled: endpoint.enabled,
        events: JSON.parse(endpoint.events) as WebhookEventType[],
        timeoutSeconds: endpoint.timeoutSeconds,
        created_at: endpoint.createdAt.toISOString(),
        updated_at: endpoint.updatedAt.toISOString(),
      };

      if (endpoint.secret) result.secret = endpoint.secret;
      if (endpoint.headers) result.headers = JSON.parse(endpoint.headers);
      if (endpoint.retryPolicy)
        result.retryPolicy = JSON.parse(endpoint.retryPolicy);

      await this.queueDelivery(result, event);
    }
  }

  /**
   * Queue webhook delivery for later processing
   */
  private async queueDelivery(
    endpoint: WebhookEndpoint,
    event: WebhookEvent
  ): Promise<void> {
    const deliveryId = crypto.randomUUID();
    const maxRetries = endpoint.retryPolicy?.maxRetries ?? 3;

    try {
      // Store delivery in database
      await prisma.webhookDelivery.create({
        data: {
          id: deliveryId,
          webhookEndpointId: endpoint.id,
          eventId: event.id,
          eventType: event.type,
          status: "pending",
          attempt: 0,
          maxRetries,
        },
      });

      // Also add to in-memory queue for immediate processing
      const delivery: WebhookDelivery = {
        id: deliveryId,
        webhookEndpointId: endpoint.id,
        eventId: event.id,
        eventType: event.type,
        status: "pending",
        attempt: 0,
        maxRetries,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      this.deliveryQueue.set(delivery.id, delivery);
      logger.info("Webhook delivery queued", {
        deliveryId: delivery.id,
        endpointId: endpoint.id,
        eventType: event.type,
      });

      // Immediately try to deliver
      await this.attemptDelivery(delivery, endpoint, event);
    } catch (error) {
      logger.error("Failed to queue webhook delivery", {
        endpointId: endpoint.id,
        eventId: event.id,
        error,
      });
    }
  }

  /**
   * Attempt to deliver webhook to endpoint
   */
  private async attemptDelivery(
    delivery: WebhookDelivery,
    endpoint: WebhookEndpoint,
    event: WebhookEvent
  ): Promise<void> {
    delivery.attempt++;
    delivery.lastAttemptAt = new Date().toISOString();
    delivery.status = "retrying";

    // Update database with attempt info
    try {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          attempt: delivery.attempt,
          lastAttemptAt: new Date(delivery.lastAttemptAt),
          status: delivery.status,
        },
      });
    } catch (dbError) {
      logger.error("Failed to update delivery attempt in database", {
        deliveryId: delivery.id,
        error: dbError,
      });
    }

    try {
      const signature = this.generateSignature(
        JSON.stringify(event),
        endpoint.secret
      );
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": `CityForge-Webhooks/${event.source.version}`,
        "X-CityForge-Event": event.type,
        "X-CityForge-Delivery": delivery.id,
        "X-CityForge-Timestamp": event.timestamp,
        ...(signature && { "X-CityForge-Signature": signature }),
        ...(endpoint.headers || {}),
      };

      const response = await this.fetchWithTimeout(
        endpoint.url,
        {
          method: "POST",
          headers,
          body: JSON.stringify(event),
        },
        endpoint.timeoutSeconds * 1000
      );

      delivery.responseStatus = response.status;
      delivery.responseHeaders = Object.fromEntries(response.headers.entries());
      delivery.responseBody = await response.text();

      if (response.ok) {
        delivery.status = "delivered";
        delivery.updated_at = new Date().toISOString();

        // Update database with success
        try {
          await prisma.webhookDelivery.update({
            where: { id: delivery.id },
            data: {
              status: delivery.status,
              responseStatus: delivery.responseStatus,
              responseHeaders: JSON.stringify(delivery.responseHeaders),
              responseBody: delivery.responseBody,
            },
          });
        } catch (dbError) {
          logger.error("Failed to update delivery success in database", {
            deliveryId: delivery.id,
            error: dbError,
          });
        }

        logger.info("Webhook delivered successfully", {
          deliveryId: delivery.id,
          endpointId: endpoint.id,
          status: response.status,
        });
        this.deliveryQueue.delete(delivery.id);
      } else {
        throw new Error(`HTTP ${response.status}: ${delivery.responseBody}`);
      }
    } catch (error) {
      delivery.errorMessage =
        error instanceof Error ? error.message : String(error);
      delivery.updated_at = new Date().toISOString();

      // Update database with error
      try {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            errorMessage: delivery.errorMessage,
            ...(delivery.responseStatus && {
              responseStatus: delivery.responseStatus,
            }),
            ...(delivery.responseHeaders && {
              responseHeaders: JSON.stringify(delivery.responseHeaders),
            }),
            ...(delivery.responseBody && {
              responseBody: delivery.responseBody,
            }),
          },
        });
      } catch (dbError) {
        logger.error("Failed to update delivery error in database", {
          deliveryId: delivery.id,
          error: dbError,
        });
      }

      logger.error("Webhook delivery failed", {
        deliveryId: delivery.id,
        endpointId: endpoint.id,
        attempt: delivery.attempt,
        maxRetries: delivery.maxRetries,
        error: delivery.errorMessage,
      });

      if (delivery.attempt >= delivery.maxRetries) {
        delivery.status = "failed";

        // Update database with final failure
        try {
          await prisma.webhookDelivery.update({
            where: { id: delivery.id },
            data: {
              status: delivery.status,
            },
          });
        } catch (dbError) {
          logger.error("Failed to update delivery final failure in database", {
            deliveryId: delivery.id,
            error: dbError,
          });
        }

        this.deliveryQueue.delete(delivery.id);
        logger.error("Webhook delivery permanently failed after max retries", {
          deliveryId: delivery.id,
          endpointId: endpoint.id,
        });
      } else {
        // Schedule retry
        const delaySeconds = this.calculateRetryDelay(
          delivery.attempt,
          endpoint.retryPolicy
        );
        delivery.nextRetryAt = new Date(
          Date.now() + delaySeconds * 1000
        ).toISOString();
        delivery.status = "pending";

        // Update database with retry schedule
        try {
          await prisma.webhookDelivery.update({
            where: { id: delivery.id },
            data: {
              status: delivery.status,
              nextRetryAt: new Date(delivery.nextRetryAt),
            },
          });
        } catch (dbError) {
          logger.error("Failed to update delivery retry schedule in database", {
            deliveryId: delivery.id,
            error: dbError,
          });
        }

        logger.info("Webhook delivery retry scheduled", {
          deliveryId: delivery.id,
          nextRetryAt: delivery.nextRetryAt,
          delaySeconds,
        });
      }
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(
    attempt: number,
    retryPolicy: WebhookEndpoint["retryPolicy"]
  ): number {
    let delay = retryPolicy?.retryDelaySeconds ?? 30;

    if (retryPolicy?.exponentialBackoff) {
      // Exponential backoff: delay * (2 ^ (attempt - 1))
      delay = delay * Math.pow(2, attempt - 1);
    }

    // Cap at 5 minutes
    return Math.min(delay, 300);
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateSignature(payload: string, secret?: string): string | null {
    if (!secret) return null;

    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    return `sha256=${hmac.digest("hex")}`;
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Worker to process retry queue
   */
  private startDeliveryWorker(): void {
    setInterval(() => {
      const now = new Date().toISOString();

      for (const [deliveryId, delivery] of this.deliveryQueue.entries()) {
        if (
          delivery.status === "pending" &&
          delivery.nextRetryAt &&
          delivery.nextRetryAt <= now
        ) {
          // Find endpoint and event data (in real implementation, store in database)
          logger.info("Processing retry for webhook delivery", { deliveryId });
          // For now, just remove from queue - in production this would need database storage
          this.deliveryQueue.delete(deliveryId);
        }
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Add webhook endpoint
   */
  async addEndpoint(
    endpoint: Omit<WebhookEndpoint, "id" | "created_at" | "updated_at">
  ): Promise<WebhookEndpoint> {
    try {
      const newEndpoint = await prisma.webhookEndpoint.create({
        data: {
          name: endpoint.name,
          url: endpoint.url,
          secret: endpoint.secret ?? null,
          enabled: endpoint.enabled ?? true,
          events: JSON.stringify(endpoint.events),
          headers: endpoint.headers ? JSON.stringify(endpoint.headers) : null,
          retryPolicy: endpoint.retryPolicy
            ? JSON.stringify(endpoint.retryPolicy)
            : null,
          timeoutSeconds: endpoint.timeoutSeconds ?? 30,
        },
      });

      // Convert database model to service type
      const webhookEndpoint: WebhookEndpoint = {
        id: newEndpoint.id,
        name: newEndpoint.name,
        url: newEndpoint.url,
        enabled: newEndpoint.enabled,
        events: JSON.parse(newEndpoint.events) as WebhookEventType[],
        timeoutSeconds: newEndpoint.timeoutSeconds,
        created_at: newEndpoint.createdAt.toISOString(),
        updated_at: newEndpoint.updatedAt.toISOString(),
      };

      if (newEndpoint.secret) webhookEndpoint.secret = newEndpoint.secret;
      if (newEndpoint.headers)
        webhookEndpoint.headers = JSON.parse(newEndpoint.headers);
      if (newEndpoint.retryPolicy)
        webhookEndpoint.retryPolicy = JSON.parse(newEndpoint.retryPolicy);

      // Also add to in-memory config for compatibility during transition
      this.config.endpoints.push(webhookEndpoint);

      logger.info("Webhook endpoint added", {
        endpointId: webhookEndpoint.id,
        url: webhookEndpoint.url,
      });
      return webhookEndpoint;
    } catch (error) {
      logger.error("Failed to add webhook endpoint", { error });
      throw error;
    }
  }

  /**
   * Update webhook endpoint
   */
  async updateEndpoint(
    id: string,
    updates: Partial<WebhookEndpoint>
  ): Promise<WebhookEndpoint | null> {
    try {
      const updatedEndpoint = await prisma.webhookEndpoint.update({
        where: { id },
        data: {
          ...(updates.name && { name: updates.name }),
          ...(updates.url && { url: updates.url }),
          ...(updates.enabled !== undefined && { enabled: updates.enabled }),
          ...(updates.events && { events: JSON.stringify(updates.events) }),
          ...(updates.secret !== undefined && {
            secret: updates.secret || null,
          }),
          ...(updates.headers !== undefined && {
            headers: updates.headers ? JSON.stringify(updates.headers) : null,
          }),
          ...(updates.retryPolicy !== undefined && {
            retryPolicy: updates.retryPolicy
              ? JSON.stringify(updates.retryPolicy)
              : null,
          }),
          ...(updates.timeoutSeconds !== undefined && {
            timeoutSeconds: updates.timeoutSeconds,
          }),
        },
      });

      // Convert database model to service type
      const webhookEndpoint: WebhookEndpoint = {
        id: updatedEndpoint.id,
        name: updatedEndpoint.name,
        url: updatedEndpoint.url,
        enabled: updatedEndpoint.enabled,
        events: JSON.parse(updatedEndpoint.events) as WebhookEventType[],
        timeoutSeconds: updatedEndpoint.timeoutSeconds,
        created_at: updatedEndpoint.createdAt.toISOString(),
        updated_at: updatedEndpoint.updatedAt.toISOString(),
      };

      if (updatedEndpoint.secret)
        webhookEndpoint.secret = updatedEndpoint.secret;
      if (updatedEndpoint.headers)
        webhookEndpoint.headers = JSON.parse(updatedEndpoint.headers);
      if (updatedEndpoint.retryPolicy)
        webhookEndpoint.retryPolicy = JSON.parse(updatedEndpoint.retryPolicy);

      // Update in-memory config
      const endpointIndex = this.config.endpoints.findIndex((e) => e.id === id);
      if (endpointIndex >= 0) {
        this.config.endpoints[endpointIndex] = webhookEndpoint;
      }

      logger.info("Webhook endpoint updated", { endpointId: id });
      return webhookEndpoint;
    } catch (error) {
      logger.error("Failed to update webhook endpoint", {
        endpointId: id,
        error,
      });
      return null;
    }
  }

  /**
   * Remove webhook endpoint
   */
  async removeEndpoint(id: string): Promise<boolean> {
    try {
      await prisma.webhookEndpoint.delete({
        where: { id },
      });

      // Also remove from in-memory config
      this.config.endpoints = this.config.endpoints.filter((e) => e.id !== id);

      logger.info("Webhook endpoint removed", { endpointId: id });
      return true;
    } catch (error) {
      logger.error("Failed to remove webhook endpoint", {
        endpointId: id,
        error,
      });
      return false;
    }
  }

  /**
   * Get all endpoints
   */
  async getEndpoints(): Promise<WebhookEndpoint[]> {
    try {
      const endpoints = await prisma.webhookEndpoint.findMany({
        orderBy: { createdAt: "desc" },
      });

      const webhookEndpoints: WebhookEndpoint[] = endpoints.map((endpoint) => {
        const result: WebhookEndpoint = {
          id: endpoint.id,
          name: endpoint.name,
          url: endpoint.url,
          enabled: endpoint.enabled,
          events: JSON.parse(endpoint.events) as WebhookEventType[],
          timeoutSeconds: endpoint.timeoutSeconds,
          created_at: endpoint.createdAt.toISOString(),
          updated_at: endpoint.updatedAt.toISOString(),
        };

        if (endpoint.secret) result.secret = endpoint.secret;
        if (endpoint.headers) result.headers = JSON.parse(endpoint.headers);
        if (endpoint.retryPolicy)
          result.retryPolicy = JSON.parse(endpoint.retryPolicy);

        return result;
      });

      // Update in-memory cache
      this.config.endpoints = webhookEndpoints;

      return webhookEndpoints;
    } catch (error) {
      logger.error("Failed to load webhook endpoints from database", { error });
      // Fallback to in-memory config
      return [...this.config.endpoints];
    }
  }

  /**
   * Get endpoint by ID
   */
  async getEndpoint(id: string): Promise<WebhookEndpoint | null> {
    try {
      const endpoint = await prisma.webhookEndpoint.findUnique({
        where: { id },
      });

      if (!endpoint) return null;

      const result: WebhookEndpoint = {
        id: endpoint.id,
        name: endpoint.name,
        url: endpoint.url,
        enabled: endpoint.enabled,
        events: JSON.parse(endpoint.events) as WebhookEventType[],
        timeoutSeconds: endpoint.timeoutSeconds,
        created_at: endpoint.createdAt.toISOString(),
        updated_at: endpoint.updatedAt.toISOString(),
      };

      if (endpoint.secret) result.secret = endpoint.secret;
      if (endpoint.headers) result.headers = JSON.parse(endpoint.headers);
      if (endpoint.retryPolicy)
        result.retryPolicy = JSON.parse(endpoint.retryPolicy);

      return result;
    } catch (error) {
      logger.error("Failed to get webhook endpoint", { endpointId: id, error });
      return null;
    }
  }

  /**
   * Save configuration (in production, this would be database storage)
   */
  private async saveConfig(): Promise<void> {
    // For now, just log the config. In production, save to database
    logger.debug("Webhook configuration updated", {
      endpointCount: this.config.endpoints.length,
      globallyEnabled: this.config.enabledGlobally,
    });
  }

  /**
   * Create webhook event with standard metadata
   */
  createEvent<T extends WebhookEvent>(type: T["type"], data: T["data"]): T {
    return {
      id: crypto.randomUUID(),
      type,
      data,
      timestamp: new Date().toISOString(),
      environment: process.env["NODE_ENV"] || "development",
      source: {
        name: "CityForge",
        version: process.env["npm_package_version"] || "unknown",
      },
    } as T;
  }
}

// Singleton instance
export const webhookService = new WebhookService();

/**
 * Helper function to send webhook event
 */
export async function sendWebhookEvent(event: WebhookEvent): Promise<void> {
  return webhookService.sendWebhookEvent(event);
}

/**
 * Helper function to create and send webhook event
 */
export async function createAndSendWebhookEvent<T extends WebhookEvent>(
  type: T["type"],
  data: T["data"]
): Promise<void> {
  const event = webhookService.createEvent<T>(type, data);
  return webhookService.sendWebhookEvent(event);
}
