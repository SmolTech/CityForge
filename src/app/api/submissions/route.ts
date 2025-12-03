import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { withCsrfProtection } from "@/lib/auth/csrf";
import { submissionQueries } from "@/lib/db/queries";
import { validateCardSubmission } from "@/lib/validation/submissions";
import {
  handleApiError,
  BadRequestError,
  RateLimitError,
  ValidationError,
} from "@/lib/errors";
import { sendSubmissionNotification } from "@/lib/email/admin-notifications";
import { metrics } from "@/lib/monitoring/metrics";

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
export const POST = withCsrfProtection(
  withAuth(async (request: NextRequest, { user }) => {
    try {
      // Rate limiting: 10 requests per hour per user
      if (!checkRateLimit(user.id, 10)) {
        throw new RateLimitError();
      }

      // Parse request body
      let data;
      try {
        data = await request.json();
      } catch {
        throw new BadRequestError("No data provided");
      }

      if (!data) {
        throw new BadRequestError("No data provided");
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

        throw new ValidationError("Validation failed", errorMessages);
      }

      // At this point, validation.data is guaranteed to exist
      if (!validation.data) {
        throw new BadRequestError("Validation failed - no data");
      }

      // Create submission in database
      const submissionData: {
        name: string;
        description?: string;
        website_url?: string;
        phone_number?: string;
        email?: string;
        address?: string;
        address_override_url?: string;
        contact_name?: string;
        image_url?: string;
        tags_text?: string;
        submitted_by: number;
      } = {
        name: validation.data.name,
        submitted_by: user.id,
      };

      // Only add optional fields if they are defined
      if (validation.data.description)
        submissionData.description = validation.data.description;
      if (validation.data.websiteUrl)
        submissionData.website_url = validation.data.websiteUrl;
      if (validation.data.phoneNumber)
        submissionData.phone_number = validation.data.phoneNumber;
      if (validation.data.email) submissionData.email = validation.data.email;
      if (validation.data.address)
        submissionData.address = validation.data.address;
      if (validation.data.addressOverrideUrl)
        submissionData.address_override_url =
          validation.data.addressOverrideUrl;
      if (validation.data.contactName)
        submissionData.contact_name = validation.data.contactName;
      if (validation.data.imageUrl)
        submissionData.image_url = validation.data.imageUrl;
      if (validation.data.tagsText)
        submissionData.tags_text = validation.data.tagsText;

      const submission =
        await submissionQueries.createSubmission(submissionData);

      // Track business submission in metrics
      metrics.incrementCounter("businessSubmissions");

      // Send email notification to admins
      try {
        await sendSubmissionNotification(submission, {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        });
      } catch (emailError) {
        // Log email error but don't fail the submission
        console.error(
          "Failed to send submission notification email:",
          emailError
        );
      }

      // Return the submission data directly (already in Flask API format from queries.ts)
      return NextResponse.json(submission, { status: 201 });
    } catch (error) {
      return handleApiError(error, "POST /api/submissions");
    }
  })
);

// GET /api/submissions - Get user's submissions
export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    const submissions = await submissionQueries.getUserSubmissions(user.id);

    // Return the submissions data directly (already in Flask API format from queries.ts)
    return NextResponse.json(submissions);
  } catch (error) {
    return handleApiError(error, "GET /api/submissions");
  }
});
