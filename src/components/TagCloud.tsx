import { Tag } from "@/lib/api";

interface Props {
  tags: Tag[];
  selectedTags: string[];
  onTagClick: (tagName: string) => void;
}

export default function TagCloud({ tags, selectedTags, onTagClick }: Props) {
  const getTagSize = (count: number, maxCount: number) => {
    const ratio = count / maxCount;
    if (ratio > 0.8) return "text-lg";
    if (ratio > 0.5) return "text-base";
    if (ratio > 0.2) return "text-sm";
    return "text-xs";
  };

  const maxCount = Math.max(...tags.map(tag => tag.count));

  if (tags.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Tags</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm">No tags available</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Tags</h3>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const isSelected = selectedTags.includes(tag.name);
          return (
            <button
              key={tag.name}
              onClick={() => onTagClick(tag.name)}
              className={`
                inline-flex items-center px-2.5 py-1.5 rounded-full font-medium transition-colors
                ${getTagSize(tag.count, maxCount)}
                ${
                  isSelected
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 ring-2 ring-blue-500"
                    : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }
              `}
            >
              {tag.name}
              {tag.count > 0 && (
                <span className="ml-1 text-xs opacity-75">
                  {tag.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}