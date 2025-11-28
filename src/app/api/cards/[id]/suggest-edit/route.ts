import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { submissionQueries, cardQueries } from "@/lib/db/queries";
import { validateCardModification } from "@/lib/validation/submissions";
import {
  handleApiError,
  BadRequestError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from "@/lib/errors";

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

// POST /api/cards/[id]/suggest-edit - Suggest edits to an existing card
export const POST = withAuth(
  async (
    request: NextRequest,
    { user },
    context: { params: Promise<{ id: string }> }
  ) => {
    try {
      // Rate limiting: 10 requests per hour per user
      if (!checkRateLimit(user.id, 10)) {
        throw new RateLimitError();
      }

      // Get card ID from URL parameters
      const { id } = await context.params;
      const cardId = parseInt(id);
      if (isNaN(cardId)) {
        throw new BadRequestError("Invalid card ID");
      }

      // Verify the card exists
      const existingCard = await cardQueries.getCardById(cardId);
      if (!existingCard) {
        throw new NotFoundError("Card");
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

      // Validate input data using card modification validation
      const validation = validateCardModification(data);
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

      // Create modification suggestion in database
      const modificationData: {
        card_id: number;
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
        card_id: cardId,
        name: validation.data.name, // Now guaranteed to exist and be non-empty
        submitted_by: user.id,
      };

      // Only add optional fields if they are defined
      if (validation.data.description)
        modificationData.description = validation.data.description;
      if (validation.data.websiteUrl)
        modificationData.website_url = validation.data.websiteUrl;
      if (validation.data.phoneNumber)
        modificationData.phone_number = validation.data.phoneNumber;
      if (validation.data.email) modificationData.email = validation.data.email;
      if (validation.data.address)
        modificationData.address = validation.data.address;
      if (validation.data.addressOverrideUrl)
        modificationData.address_override_url =
          validation.data.addressOverrideUrl;
      if (validation.data.contactName)
        modificationData.contact_name = validation.data.contactName;
      if (validation.data.imageUrl)
        modificationData.image_url = validation.data.imageUrl;
      if (validation.data.tagsText)
        modificationData.tags_text = validation.data.tagsText;

      const modification =
        await submissionQueries.createModification(modificationData);

      // Return the modification data directly (already in Flask API format from queries.ts)
      return NextResponse.json(modification, { status: 201 });
    } catch (error) {
      return handleApiError(error, "POST /api/cards/[id]/suggest-edit");
    }
  }
);
