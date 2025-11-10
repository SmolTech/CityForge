import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { submissionQueries } from "@/lib/db/queries";
import { validateCardSubmission } from "@/lib/validation/submissions";
import { logger } from "@/lib/logger";

// Rate limiting storage (in-memory for now)
const rateLimitStore = new Map<number, { count: number; resetTime: number }>();

function checkRateLimit(userId: number, limitPerHour: number): boolean {
  const now = Date.now();
  const hourInMs = 60 * 60 * 1000;

  const userLimits = rateLimitStore.get(userId);

  // If no record exists or the hour has passed, reset
  if (!userLimits || now >= userLimits.resetTime) {
    rateLimitStore.set(userId, { count: 1, resetTime: now + hourInMs });
    return true;
  }

  // Check if under the limit
  if (userLimits.count >= limitPerHour) {
    return false;
  }

  // Increment count
  userLimits.count += 1;
  return true;
}

// POST /api/submissions - Create a new card submission
export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    // Rate limiting: 10 requests per hour per user
    if (!checkRateLimit(user.id, 10)) {
      return NextResponse.json(
        {
          error: {
            message: "Rate limit exceeded. Please try again later.",
            code: 429,
            details: {
              description: "10 per 1 hour",
            },
          },
        },
        { status: 429 }
      );
    }

    // Parse request body
    let data;
    try {
      data = await request.json();
    } catch {
      return NextResponse.json(
        {
          message: "No data provided",
        },
        { status: 400 }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          message: "No data provided",
        },
        { status: 400 }
      );
    }

    // Validate input data
    const validation = validateCardSubmission(data);
    if (!validation.isValid) {
      const errorMessages: Record<string, string[]> = {};
      validation.errors.forEach((error) => {
        if (!errorMessages[error.field]) {
          errorMessages[error.field] = [];
        }
        errorMessages[error.field]!.push(error.message);
      });

      return NextResponse.json(
        {
          message: "Validation failed",
          errors: errorMessages,
        },
        { status: 400 }
      );
    }

    // At this point, validation.data is guaranteed to exist
    if (!validation.data) {
      return NextResponse.json(
        {
          message: "Validation failed - no data",
        },
        { status: 400 }
      );
    }

    // Create submission in database
    const submissionData = {
      name: validation.data.name,
      description: validation.data.description || "",
      website_url: validation.data.websiteUrl || null,
      phone_number: validation.data.phoneNumber || null,
      email: validation.data.email || null,
      address: validation.data.address || null,
      address_override_url: validation.data.addressOverrideUrl || null,
      contact_name: validation.data.contactName || null,
      image_url: validation.data.imageUrl || null,
      tags_text: validation.data.tagsText || "",
      submitted_by: user.id,
    };

    const submission = await submissionQueries.createSubmission(submissionData);

    // Return the submission data directly (already in Flask API format from queries.ts)
    return NextResponse.json(submission, { status: 201 });
  } catch (error) {
    logger.error("Error creating card submission:", error);
    return NextResponse.json(
      {
        error: {
          message: "Internal server error",
          code: 500,
        },
      },
      { status: 500 }
    );
  }
});

// GET /api/submissions - Get user's submissions
export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    const submissions = await submissionQueries.getUserSubmissions(user.id);

    // Return the submissions data directly (already in Flask API format from queries.ts)
    return NextResponse.json(submissions);
  } catch (error) {
    logger.error("Error fetching user submissions:", error);
    return NextResponse.json(
      {
        error: {
          message: "Internal server error",
          code: 500,
        },
      },
      { status: 500 }
    );
  }
});
