#!/usr/bin/env node

/**
 * Convert Single Flask JSON Export to Admin API Format
 *
 * This script converts a single JSON file containing Flask export data
 * into the format expected by the admin data import API.
 *
 * Usage:
 *   node convert-single-json-to-admin-format.mjs --input ./cityforge_export.json --output ./admin-import-data.json
 */

import { promises as fs } from "fs";
import { resolve } from "path";

// Command line argument parsing
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, "");
    const value = args[i + 1];
    options[key] = value;
  }

  return options;
}

// Convert snake_case to camelCase
function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Convert field names from snake_case to camelCase
function convertFieldNames(obj) {
  if (Array.isArray(obj)) {
    return obj.map(convertFieldNames);
  } else if (obj !== null && typeof obj === "object") {
    const newObj = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKey = toCamelCase(key);
      newObj[newKey] = convertFieldNames(value);
    }
    return newObj;
  }
  return obj;
}

// Convert date strings to proper ISO format
function formatDate(dateString) {
  if (!dateString || dateString === null) {
    return null;
  }

  try {
    // If the date string already has timezone info (Z or +/-offset), use it as-is
    if (
      typeof dateString === "string" &&
      (dateString.endsWith("Z") ||
        dateString.match(/[+-]\d{2}:\d{2}$/) ||
        dateString.includes("+00:00"))
    ) {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return null;
      }
      return date.toISOString();
    }

    // If the date string is missing timezone info, assume UTC and add 'Z'
    if (
      typeof dateString === "string" &&
      dateString.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    ) {
      // Add 'Z' to treat as UTC
      const dateWithTz = dateString + "Z";
      const date = new Date(dateWithTz);
      if (isNaN(date.getTime())) {
        return null;
      }
      return date.toISOString();
    }

    // Parse the date and ensure it's in proper ISO format
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString();
  } catch {
    console.warn(`Failed to parse date: ${dateString}`);
    return null;
  }
}

// Convert boolean fields and format dates
function convertFieldTypes(obj, modelName) {
  if (Array.isArray(obj)) {
    return obj.map((item) => convertFieldTypes(item, modelName));
  } else if (obj !== null && typeof obj === "object") {
    const newObj = { ...obj };

    // Define boolean fields by model
    const booleanFields = {
      User: ["isActive", "isSupporterFlag"],
      Card: ["featured", "approved"],
      CardSubmission: [],
      CardModification: [],
      Review: [],
      ResourceItem: ["isActive"],
      ForumCategory: ["isActive"],
      ForumPost: ["isFirstPost"],
    };

    // Define date fields by model
    const dateFields = {
      User: ["createdDate", "lastLogin"],
      Card: ["createdDate", "updatedDate", "approvedDate"],
      Tag: ["createdDate"],
      CardSubmission: ["createdDate", "reviewedDate"],
      CardModification: ["createdDate", "reviewedDate"],
      Review: ["createdDate", "updatedDate"],
      ResourceCategory: ["createdDate"],
      ResourceItem: ["createdDate", "updatedDate"],
      QuickAccessItem: ["createdDate"],
      ResourceConfig: ["createdDate", "updatedDate"],
      ForumCategory: ["createdDate", "updatedDate"],
      ForumCategoryRequest: ["createdDate", "reviewedDate"],
      ForumThread: ["createdDate", "updatedDate"],
      ForumPost: ["createdDate", "updatedDate", "editedDate"],
      ForumReport: ["createdDate", "resolvedDate"],
      HelpWantedPost: ["createdDate", "updatedDate"],
      HelpWantedComment: ["createdDate", "updatedDate"],
      HelpWantedReport: ["createdDate", "resolvedDate"],
      IndexingJob: ["startedAt", "completedAt", "createdDate", "updatedDate"],
    };

    const booleanFieldsToConvert = booleanFields[modelName] || [];
    const dateFieldsToConvert = dateFields[modelName] || [];

    // Convert boolean fields
    for (const field of booleanFieldsToConvert) {
      if (newObj.hasOwnProperty(field)) {
        // Convert 1/0 or string boolean to actual boolean
        if (
          newObj[field] === 1 ||
          newObj[field] === "1" ||
          newObj[field] === "true"
        ) {
          newObj[field] = true;
        } else if (
          newObj[field] === 0 ||
          newObj[field] === "0" ||
          newObj[field] === "false"
        ) {
          newObj[field] = false;
        }
      }
    }

    // Convert date fields
    for (const field of dateFieldsToConvert) {
      if (newObj.hasOwnProperty(field)) {
        newObj[field] = formatDate(newObj[field]);
      }
    }

    return newObj;
  }
  return obj;
}

// Main conversion function
async function convertFlaskData(inputPath, outputPath) {
  try {
    console.log(`Reading Flask export data from: ${inputPath}`);

    // Read the input file
    const inputData = JSON.parse(await fs.readFile(inputPath, "utf8"));

    if (!inputData.data) {
      throw new Error("Input file does not contain 'data' property");
    }

    const adminFormat = {};

    // Process each model in the Flask data
    for (const [modelName, records] of Object.entries(inputData.data)) {
      console.log(`Converting ${records.length} ${modelName} records...`);

      // Convert field names from snake_case to camelCase
      let convertedRecords = convertFieldNames(records);

      // Convert boolean fields and format dates
      convertedRecords = convertFieldTypes(convertedRecords, modelName);

      // Add to admin format
      adminFormat[modelName] = convertedRecords;
    }

    // Write the converted data
    console.log(`Writing admin format data to: ${outputPath}`);
    await fs.writeFile(outputPath, JSON.stringify(adminFormat, null, 2));

    console.log("\n✅ Conversion completed successfully!");
    console.log("\nNext steps:");
    console.log("1. Start your Next.js server: npm run dev");
    console.log("2. Navigate to http://localhost:3000/admin");
    console.log("3. Go to 'Data Management' section");
    console.log(`4. Upload the file: ${outputPath}`);
    console.log("5. Type 'DELETE ALL DATA' to confirm");
    console.log("6. Click 'Import'");

    // Show conversion summary
    console.log("\nConversion Summary:");
    for (const [modelName, records] of Object.entries(adminFormat)) {
      console.log(`  ${modelName}: ${records.length} records`);
    }
  } catch (error) {
    console.error("❌ Conversion failed:", error.message);
    process.exit(1);
  }
}

// Main execution
async function main() {
  const options = parseArgs();

  if (!options.input || !options.output) {
    console.error(
      "Usage: node convert-single-json-to-admin-format.mjs --input <input-file> --output <output-file>"
    );
    console.error(
      "Example: node convert-single-json-to-admin-format.mjs --input ./cityforge_export.json --output ./admin-import-data.json"
    );
    process.exit(1);
  }

  const inputPath = resolve(options.input);
  const outputPath = resolve(options.output);

  await convertFlaskData(inputPath, outputPath);
}

main().catch(console.error);
