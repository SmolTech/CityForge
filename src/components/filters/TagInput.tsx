"use client";

import { useState, KeyboardEvent } from "react";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
}

export default function TagInput({
  tags,
  onChange,
  placeholder = "Add a tag...",
  maxTags,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && inputValue === "" && tags.length > 0) {
      // Remove last tag if backspace is pressed with empty input
      removeTag(tags.length - 1);
    }
  };

  const addTag = () => {
    const newTag = inputValue.trim().replace(/,+$/, ""); // Remove trailing commas
    if (newTag && !tags.includes(newTag)) {
      if (maxTags && tags.length >= maxTags) {
        return; // Don't add if max tags reached
      }
      onChange([...tags, newTag]);
      setInputValue("");
    }
  };

  const removeTag = (indexToRemove: number) => {
    onChange(tags.filter((_, index) => index !== indexToRemove));
  };

  const handleBlur = () => {
    // Add tag on blur if there's text
    if (inputValue.trim()) {
      addTag();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    const newTags = pastedText
      .split(/[,\n]/)
      .map((tag) => tag.trim())
      .filter((tag) => tag && !tags.includes(tag));

    if (maxTags) {
      const remainingSlots = maxTags - tags.length;
      onChange([...tags, ...newTags.slice(0, remainingSlots)]);
    } else {
      onChange([...tags, ...newTags]);
    }
    setInputValue("");
  };

  return (
    <div className="space-y-2">
      <div className="min-h-[42px] p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700"
            >
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(index)}
                className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5 transition-colors"
                aria-label={`Remove ${tag} tag`}
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </span>
          ))}
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onPaste={handlePaste}
            placeholder={tags.length === 0 ? placeholder : ""}
            disabled={maxTags ? tags.length >= maxTags : false}
            className="flex-1 min-w-[120px] px-1 py-1 outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            data-testid="tag-input"
          />
        </div>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Press Enter or comma to add a tag. Click × to remove.
        {maxTags && ` (${tags.length}/${maxTags})`}
      </p>
    </div>
  );
}
