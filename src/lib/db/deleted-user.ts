import { prisma } from "./client";
import { hashPassword } from "@/lib/auth/password";

/**
 * Special system user ID for deleted users
 * Using ID 1 which is typically the first admin user created
 * This approach keeps the deleted user as a regular user in the system
 */
const DELETED_USER_EMAIL = "deleted@system.internal";
const DELETED_USER_FIRST_NAME = "Deleted";
const DELETED_USER_LAST_NAME = "User";

/**
 * Ensures a "Deleted User" account exists in the database
 * This user will own all content from deleted user accounts
 * Returns the user ID of the deleted user account
 */
export async function ensureDeletedUserExists(): Promise<number> {
  // Check if deleted user already exists
  let deletedUser = await prisma.user.findUnique({
    where: { email: DELETED_USER_EMAIL },
    select: { id: true },
  });

  if (deletedUser) {
    return deletedUser.id;
  }

  // Create the deleted user account
  // Generate a random, secure password that will never be used
  const randomPassword = crypto.randomUUID() + crypto.randomUUID();
  const passwordHash = await hashPassword(randomPassword);

  deletedUser = await prisma.user.create({
    data: {
      email: DELETED_USER_EMAIL,
      passwordHash,
      firstName: DELETED_USER_FIRST_NAME,
      lastName: DELETED_USER_LAST_NAME,
      role: "user",
      isActive: false, // Inactive so it can't be used for login
      emailVerified: false,
      createdDate: new Date(),
    },
    select: { id: true },
  });

  return deletedUser.id;
}

/**
 * Reassigns all content from one user to another
 * Used when deleting a user account to preserve database relationships
 */
export async function reassignUserContent(
  fromUserId: number,
  toUserId: number
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Reassign cards created by the user
    await tx.card.updateMany({
      where: { createdBy: fromUserId },
      data: { createdBy: toUserId },
    });

    // Reassign cards approved by the user
    await tx.card.updateMany({
      where: { approvedBy: fromUserId },
      data: { approvedBy: toUserId },
    });

    // Reassign card submissions
    await tx.cardSubmission.updateMany({
      where: { submittedBy: fromUserId },
      data: { submittedBy: toUserId },
    });

    // Reassign submission reviews
    await tx.cardSubmission.updateMany({
      where: { reviewedBy: fromUserId },
      data: { reviewedBy: toUserId },
    });

    // Reassign card modifications
    await tx.cardModification.updateMany({
      where: { submittedBy: fromUserId },
      data: { submittedBy: toUserId },
    });

    // Reassign modification reviews
    await tx.cardModification.updateMany({
      where: { reviewedBy: fromUserId },
      data: { reviewedBy: toUserId },
    });

    // Reassign forum categories
    await tx.forumCategory.updateMany({
      where: { createdBy: fromUserId },
      data: { createdBy: toUserId },
    });

    // Reassign forum category requests
    await tx.forumCategoryRequest.updateMany({
      where: { requestedBy: fromUserId },
      data: { requestedBy: toUserId },
    });

    // Reassign forum category request reviews
    await tx.forumCategoryRequest.updateMany({
      where: { reviewedBy: fromUserId },
      data: { reviewedBy: toUserId },
    });

    // Reassign forum threads
    await tx.forumThread.updateMany({
      where: { createdBy: fromUserId },
      data: { createdBy: toUserId },
    });

    // Reassign forum posts (as creator)
    await tx.forumPost.updateMany({
      where: { createdBy: fromUserId },
      data: { createdBy: toUserId },
    });

    // Reassign forum posts (as editor)
    await tx.forumPost.updateMany({
      where: { editedBy: fromUserId },
      data: { editedBy: toUserId },
    });

    // Reassign forum reports
    await tx.forumReport.updateMany({
      where: { reportedBy: fromUserId },
      data: { reportedBy: toUserId },
    });

    // Reassign forum report reviews
    await tx.forumReport.updateMany({
      where: { reviewedBy: fromUserId },
      data: { reviewedBy: toUserId },
    });

    // Reassign reviews
    await tx.review.updateMany({
      where: { userId: fromUserId },
      data: { userId: toUserId },
    });

    // Reassign review reports
    await tx.review.updateMany({
      where: { reportedBy: fromUserId },
      data: { reportedBy: toUserId },
    });

    // Reassign help wanted posts
    await tx.helpWantedPost.updateMany({
      where: { createdBy: fromUserId },
      data: { createdBy: toUserId },
    });

    // Reassign help wanted comments
    await tx.helpWantedComment.updateMany({
      where: { createdBy: fromUserId },
      data: { createdBy: toUserId },
    });

    // Reassign help wanted reports
    await tx.helpWantedReport.updateMany({
      where: { reportedBy: fromUserId },
      data: { reportedBy: toUserId },
    });

    // Reassign help wanted report reviews
    await tx.helpWantedReport.updateMany({
      where: { reviewedBy: fromUserId },
      data: { reviewedBy: toUserId },
    });

    // Reassign support tickets
    await tx.supportTicket.updateMany({
      where: { createdBy: fromUserId },
      data: { createdBy: toUserId },
    });

    // Reassign ticket assignments
    await tx.supportTicket.updateMany({
      where: { assignedTo: fromUserId },
      data: { assignedTo: toUserId },
    });

    // Reassign support ticket messages
    await tx.supportTicketMessage.updateMany({
      where: { createdBy: fromUserId },
      data: { createdBy: toUserId },
    });

    // Delete token blacklist entries (no need to reassign)
    await tx.tokenBlacklist.deleteMany({
      where: { userId: fromUserId },
    });
  });
}
