import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  beforeEach,
} from "vitest";
import {
  assertApiResponse,
  createAuthenticatedRequest,
} from "../../utils/api-test-helpers";
import { createTestUserInDb } from "../../utils/database-test-helpers";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
  cleanDatabase,
} from "../setup";
import { prisma } from "@/lib/db";
import type {
  User,
  ForumCategory,
  ForumThread,
  ForumPost,
} from "@prisma/client";

// Import route handlers
import { GET as getCategoriesRoute } from "@/app/api/forums/categories/route";
import { GET as getCategoryRoute } from "@/app/api/forums/categories/[slug]/route";
import {
  GET as getThreadsRoute,
  POST as createThreadRoute,
} from "@/app/api/forums/categories/[slug]/threads/route";
import { GET as getThreadRoute } from "@/app/api/forums/categories/[slug]/threads/[id]/route";
import { POST as createPostRoute } from "@/app/api/forums/categories/[slug]/threads/[id]/posts/route";
import {
  GET as getCategoryRequestsRoute,
  POST as createCategoryRequestRoute,
} from "@/app/api/forums/category-requests/route";
import {
  GET as getReportsRoute,
  POST as createReportRoute,
} from "@/app/api/forums/reports/route";
import { GET as getMyContentRoute } from "@/app/api/forums/my/route";

describe("Forum API Routes", () => {
  let testUser: User;
  let testCategory: ForumCategory;
  let testThread: ForumThread;
  let testPost: ForumPost;

  beforeAll(async () => {
    await setupIntegrationTests();

    // Create test user
    testUser = await createTestUserInDb({
      email: `forum-test-${Date.now()}@example.com`,
      firstName: "Forum",
      lastName: "User",
      password: "ForumPassword123!",
    });

    // Create test category
    testCategory = await prisma.forumCategory.create({
      data: {
        name: "Test Category",
        slug: "test-category",
        description: "Test category description",
        displayOrder: 1,
        createdBy: testUser.id,
        isActive: true,
      },
    });
  }, 60000);

  afterEach(async () => {
    // Clean up test data created during tests
    await prisma.forumReport.deleteMany({});
    await prisma.forumCategoryRequest.deleteMany({});
    await prisma.forumPost.deleteMany({});
    await prisma.forumThread.deleteMany({
      where: { categoryId: { not: testCategory.id } },
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await teardownIntegrationTests();
  }, 30000);

  describe("GET /api/forums/categories", () => {
    it("should return all active forum categories", async () => {
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/forums/categories",
        {
          id: testUser.id,
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          role: testUser.role as "admin" | "supporter" | "user",
          isActive: testUser.isActive ?? true,
          emailVerified: testUser.emailVerified ?? false,
        },
        { method: "GET" }
      );

      const response = await getCategoriesRoute(request);

      await assertApiResponse(response, 200, (data) => {
        expect(data.categories).toBeDefined();
        expect(Array.isArray(data.categories)).toBe(true);

        const category = data.categories.find(
          (c: ForumCategory) => c.id === testCategory.id
        );
        expect(category).toBeDefined();
        expect(category.name).toBe("Test Category");
        expect(category.slug).toBe("test-category");
        expect(category.description).toBe("Test category description");
        expect(category.creator).toBeDefined();
        expect(category.creator.username).toBe(
          `${testUser.firstName} ${testUser.lastName}`
        );
      });
    });
  });

  describe("GET /api/forums/categories/[slug]", () => {
    it("should return specific category by slug with statistics", async () => {
      const request = createAuthenticatedRequest(
        `http://localhost:3000/api/forums/categories/${testCategory.slug}`,
        {
          id: testUser.id,
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          role: testUser.role as "admin" | "supporter" | "user",
          isActive: testUser.isActive ?? true,
          emailVerified: testUser.emailVerified ?? false,
        },
        { method: "GET" }
      );

      const response = await getCategoryRoute(request, {
        params: Promise.resolve({ slug: testCategory.slug }),
      } as any);

      await assertApiResponse(response, 200, (data) => {
        expect(data.category).toBeDefined();
        expect(data.category.id).toBe(testCategory.id);
        expect(data.category.name).toBe("Test Category");
        expect(data.category.slug).toBe("test-category");
        expect(data.category.thread_count).toBeDefined();
        expect(data.category.post_count).toBeDefined();
      });
    });

    it("should return 404 for non-existent category", async () => {
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/forums/categories/non-existent",
        {
          id: testUser.id,
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          role: testUser.role as "admin" | "supporter" | "user",
          isActive: testUser.isActive ?? true,
          emailVerified: testUser.emailVerified ?? false,
        },
        { method: "GET" }
      );

      const response = await getCategoryRoute(request, {
        params: Promise.resolve({ slug: "non-existent" }),
      } as any);

      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/forums/categories/[slug]/threads", () => {
    beforeEach(async () => {
      // Create test thread for this test suite
      testThread = await prisma.forumThread.create({
        data: {
          title: "Test Thread",
          slug: "test-thread",
          categoryId: testCategory.id,
          createdBy: testUser.id,
          isPinned: false,
          isLocked: false,
          reportCount: 0,
        },
      });

      // Create initial post for the thread
      testPost = await prisma.forumPost.create({
        data: {
          content: "Test post content",
          threadId: testThread.id,
          createdBy: testUser.id,
          reportCount: 0,
        },
      });
    });

    it("should return threads in category with pagination", async () => {
      const request = createAuthenticatedRequest(
        `http://localhost:3000/api/forums/categories/${testCategory.slug}/threads`,
        {
          id: testUser.id,
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          role: testUser.role as "admin" | "supporter" | "user",
          isActive: testUser.isActive ?? true,
          emailVerified: testUser.emailVerified ?? false,
        },
        { method: "GET" }
      );

      const response = await getThreadsRoute(request, {
        params: Promise.resolve({ slug: testCategory.slug }),
      } as any);

      await assertApiResponse(response, 200, (data) => {
        expect(data.threads).toBeDefined();
        expect(Array.isArray(data.threads)).toBe(true);
        expect(data.pagination).toBeDefined();
        expect(data.category).toBeDefined();
        expect(data.category.name).toBe("Test Category");

        const thread = data.threads.find(
          (t: ForumThread) => t.id === testThread.id
        );
        expect(thread).toBeDefined();
        expect(thread.title).toBe("Test Thread");
        expect(thread.slug).toBe("test-thread");
        expect(thread.is_pinned).toBe(false);
        expect(thread.is_locked).toBe(false);
      });
    });
  });

  describe("POST /api/forums/categories/[slug]/threads", () => {
    it("should create new thread with initial post", async () => {
      const newThreadData = {
        title: "New Test Thread",
        content: "This is the first post of the new thread",
      };

      const request = createAuthenticatedRequest(
        `http://localhost:3000/api/forums/categories/${testCategory.slug}/threads`,
        {
          id: testUser.id,
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          role: testUser.role as "admin" | "supporter" | "user",
          isActive: testUser.isActive ?? true,
          emailVerified: testUser.emailVerified ?? false,
        },
        {
          method: "POST",
          body: newThreadData,
        }
      );

      const response = await createThreadRoute(request, {
        params: Promise.resolve({ slug: testCategory.slug }),
      } as any);

      await assertApiResponse(response, 201, (data) => {
        expect(data.thread).toBeDefined();
        expect(data.thread.title).toBe("New Test Thread");
        expect(data.thread.slug).toBe("new-test-thread");
        expect(data.thread.category_id).toBe(testCategory.id);
        expect(data.thread.created_by).toBe(testUser.id);
        expect(data.thread.is_pinned).toBe(false);
        expect(data.thread.is_locked).toBe(false);
        expect(data.first_post).toBeDefined();
        expect(data.first_post.content).toBe(
          "This is the first post of the new thread"
        );
      });

      // Verify thread was created in database
      const createdThread = await prisma.forumThread.findFirst({
        where: { slug: "new-test-thread" },
        include: { posts: true },
      });
      expect(createdThread).toBeDefined();
      expect(createdThread!.posts).toHaveLength(1);
    });

    it("should reject thread creation with invalid data", async () => {
      const invalidData = {
        title: "", // Empty title
        content: "Some content",
      };

      const request = createAuthenticatedRequest(
        `http://localhost:3000/api/forums/categories/${testCategory.slug}/threads`,
        {
          id: testUser.id,
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          role: testUser.role as "admin" | "supporter" | "user",
          isActive: testUser.isActive ?? true,
          emailVerified: testUser.emailVerified ?? false,
        },
        {
          method: "POST",
          body: invalidData,
        }
      );

      const response = await createThreadRoute(request, {
        params: Promise.resolve({ slug: testCategory.slug }),
      } as any);

      expect(response.status).toBe(422);
    });
  });

  describe("GET /api/forums/categories/[slug]/threads/[id]", () => {
    beforeEach(async () => {
      testThread = await prisma.forumThread.create({
        data: {
          title: "Test Thread for Posts",
          slug: "test-thread-posts",
          categoryId: testCategory.id,
          createdBy: testUser.id,
          reportCount: 0,
        },
      });

      testPost = await prisma.forumPost.create({
        data: {
          content: "First post content",
          threadId: testThread.id,
          createdBy: testUser.id,
          reportCount: 0,
        },
      });
    });

    it("should return thread with all posts", async () => {
      const request = createAuthenticatedRequest(
        `http://localhost:3000/api/forums/categories/${testCategory.slug}/threads/${testThread.id}`,
        {
          id: testUser.id,
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          role: testUser.role as "admin" | "supporter" | "user",
          isActive: testUser.isActive ?? true,
          emailVerified: testUser.emailVerified ?? false,
        },
        { method: "GET" }
      );

      const response = await getThreadRoute(request, {
        params: Promise.resolve({
          slug: testCategory.slug,
          id: testThread.id.toString(),
        }),
      } as any);

      await assertApiResponse(response, 200, (data) => {
        expect(data.thread).toBeDefined();
        expect(data.thread.id).toBe(testThread.id);
        expect(data.thread.title).toBe("Test Thread for Posts");
        expect(data.thread.posts).toBeDefined();
        expect(Array.isArray(data.thread.posts)).toBe(true);
        expect(data.thread.posts).toHaveLength(1);
        expect(data.thread.posts[0].content).toBe("First post content");
        expect(data.thread.posts[0].author).toBeDefined();
      });
    });
  });

  describe("POST /api/forums/categories/[slug]/threads/[id]/posts", () => {
    beforeEach(async () => {
      testThread = await prisma.forumThread.create({
        data: {
          title: "Test Thread for New Posts",
          slug: "test-thread-new-posts",
          categoryId: testCategory.id,
          createdBy: testUser.id,
          reportCount: 0,
        },
      });
    });

    it("should create new post in thread", async () => {
      const postData = {
        content: "This is a new post in the thread",
      };

      const request = createAuthenticatedRequest(
        `http://localhost:3000/api/forums/categories/${testCategory.slug}/threads/${testThread.id}/posts`,
        {
          id: testUser.id,
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          role: testUser.role as "admin" | "supporter" | "user",
          isActive: testUser.isActive ?? true,
          emailVerified: testUser.emailVerified ?? false,
        },
        {
          method: "POST",
          body: postData,
        }
      );

      const response = await createPostRoute(request, {
        params: Promise.resolve({
          slug: testCategory.slug,
          id: testThread.id.toString(),
        }),
      } as any);

      await assertApiResponse(response, 201, (data) => {
        expect(data.post).toBeDefined();
        expect(data.post.content).toBe("This is a new post in the thread");
        expect(data.post.thread_id).toBe(testThread.id);
        expect(data.post.created_by).toBe(testUser.id);
        expect(data.thread).toBeDefined();
        expect(data.thread.id).toBe(testThread.id);
      });
    });

    it("should reject posting to locked thread", async () => {
      // Lock the thread
      await prisma.forumThread.update({
        where: { id: testThread.id },
        data: { isLocked: true },
      });

      const postData = {
        content: "Trying to post to locked thread",
      };

      const request = createAuthenticatedRequest(
        `http://localhost:3000/api/forums/categories/${testCategory.slug}/threads/${testThread.id}/posts`,
        {
          id: testUser.id,
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          role: testUser.role as "admin" | "supporter" | "user",
          isActive: testUser.isActive ?? true,
          emailVerified: testUser.emailVerified ?? false,
        },
        {
          method: "POST",
          body: postData,
        }
      );

      const response = await createPostRoute(request, {
        params: Promise.resolve({
          slug: testCategory.slug,
          id: testThread.id.toString(),
        }),
      } as any);

      expect(response.status).toBe(403);
    });
  });

  describe("POST /api/forums/category-requests", () => {
    it("should create new category request", async () => {
      const requestData = {
        name: "New Category Request",
        description: "Description for new category",
        justification: "We need this category for important discussions",
      };

      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/forums/category-requests",
        {
          id: testUser.id,
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          role: testUser.role as "admin" | "supporter" | "user",
          isActive: testUser.isActive ?? true,
          emailVerified: testUser.emailVerified ?? false,
        },
        {
          method: "POST",
          body: requestData,
        }
      );

      const response = await createCategoryRequestRoute(request);

      await assertApiResponse(response, 201, (data) => {
        expect(data.request).toBeDefined();
        expect(data.request.name).toBe("New Category Request");
        expect(data.request.description).toBe("Description for new category");
        expect(data.request.justification).toBe(
          "We need this category for important discussions"
        );
        expect(data.request.status).toBe("pending");
        expect(data.request.requested_by).toBe(testUser.id);
      });
    });

    it("should reject duplicate category request", async () => {
      // Create first request
      await createCategoryRequestRoute(
        createAuthenticatedRequest(
          "http://localhost:3000/api/forums/category-requests",
          {
            id: testUser.id,
            email: testUser.email,
            firstName: testUser.firstName,
            lastName: testUser.lastName,
            role: testUser.role as "admin" | "supporter" | "user",
            isActive: testUser.isActive ?? true,
            emailVerified: testUser.emailVerified ?? false,
          },
          {
            method: "POST",
            body: {
              name: "Duplicate Request",
              description: "First request",
              justification: "Need this category for community discussions",
            },
          }
        )
      );

      // Try to create duplicate
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/forums/category-requests",
        {
          id: testUser.id,
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          role: testUser.role as "admin" | "supporter" | "user",
          isActive: testUser.isActive ?? true,
          emailVerified: testUser.emailVerified ?? false,
        },
        {
          method: "POST",
          body: {
            name: "Duplicate Request",
            description: "Duplicate request",
            justification: "Need it again",
          },
        }
      );

      const response = await createCategoryRequestRoute(request);
      expect(response.status).toBe(409);
    });
  });

  describe("GET /api/forums/category-requests", () => {
    it("should return user's category requests", async () => {
      // Create a category request first
      await prisma.forumCategoryRequest.create({
        data: {
          name: "User Request",
          description: "User's category request",
          justification: "User needs this",
          requestedBy: testUser.id,
          status: "pending",
        },
      });

      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/forums/category-requests",
        {
          id: testUser.id,
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          role: testUser.role as "admin" | "supporter" | "user",
          isActive: testUser.isActive ?? true,
          emailVerified: testUser.emailVerified ?? false,
        },
        { method: "GET" }
      );

      const response = await getCategoryRequestsRoute(request);

      await assertApiResponse(response, 200, (data) => {
        expect(data.requests).toBeDefined();
        expect(Array.isArray(data.requests)).toBe(true);
        expect(data.requests).toHaveLength(1);
        expect(data.requests[0].name).toBe("User Request");
        expect(data.requests[0].status).toBe("pending");
      });
    });
  });

  describe("POST /api/forums/reports", () => {
    beforeEach(async () => {
      testThread = await prisma.forumThread.create({
        data: {
          title: "Thread to Report",
          slug: "thread-to-report",
          categoryId: testCategory.id,
          createdBy: testUser.id,
          reportCount: 0,
        },
      });

      testPost = await prisma.forumPost.create({
        data: {
          content: "Post to report",
          threadId: testThread.id,
          createdBy: testUser.id,
          reportCount: 0,
        },
      });
    });

    it("should create report for thread", async () => {
      const reportData = {
        thread_id: testThread.id,
        reason: "spam",
        details: "This thread is spam",
      };

      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/forums/reports",
        {
          id: testUser.id,
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          role: testUser.role as "admin" | "supporter" | "user",
          isActive: testUser.isActive ?? true,
          emailVerified: testUser.emailVerified ?? false,
        },
        {
          method: "POST",
          body: reportData,
        }
      );

      const response = await createReportRoute(request);

      await assertApiResponse(response, 201, (data) => {
        expect(data.report).toBeDefined();
        expect(data.report.thread_id).toBe(testThread.id);
        expect(data.report.reason).toBe("spam");
        expect(data.report.details).toBe("This thread is spam");
        expect(data.report.status).toBe("pending");
        expect(data.report.reported_by).toBe(testUser.id);
      });
    });

    it("should create report for post", async () => {
      const reportData = {
        post_id: testPost.id,
        reason: "inappropriate",
        details: "This post is inappropriate",
      };

      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/forums/reports",
        {
          id: testUser.id,
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          role: testUser.role as "admin" | "supporter" | "user",
          isActive: testUser.isActive ?? true,
          emailVerified: testUser.emailVerified ?? false,
        },
        {
          method: "POST",
          body: reportData,
        }
      );

      const response = await createReportRoute(request);

      await assertApiResponse(response, 201, (data) => {
        expect(data.report).toBeDefined();
        expect(data.report.post_id).toBe(testPost.id);
        expect(data.report.reason).toBe("inappropriate");
        expect(data.report.details).toBe("This post is inappropriate");
        expect(data.report.status).toBe("pending");
      });
    });

    it("should prevent duplicate reports from same user", async () => {
      const reportData = {
        thread_id: testThread.id,
        reason: "spam",
        details: "This thread is spam",
      };

      // Create first report
      await createReportRoute(
        createAuthenticatedRequest(
          "http://localhost:3000/api/forums/reports",
          {
            id: testUser.id,
            email: testUser.email,
            firstName: testUser.firstName,
            lastName: testUser.lastName,
            role: testUser.role as "admin" | "supporter" | "user",
            isActive: testUser.isActive ?? true,
            emailVerified: testUser.emailVerified ?? false,
          },
          {
            method: "POST",
            body: reportData,
          }
        )
      );

      // Try to create duplicate report
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/forums/reports",
        {
          id: testUser.id,
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          role: testUser.role as "admin" | "supporter" | "user",
          isActive: testUser.isActive ?? true,
          emailVerified: testUser.emailVerified ?? false,
        },
        {
          method: "POST",
          body: reportData,
        }
      );

      const response = await createReportRoute(request);
      expect(response.status).toBe(409);
    });
  });

  describe("GET /api/forums/reports", () => {
    it("should return user's reports", async () => {
      // Create a report first
      await prisma.forumReport.create({
        data: {
          threadId: testThread?.id || 1, // Use existing thread or fallback
          reason: "spam",
          details: "Test report",
          status: "pending",
          reportedBy: testUser.id,
        },
      });

      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/forums/reports",
        {
          id: testUser.id,
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          role: testUser.role as "admin" | "supporter" | "user",
          isActive: testUser.isActive ?? true,
          emailVerified: testUser.emailVerified ?? false,
        },
        { method: "GET" }
      );

      const response = await getReportsRoute(request);

      await assertApiResponse(response, 200, (data) => {
        expect(data.reports).toBeDefined();
        expect(Array.isArray(data.reports)).toBe(true);
        expect(data.pagination).toBeDefined();
      });
    });
  });

  describe("GET /api/forums/my", () => {
    beforeEach(async () => {
      testThread = await prisma.forumThread.create({
        data: {
          title: "User's Thread",
          slug: "users-thread",
          categoryId: testCategory.id,
          createdBy: testUser.id,
          reportCount: 0,
        },
      });
    });

    it("should return user's threads", async () => {
      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/forums/my?type=threads",
        {
          id: testUser.id,
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          role: testUser.role as "admin" | "supporter" | "user",
          isActive: testUser.isActive ?? true,
          emailVerified: testUser.emailVerified ?? false,
        },
        { method: "GET" }
      );

      const response = await getMyContentRoute(request);

      await assertApiResponse(response, 200, (data) => {
        expect(data.threads).toBeDefined();
        expect(Array.isArray(data.threads)).toBe(true);
        expect(data.pagination).toBeDefined();

        const userThread = data.threads.find(
          (t: ForumThread) => t.id === testThread.id
        );
        expect(userThread).toBeDefined();
        expect(userThread.title).toBe("User's Thread");
      });
    });

    it("should return user's posts", async () => {
      // Create a post first
      await prisma.forumPost.create({
        data: {
          content: "User's post content",
          threadId: testThread.id,
          createdBy: testUser.id,
          reportCount: 0,
        },
      });

      const request = createAuthenticatedRequest(
        "http://localhost:3000/api/forums/my?type=posts",
        {
          id: testUser.id,
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          role: testUser.role as "admin" | "supporter" | "user",
          isActive: testUser.isActive ?? true,
          emailVerified: testUser.emailVerified ?? false,
        },
        { method: "GET" }
      );

      const response = await getMyContentRoute(request);

      await assertApiResponse(response, 200, (data) => {
        expect(data.posts).toBeDefined();
        expect(Array.isArray(data.posts)).toBe(true);
        expect(data.pagination).toBeDefined();
        expect(data.posts.length).toBeGreaterThan(0);
        expect(data.posts[0].content).toBe("User's post content");
      });
    });
  });
});
