import { User } from "@/lib/api";
import { useState } from "react";

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
  onBatchDeactivate: (userIds: number[]) => void;
  onBatchActivate: (userIds: number[]) => void;
  onBatchDelete: (userIds: number[]) => void;
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
  onBatchDeactivate,
  onBatchActivate,
  onBatchDelete,
}: AdminUsersProps) {
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [showBatchConfirm, setShowBatchConfirm] = useState<{
    action: "deactivate" | "activate" | "delete";
    userIds: number[];
  } | null>(null);

  const handleSelectUser = (userId: number, checked: boolean) => {
    if (checked) {
      setSelectedUsers((prev) => [...prev, userId]);
    } else {
      setSelectedUsers((prev) => prev.filter((id) => id !== userId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(users.map((user) => user.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleBatchAction = (action: "deactivate" | "activate" | "delete") => {
    if (selectedUsers.length === 0) return;

    setShowBatchConfirm({ action, userIds: selectedUsers });
  };

  const confirmBatchAction = () => {
    if (!showBatchConfirm) return;

    const { action, userIds } = showBatchConfirm;
    switch (action) {
      case "deactivate":
        onBatchDeactivate(userIds);
        break;
      case "activate":
        onBatchActivate(userIds);
        break;
      case "delete":
        onBatchDelete(userIds);
        break;
    }

    setSelectedUsers([]);
    setShowBatchConfirm(null);
  };

  const selectedActiveUsers = users.filter(
    (user) => selectedUsers.includes(user.id) && user.is_active
  );
  const selectedInactiveUsers = users.filter(
    (user) => selectedUsers.includes(user.id) && !user.is_active
  );

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

      {/* Batch Actions Bar */}
      {selectedUsers.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
              {selectedUsers.length} user{selectedUsers.length === 1 ? "" : "s"}{" "}
              selected
            </span>
            <div className="flex space-x-2">
              {selectedInactiveUsers.length > 0 && (
                <button
                  onClick={() => handleBatchAction("activate")}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-sm font-medium"
                >
                  Activate ({selectedInactiveUsers.length})
                </button>
              )}
              {selectedActiveUsers.length > 0 && (
                <button
                  onClick={() => handleBatchAction("deactivate")}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded-md text-sm font-medium"
                >
                  Deactivate ({selectedActiveUsers.length})
                </button>
              )}
              <button
                onClick={() => handleBatchAction("delete")}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-sm font-medium"
              >
                Delete ({selectedUsers.length})
              </button>
              <button
                onClick={() => setSelectedUsers([])}
                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded-md text-sm font-medium"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Confirmation Modal */}
      {showBatchConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <div className="flex items-center">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20">
                  <svg
                    className="h-6 w-6 text-red-600 dark:text-red-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 18.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
              </div>
              <div className="mt-2 px-7 py-3">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Confirm Batch{" "}
                  {showBatchConfirm.action === "delete"
                    ? "Deletion"
                    : showBatchConfirm.action === "activate"
                      ? "Activation"
                      : "Deactivation"}
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Are you sure you want to {showBatchConfirm.action}{" "}
                  {showBatchConfirm.userIds.length} user
                  {showBatchConfirm.userIds.length === 1 ? "" : "s"}?
                  {showBatchConfirm.action === "delete" && (
                    <span className="block mt-1 font-medium text-red-600 dark:text-red-400">
                      This action cannot be undone.
                    </span>
                  )}
                </p>
              </div>
              <div className="items-center px-4 py-3">
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowBatchConfirm(null)}
                    className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmBatchAction}
                    className={`px-4 py-2 text-white text-base font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 ${
                      showBatchConfirm.action === "delete"
                        ? "bg-red-600 hover:bg-red-700 focus:ring-red-300"
                        : showBatchConfirm.action === "activate"
                          ? "bg-green-600 hover:bg-green-700 focus:ring-green-300"
                          : "bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-300"
                    }`}
                  >
                    {showBatchConfirm.action === "delete"
                      ? "Delete"
                      : showBatchConfirm.action === "activate"
                        ? "Activate"
                        : "Deactivate"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={
                        selectedUsers.length === users.length &&
                        users.length > 0
                      }
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                  </th>
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={(e) =>
                          handleSelectUser(user.id, e.target.checked)
                        }
                        disabled={user.role === "admin"} // Prevent selecting admin users for safety
                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 disabled:opacity-50"
                      />
                    </td>
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
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={(e) =>
                        handleSelectUser(user.id, e.target.checked)
                      }
                      disabled={user.role === "admin"} // Prevent selecting admin users for safety
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 disabled:opacity-50 mt-1"
                    />
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        {user.first_name} {user.last_name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 break-all">
                        {user.email}
                      </p>
                    </div>
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
