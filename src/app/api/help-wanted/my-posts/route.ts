import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { handleApiError } from "@/lib/errors";
import { prisma } from "@/lib/db/client";

// GET /api/help-wanted/my-posts - Get user's help wanted posts
export const GET = withAuth(async (_request: NextRequest, { user }) => {
  try {
    const posts = await prisma.helpWantedPost.findMany({
      where: {
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
        comments: {
          select: {
            id: true,
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
    });

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

    return NextResponse.json(transformedPosts);
  } catch (error) {
    return handleApiError(error, "GET /api/help-wanted/my-posts");
  }
});
