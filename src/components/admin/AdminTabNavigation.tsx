import Link from "next/link";

type ActiveTab =
  | "pending"
  | "cards"
  | "modifications"
  | "submissions"
  | "users"
  | "tags"
  | "resources"
  | "reviews";

interface AdminTabNavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  submissions: Array<{ status: string }>;
  modifications: Array<{ status: string }>;
  reviews: Array<{ reported: boolean }>;
}

export function AdminTabNavigation({
  activeTab,
  setActiveTab,
  submissions,
  modifications,
  reviews,
}: AdminTabNavigationProps) {
  const getTabClass = (tab: ActiveTab) =>
    `py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
      activeTab === tab
        ? "border-blue-500 text-blue-600 dark:text-blue-400"
        : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
    }`;

  return (
    <>
      {/* Quick Access - Classifieds */}
      <div className="mb-6">
        <Link
          href="/admin/classifieds"
          className="block bg-gradient-to-r from-red-500 to-orange-500 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-10 w-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-xl font-bold text-white">
                  Classifieds Reports
                </h3>
                <p className="text-white text-opacity-90 text-sm">
                  Review and moderate classified posts and reports
                </p>
              </div>
            </div>
            <div className="flex-shrink-0">
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </div>
        </Link>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <nav className="flex space-x-4 sm:space-x-8 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            onClick={() => setActiveTab("pending")}
            className={getTabClass("pending")}
          >
            Pending Submissions (
            {submissions.filter((s) => s.status === "pending").length})
          </button>
          <button
            onClick={() => setActiveTab("submissions")}
            className={getTabClass("submissions")}
          >
            All Submissions
          </button>
          <button
            onClick={() => setActiveTab("modifications")}
            className={getTabClass("modifications")}
          >
            Modifications (
            {modifications.filter((m) => m.status === "pending").length})
          </button>
          <button
            onClick={() => setActiveTab("cards")}
            className={getTabClass("cards")}
          >
            Published Cards
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={getTabClass("users")}
          >
            Users
          </button>
          <button
            onClick={() => setActiveTab("tags")}
            className={getTabClass("tags")}
          >
            Tags
          </button>
          <button
            onClick={() => setActiveTab("reviews")}
            className={getTabClass("reviews")}
          >
            Reviews
            {reviews.filter((r) => r.reported).length > 0 && (
              <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                {reviews.filter((r) => r.reported).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("resources")}
            className={getTabClass("resources")}
          >
            Resources
          </button>
        </nav>
      </div>
    </>
  );
}
