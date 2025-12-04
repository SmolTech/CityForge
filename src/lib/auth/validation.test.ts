import { describe, it, expect } from "vitest";
import { validateUserRegistration, validateUserLogin } from "./validation";

describe("Auth Validation", () => {
  describe("validateUserRegistration", () => {
    it("should accept valid registration data", () => {
      const data = {
        email: "test@example.com",
        password: "ValidPass123",
        first_name: "John",
        last_name: "Doe",
      };

      const result = validateUserRegistration(data);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(result.data?.email).toBe("test@example.com");
      expect(result.data?.first_name).toBe("John");
      expect(result.data?.last_name).toBe("Doe");
    });

    it("should normalize email to lowercase and trim", () => {
      const data = {
        email: "TEST@EXAMPLE.COM",
        password: "ValidPass123",
        first_name: "John",
        last_name: "Doe",
      };

      const result = validateUserRegistration(data);

      expect(result.valid).toBe(true);
      expect(result.data?.email).toBe("test@example.com");
    });

    it("should sanitize name fields by removing HTML", () => {
      const data = {
        email: "test@example.com",
        password: "ValidPass123",
        first_name: "<b>John</b>",
        last_name: "<i>Doe</i>",
      };

      const result = validateUserRegistration(data);

      expect(result.valid).toBe(true);
      expect(result.data?.first_name).toBe("John");
      expect(result.data?.last_name).toBe("Doe");
    });

    describe("XSS protection (SECURITY)", () => {
      it("should block nested tag XSS bypass attempt", () => {
        const data = {
          email: "test@example.com",
          password: "ValidPass123",
          first_name: "John<<script>alert(1)</script>Smith",
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(true);
        // DOMPurify blocks nested tags and prevents script execution
        expect(result.data?.first_name).not.toContain("<script>");
        expect(result.data?.first_name).not.toContain("</script>");
        expect(result.data?.first_name).not.toContain("alert");
        // Should contain at least some of the safe text
        expect(result.data?.first_name).toContain("John");
      });

      it("should block self-closing tag XSS bypass with img", () => {
        const data = {
          email: "test@example.com",
          password: "ValidPass123",
          first_name: "John<img/src=x/onerror=alert(1)>",
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(true);
        expect(result.data?.first_name).toBe("John");
        expect(result.data?.first_name).not.toContain("onerror");
        expect(result.data?.first_name).not.toContain("<img");
        expect(result.data?.first_name).not.toContain("alert");
      });

      it("should block SVG-based XSS attack", () => {
        const data = {
          email: "test@example.com",
          password: "ValidPass123",
          first_name: "John<svg/onload=alert(1)>",
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(true);
        // DOMPurify strips SVG tags and event handlers
        expect(result.data?.first_name).toBe("John");
        expect(result.data?.first_name).not.toContain("onload");
        expect(result.data?.first_name).not.toContain("<svg");
        expect(result.data?.first_name).not.toContain("alert");
      });

      it("should block iframe injection", () => {
        const data = {
          email: "test@example.com",
          password: "ValidPass123",
          first_name: 'John<iframe src="javascript:alert(1)"></iframe>Smith',
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(true);
        // DOMPurify strips iframe entirely (including content if any)
        expect(result.data?.first_name).toBe("JohnSmith");
        expect(result.data?.first_name).not.toContain("<iframe");
        expect(result.data?.first_name).not.toContain("javascript:");
      });

      it("should block event handler XSS", () => {
        const data = {
          email: "test@example.com",
          password: "ValidPass123",
          first_name: '<div onclick="alert(1)">Test</div>',
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(true);
        expect(result.data?.first_name).toBe("Test");
        expect(result.data?.first_name).not.toContain("onclick");
        expect(result.data?.first_name).not.toContain("alert");
      });

      it("should block javascript: protocol XSS", () => {
        const data = {
          email: "test@example.com",
          password: "ValidPass123",
          first_name: 'John<a href="javascript:alert(1)">Click</a>',
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(true);
        // DOMPurify strips the anchor tag but keeps text content
        expect(result.data?.first_name).toContain("John");
        expect(result.data?.first_name).toContain("Click");
        expect(result.data?.first_name).not.toContain("javascript:");
        expect(result.data?.first_name).not.toContain("<a");
      });

      it("should block data: URI XSS", () => {
        const data = {
          email: "test@example.com",
          password: "ValidPass123",
          first_name:
            'John<a href="data:text/html,<script>alert(1)</script>">Link</a>',
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(true);
        // DOMPurify strips the anchor tag but keeps text content
        expect(result.data?.first_name).toContain("John");
        expect(result.data?.first_name).toContain("Link");
        expect(result.data?.first_name).not.toContain("data:");
        expect(result.data?.first_name).not.toContain("<script>");
        expect(result.data?.first_name).not.toContain("<a");
      });

      it("should handle multiple XSS attempts in same field", () => {
        const data = {
          email: "test@example.com",
          password: "ValidPass123",
          first_name: "<<script>alert(1)</script><img src=x onerror=alert(2)>",
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(true);
        expect(result.data?.first_name).not.toContain("<script>");
        expect(result.data?.first_name).not.toContain("<img");
        expect(result.data?.first_name).not.toContain("onerror");
        expect(result.data?.first_name).not.toContain("alert");
      });
    });

    it("should trim whitespace from name fields", () => {
      const data = {
        email: "test@example.com",
        password: "ValidPass123",
        first_name: "  John  ",
        last_name: "  Doe  ",
      };

      const result = validateUserRegistration(data);

      expect(result.valid).toBe(true);
      expect(result.data?.first_name).toBe("John");
      expect(result.data?.last_name).toBe("Doe");
    });

    describe("email validation", () => {
      it("should reject missing email", () => {
        const data = {
          password: "ValidPass123",
          first_name: "John",
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(false);
        expect(result.errors?.["email"]).toContainEqual("Email is required");
      });

      it("should reject invalid email format", () => {
        const data = {
          email: "invalid-email",
          password: "ValidPass123",
          first_name: "John",
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(false);
        expect(result.errors?.["email"]).toContainEqual("Invalid email format");
      });

      it("should reject email without domain", () => {
        const data = {
          email: "test@",
          password: "ValidPass123",
          first_name: "John",
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(false);
        expect(result.errors?.["email"]).toContainEqual("Invalid email format");
      });

      it("should reject email without @", () => {
        const data = {
          email: "testexample.com",
          password: "ValidPass123",
          first_name: "John",
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(false);
        expect(result.errors?.["email"]).toContainEqual("Invalid email format");
      });

      it("should reject email that is too long", () => {
        const data = {
          email: "a".repeat(250) + "@example.com",
          password: "ValidPass123",
          first_name: "John",
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(false);
        expect(result.errors?.["email"]).toContainEqual(
          "Email must not exceed 255 characters"
        );
      });

      it("should accept valid email formats", () => {
        const validEmails = [
          "test@example.com",
          "user.name@example.com",
          "user+tag@example.co.uk",
          "test123@test-domain.com",
        ];

        validEmails.forEach((email) => {
          const data = {
            email,
            password: "ValidPass123",
            first_name: "John",
            last_name: "Doe",
          };

          const result = validateUserRegistration(data);

          expect(result.valid).toBe(true);
        });
      });
    });

    describe("password validation", () => {
      it("should reject missing password", () => {
        const data = {
          email: "test@example.com",
          first_name: "John",
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(false);
        expect(result.errors?.["password"]).toContainEqual(
          "Password is required"
        );
      });

      it("should reject password shorter than 8 characters", () => {
        const data = {
          email: "test@example.com",
          password: "Short1",
          first_name: "John",
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(false);
        expect(result.errors?.["password"]).toContainEqual(
          "Password must be at least 8 characters long"
        );
      });

      it("should reject password without lowercase letter", () => {
        const data = {
          email: "test@example.com",
          password: "UPPERCASE123",
          first_name: "John",
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(false);
        expect(result.errors?.["password"]).toContainEqual(
          "Password must contain at least one lowercase letter"
        );
      });

      it("should reject password without uppercase letter", () => {
        const data = {
          email: "test@example.com",
          password: "lowercase123",
          first_name: "John",
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(false);
        expect(result.errors?.["password"]).toContainEqual(
          "Password must contain at least one uppercase letter"
        );
      });

      it("should reject password without number", () => {
        const data = {
          email: "test@example.com",
          password: "NoNumbersHere",
          first_name: "John",
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(false);
        expect(result.errors?.["password"]).toContainEqual(
          "Password must contain at least one number"
        );
      });

      it("should accept minimum valid password", () => {
        const data = {
          email: "test@example.com",
          password: "Pass1234", // 8 chars, has all required types
          first_name: "John",
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(true);
      });

      it("should accept password without special characters", () => {
        const data = {
          email: "test@example.com",
          password: "ValidPass123",
          first_name: "John",
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(true);
      });
    });

    describe("name validation", () => {
      it("should reject missing first name", () => {
        const data = {
          email: "test@example.com",
          password: "ValidPass123",
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(false);
        expect(result.errors?.["first_name"]).toContainEqual(
          "First name is required"
        );
      });

      it("should reject missing last name", () => {
        const data = {
          email: "test@example.com",
          password: "ValidPass123",
          first_name: "John",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(false);
        expect(result.errors?.["last_name"]).toContainEqual(
          "Last name is required"
        );
      });

      it("should reject empty first name after sanitization", () => {
        const data = {
          email: "test@example.com",
          password: "ValidPass123",
          first_name: "   ",
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(false);
        expect(result.errors?.["first_name"]).toContainEqual(
          "First name must not be empty"
        );
      });

      it("should reject empty last name after sanitization", () => {
        const data = {
          email: "test@example.com",
          password: "ValidPass123",
          first_name: "John",
          last_name: "   ",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(false);
        expect(result.errors?.["last_name"]).toContainEqual(
          "Last name must not be empty"
        );
      });

      it("should reject first name longer than 50 characters", () => {
        const data = {
          email: "test@example.com",
          password: "ValidPass123",
          first_name: "a".repeat(51),
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(false);
        expect(result.errors?.["first_name"]).toContainEqual(
          "First name must not exceed 50 characters"
        );
      });

      it("should reject last name longer than 50 characters", () => {
        const data = {
          email: "test@example.com",
          password: "ValidPass123",
          first_name: "John",
          last_name: "a".repeat(51),
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(false);
        expect(result.errors?.["last_name"]).toContainEqual(
          "Last name must not exceed 50 characters"
        );
      });

      it("should accept names with 50 characters", () => {
        const data = {
          email: "test@example.com",
          password: "ValidPass123",
          first_name: "a".repeat(50),
          last_name: "b".repeat(50),
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(true);
      });
    });

    describe("multiple validation errors", () => {
      it("should return all validation errors at once", () => {
        const data = {
          email: "invalid",
          password: "weak",
          first_name: "",
          last_name: "",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(false);
        expect(result.errors?.["email"]).toBeDefined();
        expect(result.errors?.["password"]).toBeDefined();
        expect(result.errors?.["first_name"]).toBeDefined();
        expect(result.errors?.["last_name"]).toBeDefined();
      });
    });
  });

  describe("validateUserLogin", () => {
    it("should accept valid login data", () => {
      const data = {
        email: "test@example.com",
        password: "anypassword",
      };

      const result = validateUserLogin(data);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(result.data?.email).toBe("test@example.com");
      expect(result.data?.password).toBe("anypassword");
    });

    it("should normalize email to lowercase and trim", () => {
      const data = {
        email: "TEST@EXAMPLE.COM",
        password: "anypassword",
      };

      const result = validateUserLogin(data);

      expect(result.valid).toBe(true);
      expect(result.data?.email).toBe("test@example.com");
    });

    it("should reject missing email", () => {
      const data = {
        password: "anypassword",
      };

      const result = validateUserLogin(data);

      expect(result.valid).toBe(false);
      expect(result.errors?.["email"]).toContainEqual("Email is required");
    });

    it("should reject invalid email format", () => {
      const data = {
        email: "invalid-email",
        password: "anypassword",
      };

      const result = validateUserLogin(data);

      expect(result.valid).toBe(false);
      expect(result.errors?.["email"]).toContainEqual("Invalid email format");
    });

    it("should reject missing password", () => {
      const data = {
        email: "test@example.com",
      };

      const result = validateUserLogin(data);

      expect(result.valid).toBe(false);
      expect(result.errors?.["password"]).toContainEqual(
        "Password is required"
      );
    });

    it("should not validate password strength for login", () => {
      const data = {
        email: "test@example.com",
        password: "weak",
      };

      const result = validateUserLogin(data);

      // Login should accept any password (strength check is on registration only)
      expect(result.valid).toBe(true);
      expect(result.data?.password).toBe("weak");
    });

    it("should reject both missing email and password", () => {
      const data = {};

      const result = validateUserLogin(data);

      expect(result.valid).toBe(false);
      expect(result.errors?.["email"]).toBeDefined();
      expect(result.errors?.["password"]).toBeDefined();
    });

    it("should accept empty string password but require it", () => {
      const data = {
        email: "test@example.com",
        password: "",
      };

      const result = validateUserLogin(data);

      expect(result.valid).toBe(false);
      expect(result.errors?.["password"]).toContainEqual(
        "Password is required"
      );
    });
  });
});
