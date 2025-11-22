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

  const maxCount = Math.max(...tags.map((tag) => tag.count));

  if (tags.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Tags
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          No tags available
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-5">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
        Tags
      </h3>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const isSelected = selectedTags.includes(tag.name);
          return (
            <button
              key={tag.name}
              onClick={() => onTagClick(tag.name)}
              data-testid={`tag-${tag.name}`}
              className={`
                inline-flex items-center px-3 py-1.5 rounded-full font-medium transition-all duration-200
                ${getTagSize(tag.count, maxCount)}
                ${
                  isSelected
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-2 border-blue-500 dark:border-blue-600 shadow-md"
                    : "bg-gray-50 text-gray-700 dark:bg-slate-700 dark:text-gray-300 border border-gray-200 dark:border-slate-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm"
                }
              `}
            >
              {tag.name}
              {tag.count > 0 && (
                <span className="ml-1 text-xs opacity-75">{tag.count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
