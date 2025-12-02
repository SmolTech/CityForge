import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";
import {
  ensureDeletedUserExists,
  reassignUserContent,
} from "@/lib/db/deleted-user";

/**
 * PUT /api/admin/users/[id] - Update user (admin only)
 */
export const PUT = withAuth(
  async (
    request: NextRequest,
    _context,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;
      const userId = parseInt(id);

      if (isNaN(userId)) {
        return NextResponse.json(
          {
            error: {
              message: "Invalid user ID",
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      const body = await request.json();
      const {
        email,
        first_name,
        last_name,
        role,
        is_active,
        is_supporter_flag,
        support,
      } = body;

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        return NextResponse.json(
          {
            error: {
              message: "User not found",
              code: 404,
            },
          },
          { status: 404 }
        );
      }

      // If email is being changed, check if it's already in use
      if (email && email !== existingUser.email) {
        const emailExists = await prisma.user.findUnique({
          where: { email },
        });

        if (emailExists) {
          return NextResponse.json(
            {
              error: {
                message: "Email already in use",
                code: 400,
              },
            },
            { status: 400 }
          );
        }
      }

      // Build update data
      const updateData: {
        email?: string;
        firstName?: string;
        lastName?: string;
        role?: string;
        isActive?: boolean;
        isSupporterFlag?: boolean;
        support?: boolean;
      } = {};
      if (email !== undefined) updateData.email = email;
      if (first_name !== undefined) updateData.firstName = first_name;
      if (last_name !== undefined) updateData.lastName = last_name;
      if (role !== undefined) updateData.role = role;
      if (is_active !== undefined) updateData.isActive = is_active;
      if (is_supporter_flag !== undefined)
        updateData.isSupporterFlag = is_supporter_flag;
      if (support !== undefined) updateData.support = support;

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          isSupporterFlag: true,
          support: true,
          createdDate: true,
          lastLogin: true,
        },
      });

      // Format response to match Flask API
      return NextResponse.json({
        id: updatedUser.id,
        email: updatedUser.email,
        first_name: updatedUser.firstName,
        last_name: updatedUser.lastName,
        username: `${updatedUser.firstName} ${updatedUser.lastName}`,
        role: updatedUser.role,
        is_active: updatedUser.isActive,
        is_supporter_flag: updatedUser.isSupporterFlag,
        support: updatedUser.support,
        created_date: updatedUser.createdDate,
        last_login: updatedUser.lastLogin,
      });
    } catch (error) {
      logger.error("Error updating user:", error);
      return NextResponse.json(
        {
          error: {
            message: "Failed to update user",
            code: 500,
          },
        },
        { status: 500 }
      );
    }
  },
  { requireAdmin: true }
);

/**
 * DELETE /api/admin/users/[id] - Delete user (admin only)
 */
export const DELETE = withAuth(
  async (
    request: NextRequest,
    _context,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await params;
      const userId = parseInt(id);

      if (isNaN(userId)) {
        return NextResponse.json(
          {
            error: {
              message: "Invalid user ID",
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        return NextResponse.json(
          {
            error: {
              message: "User not found",
              code: 404,
            },
          },
          { status: 404 }
        );
      }

      // Ensure the "Deleted User" account exists
      const deletedUserId = await ensureDeletedUserExists();

      // Prevent deleting the deleted user account itself
      if (userId === deletedUserId) {
        return NextResponse.json(
          {
            error: {
              message: "Cannot delete the system deleted user account",
              code: 400,
            },
          },
          { status: 400 }
        );
      }

      // Reassign all content from the user to the deleted user account
      await reassignUserContent(userId, deletedUserId);

      // Delete user (now safe since all foreign keys point to deleted user)
      await prisma.user.delete({
        where: { id: userId },
      });

      return NextResponse.json({
        message: "User deleted successfully",
      });
    } catch (error) {
      logger.error("Error deleting user:", error);
      return NextResponse.json(
        {
          error: {
            message: "Failed to delete user",
            code: 500,
          },
        },
        { status: 500 }
      );
    }
  },
  { requireAdmin: true }
);
