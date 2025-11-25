/**
 * Security Headers Validator and Testing Utility
 *
 * This utility provides programmatic testing and validation of security headers
 * for the CityForge application. It can be used in test suites, CI/CD pipelines,
 * and for development verification.
 */

interface SecurityHeaderTestResult {
  passed: boolean;
  message: string;
  actual?: string;
  expected?: string;
}

interface SecurityHeadersTestReport {
  url: string;
  overallPassed: boolean;
  timestamp: string;
  results: {
    [headerName: string]: SecurityHeaderTestResult;
  };
  warnings: string[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

/**
 * Security header test definitions
 */
const SECURITY_HEADER_TESTS = {
  "content-security-policy": {
    required: true,
    validator: (value: string) => {
      const tests: SecurityHeaderTestResult[] = [];

      // Must include default-src 'self'
      if (value.includes("default-src 'self'")) {
        tests.push({
          passed: true,
          message: "default-src 'self' directive present",
        });
      } else {
        tests.push({
          passed: false,
          message: "Missing default-src 'self' directive",
          actual: value,
          expected: "default-src 'self'",
        });
      }

      // Must include object-src 'none'
      if (value.includes("object-src 'none'")) {
        tests.push({
          passed: true,
          message: "object-src 'none' directive present",
        });
      } else {
        tests.push({
          passed: false,
          message: "Missing object-src 'none' directive",
          actual: value,
          expected: "object-src 'none'",
        });
      }

      // Must include frame-ancestors 'none'
      if (value.includes("frame-ancestors 'none'")) {
        tests.push({
          passed: true,
          message: "frame-ancestors 'none' directive present",
        });
      } else {
        tests.push({
          passed: false,
          message: "Missing frame-ancestors 'none' directive",
          actual: value,
          expected: "frame-ancestors 'none'",
        });
      }

      // Check for common CSP issues
      const warnings: string[] = [];
      if (value.includes("'unsafe-inline'") && !value.includes("ws:")) {
        warnings.push(
          "'unsafe-inline' detected - ensure this is intentional for production"
        );
      }
      if (value.includes("'unsafe-eval'") && !value.includes("ws:")) {
        warnings.push(
          "'unsafe-eval' detected - ensure this is intentional for production"
        );
      }

      return { tests, warnings };
    },
  },
  "strict-transport-security": {
    required: false, // Only for HTTPS
    validator: (value: string, url: string) => {
      const isHttps = url.startsWith("https:");
      const tests: SecurityHeaderTestResult[] = [];

      if (!isHttps) {
        tests.push({
          passed: true,
          message: "HSTS not required for HTTP URLs",
        });
      } else if (
        value.includes("max-age=") &&
        value.includes("includeSubDomains")
      ) {
        tests.push({
          passed: true,
          message: "HSTS header properly configured",
        });
      } else {
        tests.push({
          passed: false,
          message: "HSTS header missing or misconfigured for HTTPS",
          actual: value,
          expected: "max-age=31536000; includeSubDomains",
        });
      }

      return { tests, warnings: [] };
    },
  },
  "x-frame-options": {
    required: true,
    validator: (value: string) => {
      const tests: SecurityHeaderTestResult[] = [];

      if (value.toUpperCase() === "DENY") {
        tests.push({
          passed: true,
          message: "X-Frame-Options properly set to DENY",
        });
      } else {
        tests.push({
          passed: false,
          message: "X-Frame-Options should be set to DENY",
          actual: value,
          expected: "DENY",
        });
      }

      return { tests, warnings: [] };
    },
  },
  "x-content-type-options": {
    required: true,
    validator: (value: string) => {
      const tests: SecurityHeaderTestResult[] = [];

      if (value.toLowerCase() === "nosniff") {
        tests.push({
          passed: true,
          message: "X-Content-Type-Options properly set",
        });
      } else {
        tests.push({
          passed: false,
          message: "X-Content-Type-Options should be set to nosniff",
          actual: value,
          expected: "nosniff",
        });
      }

      return { tests, warnings: [] };
    },
  },
  "referrer-policy": {
    required: true,
    validator: (value: string) => {
      const tests: SecurityHeaderTestResult[] = [];
      const validPolicies = [
        "strict-origin-when-cross-origin",
        "strict-origin",
        "no-referrer",
        "same-origin",
      ];

      if (validPolicies.includes(value.toLowerCase())) {
        tests.push({
          passed: true,
          message: "Referrer-Policy properly configured",
        });
      } else {
        tests.push({
          passed: false,
          message: "Referrer-Policy should be set to a secure value",
          actual: value,
          expected: "strict-origin-when-cross-origin",
        });
      }

      return { tests, warnings: [] };
    },
  },
  "permissions-policy": {
    required: true,
    validator: (value: string) => {
      const tests: SecurityHeaderTestResult[] = [];
      const warnings: string[] = [];

      // Check for restrictive permissions
      const restrictiveFeatures = [
        "camera=()",
        "microphone=()",
        "geolocation=()",
      ];
      const presentFeatures = restrictiveFeatures.filter((feature) =>
        value.includes(feature)
      );

      if (presentFeatures.length > 0) {
        tests.push({
          passed: true,
          message: `Permissions-Policy restricts ${presentFeatures.length} sensitive features`,
        });
      } else {
        warnings.push("Permissions-Policy could be more restrictive");
      }

      return { tests, warnings };
    },
  },
};

/**
 * Fetch and parse security headers from a URL
 */
async function fetchSecurityHeaders(
  url: string
): Promise<Record<string, string>> {
  try {
    const response = await fetch(url, { method: "HEAD" });
    const headers: Record<string, string> = {};

    // Extract security-related headers
    Object.keys(SECURITY_HEADER_TESTS).forEach((headerName) => {
      const value = response.headers.get(headerName);
      if (value) {
        headers[headerName] = value;
      }
    });

    return headers;
  } catch (error) {
    throw new Error(`Failed to fetch headers from ${url}: ${error}`);
  }
}

/**
 * Test security headers for a given URL
 */
export async function testSecurityHeaders(
  url: string
): Promise<SecurityHeadersTestReport> {
  const headers = await fetchSecurityHeaders(url);
  const results: { [headerName: string]: SecurityHeaderTestResult } = {};
  const allWarnings: string[] = [];
  let totalTests = 0;
  let passedTests = 0;

  // Test each security header
  for (const [headerName, config] of Object.entries(SECURITY_HEADER_TESTS)) {
    const headerValue = headers[headerName];

    if (!headerValue && config.required) {
      results[headerName] = {
        passed: false,
        message: `Required header ${headerName} is missing`,
      };
      totalTests++;
    } else if (!headerValue && !config.required) {
      results[headerName] = {
        passed: true,
        message: `Optional header ${headerName} not present`,
      };
      totalTests++;
      passedTests++;
    } else if (headerValue) {
      // Run validator
      const validation = config.validator(headerValue, url);
      const headerPassed = validation.tests.every((test) => test.passed);

      results[headerName] = {
        passed: headerPassed,
        message: validation.tests.map((test) => test.message).join("; "),
        actual: headerValue,
      };

      totalTests += validation.tests.length;
      passedTests += validation.tests.filter((test) => test.passed).length;
      allWarnings.push(...validation.warnings);
    }
  }

  const overallPassed = passedTests === totalTests;

  return {
    url,
    overallPassed,
    timestamp: new Date().toISOString(),
    results,
    warnings: allWarnings,
    summary: {
      total: totalTests,
      passed: passedTests,
      failed: totalTests - passedTests,
    },
  };
}

/**
 * Test multiple URLs and return a comprehensive report
 */
export async function testMultipleUrls(
  urls: string[]
): Promise<SecurityHeadersTestReport[]> {
  const reports: SecurityHeadersTestReport[] = [];

  for (const url of urls) {
    try {
      const report = await testSecurityHeaders(url);
      reports.push(report);
    } catch (error) {
      reports.push({
        url,
        overallPassed: false,
        timestamp: new Date().toISOString(),
        results: {
          error: {
            passed: false,
            message: `Failed to test URL: ${error}`,
          },
        },
        warnings: [],
        summary: { total: 1, passed: 0, failed: 1 },
      });
    }
  }

  return reports;
}

/**
 * Generate a human-readable report from test results
 */
export function generateReport(reports: SecurityHeadersTestReport[]): string {
  let output = "Security Headers Test Report\n";
  output += "============================\n\n";

  for (const report of reports) {
    output += `URL: ${report.url}\n`;
    output += `Tested at: ${report.timestamp}\n`;
    output += `Overall: ${report.overallPassed ? "✅ PASSED" : "❌ FAILED"}\n`;
    output += `Summary: ${report.summary.passed}/${report.summary.total} tests passed\n\n`;

    // Individual header results
    for (const [headerName, result] of Object.entries(report.results)) {
      output += `  ${result.passed ? "✅" : "❌"} ${headerName}: ${result.message}\n`;
      if (result.actual && !result.passed) {
        output += `     Actual: ${result.actual}\n`;
        if (result.expected) {
          output += `     Expected: ${result.expected}\n`;
        }
      }
    }

    // Warnings
    if (report.warnings.length > 0) {
      output += "\n  Warnings:\n";
      for (const warning of report.warnings) {
        output += `  ⚠️  ${warning}\n`;
      }
    }

    output += "\n" + "=".repeat(50) + "\n\n";
  }

  return output;
}

/**
 * Command line interface for testing
 */
async function main() {
  const args = process.argv.slice(2);
  const url = args[0] || "http://localhost:3000";

  console.log(`Testing security headers for: ${url}`);

  try {
    const report = await testSecurityHeaders(url);
    const output = generateReport([report]);
    console.log(output);

    // Exit with appropriate code
    process.exit(report.overallPassed ? 0 : 1);
  } catch (error) {
    console.error(`Error testing security headers: ${error}`);
    process.exit(1);
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  main();
}
