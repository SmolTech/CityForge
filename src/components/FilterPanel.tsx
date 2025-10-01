interface Props {
  showFeaturedOnly: boolean;
  onFeaturedChange: (featured: boolean) => void;
  selectedTags: string[];
  onTagRemove: (tag: string) => void;
}

export default function FilterPanel({
  showFeaturedOnly,
  onFeaturedChange,
  selectedTags,
  onTagRemove,
}: Props) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h3>

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
                className="inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              >
                {tag}
                <button
                  onClick={() => onTagRemove(tag)}
                  className="flex-shrink-0 ml-1.5 h-4 w-4 rounded-full inline-flex items-center justify-center text-blue-400 hover:bg-blue-200 hover:text-blue-500 focus:outline-none focus:bg-blue-500 focus:text-white"
                >
                  <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                    <path strokeLinecap="round" strokeWidth="1.5" d="m1 1 6 6m0-6L1 7" />
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
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Clear All Filters
        </button>
      )}
    </div>
  );
}