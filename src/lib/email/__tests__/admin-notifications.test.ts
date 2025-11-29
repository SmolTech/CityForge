import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  sendSubmissionNotification,
  sendModificationNotification,
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
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationSentAt: null,
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
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationSentAt: null,
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
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationSentAt: null,
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
});
