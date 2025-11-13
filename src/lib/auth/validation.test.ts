import { describe, it, expect } from "vitest";
import { validateUserRegistration, validateUserLogin } from "./validation";

describe("Auth Validation", () => {
  describe("validateUserRegistration", () => {
    it("should accept valid registration data", () => {
      const data = {
        email: "test@example.com",
        password: "ValidPass123!",
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
        password: "ValidPass123!",
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
        password: "ValidPass123!",
        first_name: "<b>John</b>",
        last_name: "<i>Doe</i>",
      };

      const result = validateUserRegistration(data);

      expect(result.valid).toBe(true);
      expect(result.data?.first_name).toBe("John");
      expect(result.data?.last_name).toBe("Doe");
    });

    it("should trim whitespace from name fields", () => {
      const data = {
        email: "test@example.com",
        password: "ValidPass123!",
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
          password: "ValidPass123!",
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
          password: "ValidPass123!",
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
          password: "ValidPass123!",
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
          password: "ValidPass123!",
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
          password: "ValidPass123!",
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
            password: "ValidPass123!",
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

      it("should reject password shorter than 12 characters", () => {
        const data = {
          email: "test@example.com",
          password: "Short1!",
          first_name: "John",
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(false);
        expect(result.errors?.["password"]).toContainEqual(
          "Password must be at least 12 characters long"
        );
      });

      it("should reject password longer than 128 characters", () => {
        const data = {
          email: "test@example.com",
          password: "A1!" + "a".repeat(126),
          first_name: "John",
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(false);
        expect(result.errors?.["password"]).toContainEqual(
          "Password must not exceed 128 characters"
        );
      });

      it("should reject password without lowercase letter", () => {
        const data = {
          email: "test@example.com",
          password: "UPPERCASE123!",
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
          password: "lowercase123!",
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
          password: "NoNumbersHere!",
          first_name: "John",
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(false);
        expect(result.errors?.["password"]).toContainEqual(
          "Password must contain at least one number"
        );
      });

      it("should reject password without special character", () => {
        const data = {
          email: "test@example.com",
          password: "NoSpecialChar123",
          first_name: "John",
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(false);
        expect(result.errors?.["password"]).toContainEqual(
          "Password must contain at least one special character"
        );
      });

      it("should accept minimum valid password", () => {
        const data = {
          email: "test@example.com",
          password: "Aa1!aaaaaaaa", // 12 chars, has all required types
          first_name: "John",
          last_name: "Doe",
        };

        const result = validateUserRegistration(data);

        expect(result.valid).toBe(true);
      });

      it("should accept password with various special characters", () => {
        const specialChars = ["!", "@", "#", "$", "%", "^", "&", "*"];

        specialChars.forEach((char) => {
          const data = {
            email: "test@example.com",
            password: `ValidPass123${char}`,
            first_name: "John",
            last_name: "Doe",
          };

          const result = validateUserRegistration(data);

          expect(result.valid).toBe(true);
        });
      });
    });

    describe("name validation", () => {
      it("should reject missing first name", () => {
        const data = {
          email: "test@example.com",
          password: "ValidPass123!",
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
          password: "ValidPass123!",
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
          password: "ValidPass123!",
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
          password: "ValidPass123!",
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
          password: "ValidPass123!",
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
          password: "ValidPass123!",
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
          password: "ValidPass123!",
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
