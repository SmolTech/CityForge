#!/usr/bin/env node

const API_BASE = "http://localhost:3000";
const TEST_EMAIL = "admin@test.com";
const TEST_PASSWORD = "TestPassword123!";

console.log("🔧 Testing CSRF Fix Locally");
console.log("📍 Server:", API_BASE);
console.log("👤 User:", TEST_EMAIL);

const cookieJar = new Map();
let csrfToken = null;

// Helper to handle cookies like a browser
function extractCookies(response) {
  // Use getSetCookie() to properly handle multiple Set-Cookie headers
  const setCookieHeaders = response.headers.getSetCookie();
  setCookieHeaders.forEach((cookie) => {
    const [nameValue] = cookie.split(";");
    const [name, value] = nameValue.split("=");
    if (name && value) {
      cookieJar.set(name.trim(), value.trim());
    }
  });
}

function getCookieHeader() {
  const cookies = Array.from(cookieJar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  return cookies;
}

try {
  console.log("\n🔑 Step 1: Login to get CSRF token...");

  const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
  });

  console.log("📊 Login status:", loginResponse.status);

  if (loginResponse.status !== 200) {
    const errorData = await loginResponse.text();
    console.log("❌ Login failed:", errorData);
    process.exit(1);
  }

  // Extract cookies and CSRF token
  extractCookies(loginResponse);
  csrfToken = cookieJar.get("csrf_token");

  await loginResponse.json();
  console.log("✅ Login successful");
  console.log("🍪 Cookies received:", Array.from(cookieJar.keys()));
  console.log(
    "🛡️  CSRF token:",
    csrfToken ? `${csrfToken.substring(0, 8)}...` : "NOT FOUND"
  );

  if (!csrfToken) {
    console.log("❌ CSRF token not found in cookies!");
    process.exit(1);
  }

  console.log(
    "\n🎯 Step 2: Test forum category request with CSRF protection..."
  );

  const categoryRequestResponse = await fetch(
    `${API_BASE}/api/forums/category-requests`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: getCookieHeader(),
        "X-CSRF-Token": csrfToken, // This is the key fix!
      },
      body: JSON.stringify({
        name: "Test Category (CSRF Fix)",
        description: "Testing CSRF protection fix",
        justification: "This is a test to verify the CSRF fix works correctly",
      }),
    }
  );

  console.log("📊 Category request status:", categoryRequestResponse.status);

  if (categoryRequestResponse.status !== 201) {
    const errorData = await categoryRequestResponse.text();
    console.log("❌ Category request failed:", errorData);

    // Try to parse the error for more details
    try {
      const errorJson = JSON.parse(errorData);
      if (errorJson.error?.code === "CSRF_TOKEN_INVALID") {
        console.log(
          "🚨 CSRF VALIDATION FAILED - This means the fix didn't work!"
        );
      }
    } catch {}

    process.exit(1);
  }

  const categoryData = await categoryRequestResponse.json();
  console.log("✅ Category request successful!");
  console.log("📝 Request ID:", categoryData.request?.id);
  console.log("📛 Category name:", categoryData.request?.name);

  console.log("\n🎉 CSRF FIX VERIFICATION COMPLETE!");
  console.log("✅ The CSRF token validation is now working correctly");
  console.log("✅ Forum category requests can now reach the database");
  console.log("✅ The worcester.community issue should be resolved");
} catch (error) {
  console.error("💥 Error during testing:", error.message);
  process.exit(1);
}
