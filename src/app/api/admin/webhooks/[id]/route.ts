import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/errors";
import { requireAuth } from "@/lib/auth/middleware";
import { webhookService } from "@/lib/webhooks";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export const GET = withErrorHandler(
  async (request: NextRequest, { params }: RouteContext) => {
    const { id } = await params;
    const user = await requireAuth(request);

    if (user.role !== "admin") {
      return NextResponse.json(
        { error: { message: "Admin access required" } },
        { status: 403 }
      );
    }

    const endpoint = await webhookService.getEndpoint(id);

    if (!endpoint) {
      return NextResponse.json(
        { error: { message: "Webhook endpoint not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      endpoint: {
        ...endpoint,
        secret: endpoint.secret ? "***" : undefined,
      },
    });
  },
  "GET /api/admin/webhooks/[id]"
);

export const PUT = withErrorHandler(
  async (request: NextRequest, { params }: RouteContext) => {
    const { id } = await params;
    const user = await requireAuth(request);

    if (user.role !== "admin") {
      return NextResponse.json(
        { error: { message: "Admin access required" } },
        { status: 403 }
      );
    }

    const body = await request.json();

    const updates = {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.url !== undefined && { url: body.url }),
      ...(body.secret !== undefined && { secret: body.secret }),
      ...(body.enabled !== undefined && { enabled: body.enabled }),
      ...(body.events !== undefined && { events: body.events }),
      ...(body.headers !== undefined && { headers: body.headers }),
      ...(body.retryPolicy !== undefined && { retryPolicy: body.retryPolicy }),
      ...(body.timeoutSeconds !== undefined && {
        timeoutSeconds: body.timeoutSeconds,
      }),
    };

    // Validate URL if being updated
    if (updates.url) {
      try {
        new URL(updates.url);
      } catch {
        return NextResponse.json(
          { error: { message: "Invalid URL format" } },
          { status: 400 }
        );
      }
    }

    const endpoint = await webhookService.updateEndpoint(id, updates);

    if (!endpoint) {
      return NextResponse.json(
        { error: { message: "Webhook endpoint not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      endpoint: {
        ...endpoint,
        secret: endpoint.secret ? "***" : undefined,
      },
    });
  },
  "PUT /api/admin/webhooks/[id]"
);

export const DELETE = withErrorHandler(
  async (request: NextRequest, { params }: RouteContext) => {
    const { id } = await params;
    const user = await requireAuth(request);

    if (user.role !== "admin") {
      return NextResponse.json(
        { error: { message: "Admin access required" } },
        { status: 403 }
      );
    }

    const success = await webhookService.removeEndpoint(id);

    if (!success) {
      return NextResponse.json(
        { error: { message: "Webhook endpoint not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  },
  "DELETE /api/admin/webhooks/[id]"
);
