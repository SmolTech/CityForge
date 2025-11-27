interface AdminStatsCardsProps {
  stats: {
    pendingSubmissions: number;
    pendingModifications: number;
    reportedReviews: number;
    totalCards: number;
    totalUsers: number;
    totalTags: number;
  };
}

export function AdminStatsCards({ stats }: AdminStatsCardsProps) {
  return (
    <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg shadow p-4 border border-purple-200 dark:border-purple-700">
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <svg
              className="h-6 w-6 text-purple-600 dark:text-purple-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
            {stats.totalCards}
          </p>
          <p className="text-xs font-medium text-purple-700 dark:text-purple-300">
            Total Cards
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 rounded-lg shadow p-4 border border-amber-200 dark:border-amber-700">
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <svg
              className="h-6 w-6 text-amber-600 dark:text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
            {stats.pendingSubmissions}
          </p>
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
            Pending Submissions
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg shadow p-4 border border-blue-200 dark:border-blue-700">
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <svg
              className="h-6 w-6 text-blue-600 dark:text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </div>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
            {stats.pendingModifications}
          </p>
          <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
            Pending Edits
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-lg shadow p-4 border border-red-200 dark:border-red-700">
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <svg
              className="h-6 w-6 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
              />
            </svg>
          </div>
          <p className="text-2xl font-bold text-red-900 dark:text-red-100">
            {stats.reportedReviews}
          </p>
          <p className="text-xs font-medium text-red-700 dark:text-red-300">
            Reported Reviews
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 rounded-lg shadow p-4 border border-indigo-200 dark:border-indigo-700">
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <svg
              className="h-6 w-6 text-indigo-600 dark:text-indigo-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </div>
          <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">
            {stats.totalUsers}
          </p>
          <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
            Total Users
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 rounded-lg shadow p-4 border border-pink-200 dark:border-pink-700">
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <svg
              className="h-6 w-6 text-pink-600 dark:text-pink-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
          </div>
          <p className="text-2xl font-bold text-pink-900 dark:text-pink-100">
            {stats.totalTags}
          </p>
          <p className="text-xs font-medium text-pink-700 dark:text-pink-300">
            Total Tags
          </p>
        </div>
      </div>
    </div>
  );
}
