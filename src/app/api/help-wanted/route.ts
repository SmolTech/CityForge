import { NextRequest, NextResponse } from "next/server";
import { withAuth, AuthenticatedUser } from "@/lib/auth/middleware";
import { withCsrfProtection } from "@/lib/auth/csrf";
import {
  handleApiError,
  BadRequestError,
  RateLimitError,
  ValidationError,
} from "@/lib/errors";
import { prisma } from "@/lib/db/client";
import { apiCache } from "@/lib/cache";

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

// Validation helper for help wanted posts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateHelpWantedPost(data: any) {
  // Using any for runtime validation
  const errors: string[] = [];

  if (
    !data.title ||
    typeof data.title !== "string" ||
    data.title.trim().length === 0
  ) {
    errors.push("Title is required");
  } else if (data.title.length > 255) {
    errors.push("Title must be 255 characters or less");
  }

  if (
    !data.description ||
    typeof data.description !== "string" ||
    data.description.trim().length === 0
  ) {
    errors.push("Description is required");
  }

  const validCategories = ["hiring", "collaboration", "general"];
  if (!data.category || !validCategories.includes(data.category as string)) {
    errors.push("Category must be one of: hiring, collaboration, general");
  }

  if (
    data.location &&
    typeof data.location === "string" &&
    data.location.length > 255
  ) {
    errors.push("Location must be 255 characters or less");
  }

  if (
    data.budget &&
    typeof data.budget === "string" &&
    data.budget.length > 100
  ) {
    errors.push("Budget must be 100 characters or less");
  }

  if (
    data.contact_preference &&
    typeof data.contact_preference === "string" &&
    data.contact_preference.length > 50
  ) {
    errors.push("Contact preference must be 50 characters or less");
  }

  return {
    isValid: errors.length === 0,
    errors,
    data:
      errors.length === 0
        ? {
            title: (data.title as string).trim(),
            description: (data.description as string).trim(),
            category: data.category as string,
            location:
              typeof data.location === "string" ? data.location.trim() : null,
            budget: typeof data.budget === "string" ? data.budget.trim() : null,
            contact_preference:
              typeof data.contact_preference === "string"
                ? data.contact_preference.trim()
                : null,
          }
        : null,
  };
}

// GET /api/help-wanted - Get help wanted posts with optional filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || undefined;
    const status = searchParams.get("status") || undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Generate cache key for this request
    const cacheKey = `help-wanted:${category || "all"}:${status || "all"}:${limit}:${offset}`;

    // Check cache first
    let cachedResult = apiCache.get(cacheKey);
    if (cachedResult) {
      const response = NextResponse.json(cachedResult);
      response.headers.set("Cache-Control", "public, max-age=180");
      response.headers.set("X-Cache", "HIT");
      return response;
    }

    const where: Record<string, unknown> = {
      ...(status && status !== "all" && { status }),
      ...(category && { category }),
    };

    const [posts, totalCount] = await Promise.all([
      prisma.helpWantedPost.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          status: true,
          location: true,
          budget: true,
          contactPreference: true,
          createdDate: true,
          updatedDate: true,
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          _count: {
            select: {
              comments: true,
              reports: true,
            },
          },
        },
        orderBy: {
          createdDate: "desc",
        },
        take: limit,
        skip: offset,
      }),
      prisma.helpWantedPost.count({ where }),
    ]);

    // Transform data to match the expected API format
    const transformedPosts = posts.map((post) => ({
      id: post.id,
      title: post.title,
      description: post.description,
      category: post.category,
      status: post.status,
      location: post.location,
      budget: post.budget,
      contact_preference: post.contactPreference,
      report_count: post._count.reports,
      created_date: post.createdDate?.toISOString(),
      updated_date: post.updatedDate?.toISOString(),
      creator: post.creator
        ? {
            id: post.creator.id,
            first_name: post.creator.firstName,
            last_name: post.creator.lastName,
            email: post.creator.email,
          }
        : undefined,
      comment_count: post._count.comments,
    }));

    const result = {
      posts: transformedPosts,
      total: totalCount,
      offset,
      limit,
    };

    // Cache the result for 3 minutes
    apiCache.set(cacheKey, result, 180);

    const response = NextResponse.json(result);
    response.headers.set("Cache-Control", "public, max-age=180");
    response.headers.set("X-Cache", "MISS");
    return response;
  } catch (error: unknown) {
    return handleApiError(error, "GET /api/help-wanted");
  }
}

// POST /api/help-wanted - Create a new help wanted post
export const POST = withCsrfProtection(
  withAuth(
    async (request: NextRequest, { user }: { user: AuthenticatedUser }) => {
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
        const validation = validateHelpWantedPost(data);
        if (!validation.isValid) {
          throw new ValidationError("Validation failed", {
            errors: validation.errors,
          });
        }

        // At this point, validation.data is guaranteed to exist
        if (!validation.data) {
          throw new BadRequestError("Validation failed - no data");
        }

        // Create help wanted post in database
        const helpWantedPost = await prisma.helpWantedPost.create({
          data: {
            title: validation.data.title,
            description: validation.data.description,
            category: validation.data.category,
            location: validation.data.location,
            budget: validation.data.budget,
            contactPreference: validation.data.contact_preference,
            status: "open",
            reportCount: 0,
            createdBy: user.id,
          },
          include: {
            creator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            _count: {
              select: {
                comments: true,
                reports: true,
              },
            },
          },
        });

        // Transform data to match the expected API format
        const transformedPost = {
          id: helpWantedPost.id,
          title: helpWantedPost.title,
          description: helpWantedPost.description,
          category: helpWantedPost.category,
          status: helpWantedPost.status,
          location: helpWantedPost.location,
          budget: helpWantedPost.budget,
          contact_preference: helpWantedPost.contactPreference,
          report_count: helpWantedPost._count.reports,
          created_date: helpWantedPost.createdDate?.toISOString(),
          updated_date: helpWantedPost.updatedDate?.toISOString(),
          creator: helpWantedPost.creator
            ? {
                id: helpWantedPost.creator.id,
                first_name: helpWantedPost.creator.firstName,
                last_name: helpWantedPost.creator.lastName,
                email: helpWantedPost.creator.email,
              }
            : undefined,
          comment_count: helpWantedPost._count.comments,
        };

        return NextResponse.json(transformedPost, { status: 201 });
      } catch (error: unknown) {
        return handleApiError(error, "POST /api/help-wanted");
      }
    }
  )
);
