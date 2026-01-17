import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/errors";
import { requireAuth } from "@/lib/auth/middleware";
import { webhookService } from "@/lib/webhooks";

export const POST = withErrorHandler(async (request: NextRequest) => {
  const user = await requireAuth(request);

  if (user.role !== "admin") {
    return NextResponse.json(
      { error: { message: "Admin access required" } },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { eventType, testData } = body;

  if (!eventType) {
    return NextResponse.json(
      { error: { message: "eventType is required" } },
      { status: 400 }
    );
  }

  // Generate test webhook event
  const testEvent = webhookService.createEvent(
    eventType,
    testData || {
      test: true,
      message: "This is a test webhook event",
      triggeredBy: user.email,
      timestamp: new Date().toISOString(),
    }
  );

  try {
    await webhookService.sendWebhookEvent(testEvent);

    return NextResponse.json({
      success: true,
      eventId: testEvent.id,
      message: "Test webhook sent successfully",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          message: "Failed to send test webhook",
          details: error instanceof Error ? error.message : String(error),
        },
      },
      { status: 500 }
    );
  }
}, "POST /api/admin/webhooks/test");
