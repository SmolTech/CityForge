import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/errors";
import { requireAuth } from "@/lib/auth/middleware";
import { webhookService } from "@/lib/webhooks";
import { WebhookEndpoint } from "@/lib/webhooks/types";

export const GET = withErrorHandler(async (request: NextRequest) => {
  const user = await requireAuth(request);

  if (user.role !== "admin") {
    return NextResponse.json(
      { error: { message: "Admin access required" } },
      { status: 403 }
    );
  }

  const endpoints = webhookService.getEndpoints();

  return NextResponse.json({
    endpoints: endpoints.map((endpoint) => ({
      ...endpoint,
      secret: endpoint.secret ? "***" : undefined, // Hide secrets in responses
    })),
  });
}, "GET /api/admin/webhooks");

export const POST = withErrorHandler(async (request: NextRequest) => {
  const user = await requireAuth(request);

  if (user.role !== "admin") {
    return NextResponse.json(
      { error: { message: "Admin access required" } },
      { status: 403 }
    );
  }

  const body = await request.json();

  const endpoint: Omit<WebhookEndpoint, "id" | "created_at" | "updated_at"> = {
    name: body.name,
    url: body.url,
    secret: body.secret,
    enabled: body.enabled ?? true,
    events: body.events || [],
    headers: body.headers || {},
    retryPolicy: body.retryPolicy || {
      maxRetries: 3,
      retryDelaySeconds: 5,
      exponentialBackoff: true,
    },
    timeoutSeconds: body.timeoutSeconds || 30,
  };

  // Validate required fields
  if (!endpoint.name || !endpoint.url || !Array.isArray(endpoint.events)) {
    return NextResponse.json(
      { error: { message: "Name, URL, and events array are required" } },
      { status: 400 }
    );
  }

  // Validate URL format
  try {
    new URL(endpoint.url);
  } catch {
    return NextResponse.json(
      { error: { message: "Invalid URL format" } },
      { status: 400 }
    );
  }

  const newEndpoint = await webhookService.addEndpoint(endpoint);

  return NextResponse.json(
    {
      endpoint: {
        ...newEndpoint,
        secret: newEndpoint.secret ? "***" : undefined,
      },
    },
    { status: 201 }
  );
}, "POST /api/admin/webhooks");
