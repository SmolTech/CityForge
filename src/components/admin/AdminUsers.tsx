import { User } from "@/lib/api";

interface AdminUsersProps {
  users: User[];
  searchQuery: string;
  currentPage: number;
  totalUsers: number;
  onSearchQueryChange: (query: string) => void;
  onLoadUsers: () => void;
  onSetCurrentPage: (page: number) => void;
  onSetEditingUser: (user: User) => void;
  onSetShowPasswordReset: (user: User) => void;
  onSetDeletingUser: (user: User) => void;
}

export default function AdminUsers({
  users,
  searchQuery,
  currentPage,
  totalUsers,
  onSearchQueryChange,
  onLoadUsers,
  onSetCurrentPage,
  onSetEditingUser,
  onSetShowPasswordReset,
  onSetDeletingUser,
}: AdminUsersProps) {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Users
        </h2>
        <div className="flex space-x-4">
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <button
            onClick={onLoadUsers}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Search
          </button>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No users found
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            No users match your search criteria.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider max-w-[200px]">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    IP Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider min-w-[200px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {user.first_name} {user.last_name}
                    </td>
                    <td
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 max-w-[200px] truncate"
                      title={user.email}
                    >
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.role === "admin"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.is_active
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                        }`}
                      >
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(user.created_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                      {user.registration_ip_address || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium min-w-[200px]">
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
                        <button
                          onClick={() => onSetEditingUser(user)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 text-left"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onSetShowPasswordReset(user)}
                          className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 text-left"
                        >
                          Reset Password
                        </button>
                        <button
                          onClick={() => onSetDeletingUser(user)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 text-left"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {users.map((user) => (
              <div
                key={user.id}
                className="bg-white dark:bg-gray-700 shadow rounded-lg p-4 border border-gray-200 dark:border-gray-600"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      {user.first_name} {user.last_name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 break-all">
                      {user.email}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.role === "admin"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                      }`}
                    >
                      {user.role}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.is_active
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      }`}
                    >
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 space-y-1">
                  <div>
                    Joined {new Date(user.created_date).toLocaleDateString()}
                  </div>
                  {user.registration_ip_address && (
                    <div className="font-mono">
                      IP: {user.registration_ip_address}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => onSetEditingUser(user)}
                    className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 px-3 py-1 rounded text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onSetShowPasswordReset(user)}
                    className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 px-3 py-1 rounded text-sm font-medium"
                  >
                    Reset Password
                  </button>
                  <button
                    onClick={() => onSetDeletingUser(user)}
                    className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 px-3 py-1 rounded text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalUsers > 20 && (
            <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 sm:px-6 mt-4">
              <div className="flex flex-1 justify-between sm:hidden">
                <button
                  onClick={() => onSetCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Previous
                </button>
                <button
                  onClick={() => onSetCurrentPage(currentPage + 1)}
                  disabled={currentPage * 20 >= totalUsers}
                  className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Showing{" "}
                    <span className="font-medium">
                      {(currentPage - 1) * 20 + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-medium">
                      {Math.min(currentPage * 20, totalUsers)}
                    </span>{" "}
                    of <span className="font-medium">{totalUsers}</span> results
                  </p>
                </div>
                <div>
                  <nav
                    className="isolate inline-flex -space-x-px rounded-md shadow-sm"
                    aria-label="Pagination"
                  >
                    <button
                      onClick={() =>
                        onSetCurrentPage(Math.max(1, currentPage - 1))
                      }
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-20 focus:outline-offset-0"
                    >
                      Previous
                    </button>
                    <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 ring-1 ring-inset ring-gray-300 dark:ring-gray-600">
                      Page {currentPage}
                    </span>
                    <button
                      onClick={() => onSetCurrentPage(currentPage + 1)}
                      disabled={currentPage * 20 >= totalUsers}
                      className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-20 focus:outline-offset-0"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
