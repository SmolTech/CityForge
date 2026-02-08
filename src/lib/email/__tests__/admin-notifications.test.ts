import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  sendSubmissionNotification,
  sendModificationNotification,
  sendForumReportNotification,
} from "../admin-notifications";

// Define a minimal email service interface for testing
interface EmailService {
  sendEmail: (params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }) => Promise<void>;
}

// Mock the dependencies
vi.mock("../index", () => ({
  getEmailService: vi.fn(),
}));

vi.mock("../../db/client", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../../logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Admin Notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset console.log mock
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  describe("sendSubmissionNotification", () => {
    it("should handle case when email service is not configured", async () => {
      // Mock getEmailService to return null (not configured)
      const { getEmailService } = await import("../index");
      vi.mocked(getEmailService).mockReturnValue(null);

      const submission = {
        id: 1,
        name: "Test Business",
        description: "A test business",
        website_url: "https://example.com",
        created_date: "2023-01-01T00:00:00Z",
      };

      const submitter = {
        id: 1,
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      };

      // Should not throw an error
      await expect(
        sendSubmissionNotification(submission, submitter)
      ).resolves.not.toThrow();

      // Should log the notification instead
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("📨 New Business Submission Notification:")
      );
    });

    it("should send emails to admin users when email service is configured", async () => {
      // Mock email service
      const mockSendEmail = vi.fn().mockResolvedValue(undefined);
      const mockEmailService: EmailService = {
        sendEmail: mockSendEmail,
      };

      const { getEmailService } = await import("../index");
      vi.mocked(getEmailService).mockReturnValue(mockEmailService as any);

      // Mock admin users - include minimal required fields for Prisma User type
      const { prisma } = await import("../../db/client");
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: 1,
          email: "admin1@example.com",
          passwordHash: "",
          firstName: "",
          lastName: "",
          role: "admin",
          isActive: true,
          createdDate: new Date(),
          lastLogin: null,
          isSupporterFlag: false,
          support: false,
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationSentAt: null,
          registrationIpAddress: null,
        },
        {
          id: 2,
          email: "admin2@example.com",
          passwordHash: "",
          firstName: "",
          lastName: "",
          role: "admin",
          isActive: true,
          createdDate: new Date(),
          lastLogin: null,
          isSupporterFlag: false,
          support: false,
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationSentAt: null,
          registrationIpAddress: null,
        },
      ]);

      const submission = {
        id: 1,
        name: "Test Business",
        description: "A test business",
        created_date: "2023-01-01T00:00:00Z",
      };

      const submitter = {
        id: 1,
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      };

      await sendSubmissionNotification(submission, submitter);

      // Should call sendEmail for each admin
      expect(mockSendEmail).toHaveBeenCalledTimes(2);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "admin1@example.com",
          subject: "New Business Submission: Test Business",
          html: expect.stringContaining("New Business Submission"),
          text: expect.stringContaining("Test Business"),
        })
      );
    });
  });

  describe("sendModificationNotification", () => {
    it("should handle case when email service is not configured", async () => {
      const { getEmailService } = await import("../index");
      vi.mocked(getEmailService).mockReturnValue(null);

      const modification = {
        id: 1,
        name: "Updated Business Name",
        description: "Updated description",
        created_date: "2023-01-01T00:00:00Z",
      };

      const submitter = {
        id: 1,
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
      };

      const card = {
        id: 1,
        name: "Original Business Name",
      };

      await expect(
        sendModificationNotification(modification, submitter, card)
      ).resolves.not.toThrow();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("✏️ Business Modification Notification:")
      );
    });

    it("should send emails to admin users for modification notifications", async () => {
      const mockSendEmail = vi.fn().mockResolvedValue(undefined);
      const mockEmailService: EmailService = {
        sendEmail: mockSendEmail,
      };

      const { getEmailService } = await import("../index");
      vi.mocked(getEmailService).mockReturnValue(mockEmailService as any);

      const { prisma } = await import("../../db/client");
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: 1,
          email: "admin@example.com",
          passwordHash: "",
          firstName: "",
          lastName: "",
          role: "admin",
          isActive: true,
          createdDate: new Date(),
          lastLogin: null,
          isSupporterFlag: false,
          support: false,
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationSentAt: null,
          registrationIpAddress: null,
        },
      ]);

      const modification = {
        id: 1,
        name: "Updated Business Name",
        created_date: "2023-01-01T00:00:00Z",
      };

      const submitter = {
        id: 1,
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
      };

      const card = {
        id: 1,
        name: "Original Business Name",
      };

      await sendModificationNotification(modification, submitter, card);

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "admin@example.com",
          subject: "Business Modification: Original Business Name",
          html: expect.stringContaining("Business Modification Suggestion"),
          text: expect.stringContaining("Updated Business Name"),
        })
      );
    });
  });

  describe("sendForumReportNotification", () => {
    it("should handle case when email service is not configured", async () => {
      const { getEmailService } = await import("../index");
      vi.mocked(getEmailService).mockReturnValue(null);

      const threadReport = {
        id: 1,
        thread: {
          id: 123,
          title: "Test Thread",
          slug: "test-thread",
          categoryId: 1,
          category: {
            name: "General Discussion",
            slug: "general-discussion",
          },
        },
        post: null,
        reason: "Inappropriate Content",
        details: "This content violates community guidelines",
        created_date: "2023-01-01T00:00:00Z",
      };

      const reporter = {
        id: 1,
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
      };

      await expect(
        sendForumReportNotification(threadReport, reporter)
      ).resolves.not.toThrow();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("🚨 Forum Report Notification:")
      );
    });

    it("should send emails to admin users for thread report notifications", async () => {
      const mockSendEmail = vi.fn().mockResolvedValue(undefined);
      const mockEmailService: EmailService = {
        sendEmail: mockSendEmail,
      };

      const { getEmailService } = await import("../index");
      vi.mocked(getEmailService).mockReturnValue(mockEmailService as any);

      const { prisma } = await import("../../db/client");
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: 1,
          email: "admin@example.com",
          passwordHash: "",
          firstName: "",
          lastName: "",
          role: "admin",
          isActive: true,
          createdDate: new Date(),
          lastLogin: null,
          isSupporterFlag: false,
          support: false,
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationSentAt: null,
          registrationIpAddress: null,
        },
      ]);

      const threadReport = {
        id: 1,
        thread: {
          id: 123,
          title: "Test Thread",
          slug: "test-thread",
          categoryId: 1,
          category: {
            name: "General Discussion",
            slug: "general-discussion",
          },
        },
        post: null,
        reason: "Inappropriate Content",
        details: "This content violates community guidelines",
        created_date: "2023-01-01T00:00:00Z",
      };

      const reporter = {
        id: 1,
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
      };

      await sendForumReportNotification(threadReport, reporter);

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "admin@example.com",
          subject: "🚨 Forum Thread Reported: Test Thread",
          html: expect.stringContaining("Forum Thread Reported"),
          text: expect.stringContaining("Test Thread"),
        })
      );
    });

    it("should send emails to admin users for post report notifications", async () => {
      const mockSendEmail = vi.fn().mockResolvedValue(undefined);
      const mockEmailService: EmailService = {
        sendEmail: mockSendEmail,
      };

      const { getEmailService } = await import("../index");
      vi.mocked(getEmailService).mockReturnValue(mockEmailService as any);

      const { prisma } = await import("../../db/client");
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: 1,
          email: "admin@example.com",
          passwordHash: "",
          firstName: "",
          lastName: "",
          role: "admin",
          isActive: true,
          createdDate: new Date(),
          lastLogin: null,
          isSupporterFlag: false,
          support: false,
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationSentAt: null,
          registrationIpAddress: null,
        },
      ]);

      const postReport = {
        id: 2,
        thread: {
          id: 456,
          title: "Help with recommendations",
          slug: "help-with-recommendations",
          categoryId: 2,
          category: {
            name: "Business Directory",
            slug: "business-directory",
          },
        },
        post: {
          id: 789,
          content:
            "This is some inappropriate content that should be reported for moderation review.",
        },
        reason: "Harassment",
        details: "Personal attacks against community members",
        created_date: "2023-01-01T00:00:00Z",
      };

      const reporter = {
        id: 2,
        firstName: "John",
        lastName: "Smith",
        email: "john@example.com",
      };

      await sendForumReportNotification(postReport, reporter);

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "admin@example.com",
          subject: "🚨 Forum Post Reported: Help with recommendations",
          html: expect.stringContaining("Forum Post Reported"),
          text: expect.stringContaining("This is some inappropriate content"),
        })
      );
    });

    it("should handle post content truncation in email preview", async () => {
      const mockSendEmail = vi.fn().mockResolvedValue(undefined);
      const mockEmailService: EmailService = {
        sendEmail: mockSendEmail,
      };

      const { getEmailService } = await import("../index");
      vi.mocked(getEmailService).mockReturnValue(mockEmailService as any);

      const { prisma } = await import("../../db/client");
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: 1,
          email: "admin@example.com",
          passwordHash: "",
          firstName: "",
          lastName: "",
          role: "admin",
          isActive: true,
          createdDate: new Date(),
          lastLogin: null,
          isSupporterFlag: false,
          support: false,
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationSentAt: null,
          registrationIpAddress: null,
        },
      ]);

      const longContent = "A".repeat(300); // 300 character string
      const postReport = {
        id: 3,
        thread: {
          id: 789,
          title: "Long post thread",
          slug: "long-post-thread",
          categoryId: 1,
          category: {
            name: "General",
            slug: "general",
          },
        },
        post: {
          id: 999,
          content: longContent,
        },
        reason: "Spam",
        details: "This is spam content",
        created_date: "2023-01-01T00:00:00Z",
      };

      const reporter = {
        id: 3,
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
      };

      await sendForumReportNotification(postReport, reporter);

      // Verify content was truncated to 200 characters + "..."
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining(`${"A".repeat(200)}...`),
          text: expect.stringContaining(`${"A".repeat(200)}...`),
        })
      );
    });

    it("should handle reports with no additional details", async () => {
      const mockSendEmail = vi.fn().mockResolvedValue(undefined);
      const mockEmailService: EmailService = {
        sendEmail: mockSendEmail,
      };

      const { getEmailService } = await import("../index");
      vi.mocked(getEmailService).mockReturnValue(mockEmailService as any);

      const { prisma } = await import("../../db/client");
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: 1,
          email: "admin@example.com",
          passwordHash: "",
          firstName: "",
          lastName: "",
          role: "admin",
          isActive: true,
          createdDate: new Date(),
          lastLogin: null,
          isSupporterFlag: false,
          support: false,
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationSentAt: null,
          registrationIpAddress: null,
        },
      ]);

      const reportWithoutDetails = {
        id: 4,
        thread: {
          id: 100,
          title: "Simple thread",
          slug: "simple-thread",
          categoryId: 1,
          category: {
            name: "General",
            slug: "general",
          },
        },
        post: null,
        reason: "Off-topic",
        details: null, // No additional details
        created_date: "2023-01-01T00:00:00Z",
      };

      const reporter = {
        id: 4,
        firstName: "Reporter",
        lastName: "Person",
        email: "reporter@example.com",
      };

      await expect(
        sendForumReportNotification(reportWithoutDetails, reporter)
      ).resolves.not.toThrow();

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "🚨 Forum Thread Reported: Simple thread",
          html: expect.stringContaining("Off-topic"),
        })
      );
    });
  });
});
