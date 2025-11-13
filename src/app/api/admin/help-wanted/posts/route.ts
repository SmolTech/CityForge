import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { handleApiError } from "@/lib/errors";
import { prisma } from "@/lib/db/client";

// GET /api/admin/help-wanted/posts - Get help wanted posts for admin
export const GET = withAuth(
  async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get("status") || undefined;
      const category = searchParams.get("category") || undefined;
      const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
      const offset = parseInt(searchParams.get("offset") || "0");

      const where: Record<string, unknown> = {
        ...(status && { status }),
        ...(category && { category }),
      };

      const [posts, totalCount] = await Promise.all([
        prisma.helpWantedPost.findMany({
          where,
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

      return NextResponse.json({
        posts: transformedPosts,
        total: totalCount,
        offset,
        limit,
      });
    } catch (error) {
      return handleApiError(error, "GET /api/admin/help-wanted/posts");
    }
  },
  { requireAdmin: true }
);
