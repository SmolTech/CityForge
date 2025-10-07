interface Props {
  showFeaturedOnly: boolean;
  onFeaturedChange: (featured: boolean) => void;
  selectedTags: string[];
  onTagRemove: (tag: string) => void;
  tagFilterMode: "and" | "or";
  onTagFilterModeChange: (mode: "and" | "or") => void;
}

export default function FilterPanel({
  showFeaturedOnly,
  onFeaturedChange,
  selectedTags,
  onTagRemove,
  tagFilterMode,
  onTagFilterModeChange,
}: Props) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-5 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Filters
      </h3>

      {/* Featured Filter */}
      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={showFeaturedOnly}
            onChange={(e) => onFeaturedChange(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
          />
          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
            Featured only
          </span>
        </label>
      </div>

      {/* Tag Filter Mode */}
      {selectedTags.length > 1 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tag Match
          </label>
          <div className="flex rounded-lg border border-gray-200 dark:border-slate-600 overflow-hidden">
            <button
              onClick={() => onTagFilterModeChange("and")}
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                tagFilterMode === "and"
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600"
              }`}
            >
              Match All (AND)
            </button>
            <button
              onClick={() => onTagFilterModeChange("or")}
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors border-l border-gray-200 dark:border-slate-600 ${
                tagFilterMode === "or"
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600"
              }`}
            >
              Match Any (OR)
            </button>
          </div>
        </div>
      )}

      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Selected Tags
          </label>
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
              >
                {tag}
                <button
                  onClick={() => onTagRemove(tag)}
                  className="flex-shrink-0 ml-1.5 h-4 w-4 rounded-full inline-flex items-center justify-center text-blue-400 hover:bg-blue-200 hover:text-blue-500 focus:outline-none focus:bg-blue-500 focus:text-white"
                >
                  <svg
                    className="h-2 w-2"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 8 8"
                  >
                    <path
                      strokeLinecap="round"
                      strokeWidth="1.5"
                      d="m1 1 6 6m0-6L1 7"
                    />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Clear All Filters */}
      {(showFeaturedOnly || selectedTags.length > 0) && (
        <button
          onClick={() => {
            onFeaturedChange(false);
            selectedTags.forEach(onTagRemove);
          }}
          className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
        >
          Clear All Filters
        </button>
      )}
    </div>
  );
}
