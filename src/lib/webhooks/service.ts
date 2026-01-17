import { logger } from "../logger";
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

    const relevantEndpoints = this.config.endpoints.filter(
      (endpoint) => endpoint.enabled && endpoint.events.includes(event.type)
    );

    if (relevantEndpoints.length === 0) {
      logger.debug("No endpoints configured for event type", {
        eventType: event.type,
      });
      return;
    }

    // Queue delivery for each endpoint
    for (const endpoint of relevantEndpoints) {
      await this.queueDelivery(endpoint, event);
    }
  }

  /**
   * Queue webhook delivery for later processing
   */
  private async queueDelivery(
    endpoint: WebhookEndpoint,
    event: WebhookEvent
  ): Promise<void> {
    const delivery: WebhookDelivery = {
      id: crypto.randomUUID(),
      webhookEndpointId: endpoint.id,
      eventId: event.id,
      eventType: event.type,
      status: "pending",
      attempt: 0,
      maxRetries: endpoint.retryPolicy.maxRetries,
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

      logger.error("Webhook delivery failed", {
        deliveryId: delivery.id,
        endpointId: endpoint.id,
        attempt: delivery.attempt,
        maxRetries: delivery.maxRetries,
        error: delivery.errorMessage,
      });

      if (delivery.attempt >= delivery.maxRetries) {
        delivery.status = "failed";
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
    let delay = retryPolicy.retryDelaySeconds;

    if (retryPolicy.exponentialBackoff) {
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
    const newEndpoint: WebhookEndpoint = {
      ...endpoint,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.config.endpoints.push(newEndpoint);
    await this.saveConfig();

    logger.info("Webhook endpoint added", {
      endpointId: newEndpoint.id,
      url: newEndpoint.url,
    });
    return newEndpoint;
  }

  /**
   * Update webhook endpoint
   */
  async updateEndpoint(
    id: string,
    updates: Partial<WebhookEndpoint>
  ): Promise<WebhookEndpoint | null> {
    const endpointIndex = this.config.endpoints.findIndex((e) => e.id === id);
    if (endpointIndex === -1) return null;

    this.config.endpoints[endpointIndex] = {
      ...this.config.endpoints[endpointIndex],
      ...updates,
      id, // Prevent ID changes
      updated_at: new Date().toISOString(),
    };

    await this.saveConfig();
    logger.info("Webhook endpoint updated", { endpointId: id });
    return this.config.endpoints[endpointIndex];
  }

  /**
   * Remove webhook endpoint
   */
  async removeEndpoint(id: string): Promise<boolean> {
    const initialLength = this.config.endpoints.length;
    this.config.endpoints = this.config.endpoints.filter((e) => e.id !== id);

    if (this.config.endpoints.length < initialLength) {
      await this.saveConfig();
      logger.info("Webhook endpoint removed", { endpointId: id });
      return true;
    }

    return false;
  }

  /**
   * Get all endpoints
   */
  getEndpoints(): WebhookEndpoint[] {
    return [...this.config.endpoints];
  }

  /**
   * Get endpoint by ID
   */
  getEndpoint(id: string): WebhookEndpoint | null {
    return this.config.endpoints.find((e) => e.id === id) || null;
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
