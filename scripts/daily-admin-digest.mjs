#!/usr/bin/env node
/**
 * Daily Admin Digest
 * Sends a daily summary of pending approvals to admins via email and webhooks
 */
import { PrismaClient } from "@prisma/client";
import { createAndSendWebhookEvent } from "../src/lib/webhooks/helpers.js";
import { getEmailService } from "../src/lib/email/index.js";

const prisma = new PrismaClient();

async function getPendingApprovals() {
  const [
    pendingSubmissions,
    pendingModifications,
    pendingReports,
    pendingCategoryRequests,
    pendingHelpWantedReports,
    reportedReviews,
  ] = await Promise.all([
    // Business submissions awaiting approval
    prisma.cardSubmission.findMany({
      where: {
        status: "pending",
        reviewedDate: null,
      },
      include: {
        submitter: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdDate: "asc" },
    }),

    // Business modifications awaiting approval
    prisma.cardModification.findMany({
      where: {
        status: "pending",
        reviewedDate: null,
      },
      include: {
        submitter: { select: { firstName: true, lastName: true, email: true } },
        card: { select: { name: true } },
      },
      orderBy: { createdDate: "asc" },
    }),

    // Forum reports awaiting review
    prisma.forumReport.findMany({
      where: {
        status: "pending",
        reviewedDate: null,
      },
      include: {
        reporter: { select: { firstName: true, lastName: true, email: true } },
        thread: { select: { title: true } },
      },
      orderBy: { createdDate: "asc" },
    }),

    // Forum category requests awaiting approval
    prisma.forumCategoryRequest.findMany({
      where: {
        status: "pending",
        reviewedDate: null,
      },
      include: {
        requester: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdDate: "asc" },
    }),

    // Help wanted reports awaiting review
    prisma.helpWantedReport.findMany({
      where: {
        status: "pending",
        reviewedDate: null,
      },
      include: {
        reporter: { select: { firstName: true, lastName: true, email: true } },
        post: { select: { title: true } },
      },
      orderBy: { createdDate: "asc" },
    }),

    // Reported reviews awaiting action
    prisma.review.findMany({
      where: {
        reported: true,
        hidden: null, // Not yet acted upon
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        card: { select: { name: true } },
        reporter: { select: { firstName: true, lastName: true } },
      },
      orderBy: { reportedDate: "asc" },
    }),
  ]);

  return {
    pendingSubmissions,
    pendingModifications,
    pendingReports,
    pendingCategoryRequests,
    pendingHelpWantedReports,
    reportedReviews,
  };
}

async function getAdminEmails() {
  const admins = await prisma.user.findMany({
    where: {
      role: "admin",
      isActive: true,
      emailVerified: true,
    },
    select: { email: true },
  });

  return admins.map((admin) => admin.email);
}

function formatDigestText(data) {
  const {
    pendingSubmissions,
    pendingModifications,
    pendingReports,
    pendingCategoryRequests,
    pendingHelpWantedReports,
    reportedReviews,
  } = data;

  const total =
    pendingSubmissions.length +
    pendingModifications.length +
    pendingReports.length +
    pendingCategoryRequests.length +
    pendingHelpWantedReports.length +
    reportedReviews.length;

  if (total === 0) {
    return null; // No digest needed
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  let text = `Daily Admin Digest - ${total} items pending approval\n\n`;

  if (pendingSubmissions.length > 0) {
    text += `🏢 Business Submissions (${pendingSubmissions.length}):\n`;
    pendingSubmissions.slice(0, 5).forEach((sub) => {
      const daysOld = Math.floor(
        (Date.now() - new Date(sub.createdDate)) / (1000 * 60 * 60 * 24)
      );
      text += `  • ${sub.name} (${daysOld}d old) - ${sub.submitter.firstName} ${sub.submitter.lastName}\n`;
    });
    if (pendingSubmissions.length > 5) {
      text += `  ... and ${pendingSubmissions.length - 5} more\n`;
    }
    text += `  View all: ${baseUrl}/admin/submissions\n\n`;
  }

  if (pendingModifications.length > 0) {
    text += `✏️ Business Modifications (${pendingModifications.length}):\n`;
    pendingModifications.slice(0, 5).forEach((mod) => {
      const daysOld = Math.floor(
        (Date.now() - new Date(mod.createdDate)) / (1000 * 60 * 60 * 24)
      );
      text += `  • ${mod.card.name} (${daysOld}d old) - ${mod.submitter.firstName} ${mod.submitter.lastName}\n`;
    });
    if (pendingModifications.length > 5) {
      text += `  ... and ${pendingModifications.length - 5} more\n`;
    }
    text += `  View all: ${baseUrl}/admin/modifications\n\n`;
  }

  if (pendingReports.length > 0) {
    text += `⚠️ Forum Reports (${pendingReports.length}):\n`;
    pendingReports.slice(0, 5).forEach((report) => {
      const daysOld = Math.floor(
        (Date.now() - new Date(report.createdDate)) / (1000 * 60 * 60 * 24)
      );
      text += `  • ${report.reason} in "${report.thread.title}" (${daysOld}d old)\n`;
    });
    if (pendingReports.length > 5) {
      text += `  ... and ${pendingReports.length - 5} more\n`;
    }
    text += `  View all: ${baseUrl}/admin/forums\n\n`;
  }

  if (pendingCategoryRequests.length > 0) {
    text += `📁 Category Requests (${pendingCategoryRequests.length}):\n`;
    pendingCategoryRequests.slice(0, 5).forEach((req) => {
      const daysOld = Math.floor(
        (Date.now() - new Date(req.createdDate)) / (1000 * 60 * 60 * 24)
      );
      text += `  • "${req.name}" (${daysOld}d old) - ${req.requester.firstName} ${req.requester.lastName}\n`;
    });
    if (pendingCategoryRequests.length > 5) {
      text += `  ... and ${pendingCategoryRequests.length - 5} more\n`;
    }
    text += `  View all: ${baseUrl}/admin/forums\n\n`;
  }

  if (pendingHelpWantedReports.length > 0) {
    text += `🆘 Help Wanted Reports (${pendingHelpWantedReports.length}):\n`;
    pendingHelpWantedReports.slice(0, 5).forEach((report) => {
      const daysOld = Math.floor(
        (Date.now() - new Date(report.createdDate)) / (1000 * 60 * 60 * 24)
      );
      text += `  • ${report.reason} in "${report.post.title}" (${daysOld}d old)\n`;
    });
    if (pendingHelpWantedReports.length > 5) {
      text += `  ... and ${pendingHelpWantedReports.length - 5} more\n`;
    }
    text += `  View all: ${baseUrl}/admin/classifieds\n\n`;
  }

  if (reportedReviews.length > 0) {
    text += `⭐ Reported Reviews (${reportedReviews.length}):\n`;
    reportedReviews.slice(0, 5).forEach((review) => {
      const daysOld = Math.floor(
        (Date.now() - new Date(review.reportedDate)) / (1000 * 60 * 60 * 24)
      );
      text += `  • Review of ${review.card.name} (${daysOld}d old)\n`;
    });
    if (reportedReviews.length > 5) {
      text += `  ... and ${reportedReviews.length - 5} more\n`;
    }
    text += `  View all: ${baseUrl}/admin/reviews\n\n`;
  }

  text += `Admin Panel: ${baseUrl}/admin\n`;
  text += `Generated: ${new Date().toLocaleString()}`;

  return text;
}

async function sendDigest() {
  try {
    console.log("📊 Generating daily admin digest...");

    const approvalData = await getPendingApprovals();
    const digestText = formatDigestText(approvalData);

    if (!digestText) {
      console.log("✅ No pending approvals - skipping digest");
      return;
    }

    console.log("📤 Sending digest notifications...");

    // Send webhook notification
    if (process.env.WEBHOOKS_ENABLED === "true") {
      await createAndSendWebhookEvent("admin.notification", {
        message: digestText,
        type: "daily_digest",
        timestamp: new Date().toISOString(),
        counts: {
          submissions: approvalData.pendingSubmissions.length,
          modifications: approvalData.pendingModifications.length,
          reports: approvalData.pendingReports.length,
          categoryRequests: approvalData.pendingCategoryRequests.length,
          helpWantedReports: approvalData.pendingHelpWantedReports.length,
          reportedReviews: approvalData.reportedReviews.length,
        },
      });
    }

    // Send email to admins
    const adminEmails = await getAdminEmails();

    if (adminEmails.length > 0) {
      const total = Object.values(approvalData).flat().length;
      const subject = `CityForge Daily Digest - ${total} items pending approval`;
      const emailService = getEmailService();

      for (const email of adminEmails) {
        await emailService.sendEmail({
          to: email,
          subject,
          text: digestText,
          html: digestText.replace(/\n/g, "<br>"),
        });
      }

      console.log(`✅ Digest sent to ${adminEmails.length} admin(s)`);
    } else {
      console.log("⚠️ No admin email addresses found");
    }
  } catch (error) {
    console.error("❌ Failed to send daily admin digest:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Only run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  sendDigest();
}

export { sendDigest, getPendingApprovals };
