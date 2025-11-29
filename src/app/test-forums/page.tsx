"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";

export default function TestForumsPage() {
  const [result, setResult] = useState<string>("Loading...");

  useEffect(() => {
    async function test() {
      try {
        console.log("Testing forums API...");
        const data = await apiClient.getForumCategories(true);
        console.log("API Response:", data);
        setResult(
          `SUCCESS: Found ${data.length} categories: ${JSON.stringify(data, null, 2)}`
        );
      } catch (error) {
        console.error("API Error:", error);
        setResult(`ERROR: ${error}`);
      }
    }
    test();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-xl mb-4">Forums API Test</h1>
      <pre className="whitespace-pre-wrap">{result}</pre>
    </div>
  );
}
